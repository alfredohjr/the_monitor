import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, Goal, Notification, Organization, Membership
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
    org = Organization(nome="Org Notif")
    session.add(org)
    session.commit()
    session.refresh(org)
    return org.id


def make_user(session: Session, org_id: int, username: str) -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    session.add(Membership(user_id=user.id, organization_id=org_id, role="admin"))
    session.commit()
    return user


def make_goal(session: Session, org_id: int, alvo: str) -> Goal:
    metric = Metric(codigo="VENDAS", nome="Vendas", descricao="d", tipo="number", periodo="daily", organization_id=org_id)
    session.add(metric)
    session.commit()
    session.refresh(metric)
    goal = Goal(metric=metric.id, alvo=alvo, periodo_referencia="2026-07-01", organization_id=org_id)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal


def auth(user: User):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def notifs(client, user):
    return client.get("/api/v1/notifications/", headers=auth(user)).json()


def test_notifica_quando_lancamento_atinge_a_meta(client: TestClient, session: Session, org_id: int):
    user = make_user(session, org_id, "ana")
    goal = make_goal(session, org_id, "100")

    # Abaixo do alvo: nenhuma notificação.
    client.post("/api/v1/logs/", json={"goal": goal.id, "data": "2026-07-01", "valor_logado": "60"}, headers=auth(user))
    assert notifs(client, user) == []

    # Cruza o alvo (60 -> 110): notifica uma vez.
    client.post("/api/v1/logs/", json={"goal": goal.id, "data": "2026-07-01", "valor_logado": "50"}, headers=auth(user))
    lista = notifs(client, user)
    assert len(lista) == 1
    assert "atingida" in lista[0]["mensagem"].lower()


def test_nao_notifica_se_nao_atinge(client: TestClient, session: Session, org_id: int):
    user = make_user(session, org_id, "bob")
    goal = make_goal(session, org_id, "100")
    client.post("/api/v1/logs/", json={"goal": goal.id, "data": "2026-07-01", "valor_logado": "40"}, headers=auth(user))
    assert notifs(client, user) == []


def test_notifica_apenas_uma_vez_ao_cruzar(client: TestClient, session: Session, org_id: int):
    user = make_user(session, org_id, "cid")
    goal = make_goal(session, org_id, "100")
    client.post("/api/v1/logs/", json={"goal": goal.id, "data": "2026-07-01", "valor_logado": "100"}, headers=auth(user))
    assert len(notifs(client, user)) == 1
    # Já estava atingida; novo lançamento não gera outra notificação.
    client.post("/api/v1/logs/", json={"goal": goal.id, "data": "2026-07-01", "valor_logado": "10"}, headers=auth(user))
    assert len(notifs(client, user)) == 1
