"""Catálogo de metas-modelo (GoalTemplate) — seed + listagem (#143)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, GoalTemplate
from auth import hash_password, create_access_token
from seed import seed_goal_templates


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    app.dependency_overrides[get_session] = lambda: session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session, username="ana"):
    u = User(username=username, hashed_password=hash_password("secret"))
    session.add(u); session.commit(); session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def test_seed_cria_templates(session):
    seed_goal_templates(session)
    templates = session.exec(select(GoalTemplate)).all()
    assert len(templates) >= 3
    # cada template aponta para uma métrica de catálogo por código
    assert all(t.metric_codigo.startswith("PAD_") for t in templates)


def test_seed_idempotente(session):
    seed_goal_templates(session)
    seed_goal_templates(session)
    templates = session.exec(select(GoalTemplate)).all()
    assert len(templates) == len(set(t.nome for t in templates))  # sem duplicar por nome


def test_lista_templates_via_endpoint(client, session):
    seed_goal_templates(session)
    user = make_user(session)
    r = client.get("/api/v1/goal-templates/", headers=auth(user))
    assert r.status_code == 200
    nomes = {t["nome"] for t in r.json()}
    assert "Meta de leitura" in nomes
    # expõe alvo sugerido e estratégia para pré-preencher o import
    leitura = next(t for t in r.json() if t["nome"] == "Meta de leitura")
    assert leitura["alvo_sugerido"] and leitura["estrategia"]


def test_endpoint_exige_auth(client, session):
    assert client.get("/api/v1/goal-templates/").status_code == 403
