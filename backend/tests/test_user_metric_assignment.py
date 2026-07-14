"""Atribuição admin-controlada de métricas ao lançador (#163).

Regra (estrita): o lançador (role 'user') só vê e só lança nas métricas
atribuídas a ele pelo admin. Sem atribuição = 403. Admin não é restringido.
Remover a atribuição preserva os lançamentos históricos.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, Membership, LogEntry, UserMetricAssignment
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
    session.add(u)
    session.commit()
    session.refresh(u)
    return u


def auth(user, org_id=None):
    h = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if org_id is not None:
        h["X-Org-Id"] = str(org_id)
    return h


def make_admin_with_org(client, session, username="admin"):
    admin = make_user(session, username)
    org_id = client.post("/api/v1/organizations/", json={"nome": f"Org {username}"}, headers=auth(admin)).json()["id"]
    return admin, org_id


def add_membro(session, user, org_id, role="user"):
    session.add(Membership(user_id=user.id, organization_id=org_id, role=role))
    session.commit()


def make_metric(client, session, admin, org_id, codigo):
    return client.post("/api/v1/metrics/", json={"codigo": codigo, "descricao": "x"}, headers=auth(admin, org_id)).json()["id"]


def make_goal(client, admin, org_id, metric_id):
    return client.post("/api/v1/goals/", json={"metric": metric_id, "alvo": "100", "periodo_referencia": "2026-08"}, headers=auth(admin, org_id)).json()["id"]


# ---------- endpoints de admin ----------

def test_admin_atribui_e_lista_metricas_do_lancador(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    m2 = make_metric(client, session, admin, org_id, "M2")

    r = client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/",
                   json={"metric_ids": [m1, m2]}, headers=auth(admin, org_id))
    assert r.status_code == 200
    assert set(r.json()["metric_ids"]) == {m1, m2}

    got = client.get(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", headers=auth(admin, org_id))
    assert set(got.json()["metric_ids"]) == {m1, m2}


def test_atribuicao_e_idempotente_replace(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    m2 = make_metric(client, session, admin, org_id, "M2")
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1, m2]}, headers=auth(admin, org_id))
    # substitui pelo conjunto {m1}
    r = client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1]}, headers=auth(admin, org_id))
    assert set(r.json()["metric_ids"]) == {m1}


def test_gerenciar_atribuicao_requer_admin(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    r = client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1]}, headers=auth(colab, org_id))
    assert r.status_code == 403


# ---------- enforcement no lançamento ----------

def test_lancador_atribuido_consegue_lancar(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    g1 = make_goal(client, admin, org_id, m1)
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1]}, headers=auth(admin, org_id))

    r = client.post("/api/v1/logs/", json={"goal": g1, "data": "2026-08-01", "valor_logado": "10"}, headers=auth(colab, org_id))
    assert r.status_code == 201


def test_lancador_sem_atribuicao_recebe_403(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    g1 = make_goal(client, admin, org_id, m1)
    # sem atribuir
    r = client.post("/api/v1/logs/", json={"goal": g1, "data": "2026-08-01", "valor_logado": "10"}, headers=auth(colab, org_id))
    assert r.status_code == 403


def test_admin_lanca_sem_precisar_de_atribuicao(client, session):
    admin, org_id = make_admin_with_org(client, session)
    m1 = make_metric(client, session, admin, org_id, "M1")
    g1 = make_goal(client, admin, org_id, m1)
    r = client.post("/api/v1/logs/", json={"goal": g1, "data": "2026-08-01", "valor_logado": "10"}, headers=auth(admin, org_id))
    assert r.status_code == 201


# ---------- visibilidade na listagem ----------

def test_lancador_so_ve_metricas_atribuidas(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    make_metric(client, session, admin, org_id, "M2")
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1]}, headers=auth(admin, org_id))

    codigos = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(colab, org_id)).json()}
    assert codigos == {"M1"}


def test_admin_ve_todas_as_metricas(client, session):
    admin, org_id = make_admin_with_org(client, session)
    make_metric(client, session, admin, org_id, "M1")
    make_metric(client, session, admin, org_id, "M2")
    codigos = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(admin, org_id)).json()}
    assert {"M1", "M2"} <= codigos


# ---------- remover atribuição preserva histórico ----------

def test_remover_atribuicao_preserva_lancamentos(client, session):
    admin, org_id = make_admin_with_org(client, session)
    colab = make_user(session, "colab"); add_membro(session, colab, org_id)
    m1 = make_metric(client, session, admin, org_id, "M1")
    g1 = make_goal(client, admin, org_id, m1)
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": [m1]}, headers=auth(admin, org_id))
    client.post("/api/v1/logs/", json={"goal": g1, "data": "2026-08-01", "valor_logado": "10"}, headers=auth(colab, org_id))

    # remove a atribuição (conjunto vazio)
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", json={"metric_ids": []}, headers=auth(admin, org_id))

    logs = session.exec(select(LogEntry).where(LogEntry.goal == g1, LogEntry.deleted == False)).all()
    assert len(logs) == 1  # histórico preservado
    # e agora ele não lança mais
    r = client.post("/api/v1/logs/", json={"goal": g1, "data": "2026-08-02", "valor_logado": "5"}, headers=auth(colab, org_id))
    assert r.status_code == 403
