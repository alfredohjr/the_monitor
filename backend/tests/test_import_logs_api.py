"""Endpoint POST /api/v1/logs/import (#144) — histórico realizado em lote."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Goal, LogEntry, Notification
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


def meta_do_dia(session, metric_id, org_id, dia, alvo="10"):
    g = Goal(metric=metric_id, alvo=alvo, periodo_referencia=dia, organization_id=org_id)
    session.add(g); session.commit(); session.refresh(g)
    return g


def test_importa_lancamentos_casando_com_meta_do_dia(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")
    meta_do_dia(session, mid, org, "2026-08-04")

    body = {"metric_id": mid, "lancamentos": [
        {"data": "2026-08-03", "valor": "5"},
        {"data": "2026-08-04", "valor": "7"},
    ]}
    r = client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    assert r.status_code == 200
    assert r.json()["criadas"] == 2
    logs = session.exec(select(LogEntry)).all()
    assert len(logs) == 2
    assert all(l.organization_id == org for l in logs)


def test_lancamento_sem_meta_no_dia_e_ignorado(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")

    body = {"metric_id": mid, "lancamentos": [
        {"data": "2026-08-03", "valor": "5"},
        {"data": "2026-08-09", "valor": "5"},   # sem meta nesse dia
    ]}
    r = client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    assert r.json()["criadas"] == 1
    assert r.json()["sem_meta"] == 1
    assert len(session.exec(select(LogEntry)).all()) == 1


def test_idempotente_nao_duplica(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")
    body = {"metric_id": mid, "lancamentos": [{"data": "2026-08-03", "valor": "5"}]}
    client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    r2 = client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    assert r2.json()["criadas"] == 0
    assert r2.json()["ignoradas"] == 1
    assert len(session.exec(select(LogEntry)).all()) == 1


def test_dry_run_nao_grava(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03")
    body = {"metric_id": mid, "lancamentos": [{"data": "2026-08-03", "valor": "5"}], "dry_run": True}
    r = client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    assert r.json()["dry_run"] is True
    assert r.json()["criadas"] == 1   # prévia diz quantas criaria
    assert session.exec(select(LogEntry)).all() == []


def test_nao_notifica_em_lote(client, session):
    # Importar em lote não deve disparar notificação de meta atingida (evita spam).
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta_do_dia(session, mid, org, "2026-08-03", alvo="10")
    body = {"metric_id": mid, "lancamentos": [{"data": "2026-08-03", "valor": "50"}]}
    client.post("/api/v1/logs/import", json=body, headers=auth(alice, org))
    assert session.exec(select(Notification)).all() == []


def test_metrica_de_outra_org_404(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mid = criar_metrica(client, bob, orgB)
    body = {"metric_id": mid, "lancamentos": [{"data": "2026-08-03", "valor": "5"}]}
    r = client.post("/api/v1/logs/import", json=body, headers=auth(alice, orgA))
    assert r.status_code == 404


def test_sem_organizacao_400(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    solto = make_user(session, "solto")
    body = {"metric_id": mid, "lancamentos": [{"data": "2026-08-03", "valor": "5"}]}
    r = client.post("/api/v1/logs/import", json=body, headers=auth(solto))
    assert r.status_code == 400
