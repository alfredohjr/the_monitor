import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Organization, Membership, Metric
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


def make_user(session, username="solo@example.com", **extra):
    u = User(username=username, hashed_password=hash_password("secret"), **extra)
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def test_onboarding_cria_org_pessoal_como_admin(client, session):
    user = make_user(session)
    resp = client.post(
        "/api/v1/onboarding/",
        json={"organizacao": "Minha Loja", "display_name": "Alfredo"},
        headers=auth(user),
    )
    assert resp.status_code == 201

    org = session.exec(select(Organization).where(Organization.nome == "Minha Loja")).first()
    assert org is not None
    m = session.exec(select(Membership).where(Membership.user_id == user.id)).first()
    assert m is not None
    assert m.role == "admin"
    assert m.organization_id == org.id


def test_onboarding_grava_display_name(client, session):
    user = make_user(session)
    client.post("/api/v1/onboarding/", json={"organizacao": "Loja", "display_name": "Fulano"}, headers=auth(user))
    session.refresh(user)
    assert user.display_name == "Fulano"


def test_onboarding_semeia_exemplo(client, session):
    user = make_user(session)
    client.post("/api/v1/onboarding/", json={"organizacao": "Loja X"}, headers=auth(user))
    org = session.exec(select(Organization).where(Organization.nome == "Loja X")).first()
    metricas = session.exec(select(Metric).where(Metric.organization_id == org.id)).all()
    assert len(metricas) >= 1  # o novo usuário vê algo ao entrar


def test_onboarding_recusa_se_ja_tem_org(client, session):
    user = make_user(session)
    org = Organization(nome="Existente")
    session.add(org)
    session.commit()
    session.refresh(org)
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()

    resp = client.post("/api/v1/onboarding/", json={"organizacao": "Outra"}, headers=auth(user))
    assert resp.status_code == 400
    assert session.exec(select(Organization).where(Organization.nome == "Outra")).first() is None


def test_onboarding_org_vazia_recusada(client, session):
    user = make_user(session)
    resp = client.post("/api/v1/onboarding/", json={"organizacao": "   "}, headers=auth(user))
    assert resp.status_code == 400
    assert session.exec(select(Membership).where(Membership.user_id == user.id)).first() is None


def test_onboarding_nome_org_duplicado_recusado(client, session):
    dono = make_user(session, username="dono@x.com")
    session.add(Organization(nome="Acme"))
    session.commit()
    user = make_user(session, username="novo@x.com")
    resp = client.post("/api/v1/onboarding/", json={"organizacao": "Acme"}, headers=auth(user))
    assert resp.status_code == 400


def test_onboarding_exige_autenticacao(client, session):
    resp = client.post("/api/v1/onboarding/", json={"organizacao": "X"})
    assert resp.status_code == 403


def test_me_reflete_org_apos_onboarding(client, session):
    user = make_user(session)
    client.post("/api/v1/onboarding/", json={"organizacao": "Nova"}, headers=auth(user))
    me = client.get("/api/v1/me/", headers=auth(user)).json()
    assert len(me["organizations"]) == 1
    assert me["organizations"][0]["role"] == "admin"
