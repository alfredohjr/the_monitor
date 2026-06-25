import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import IntegrityError

from main import app
from models import get_session, User, Metric, Goal, LogEntry
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


@pytest.fixture(name="token")
def token_fixture(session: Session, client: TestClient):
    user = User(username="tester", hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()

    resp = client.post("/api/v1/token/", json={"username": "tester", "password": "secret"})
    assert resp.status_code == 200
    return resp.json()["access"]


def auth(token: str):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------

def test_token_invalid_credentials(client: TestClient):
    resp = client.post("/api/v1/token/", json={"username": "ghost", "password": "wrong"})
    assert resp.status_code == 401


def test_token_valid_credentials(session: Session, client: TestClient):
    session.add(User(username="admin", hashed_password=hash_password("pass")))
    session.commit()

    resp = client.post("/api/v1/token/", json={"username": "admin", "password": "pass"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access" in data
    assert "refresh" in data


def test_protected_routes_require_auth(client: TestClient):
    # HTTPBearer returns 403 when Authorization header is missing
    assert client.get("/api/v1/metrics/").status_code == 403
    assert client.get("/api/v1/goals/").status_code == 403
    assert client.get("/api/v1/logs/").status_code == 403


# ---------- Metrics ----------

def test_create_metric(client: TestClient, token: str):
    resp = client.post(
        "/api/v1/metrics/",
        json={"codigo": "AGUA", "nome": "Copos de Água", "descricao": "Copos por dia", "tipo": "number", "periodo": "daily"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["codigo"] == "AGUA"
    assert data["deleted"] is False


def test_list_metrics(client: TestClient, token: str, session: Session):
    m = Metric(codigo="LEITURA", nome="Leitura", descricao="Pgs", tipo="number", periodo="daily")
    session.add(m)
    session.commit()

    resp = client.get("/api/v1/metrics/", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_metric(client: TestClient, token: str, session: Session):
    m = Metric(codigo="RUN", nome="Corrida", descricao="Km", tipo="decimal", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    resp = client.get(f"/api/v1/metrics/{m.id}/", headers=auth(token))
    assert resp.status_code == 200
    assert resp.json()["codigo"] == "RUN"


def test_update_metric(client: TestClient, token: str, session: Session):
    m = Metric(codigo="SLEEP", nome="Sono", descricao="Horas", tipo="decimal", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    resp = client.put(
        f"/api/v1/metrics/{m.id}/",
        json={"codigo": "SLEEP", "nome": "Sono Total", "descricao": "Horas dormidas", "tipo": "decimal", "periodo": "daily"},
        headers=auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["nome"] == "Sono Total"


def test_soft_delete_metric(client: TestClient, token: str, session: Session):
    m = Metric(codigo="GYM", nome="Academia", descricao="Treinos", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    resp = client.delete(f"/api/v1/metrics/{m.id}/", headers=auth(token))
    assert resp.status_code == 204

    session.refresh(m)
    assert m.deleted is True


def test_deleted_metric_not_listed(client: TestClient, token: str, session: Session):
    m = Metric(codigo="HIDDEN", nome="Oculta", descricao="Desc", tipo="number", periodo="daily", deleted=True)
    session.add(m)
    session.commit()

    resp = client.get("/api/v1/metrics/", headers=auth(token))
    assert resp.status_code == 200
    assert all(i["codigo"] != "HIDDEN" for i in resp.json())


# ---------- Goals ----------

def test_create_goal(client: TestClient, token: str, session: Session):
    m = Metric(codigo="AGUA2", nome="Água", descricao="Copos", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    resp = client.post(
        "/api/v1/goals/",
        json={"metric": m.id, "alvo": "8", "periodo_referencia": "2026-06-23"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["alvo"] == "8"


def test_list_goals(client: TestClient, token: str, session: Session):
    m = Metric(codigo="STEPS", nome="Passos", descricao="Passos", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    g = Goal(metric=m.id, alvo="10000", periodo_referencia="2026-06-23")
    session.add(g)
    session.commit()

    resp = client.get("/api/v1/goals/", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_soft_delete_goal(client: TestClient, token: str, session: Session):
    m = Metric(codigo="CAL", nome="Calorias", descricao="Kcal", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    g = Goal(metric=m.id, alvo="2000", periodo_referencia="2026-06-23")
    session.add(g)
    session.commit()
    session.refresh(g)

    resp = client.delete(f"/api/v1/goals/{g.id}/", headers=auth(token))
    assert resp.status_code == 204

    session.refresh(g)
    assert g.deleted is True


# ---------- LogEntries ----------

def test_create_log_entry(client: TestClient, token: str, session: Session):
    m = Metric(codigo="WATER", nome="Água", descricao="Copos", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    g = Goal(metric=m.id, alvo="8", periodo_referencia="2026-06-23")
    session.add(g)
    session.commit()
    session.refresh(g)

    resp = client.post(
        "/api/v1/logs/",
        json={"goal": g.id, "data": "2026-06-23", "valor_logado": "6"},
        headers=auth(token),
    )
    assert resp.status_code == 201
    assert resp.json()["valor_logado"] == "6"


def test_list_log_entries(client: TestClient, token: str, session: Session):
    m = Metric(codigo="BOOK", nome="Leitura", descricao="Páginas", tipo="number", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    g = Goal(metric=m.id, alvo="30", periodo_referencia="2026-06-23")
    session.add(g)
    session.commit()
    session.refresh(g)

    log = LogEntry(goal=g.id, data=date(2026, 6, 23), valor_logado="25")
    session.add(log)
    session.commit()

    resp = client.get("/api/v1/logs/", headers=auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_soft_delete_log_entry(client: TestClient, token: str, session: Session):
    m = Metric(codigo="MEDIA", nome="Mídia", descricao="Horas", tipo="decimal", periodo="daily")
    session.add(m)
    session.commit()
    session.refresh(m)

    g = Goal(metric=m.id, alvo="2", periodo_referencia="2026-06-23")
    session.add(g)
    session.commit()
    session.refresh(g)

    log = LogEntry(goal=g.id, data=date(2026, 6, 23), valor_logado="1.5")
    session.add(log)
    session.commit()
    session.refresh(log)

    resp = client.delete(f"/api/v1/logs/{log.id}/", headers=auth(token))
    assert resp.status_code == 204

    session.refresh(log)
    assert log.deleted is True


# ---------- User email (issue #17) ----------

def test_user_email_persisted(session: Session):
    user = User(username="comemail", hashed_password=hash_password("x"), email="user@example.com")
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.email == "user@example.com"


def test_user_email_is_optional(session: Session):
    user = User(username="sememail", hashed_password=hash_password("x"))
    session.add(user)
    session.commit()
    session.refresh(user)

    assert user.email is None


def test_user_email_is_unique(session: Session):
    session.add(User(username="a", hashed_password=hash_password("x"), email="dup@example.com"))
    session.commit()

    session.add(User(username="b", hashed_password=hash_password("x"), email="dup@example.com"))
    with pytest.raises(IntegrityError):
        session.commit()
