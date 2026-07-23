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
    app.dependency_overrides[get_session] = lambda: session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session, username, **extra):
    u = User(username=username, hashed_password=hash_password("secret"), **extra)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def make_admin_org(session, admin, nome="Org", is_paid=False, codigo="cod"):
    org = Organization(nome=nome, is_paid=is_paid, codigo_acesso=codigo)
    session.add(org)
    session.commit()
    session.refresh(org)
    session.add(Membership(user_id=admin.id, organization_id=org.id, role="admin"))
    session.commit()
    return org


# --- flag no model ---

def test_organization_nasce_free_por_padrao(session):
    org = Organization(nome="Nova")
    session.add(org)
    session.commit()
    session.refresh(org)
    assert org.is_paid is False


# --- admin adiciona membro (POST /organizations/{id}/users/) ---

def test_org_free_bloqueia_adicionar_membro(client, session):
    admin = make_user(session, "admin@x.com")
    org = make_admin_org(session, admin, is_paid=False)
    resp = client.post(
        f"/api/v1/organizations/{org.id}/users/",
        json={"email": "novo@x.com"},
        headers=auth(admin),
    )
    assert resp.status_code == 403
    # não criou membership nova
    membros = session.exec(select(Membership).where(Membership.organization_id == org.id)).all()
    assert len(membros) == 1  # só o admin


def test_org_paga_permite_adicionar_membro(client, session):
    admin = make_user(session, "admin2@x.com")
    org = make_admin_org(session, admin, is_paid=True)
    resp = client.post(
        f"/api/v1/organizations/{org.id}/users/",
        json={"email": "novo2@x.com"},
        headers=auth(admin),
    )
    assert resp.status_code == 201


# --- auto-cadastro por código (register em org existente) ---

def test_register_em_org_free_recusado(client, session):
    dono = make_user(session, "dono@x.com")
    make_admin_org(session, dono, nome="Acme", is_paid=False, codigo="segredo")
    resp = client.post("/api/v1/register/", json={
        "username": "intruso", "password": "senha123",
        "organizacao": "Acme", "codigo_organizacao": "segredo",
    })
    assert resp.status_code == 403
    assert session.exec(select(User).where(User.username == "intruso")).first() is None


def test_register_em_org_paga_permitido(client, session):
    dono = make_user(session, "dono2@x.com")
    make_admin_org(session, dono, nome="AcmePro", is_paid=True, codigo="segredo")
    resp = client.post("/api/v1/register/", json={
        "username": "maria", "password": "senha123",
        "organizacao": "AcmePro", "codigo_organizacao": "segredo",
    })
    assert resp.status_code == 201


def test_register_criando_org_nova_continua_ok(client, session):
    # Criar a própria org (vira admin) não é "adicionar membro" — segue liberado.
    resp = client.post("/api/v1/register/", json={
        "username": "fundador", "password": "senha123",
        "organizacao": "Minha Nova", "codigo_organizacao": "cod",
    })
    assert resp.status_code == 201


# --- /me expõe is_paid ---

def test_me_expoe_is_paid_da_org(client, session):
    admin = make_user(session, "admin3@x.com")
    make_admin_org(session, admin, nome="OrgPaga", is_paid=True)
    me = client.get("/api/v1/me/", headers=auth(admin)).json()
    assert me["organizations"][0]["is_paid"] is True
