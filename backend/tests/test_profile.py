import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User
from auth import hash_password, create_access_token


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
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session, username="alguem", **extra):
    u = User(username=username, hashed_password=hash_password("secret"), **extra)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


# --- leitura: /me expõe display_name ---

def test_me_inclui_display_name_none_por_padrao(client, session):
    user = make_user(session)
    resp = client.get("/api/v1/me/", headers=auth(user))
    assert resp.status_code == 200
    assert "display_name" in resp.json()
    assert resp.json()["display_name"] is None


def test_me_inclui_display_name_definido(client, session):
    user = make_user(session, display_name="Alfredo")
    resp = client.get("/api/v1/me/", headers=auth(user))
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Alfredo"


# --- edição: PATCH /me ---

def test_patch_me_define_display_name(client, session):
    user = make_user(session)
    resp = client.patch("/api/v1/me/", json={"display_name": "Alfredo Junior"}, headers=auth(user))
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Alfredo Junior"

    session.refresh(user)
    assert user.display_name == "Alfredo Junior"


def test_patch_me_faz_trim(client, session):
    user = make_user(session)
    resp = client.patch("/api/v1/me/", json={"display_name": "  Fulano  "}, headers=auth(user))
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Fulano"


def test_patch_me_nome_vazio_recusado(client, session):
    user = make_user(session)
    resp = client.patch("/api/v1/me/", json={"display_name": "   "}, headers=auth(user))
    assert resp.status_code == 400
    session.refresh(user)
    assert user.display_name is None


def test_patch_me_exige_autenticacao(client, session):
    # Sem header Authorization o HTTPBearer do projeto responde 403 (não 401).
    resp = client.patch("/api/v1/me/", json={"display_name": "X"})
    assert resp.status_code == 403
