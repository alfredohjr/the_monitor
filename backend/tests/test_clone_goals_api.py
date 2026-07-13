"""Endpoint POST /api/v1/goals/clone (#142) — replicar metas de um período."""
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


def meta(session, metric_id, org_id, dia, alvo="10"):
    session.add(Goal(metric=metric_id, alvo=alvo, periodo_referencia=dia, organization_id=org_id)); session.commit()


def payload(mid, **kw):
    base = {"metric_id": mid, "origem_inicio": "2026-07-01", "origem_fim": "2026-07-03", "destino_inicio": "2026-08-01"}
    base.update(kw)
    return base


def metas_da(session, mid, org):
    return session.exec(select(Goal).where(Goal.metric == mid, Goal.organization_id == org)).all()


def test_clona_deslocando_datas_e_escalando(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    for d in ("2026-07-01", "2026-07-02", "2026-07-03"):
        meta(session, mid, org, d, "10")

    r = client.post("/api/v1/goals/clone", json=payload(mid, escala=2), headers=auth(alice, org))
    assert r.status_code == 200
    assert r.json()["criadas"] == 3
    novos = {g.periodo_referencia: g.alvo for g in metas_da(session, mid, org) if g.periodo_referencia.startswith("2026-08")}
    assert novos == {"2026-08-01": "20", "2026-08-02": "20", "2026-08-03": "20"}


def test_escala_padrao_mantem_alvo(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta(session, mid, org, "2026-07-01", "7")
    client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(alice, org))
    novo = [g for g in metas_da(session, mid, org) if g.periodo_referencia == "2026-08-01"][0]
    assert novo.alvo == "7"


def test_ignora_metas_fora_do_intervalo(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta(session, mid, org, "2026-07-02", "10")
    meta(session, mid, org, "2026-09-01", "10")   # fora de origem
    r = client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(alice, org))
    assert r.json()["criadas"] == 1


def test_idempotente(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta(session, mid, org, "2026-07-01", "10")
    client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(alice, org))
    r2 = client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(alice, org))
    assert r2.json()["criadas"] == 0 and r2.json()["ignoradas"] == 1


def test_dry_run_nao_grava(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    meta(session, mid, org, "2026-07-01", "10")
    r = client.post("/api/v1/goals/clone", json=payload(mid, dry_run=True), headers=auth(alice, org))
    assert r.json()["criadas"] == 1
    assert not [g for g in metas_da(session, mid, org) if g.periodo_referencia.startswith("2026-08")]


def test_metrica_outra_org_404(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mid = criar_metrica(client, bob, orgB)
    r = client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(alice, orgA))
    assert r.status_code == 404


def test_sem_org_400(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    solto = make_user(session, "solto")
    r = client.post("/api/v1/goals/clone", json=payload(mid), headers=auth(solto))
    assert r.status_code == 400


def test_data_invalida_422(client, session):
    alice, org = make_admin_org(client, session, "alice")
    mid = criar_metrica(client, alice, org)
    r = client.post("/api/v1/goals/clone", json=payload(mid, origem_fim="2026-06-01"), headers=auth(alice, org))
    assert r.status_code == 422
