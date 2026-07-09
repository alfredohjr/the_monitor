import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Membership
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


def make_user(session, username):
    u = User(username=username, hashed_password=hash_password("secret"))
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def make_admin_with_org(client, session, username="admin"):
    admin = make_user(session, username)
    resp = client.post("/api/v1/organizations/", json={"nome": f"Org {username}"}, headers=auth(admin))
    return admin, resp.json()["id"]


def test_list_users_requires_admin(client, session):
    admin, org_id = make_admin_with_org(client, session)
    outsider = make_user(session, "estranho")
    resp = client.get(f"/api/v1/organizations/{org_id}/users/", headers=auth(outsider))
    assert resp.status_code == 403


def test_admin_lists_org_users(client, session):
    admin, org_id = make_admin_with_org(client, session)
    resp = client.get(f"/api/v1/organizations/{org_id}/users/", headers=auth(admin))
    assert resp.status_code == 200
    usernames = [u["username"] for u in resp.json()]
    assert "admin" in usernames
    assert any(u["role"] == "admin" for u in resp.json())


def test_admin_creates_user(client, session):
    admin, org_id = make_admin_with_org(client, session)
    resp = client.post(
        f"/api/v1/organizations/{org_id}/users/",
        json={"username": "colab", "password": "senha123"},
        headers=auth(admin),
    )
    assert resp.status_code == 201

    user = session.exec(select(User).where(User.username == "colab")).first()
    assert user is not None
    assert user.email_verified is True  # criado pelo admin, pode logar já

    m = session.exec(
        select(Membership).where(Membership.user_id == user.id, Membership.organization_id == org_id)
    ).first()
    assert m is not None
    assert m.role == "user"

    # consegue logar
    login = client.post("/api/v1/token/", json={"username": "colab", "password": "senha123"})
    assert login.status_code == 200


def test_admin_create_duplicate_username(client, session):
    admin, org_id = make_admin_with_org(client, session)
    make_user(session, "ocupado")
    resp = client.post(
        f"/api/v1/organizations/{org_id}/users/",
        json={"username": "ocupado", "password": "x"},
        headers=auth(admin),
    )
    assert resp.status_code == 400


def test_create_user_requires_admin(client, session):
    admin, org_id = make_admin_with_org(client, session)
    outsider = make_user(session, "estranho")
    resp = client.post(
        f"/api/v1/organizations/{org_id}/users/",
        json={"username": "x", "password": "y"},
        headers=auth(outsider),
    )
    assert resp.status_code == 403


def test_admin_removes_user(client, session):
    admin, org_id = make_admin_with_org(client, session)
    client.post(
        f"/api/v1/organizations/{org_id}/users/",
        json={"username": "colab", "password": "senha123"},
        headers=auth(admin),
    )
    colab = session.exec(select(User).where(User.username == "colab")).first()

    resp = client.delete(f"/api/v1/organizations/{org_id}/users/{colab.id}/", headers=auth(admin))
    assert resp.status_code == 200

    m = session.exec(
        select(Membership).where(Membership.user_id == colab.id, Membership.organization_id == org_id)
    ).first()
    assert m is None


def test_admin_cannot_remove_self(client, session):
    admin, org_id = make_admin_with_org(client, session)
    resp = client.delete(f"/api/v1/organizations/{org_id}/users/{admin.id}/", headers=auth(admin))
    assert resp.status_code == 400


def test_admin_endpoints_unknown_org(client, session):
    admin = make_user(session, "semorg")
    resp = client.get("/api/v1/organizations/999/users/", headers=auth(admin))
    assert resp.status_code in (403, 404)
