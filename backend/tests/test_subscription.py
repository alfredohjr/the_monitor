import pytest
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from main import app
from models import get_session, User, Metric, UserMetricSubscription
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
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(session: Session, username: str = "ana") -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def make_metric(session: Session, codigo: str = "M1", is_default: bool = True) -> Metric:
    m = Metric(codigo=codigo, nome=codigo, descricao="desc", is_default=is_default)
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def auth_headers(username: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(username)}"}


# --- model ---

def test_subscription_model_existe(session):
    user = make_user(session)
    metric = make_metric(session)
    sub = UserMetricSubscription(user_id=user.id, metric_id=metric.id)
    session.add(sub)
    session.commit()
    result = session.exec(select(UserMetricSubscription)).first()
    assert result is not None
    assert result.user_id == user.id
    assert result.metric_id == metric.id


# --- POST /api/v1/subscriptions/ ---

def test_assinar_metrica(client, session):
    user = make_user(session)
    metric = make_metric(session)
    r = client.post("/api/v1/subscriptions/", json={"metric_id": metric.id}, headers=auth_headers("ana"))
    assert r.status_code == 201
    sub = session.exec(select(UserMetricSubscription).where(UserMetricSubscription.user_id == user.id)).first()
    assert sub is not None


def test_assinar_metrica_sem_autenticacao(client, session):
    metric = make_metric(session)
    r = client.post("/api/v1/subscriptions/", json={"metric_id": metric.id})
    assert r.status_code in (401, 403)


def test_assinar_metrica_inexistente(client, session):
    make_user(session)
    r = client.post("/api/v1/subscriptions/", json={"metric_id": 9999}, headers=auth_headers("ana"))
    assert r.status_code == 404


def test_assinar_mesma_metrica_duas_vezes_retorna_200(client, session):
    make_user(session)
    metric = make_metric(session)
    client.post("/api/v1/subscriptions/", json={"metric_id": metric.id}, headers=auth_headers("ana"))
    r = client.post("/api/v1/subscriptions/", json={"metric_id": metric.id}, headers=auth_headers("ana"))
    assert r.status_code in (200, 201)
    subs = session.exec(select(UserMetricSubscription)).all()
    assert len(subs) == 1  # não duplica


# --- GET /api/v1/subscriptions/ ---

def test_listar_subscricoes_do_usuario(client, session):
    user = make_user(session)
    m1 = make_metric(session, "M1")
    m2 = make_metric(session, "M2")
    session.add(UserMetricSubscription(user_id=user.id, metric_id=m1.id))
    session.add(UserMetricSubscription(user_id=user.id, metric_id=m2.id))
    session.commit()
    r = client.get("/api/v1/subscriptions/", headers=auth_headers("ana"))
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_listar_subscricoes_isoladas_por_usuario(client, session):
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    metric = make_metric(session)
    session.add(UserMetricSubscription(user_id=ana.id, metric_id=metric.id))
    session.commit()
    r = client.get("/api/v1/subscriptions/", headers=auth_headers("bob"))
    assert r.json() == []


def test_listar_subscricoes_sem_autenticacao(client, session):
    r = client.get("/api/v1/subscriptions/")
    assert r.status_code in (401, 403)


# --- DELETE /api/v1/subscriptions/{id}/ ---

def test_cancelar_subscricao(client, session):
    user = make_user(session)
    metric = make_metric(session)
    sub = UserMetricSubscription(user_id=user.id, metric_id=metric.id)
    session.add(sub)
    session.commit()
    session.refresh(sub)
    r = client.delete(f"/api/v1/subscriptions/{sub.id}/", headers=auth_headers("ana"))
    assert r.status_code == 204
    assert session.get(UserMetricSubscription, sub.id) is None


def test_cancelar_subscricao_de_outro_usuario_retorna_404(client, session):
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    metric = make_metric(session)
    sub = UserMetricSubscription(user_id=bob.id, metric_id=metric.id)
    session.add(sub)
    session.commit()
    session.refresh(sub)
    r = client.delete(f"/api/v1/subscriptions/{sub.id}/", headers=auth_headers("ana"))
    assert r.status_code == 404
