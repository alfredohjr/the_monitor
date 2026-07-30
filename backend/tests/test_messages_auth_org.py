"""Mensagens de auth e organização respondendo ao Accept-Language (#300).

Verifica o par: inglês por padrão, português quando o cliente pede. Testar só
um dos lados deixaria passar tanto "esqueci de traduzir" quanto "traduzi mas
ignorei o header".
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from auth import create_access_token, hash_password
from main import app
from models import User, get_session


# Não há conftest.py neste projeto: cada arquivo monta o próprio client/session.
# Padrão copiado de tests/test_rbac_org.py.
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


def make_user(session: Session, username: str) -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def auth(user: User):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}

PT = {"Accept-Language": "pt-BR"}


def _registrar(client, **extra):
    corpo = {
        "username": "novo",
        "password": "senha123",
        "organizacao": "Org Nova",
        "codigo_organizacao": "chave",
    }
    corpo.update(extra)
    return client.post("/api/v1/register/", json=corpo)


# --- Login ------------------------------------------------------------------


def test_credenciais_invalidas_em_ingles_por_padrao(client):
    r = client.post("/api/v1/token/", json={"username": "nao", "password": "existe"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid credentials"


def test_credenciais_invalidas_em_portugues_com_header(client):
    r = client.post(
        "/api/v1/token/", json={"username": "nao", "password": "existe"}, headers=PT
    )
    assert r.status_code == 401
    assert r.json()["detail"] == "Credenciais inválidas"


def test_header_de_navegador_com_q_escolhe_portugues(client):
    """O peso manda, não a ordem — é o caso real de um navegador pt-BR."""
    r = client.post(
        "/api/v1/token/",
        json={"username": "nao", "password": "existe"},
        headers={"Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"},
    )
    assert r.json()["detail"] == "Credenciais inválidas"


# --- Registro ---------------------------------------------------------------


def test_username_duplicado_nos_dois_idiomas(client, session: Session):
    make_user(session, "novo")
    assert _registrar(client).json()["detail"] == "Username already registered"

    r = client.post(
        "/api/v1/register/",
        json={
            "username": "novo",
            "password": "senha123",
            "organizacao": "Org Nova",
            "codigo_organizacao": "chave",
        },
        headers=PT,
    )
    assert r.json()["detail"] == "Username já cadastrado"


def test_organizacao_obrigatoria_nos_dois_idiomas(client):
    assert _registrar(client, organizacao="").json()["detail"] == "Organization is required"

    r = client.post(
        "/api/v1/register/",
        json={
            "username": "outro",
            "password": "senha123",
            "organizacao": "",
            "codigo_organizacao": "chave",
        },
        headers=PT,
    )
    assert r.json()["detail"] == "Organização é obrigatória"


# --- Token de usuário -------------------------------------------------------


def test_token_invalido_nos_dois_idiomas(client):
    r = client.get("/api/v1/me/", headers={"Authorization": "Bearer lixo"})
    assert r.status_code == 401
    assert r.json()["detail"] == "Invalid token"

    r = client.get(
        "/api/v1/me/", headers={"Authorization": "Bearer lixo", **PT}
    )
    assert r.json()["detail"] == "Token inválido"


# --- Organização ------------------------------------------------------------


def test_nome_de_org_duplicado_nos_dois_idiomas(client, session: Session):
    alice = make_user(session, "alice")
    bob = make_user(session, "bob")
    client.post("/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(alice))

    r = client.post(
        "/api/v1/organizations/", json={"nome": "Acme"}, headers=auth(bob)
    )
    assert r.status_code == 400
    assert r.json()["detail"] == "Organization name already in use"

    r = client.post(
        "/api/v1/organizations/",
        json={"nome": "Acme"},
        headers={**auth(bob), **PT},
    )
    assert r.json()["detail"] == "Nome de organização já está em uso"
