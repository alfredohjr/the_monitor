from pathlib import Path

from alembic.config import Config
from alembic import command

BACKEND_DIR = Path(__file__).resolve().parent


def run_migrations() -> None:
    """Aplica as migrations pendentes (alembic upgrade head).

    Chamado no startup do app para manter o schema do banco em dia.
    """
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(cfg, "head")
