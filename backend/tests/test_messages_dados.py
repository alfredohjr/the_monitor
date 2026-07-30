"""Mensagens de métricas, metas e lançamentos por Accept-Language (#301).

Sempre em par: inglês por padrão, português com header. Um lado só deixaria
passar "esqueci de traduzir" ou "traduzi mas ignorei o header".
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from auth import create_access_token, hash_password
from main import app
from models import Membership, Metric, Organization, User, get_session

PT = {"Accept-Language": "pt-BR"}


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
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


@pytest.fixture(name="dono")
def dono_fixture(session: Session):
    """Usuário com organização — sem ela as rotas param antes no 'sem org'."""
    user = User(username="dono", hashed_password=hash_password("secret"))
    session.add(user)
    org = Organization(nome="Acme")
    session.add(org)
    session.commit()
    session.refresh(user)
    session.refresh(org)
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()
    return user


def auth(user: User, extra: dict | None = None):
    h = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if extra:
        h.update(extra)
    return h


# --- Métricas ---------------------------------------------------------------


def test_metrica_nao_encontrada_nos_dois_idiomas(client, dono):
    r = client.get("/api/v1/metrics/9999/", headers=auth(dono))
    assert r.status_code == 404
    assert r.json()["detail"] == "Metric not found"

    r = client.get("/api/v1/metrics/9999/", headers=auth(dono, PT))
    assert r.json()["detail"] == "Métrica não encontrada"


def test_datas_invalidas_no_progresso_nos_dois_idiomas(client, dono, session: Session):
    org = session.exec(select(Organization)).first()
    m = Metric(codigo="M", nome="M", descricao="d", tipo="number", periodo="daily", organization_id=org.id)
    session.add(m)
    session.commit()
    session.refresh(m)

    # A rota usa `start`/`end` (li a assinatura, não chutei os nomes).
    url = f"/api/v1/metrics/{m.id}/progress?start=xx&end=yy"
    assert client.get(url, headers=auth(dono)).json()["detail"] == "Invalid dates (use YYYY-MM-DD)"
    assert client.get(url, headers=auth(dono, PT)).json()["detail"] == "Datas inválidas (use YYYY-MM-DD)"


# --- Metas ------------------------------------------------------------------


def test_meta_nao_encontrada_nos_dois_idiomas(client, dono):
    r = client.get("/api/v1/goals/9999/", headers=auth(dono))
    assert r.status_code == 404
    assert r.json()["detail"] == "Goal not found"

    r = client.get("/api/v1/goals/9999/", headers=auth(dono, PT))
    assert r.json()["detail"] == "Meta não encontrada"


# --- Lançamentos ------------------------------------------------------------


def test_lancamento_nao_encontrado_nos_dois_idiomas(client, dono):
    r = client.get("/api/v1/logs/9999/", headers=auth(dono))
    assert r.status_code == 404
    assert r.json()["detail"] == "Entry not found"

    r = client.get("/api/v1/logs/9999/", headers=auth(dono, PT))
    assert r.json()["detail"] == "Lançamento não encontrado"


# --- Notificações -----------------------------------------------------------


def test_notificacao_nao_encontrada_nos_dois_idiomas(client, dono):
    r = client.post("/api/v1/notifications/9999/read/", headers=auth(dono))
    assert r.status_code == 404
    assert r.json()["detail"] == "Notification not found"

    r = client.post("/api/v1/notifications/9999/read/", headers=auth(dono, PT))
    assert r.json()["detail"] == "Notificação não encontrada"
