import pytest
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from main import app
from models import get_session, User, Metric, Goal, Organization, Membership
from auth import hash_password, create_access_token
from seed import seed_exemplo


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


def make_user(session: Session, username: str = "ana") -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


# --- seed_exemplo ---

def test_seed_cria_org_no_primeiro_registro(session):
    user = make_user(session)
    seed_exemplo(user, session)
    org = session.exec(select(Organization)).first()
    assert org is not None
    assert org.nome != ""


def test_seed_vincula_usuario_a_org(session):
    user = make_user(session)
    seed_exemplo(user, session)
    membership = session.exec(select(Membership).where(Membership.user_id == user.id)).first()
    assert membership is not None


def test_seed_cria_metric_exemplo(session):
    user = make_user(session)
    seed_exemplo(user, session)
    metric = session.exec(select(Metric)).first()
    assert metric is not None
    assert metric.deleted is False


def test_seed_cria_goal_exemplo(session):
    user = make_user(session)
    seed_exemplo(user, session)
    goal = session.exec(select(Goal)).first()
    assert goal is not None
    assert goal.deleted is False


def test_seed_nao_repete_se_ja_existem_metricas(session):
    user = make_user(session)
    seed_exemplo(user, session)
    seed_exemplo(user, session)  # segunda chamada não deve duplicar
    metrics = session.exec(select(Metric)).all()
    orgs = session.exec(select(Organization)).all()
    assert len(metrics) == 1
    assert len(orgs) == 1


def test_seed_nao_repete_para_segundo_usuario(session):
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    seed_exemplo(ana, session)
    seed_exemplo(bob, session)
    metrics = session.exec(select(Metric)).all()
    assert len(metrics) == 1


# --- integração via endpoint de registro ---

def test_registro_cria_dados_de_exemplo(client: TestClient, session: Session):
    client.post("/api/v1/register/", json={"username": "ana", "password": "secret123"})
    assert session.exec(select(Organization)).first() is not None
    assert session.exec(select(Metric)).first() is not None
    assert session.exec(select(Goal)).first() is not None


def test_segundo_registro_nao_duplica_dados(client: TestClient, session: Session):
    client.post("/api/v1/register/", json={"username": "ana", "password": "secret123"})
    client.post("/api/v1/register/", json={"username": "bob", "password": "secret123"})
    assert len(session.exec(select(Metric)).all()) == 1
    assert len(session.exec(select(Organization)).all()) == 1
