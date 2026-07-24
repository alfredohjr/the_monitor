import datetime
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

import email_service
from main import app
from models import get_session, User, EmailVerificationToken, PasswordResetToken
from auth import hash_password, verify_password


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
def client_fixture(session: Session, monkeypatch):
    # Não toca a rede: captura os e-mails "enviados".
    enviados = []
    monkeypatch.setattr(email_service, "send_email", lambda *a, **k: enviados.append(a) or True)
    app.dependency_overrides[get_session] = lambda: session
    client = TestClient(app)
    client.enviados = enviados
    yield client
    app.dependency_overrides.clear()


def make_user(session, username="ana", email="ana@x.com", senha="antiga123", verified=True):
    u = User(username=username, email=email, hashed_password=hash_password(senha), email_verified=verified)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


# --- request: 'esqueci minha senha' ---

def test_request_email_inexistente_responde_200_sem_token(client, session):
    resp = client.post("/api/v1/password-reset/request/", json={"email": "naoexiste@x.com"})
    assert resp.status_code == 200  # não vaza cadastro
    assert session.exec(select(PasswordResetToken)).first() is None
    assert client.enviados == []


def test_request_email_existente_cria_token_e_envia(client, session):
    make_user(session)
    resp = client.post("/api/v1/password-reset/request/", json={"email": "ana@x.com"})
    assert resp.status_code == 200
    tok = session.exec(select(PasswordResetToken)).first()
    assert tok is not None and tok.used_at is None
    # expiração ~1h
    delta = tok.expires_at - datetime.datetime.utcnow()
    assert datetime.timedelta(minutes=50) < delta < datetime.timedelta(minutes=70)
    assert len(client.enviados) == 1


# --- confirm: redefinir a senha ---

def _token_para(session, user, **over):
    import secrets
    tok = PasswordResetToken(
        user_id=user.id,
        token=over.get("token", secrets.token_urlsafe(16)),
        expires_at=over.get("expires_at", datetime.datetime.utcnow() + datetime.timedelta(hours=1)),
        used_at=over.get("used_at"),
    )
    session.add(tok)
    session.commit()
    session.refresh(tok)
    return tok


def test_confirm_troca_a_senha(client, session):
    user = make_user(session)
    tok = _token_para(session, user)
    resp = client.post("/api/v1/password-reset/confirm/", json={"token": tok.token, "password": "novaSenha1"})
    assert resp.status_code == 200
    session.refresh(user)
    assert verify_password("novaSenha1", user.hashed_password)
    assert not verify_password("antiga123", user.hashed_password)


def test_confirm_token_e_uso_unico(client, session):
    user = make_user(session)
    tok = _token_para(session, user)
    client.post("/api/v1/password-reset/confirm/", json={"token": tok.token, "password": "novaSenha1"})
    # segunda vez falha
    resp = client.post("/api/v1/password-reset/confirm/", json={"token": tok.token, "password": "outra12345"})
    assert resp.status_code == 400


def test_confirm_token_expirado(client, session):
    user = make_user(session)
    tok = _token_para(session, user, expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=1))
    resp = client.post("/api/v1/password-reset/confirm/", json={"token": tok.token, "password": "novaSenha1"})
    assert resp.status_code == 400


def test_confirm_token_invalido(client, session):
    resp = client.post("/api/v1/password-reset/confirm/", json={"token": "nao-existe", "password": "novaSenha1"})
    assert resp.status_code == 400


def test_confirm_senha_curta_recusada(client, session):
    user = make_user(session)
    tok = _token_para(session, user)
    resp = client.post("/api/v1/password-reset/confirm/", json={"token": tok.token, "password": "123"})
    assert resp.status_code == 400
    session.refresh(user)
    assert verify_password("antiga123", user.hashed_password)  # inalterada


# --- reenvio de verificação ---

def test_resend_verificacao_nao_verificado_envia(client, session):
    make_user(session, email="novo@x.com", verified=False)
    resp = client.post("/api/v1/verify-email/resend/", json={"email": "novo@x.com"})
    assert resp.status_code == 200
    assert session.exec(select(EmailVerificationToken)).first() is not None
    assert len(client.enviados) == 1


def test_resend_ja_verificado_nao_envia(client, session):
    make_user(session, email="ok@x.com", verified=True)
    resp = client.post("/api/v1/verify-email/resend/", json={"email": "ok@x.com"})
    assert resp.status_code == 200  # resposta genérica
    assert session.exec(select(EmailVerificationToken)).first() is None
    assert client.enviados == []


def test_resend_email_inexistente_responde_200(client, session):
    resp = client.post("/api/v1/verify-email/resend/", json={"email": "ninguem@x.com"})
    assert resp.status_code == 200
    assert client.enviados == []
