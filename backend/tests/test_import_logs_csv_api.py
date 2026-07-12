"""Endpoint POST /api/v1/logs/import-csv (#141)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Goal, LogEntry
from auth import hash_password, create_access_token


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    app.dependency_overrides[get_session] = lambda: session
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session, username):
    u = User(username=username, hashed_password=hash_password("secret"))
    session.add(u); session.commit(); session.refresh(u)
    return u


def auth(user, org_id=None):
    h = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if org_id is not None:
        h["X-Org-Id"] = str(org_id)
    return h


def make_admin_org(client, session, username):
    user = make_user(session, username)
    org_id = client.post("/api/v1/organizations/", json={"nome": f"Org {username}"}, headers=auth(user)).json()["id"]
    return user, org_id


def criar_metrica(client, user, org_id, codigo="M1"):
    return client.post("/api/v1/metrics/", json={"codigo": codigo, "descricao": "x"}, headers=auth(user, org_id)).json()["id"]


def meta_do_dia(session, metric_id, org_id, dia):
    g = Goal(metric=metric_id, alvo="10", periodo_referencia=dia, organization_id=org_id)
    session.add(g); session.commit()


def test_importa_csv_e_reporta_erros(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")
    meta_do_dia(session, mid, org, "2026-08-04")

    csv = "data,valor\n2026-08-03,5\nlixo\n2026-08-04,7"
    r = client.post("/api/v1/logs/import-csv", json={"metric_id": mid, "csv": csv}, headers=auth(alice, org))
    assert r.status_code == 200
    body = r.json()
    assert body["criadas"] == 2
    assert len(body["erros"]) == 1          # a linha "lixo"
    assert len(session.exec(select(LogEntry)).all()) == 2


def test_csv_dry_run_nao_grava(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")
    r = client.post("/api/v1/logs/import-csv",
                    json={"metric_id": mid, "csv": "2026-08-03,5", "dry_run": True},
                    headers=auth(alice, org))
    assert r.json()["criadas"] == 1
    assert session.exec(select(LogEntry)).all() == []


def test_csv_metrica_outra_org_404(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mid = criar_metrica(client, bob, orgB)
    r = client.post("/api/v1/logs/import-csv", json={"metric_id": mid, "csv": "2026-08-03,5"}, headers=auth(alice, orgA))
    assert r.status_code == 404


def test_csv_sem_org_400(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    solto = make_user(session, "solto")
    r = client.post("/api/v1/logs/import-csv", json={"metric_id": mid, "csv": "2026-08-03,5"}, headers=auth(solto))
    assert r.status_code == 400
