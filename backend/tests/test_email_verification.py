from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, EmailVerificationToken
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


def token_for(session, username):
    return session.exec(
        select(EmailVerificationToken)
        .join(User, User.id == EmailVerificationToken.user_id)
        .where(User.username == username)
    ).first()


def test_register_with_email_creates_unverified_user_and_token(client, session):
    resp = client.post(
        "/api/v1/register/",
        json={"username": "ana", "password": "senha123", "email": "ana@example.com", "organizacao": "Ana Org", "codigo_organizacao": "k"},
    )
    assert resp.status_code == 201

    user = session.exec(select(User).where(User.username == "ana")).first()
    assert user.email_verified is False

    tok = token_for(session, "ana")
    assert tok is not None
    assert tok.used_at is None
    # expira no futuro (~24h)
    assert tok.expires_at > datetime.utcnow()


def test_login_blocked_until_email_verified(client, session):
    client.post(
        "/api/v1/register/",
        json={"username": "bia", "password": "senha123", "email": "bia@example.com", "organizacao": "Bia Org", "codigo_organizacao": "k"},
    )
    resp = client.post("/api/v1/token/", json={"username": "bia", "password": "senha123"})
    assert resp.status_code == 403
    assert "verific" in resp.json()["detail"].lower()


def test_verify_email_then_login_works(client, session):
    client.post(
        "/api/v1/register/",
        json={"username": "caio", "password": "senha123", "email": "caio@example.com", "organizacao": "Caio Org", "codigo_organizacao": "k"},
    )
    tok = token_for(session, "caio")

    v = client.post("/api/v1/verify-email/", json={"token": tok.token})
    assert v.status_code == 200

    session.expire_all()
    user = session.exec(select(User).where(User.username == "caio")).first()
    assert user.email_verified is True

    login = client.post("/api/v1/token/", json={"username": "caio", "password": "senha123"})
    assert login.status_code == 200


def test_verify_email_expired_token(client, session):
    client.post(
        "/api/v1/register/",
        json={"username": "dora", "password": "senha123", "email": "dora@example.com", "organizacao": "Dora Org", "codigo_organizacao": "k"},
    )
    tok = token_for(session, "dora")
    tok.expires_at = datetime.utcnow() - timedelta(hours=1)
    session.add(tok)
    session.commit()

    v = client.post("/api/v1/verify-email/", json={"token": tok.token})
    assert v.status_code == 400


def test_verify_email_unknown_token(client):
    v = client.post("/api/v1/verify-email/", json={"token": "nao-existe"})
    assert v.status_code == 400


def test_verify_email_token_cannot_be_reused(client, session):
    client.post(
        "/api/v1/register/",
        json={"username": "edu", "password": "senha123", "email": "edu@example.com", "organizacao": "Edu Org", "codigo_organizacao": "k"},
    )
    tok = token_for(session, "edu")
    assert client.post("/api/v1/verify-email/", json={"token": tok.token}).status_code == 200
    # segunda vez falha
    assert client.post("/api/v1/verify-email/", json={"token": tok.token}).status_code == 400


def test_user_without_email_can_login(client, session):
    # cadastro sem e-mail não exige verificação
    client.post("/api/v1/register/", json={"username": "sem", "password": "senha123", "organizacao": "Sem Org", "codigo_organizacao": "k"})
    login = client.post("/api/v1/token/", json={"username": "sem", "password": "senha123"})
    assert login.status_code == 200


def test_me_endpoint(client, session):
    user = User(username="fred", hashed_password=hash_password("secret"), email="fred@x.com", email_verified=True)
    session.add(user)
    session.commit()

    headers = {"Authorization": f"Bearer {create_access_token('fred')}"}
    resp = client.get("/api/v1/me/", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "fred"
    assert data["email_verified"] is True
    assert data["role"] == "user"  # sem organização admin → menor privilégio


def test_me_reflects_admin_role(client, session):
    user = User(username="gina", hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    headers = {"Authorization": f"Bearer {create_access_token('gina')}"}
    client.post("/api/v1/organizations/", json={"nome": "Gina Org"}, headers=headers)

    resp = client.get("/api/v1/me/", headers=headers)
    assert resp.json()["role"] == "admin"
