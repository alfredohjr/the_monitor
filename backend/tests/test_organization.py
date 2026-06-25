import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Organization, Membership
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


def test_create_organization_requires_auth(client: TestClient):
    resp = client.post("/api/v1/organizations/", json={"nome": "Acme"})
    assert resp.status_code == 403


def test_list_organizations_requires_auth(client: TestClient):
    resp = client.get("/api/v1/organizations/")
    assert resp.status_code == 403


def test_create_organization(client: TestClient, session: Session):
    user = make_user(session, "dono")
    resp = client.post("/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(user))
    assert resp.status_code == 201
    data = resp.json()
    assert data["nome"] == "Acme"
    assert "id" in data


def test_creator_becomes_member(client: TestClient, session: Session):
    user = make_user(session, "dono")
    resp = client.post("/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(user))
    org_id = resp.json()["id"]

    membership = session.exec(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == org_id,
        )
    ).first()
    assert membership is not None


def test_list_returns_only_my_organizations(client: TestClient, session: Session):
    alice = make_user(session, "alice")
    bob = make_user(session, "bob")

    client.post("/api/v1/organizations/", json={"nome": "Alice Org"}, headers=auth(alice))
    client.post("/api/v1/organizations/", json={"nome": "Bob Org"}, headers=auth(bob))

    resp = client.get("/api/v1/organizations/", headers=auth(alice))
    assert resp.status_code == 200
    nomes = [o["nome"] for o in resp.json()]
    assert nomes == ["Alice Org"]


def test_user_can_belong_to_multiple_organizations(client: TestClient, session: Session):
    user = make_user(session, "multi")
    client.post("/api/v1/organizations/", json={"nome": "Org 1"}, headers=auth(user))
    client.post("/api/v1/organizations/", json={"nome": "Org 2"}, headers=auth(user))

    resp = client.get("/api/v1/organizations/", headers=auth(user))
    assert resp.status_code == 200
    assert len(resp.json()) == 2
