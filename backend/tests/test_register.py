import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Organization, Membership
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


def payload(username="novo", password="senha123", organizacao="Acme", codigo="chave-acme", **extra):
    body = {
        "username": username,
        "password": password,
        "organizacao": organizacao,
        "codigo_organizacao": codigo,
    }
    body.update(extra)
    return body


def membership_of(session: Session, username: str) -> Membership:
    user = session.exec(select(User).where(User.username == username)).first()
    return session.exec(select(Membership).where(Membership.user_id == user.id)).first()


# --- cadastro básico ---

def test_register_creates_user(client: TestClient, session: Session):
    response = client.post("/api/v1/register/", json=payload())
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "novo"
    assert "id" in data
    assert "hashed_password" not in data


def test_register_duplicate_username(client: TestClient, session: Session):
    session.add(User(username="existente", hashed_password=hash_password("abc")))
    session.commit()
    response = client.post("/api/v1/register/", json=payload(username="existente"))
    assert response.status_code == 400


def test_register_missing_fields(client: TestClient):
    response = client.post("/api/v1/register/", json={"username": "incompleto"})
    assert response.status_code == 422


def test_register_requires_organizacao(client: TestClient):
    body = payload()
    del body["organizacao"]
    response = client.post("/api/v1/register/", json=body)
    assert response.status_code == 422


def test_register_requires_codigo(client: TestClient):
    body = payload()
    del body["codigo_organizacao"]
    response = client.post("/api/v1/register/", json=body)
    assert response.status_code == 422


def test_register_with_email(client: TestClient, session: Session):
    response = client.post("/api/v1/register/", json=payload(username="comemail", email="novo@example.com"))
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "novo@example.com"

    user = session.exec(select(User).where(User.username == "comemail")).first()
    assert user.email == "novo@example.com"


def test_register_duplicate_email(client: TestClient, session: Session):
    session.add(User(username="dono", hashed_password=hash_password("abc"), email="dup@example.com"))
    session.commit()
    response = client.post("/api/v1/register/", json=payload(username="outro", email="dup@example.com"))
    assert response.status_code == 400


# --- organização no cadastro (org nova x existente + código) ---

def test_register_org_nova_torna_admin(client: TestClient, session: Session):
    # Org que ainda não existe: é criada e o cadastrante vira admin dela.
    response = client.post("/api/v1/register/", json=payload(username="dona", organizacao="Nova Co", codigo="segredo"))
    assert response.status_code == 201

    org = session.exec(select(Organization).where(Organization.nome == "Nova Co")).first()
    assert org is not None
    m = membership_of(session, "dona")
    assert m.role == "admin"
    assert m.organization_id == org.id


def test_register_org_existente_codigo_correto_entra_como_user(client: TestClient, session: Session):
    client.post("/api/v1/register/", json=payload(username="dona", organizacao="Acme", codigo="segredo"))
    response = client.post("/api/v1/register/", json=payload(username="maria", organizacao="Acme", codigo="segredo"))
    assert response.status_code == 201

    m = membership_of(session, "maria")
    assert m.role == "user"
    # entrou na MESMA org, sem duplicar
    orgs = session.exec(select(Organization).where(Organization.nome == "Acme")).all()
    assert len(orgs) == 1
    assert m.organization_id == orgs[0].id


def test_register_org_existente_codigo_errado_recusado(client: TestClient, session: Session):
    client.post("/api/v1/register/", json=payload(username="dona", organizacao="Acme", codigo="segredo"))
    response = client.post("/api/v1/register/", json=payload(username="intruso", organizacao="Acme", codigo="chute"))
    assert response.status_code == 400
    # usuário não pode ter sido criado quando o código está errado
    assert session.exec(select(User).where(User.username == "intruso")).first() is None


def test_register_org_vazia_recusada(client: TestClient, session: Session):
    response = client.post("/api/v1/register/", json=payload(organizacao="   "))
    assert response.status_code == 400
    assert session.exec(select(User).where(User.username == "novo")).first() is None


# --- validação de formato do e-mail ---

@pytest.mark.parametrize("email_invalido", [
    "nao-e-email",
    "sem-arroba.com",
    "@sem-usuario.com",
    "sem-dominio@",
    "ana@@example.com",
    "ana ana@example.com",
    "ana@example",          # sem TLD
    "ana@.com",
])
def test_register_email_invalido_retorna_422(client: TestClient, session: Session, email_invalido):
    response = client.post("/api/v1/register/", json=payload(email=email_invalido))
    assert response.status_code == 422
    # e não deixa conta órfã pra trás
    assert session.exec(select(User).where(User.username == "novo")).first() is None


def test_register_email_valido_continua_201(client: TestClient, session: Session):
    response = client.post("/api/v1/register/", json=payload(email="ana@example.com"))
    assert response.status_code == 201


def test_register_sem_email_continua_201(client: TestClient, session: Session):
    # e-mail segue opcional: cadastro sem e-mail não exige verificação
    response = client.post("/api/v1/register/", json=payload())
    assert response.status_code == 201
    assert session.exec(select(User).where(User.username == "novo")).first().email is None


def test_register_aceita_email_internacionalizado(client: TestClient, session: Session):
    # RFC 6531: acentos no local part são válidos e o email-validator aceita.
    # Fixa a decisão de não restringir a ASCII.
    response = client.post("/api/v1/register/", json=payload(email="joão@example.com"))
    assert response.status_code == 201
