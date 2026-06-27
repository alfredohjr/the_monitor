import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Notification
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
    def override():
        return session

    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session: Session, username: str) -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(user: User):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def test_list_notifications_requires_auth(client: TestClient):
    assert client.get("/api/v1/notifications/").status_code == 403


def test_create_notification(client: TestClient, session: Session):
    user = make_user(session, "ana")
    resp = client.post("/api/v1/notifications/", json={"mensagem": "Bem-vindo!"}, headers=auth(user))
    assert resp.status_code == 201
    data = resp.json()
    assert data["mensagem"] == "Bem-vindo!"
    assert data["lida"] is False


def test_list_returns_only_my_notifications_newest_first(client: TestClient, session: Session):
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    client.post("/api/v1/notifications/", json={"mensagem": "primeira"}, headers=auth(ana))
    client.post("/api/v1/notifications/", json={"mensagem": "segunda"}, headers=auth(ana))
    client.post("/api/v1/notifications/", json={"mensagem": "do bob"}, headers=auth(bob))

    resp = client.get("/api/v1/notifications/", headers=auth(ana))
    assert resp.status_code == 200
    msgs = [n["mensagem"] for n in resp.json()]
    assert msgs == ["segunda", "primeira"]  # mais nova primeiro


def test_mark_notification_read(client: TestClient, session: Session):
    user = make_user(session, "ana")
    created = client.post("/api/v1/notifications/", json={"mensagem": "oi"}, headers=auth(user)).json()

    resp = client.post(f"/api/v1/notifications/{created['id']}/read/", headers=auth(user))
    assert resp.status_code == 200
    assert resp.json()["lida"] is True

    n = session.get(Notification, created["id"])
    assert n.lida is True


def test_cannot_mark_other_users_notification(client: TestClient, session: Session):
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    created = client.post("/api/v1/notifications/", json={"mensagem": "da ana"}, headers=auth(ana)).json()

    resp = client.post(f"/api/v1/notifications/{created['id']}/read/", headers=auth(bob))
    assert resp.status_code == 404
