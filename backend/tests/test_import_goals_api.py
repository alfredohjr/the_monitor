"""Endpoint POST /api/v1/goals/import (#140)."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Goal
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


def payload(mid, **kw):
    base = {"metric_id": mid, "alvo_total": 100, "inicio": "2026-08-03", "fim": "2026-08-06", "estrategia": "linear"}
    base.update(kw)
    return base


def test_dry_run_nao_grava(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/import", json=payload(mid, dry_run=True), headers=auth(alice, org))
    assert r.status_code == 200
    body = r.json()
    assert body["dry_run"] is True
    assert len(body["pontos"]) == 4
    assert body["soma"] == 100
    assert session.exec(select(Goal)).all() == []  # nada gravado


def test_cria_metas_diarias_soma_bate(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/import", json=payload(mid), headers=auth(alice, org))
    assert r.status_code == 200
    assert r.json()["criadas"] == 4
    goals = session.exec(select(Goal).where(Goal.metric == mid)).all()
    assert len(goals) == 4
    assert all(g.organization_id == org for g in goals)
    assert sum(float(g.alvo) for g in goals) == 100


def test_idempotente_nao_duplica(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    client.post("/api/v1/goals/import", json=payload(mid), headers=auth(alice, org))
    r2 = client.post("/api/v1/goals/import", json=payload(mid), headers=auth(alice, org))
    assert r2.json()["criadas"] == 0
    assert r2.json()["ignoradas"] == 4
    assert len(session.exec(select(Goal).where(Goal.metric == mid)).all()) == 4


def test_peso_semana_nao_cria_fim_de_semana(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    # 2026-08-03 (seg) a 2026-08-09 (dom): 5 dias úteis criam meta, sáb/dom não
    r = client.post("/api/v1/goals/import",
                    json=payload(mid, fim="2026-08-09", estrategia="peso_semana"),
                    headers=auth(alice, org))
    assert r.json()["criadas"] == 5
    goals = session.exec(select(Goal).where(Goal.metric == mid)).all()
    assert len(goals) == 5
    assert sum(float(g.alvo) for g in goals) == 100


def test_metrica_de_outra_org_404(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mid = criar_metrica(client, bob, orgB)
    r = client.post("/api/v1/goals/import", json=payload(mid), headers=auth(alice, orgA))
    assert r.status_code == 404


def test_sem_organizacao_400(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    solto = make_user(session, "solto")
    r = client.post("/api/v1/goals/import", json=payload(mid), headers=auth(solto))
    assert r.status_code == 400


def test_sazonal_mes(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    # 3 dias no começo do mês; pesos = dia do mês [1,2,3] -> soma bate
    r = client.post("/api/v1/goals/import",
                    json=payload(mid, inicio="2026-08-01", fim="2026-08-03", alvo_total=60, estrategia="sazonal_mes"),
                    headers=auth(alice, org))
    assert r.status_code == 200
    goals = session.exec(select(Goal).where(Goal.metric == mid)).all()
    assert sum(float(g.alvo) for g in goals) == 60


def test_pesos_custom(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/import",
                    json=payload(mid, alvo_total=80, estrategia="pesos_custom", pesos=[1, 3]),
                    headers=auth(alice, org))
    assert r.status_code == 200
    goals = session.exec(select(Goal).where(Goal.metric == mid)).all()
    assert sum(float(g.alvo) for g in goals) == 80


def test_pesos_custom_sem_pesos_422(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/import",
                    json=payload(mid, estrategia="pesos_custom"),
                    headers=auth(alice, org))
    assert r.status_code == 422


def test_datas_invalidas_422(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/import",
                    json=payload(mid, inicio="2026-08-10", fim="2026-08-01"),
                    headers=auth(alice, org))
    assert r.status_code == 422
