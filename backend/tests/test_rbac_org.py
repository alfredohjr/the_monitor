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


def make_user(session: Session, username: str) -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(user: User):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def test_creator_membership_is_admin(client: TestClient, session: Session):
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
    assert membership.role == "admin"


def test_org_name_must_be_unique(client: TestClient, session: Session):
    alice = make_user(session, "alice")
    bob = make_user(session, "bob")

    r1 = client.post("/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(alice))
    assert r1.status_code == 201

    r2 = client.post("/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(bob))
    assert r2.status_code == 400
    assert "nome" in r2.json()["detail"].lower() or "já" in r2.json()["detail"].lower()


def test_membership_role_defaults_to_user(session: Session):
    # Uma associação criada sem papel explícito é 'user' (papel de menor privilégio).
    user = make_user(session, "u")
    m = Membership(user_id=user.id, organization_id=1)
    session.add(m)
    session.commit()
    session.refresh(m)
    assert m.role == "user"
