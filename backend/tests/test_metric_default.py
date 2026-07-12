import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, Organization, Membership
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


@pytest.fixture(name="org_id")
def org_id_fixture(session: Session):
    org = Organization(nome="Org Default")
    session.add(org)
    session.commit()
    session.refresh(org)
    return org.id


@pytest.fixture(name="token")
def token_fixture(session: Session, org_id: int):
    user = User(username="tester", hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(Membership(user_id=user.id, organization_id=org_id, role="admin"))
    session.commit()
    return create_access_token("tester")


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_metric_criada_com_is_default_false_por_padrao(client: TestClient, token: str):
    resp = client.post("/api/v1/metrics/", json={
        "codigo": "M1", "descricao": "desc", "nome": "Nome"
    }, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["is_default"] is False


def test_metric_criada_com_is_default_true(client: TestClient, token: str):
    resp = client.post("/api/v1/metrics/", json={
        "codigo": "M1", "descricao": "desc", "nome": "Nome", "is_default": True
    }, headers=auth(token))
    assert resp.status_code == 201
    assert resp.json()["is_default"] is True


def test_metric_listada_expoe_is_default(client: TestClient, token: str, session: Session):
    session.add(Metric(codigo="M1", nome="Nome", descricao="desc", is_default=True))
    session.commit()
    resp = client.get("/api/v1/metrics/", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()[0]["is_default"] is True


def test_metric_update_altera_is_default(client: TestClient, token: str, session: Session, org_id: int):
    m = Metric(codigo="M1", nome="Nome", descricao="desc", is_default=False, organization_id=org_id)
    session.add(m)
    session.commit()
    session.refresh(m)
    resp = client.put(f"/api/v1/metrics/{m.id}/", json={
        "codigo": "M1", "descricao": "desc", "nome": "Nome", "is_default": True
    }, headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["is_default"] is True


def test_migration_adiciona_coluna_is_default(session: Session):
    m = Metric(codigo="M1", nome="Nome", descricao="desc")
    session.add(m)
    session.commit()
    session.refresh(m)
    assert hasattr(m, "is_default")
    assert m.is_default is False
