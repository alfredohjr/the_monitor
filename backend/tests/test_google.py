import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

import main
from main import app
from models import get_session, User
from auth import hash_password


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


def fake_verify(email):
    return lambda token: {"email": email, "email_verified": True}


def test_google_login_creates_new_user(client, session, monkeypatch):
    monkeypatch.setattr(main, "verify_google_token", fake_verify("novo@gmail.com"), raising=False)
    resp = client.post("/api/v1/auth/google/", json={"credential": "fake-token"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access" in data and "refresh" in data

    user = session.exec(select(User).where(User.email == "novo@gmail.com")).first()
    assert user is not None


def test_google_login_links_existing_user(client, session, monkeypatch):
    session.add(User(username="alfredo", email="a@gmail.com", hashed_password=hash_password("x")))
    session.commit()

    monkeypatch.setattr(main, "verify_google_token", fake_verify("a@gmail.com"), raising=False)
    resp = client.post("/api/v1/auth/google/", json={"credential": "fake-token"})
    assert resp.status_code == 200

    users = session.exec(select(User).where(User.email == "a@gmail.com")).all()
    assert len(users) == 1  # logou na conta existente, nao duplicou


def test_google_login_invalid_token(client, monkeypatch):
    def boom(token):
        raise ValueError("token invalido")

    monkeypatch.setattr(main, "verify_google_token", boom, raising=False)
    resp = client.post("/api/v1/auth/google/", json={"credential": "ruim"})
    assert resp.status_code == 401
