"""Permissão de editar/excluir lançamento pelo lançador (#164).

Flags por métrica (can_edit_entry / can_delete_entry) na atribuição admin (#163).
- Lançador só edita/exclui os PRÓPRIOS lançamentos e só com a flag ligada (senão 403).
- Admin edita/exclui independente das flags.
- Toda edição/exclusão registra auditoria (autor, ação, valor anterior).
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Membership, LogEntry, LogEntryAudit
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


def setup_org_colab_metric(client, session):
    admin = make_user(session, "admin")
    org_id = client.post("/api/v1/organizations/", json={"nome": "Org"}, headers=auth(admin)).json()["id"]
    colab = make_user(session, "colab")
    session.add(Membership(user_id=colab.id, organization_id=org_id, role="user")); session.commit()
    mid = client.post("/api/v1/metrics/", json={"codigo": "M1", "descricao": "x"}, headers=auth(admin, org_id)).json()["id"]
    gid = client.post("/api/v1/goals/", json={"metric": mid, "alvo": "100", "periodo_referencia": "2026-08"}, headers=auth(admin, org_id)).json()["id"]
    return admin, colab, org_id, mid, gid


def assign(client, admin, org_id, colab, mid, can_edit=False, can_delete=False):
    client.put(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/",
               json={"assignments": [{"metric_id": mid, "can_edit": can_edit, "can_delete": can_delete}]},
               headers=auth(admin, org_id))


def colab_log(client, colab, org_id, gid, valor="10", data="2026-08-01"):
    return client.post("/api/v1/logs/", json={"goal": gid, "data": data, "valor_logado": valor}, headers=auth(colab, org_id)).json()["id"]


# ---------- autor no lançamento ----------

def test_create_log_grava_autor(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True)
    lid = colab_log(client, colab, org_id, gid)
    assert session.get(LogEntry, lid).created_by == colab.id


# ---------- editar ----------

def test_lancador_com_can_edit_edita_proprio(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True)
    lid = colab_log(client, colab, org_id, gid)
    r = client.put(f"/api/v1/logs/{lid}/", json={"goal": gid, "data": "2026-08-01", "valor_logado": "99"}, headers=auth(colab, org_id))
    assert r.status_code == 200
    assert session.get(LogEntry, lid).valor_logado == "99"


def test_lancador_sem_can_edit_recebe_403(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=False, can_delete=True)
    lid = colab_log(client, colab, org_id, gid)
    r = client.put(f"/api/v1/logs/{lid}/", json={"goal": gid, "data": "2026-08-01", "valor_logado": "99"}, headers=auth(colab, org_id))
    assert r.status_code == 403


def test_lancador_nao_edita_lancamento_de_outro(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True)
    # lançamento criado pelo admin (autor = admin)
    lid = client.post("/api/v1/logs/", json={"goal": gid, "data": "2026-08-02", "valor_logado": "5"}, headers=auth(admin, org_id)).json()["id"]
    r = client.put(f"/api/v1/logs/{lid}/", json={"goal": gid, "data": "2026-08-02", "valor_logado": "7"}, headers=auth(colab, org_id))
    assert r.status_code == 403


# ---------- excluir ----------

def test_lancador_com_can_delete_exclui_proprio(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_delete=True)
    lid = colab_log(client, colab, org_id, gid)
    r = client.delete(f"/api/v1/logs/{lid}/", headers=auth(colab, org_id))
    assert r.status_code == 204
    assert session.get(LogEntry, lid).deleted is True  # soft delete


def test_lancador_sem_can_delete_recebe_403(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_delete=False)
    lid = colab_log(client, colab, org_id, gid)
    r = client.delete(f"/api/v1/logs/{lid}/", headers=auth(colab, org_id))
    assert r.status_code == 403
    assert session.get(LogEntry, lid).deleted is False


# ---------- admin bypassa ----------

def test_admin_edita_e_exclui_sem_flags(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    lid = client.post("/api/v1/logs/", json={"goal": gid, "data": "2026-08-01", "valor_logado": "5"}, headers=auth(admin, org_id)).json()["id"]
    assert client.put(f"/api/v1/logs/{lid}/", json={"goal": gid, "data": "2026-08-01", "valor_logado": "6"}, headers=auth(admin, org_id)).status_code == 200
    assert client.delete(f"/api/v1/logs/{lid}/", headers=auth(admin, org_id)).status_code == 204


# ---------- auditoria ----------

def test_edicao_registra_auditoria_com_valor_anterior(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True)
    lid = colab_log(client, colab, org_id, gid, valor="10")
    client.put(f"/api/v1/logs/{lid}/", json={"goal": gid, "data": "2026-08-01", "valor_logado": "42"}, headers=auth(colab, org_id))
    audits = session.exec(select(LogEntryAudit).where(LogEntryAudit.log_entry_id == lid, LogEntryAudit.action == "edit")).all()
    assert len(audits) == 1
    assert audits[0].actor_id == colab.id
    assert audits[0].valor_anterior == "10"


def test_exclusao_registra_auditoria(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_delete=True)
    lid = colab_log(client, colab, org_id, gid, valor="8")
    client.delete(f"/api/v1/logs/{lid}/", headers=auth(colab, org_id))
    audits = session.exec(select(LogEntryAudit).where(LogEntryAudit.log_entry_id == lid, LogEntryAudit.action == "delete")).all()
    assert len(audits) == 1
    assert audits[0].actor_id == colab.id
    assert audits[0].valor_anterior == "8"


# ---------- permissões expostas p/ a UI ----------

def test_endpoint_log_permissions_para_lancador(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True, can_delete=False)
    r = client.get("/api/v1/me/log-permissions/", headers=auth(colab, org_id))
    assert r.status_code == 200
    d = r.json()
    assert d["is_admin"] is False
    assert d["user_id"] == colab.id
    assert d["metrics"][str(mid)] == {"can_edit": True, "can_delete": False}


def test_endpoint_log_permissions_admin(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    r = client.get("/api/v1/me/log-permissions/", headers=auth(admin, org_id))
    assert r.json()["is_admin"] is True


# ---------- flags aparecem no GET de atribuições ----------

def test_get_atribuicoes_inclui_flags(client, session):
    admin, colab, org_id, mid, gid = setup_org_colab_metric(client, session)
    assign(client, admin, org_id, colab, mid, can_edit=True, can_delete=True)
    d = client.get(f"/api/v1/organizations/{org_id}/users/{colab.id}/metrics/", headers=auth(admin, org_id)).json()
    assert mid in d["metric_ids"]
    item = next(a for a in d["assignments"] if a["metric_id"] == mid)
    assert item["can_edit"] is True and item["can_delete"] is True
