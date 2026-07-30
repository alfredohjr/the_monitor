"""Métricas-modelo do catálogo por idioma (#317).

Só as métricas do SISTEMA (is_default) são traduzidas. Métrica criada por
usuário é dado dele e continua exatamente como foi escrita.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from auth import create_access_token, hash_password
from main import app
from models import Membership, Metric, Organization, User, get_session
from seed import seed_metricas_padrao

PT = {"Accept-Language": "pt-BR"}


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    app.dependency_overrides[get_session] = lambda: session
    cliente = TestClient(app)
    yield cliente
    app.dependency_overrides.clear()


@pytest.fixture(name="user")
def user_fixture(session: Session):
    u = User(username="ana", hashed_password=hash_password("x"))
    org = Organization(nome="Acme")
    session.add(u)
    session.add(org)
    session.commit()
    session.refresh(u)
    session.refresh(org)
    session.add(Membership(user_id=u.id, organization_id=org.id, role="admin"))
    session.commit()
    return u


def auth(u: User, extra: dict | None = None):
    h = {"Authorization": f"Bearer {create_access_token(u.username)}"}
    if extra:
        h.update(extra)
    return h


def _catalogo(client, u, headers=None):
    r = client.get("/api/v1/metrics/", headers=auth(u, headers))
    assert r.status_code == 200
    return {m["codigo"]: m for m in r.json() if m["is_default"]}


def test_semeia_os_dois_idiomas(session: Session):
    seed_metricas_padrao(session)
    m = session.exec(select(Metric).where(Metric.codigo == "PAD_RECEITA_DIARIA")).first()
    assert m.nome == "Receita do Dia"
    assert m.nome_en == "Daily Revenue"
    assert m.descricao_en


def test_catalogo_em_ingles_por_padrao(client, session: Session, user):
    seed_metricas_padrao(session)
    cat = _catalogo(client, user)
    assert cat["PAD_RECEITA_DIARIA"]["nome"] == "Daily Revenue"
    assert cat["PAD_HORAS_ESTUDO"]["nome"] == "Study Hours"


def test_catalogo_em_portugues_com_header(client, session: Session, user):
    seed_metricas_padrao(session)
    cat = _catalogo(client, user, PT)
    assert cat["PAD_RECEITA_DIARIA"]["nome"] == "Receita do Dia"
    assert cat["PAD_HORAS_ESTUDO"]["nome"] == "Horas Estudadas"


def test_metrica_do_usuario_nao_e_traduzida(client, session: Session, user):
    """Dado do usuário não se traduz — nem que pareça português."""
    org = session.exec(select(Organization)).first()
    session.add(Metric(
        codigo="MINHA", nome="Vendas da Loja", descricao="Minha métrica",
        tipo="number", periodo="daily", organization_id=org.id,
    ))
    session.commit()

    r = client.get("/api/v1/metrics/", headers=auth(user))
    minha = next(m for m in r.json() if m["codigo"] == "MINHA")
    assert minha["nome"] == "Vendas da Loja"


def test_traducao_nao_persiste_no_banco(client, session: Session, user):
    """A rota troca o texto NA RESPOSTA, não no registro. Se persistisse, uma
    leitura em inglês apagaria o português do banco para sempre."""
    seed_metricas_padrao(session)
    client.get("/api/v1/metrics/", headers=auth(user))          # lê em inglês
    session.expire_all()
    m = session.exec(select(Metric).where(Metric.codigo == "PAD_RECEITA_DIARIA")).first()
    assert m.nome == "Receita do Dia", "a leitura em inglês sobrescreveu o dado"


def test_sem_traducao_cai_no_nome_original(client, session: Session, user):
    """Métrica de sistema sem nome_en preenchido não pode sumir da tela."""
    session.add(Metric(
        codigo="PAD_SEM_EN", nome="Só em Português", descricao="d",
        tipo="number", periodo="daily", is_default=True,
    ))
    session.commit()
    cat = _catalogo(client, user)
    assert cat["PAD_SEM_EN"]["nome"] == "Só em Português"
