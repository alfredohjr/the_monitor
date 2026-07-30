import sqlite3
from pathlib import Path

from alembic.config import Config
from alembic import command

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _run_migrations(db_path: Path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")


def test_migrations_create_all_tables(tmp_path, monkeypatch):
    db = tmp_path / "mig.db"
    _run_migrations(db, monkeypatch)

    con = sqlite3.connect(db)
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    esperadas = {"user", "organization", "membership", "metric", "goal", "logentry", "notification"}
    assert esperadas <= tables


def test_migrations_user_has_email_column(tmp_path, monkeypatch):
    # Regressão: o login quebrava (500 mascarado de CORS) porque a tabela user
    # nao tinha a coluna email apos a #17. As migrations devem garantir ela.
    db = tmp_path / "mig.db"
    _run_migrations(db, monkeypatch)

    con = sqlite3.connect(db)
    user_cols = {r[1] for r in con.execute("PRAGMA table_info(user)")}
    assert "email" in user_cols


def test_migrations_are_in_sync_with_models(tmp_path, monkeypatch):
    # Garante que nao ha diferenca entre os models e as migrations aplicadas
    # (ou seja, alguem mudou um model e esqueceu de gerar a migration).
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from sqlalchemy import create_engine
    from sqlmodel import SQLModel
    import models  # noqa: F401  registra todos os models

    db = tmp_path / "sync.db"
    _run_migrations(db, monkeypatch)

    engine = create_engine(f"sqlite:///{db}")
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        diff = compare_metadata(ctx, SQLModel.metadata)
    assert diff == [], f"Models fora de sincronia com as migrations: {diff}"


def test_locale_em_tabela_com_dados(tmp_path, monkeypatch):
    """A migration do #304 acrescenta uma coluna NOT NULL numa tabela que já tem
    linhas — o cenário que o `server_default` existe para cobrir.

    O teste de upgrade do zero não pega isso: sem linhas, NOT NULL sem default
    passa liso. Em produção, com usuários cadastrados, quebraria.
    """
    import sqlalchemy as sa

    db = tmp_path / "com_dados.db"
    url = f"sqlite:///{db}"
    monkeypatch.setenv("DATABASE_URL", url)
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    # Sobe até a revisão ANTERIOR ao locale e insere um usuário.
    command.upgrade(cfg, "b4c5d6e7f8a9")
    engine = sa.create_engine(url)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO user (username, hashed_password, email_verified) "
                "VALUES ('antigo', 'x', 0)"
            )
        )

    # Agora aplica a migration do locale por cima dos dados existentes.
    command.upgrade(cfg, "head")

    with engine.connect() as conn:
        locale = conn.execute(sa.text("SELECT locale FROM user WHERE username='antigo'")).scalar()
    assert locale == "en", "usuário pré-existente devia herdar o padrão do app"
