"""Isolamento de dados por organização.

Métricas, metas e lançamentos passam a pertencer a uma organização. Um usuário
só enxerga (e mexe) no que é da sua org ativa; métricas `is_default` (catálogo
padrão) continuam globais, visíveis a todos.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, Goal, LogEntry, Membership
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


def make_admin_org(client, session, username):
    """Cria usuário + org (vira admin) e devolve (user, org_id)."""
    user = make_user(session, username)
    resp = client.post("/api/v1/organizations/", json={"nome": f"Org {username}"}, headers=auth(user))
    return user, resp.json()["id"]


def criar_metrica(client, user, org_id, codigo):
    return client.post(
        "/api/v1/metrics/",
        json={"codigo": codigo, "descricao": "x"},
        headers=auth(user, org_id),
    )


def add_membro(session, user, org_id, role="user"):
    """Vincula um usuário a uma org com o papel dado (default: 'user' comum)."""
    session.add(Membership(user_id=user.id, organization_id=org_id, role=role))
    session.commit()


# ---------- Métricas ----------

def test_metric_recebe_org_ativa_na_criacao(client, session):
    user, org = make_admin_org(client, session, "alice")
    r = criar_metrica(client, user, org, "M1")
    assert r.status_code == 201
    metric = session.get(Metric, r.json()["id"])
    assert metric.organization_id == org


def test_usuario_so_ve_metricas_da_propria_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    criar_metrica(client, alice, orgA, "A1")
    criar_metrica(client, bob, orgB, "B1")

    codigos_a = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice, orgA)).json()}
    codigos_b = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(bob, orgB)).json()}
    assert "A1" in codigos_a and "B1" not in codigos_a
    assert "B1" in codigos_b and "A1" not in codigos_b


def test_metricas_default_sao_globais(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    # métrica de catálogo (sem org)
    session.add(Metric(codigo="PAD_X", descricao="padrão", is_default=True))
    session.commit()
    codigos = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice, orgA)).json()}
    assert "PAD_X" in codigos


def test_nao_acessa_metrica_de_outra_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mid = criar_metrica(client, bob, orgB, "B1").json()["id"]

    assert client.get(f"/api/v1/metrics/{mid}/", headers=auth(alice, orgA)).status_code == 404
    assert client.put(f"/api/v1/metrics/{mid}/", json={"codigo": "B1", "descricao": "z"}, headers=auth(alice, orgA)).status_code == 404
    assert client.delete(f"/api/v1/metrics/{mid}/", headers=auth(alice, orgA)).status_code == 404


# ---------- Header X-Org-Id / membership ----------

def test_header_org_sem_membership_e_403(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    # alice tenta agir como se fosse da org do bob
    r = client.get("/api/v1/metrics/", headers=auth(alice, orgB))
    assert r.status_code == 403


def test_sem_header_usa_primeira_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    criar_metrica(client, alice, orgA, "A1")
    # sem X-Org-Id: cai na org da alice
    codigos = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice)).json()}
    assert "A1" in codigos


def test_usuario_multi_org_troca_de_contexto(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    # alice cria uma segunda org (também vira admin)
    orgC = client.post("/api/v1/organizations/", json={"nome": "Terceira"}, headers=auth(alice)).json()["id"]
    criar_metrica(client, alice, orgA, "A1")
    criar_metrica(client, alice, orgC, "C1")

    codigos_a = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice, orgA)).json()}
    codigos_c = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice, orgC)).json()}
    assert codigos_a == {"A1"}
    assert codigos_c == {"C1"}


# ---------- Metas ----------

def test_goal_isolada_por_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mA = criar_metrica(client, alice, orgA, "A1").json()["id"]

    g = client.post("/api/v1/goals/", json={"metric": mA, "alvo": "10"}, headers=auth(alice, orgA))
    assert g.status_code == 201
    gid = g.json()["id"]
    assert session.get(Goal, gid).organization_id == orgA

    # bob não vê nem acessa
    assert gid not in {x["id"] for x in client.get("/api/v1/goals/", headers=auth(bob, orgB)).json()}
    assert client.get(f"/api/v1/goals/{gid}/", headers=auth(bob, orgB)).status_code == 404


# ---------- Lançamentos ----------

def test_log_isolado_por_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mA = criar_metrica(client, alice, orgA, "A1").json()["id"]
    gid = client.post("/api/v1/goals/", json={"metric": mA, "alvo": "10"}, headers=auth(alice, orgA)).json()["id"]

    l = client.post("/api/v1/logs/", json={"goal": gid, "data": "2026-07-11", "valor_logado": "3"}, headers=auth(alice, orgA))
    assert l.status_code == 201
    lid = l.json()["id"]
    assert session.get(LogEntry, lid).organization_id == orgA

    assert lid not in {x["id"] for x in client.get("/api/v1/logs/", headers=auth(bob, orgB)).json()}
    assert client.get(f"/api/v1/logs/{lid}/", headers=auth(bob, orgB)).status_code == 404


def test_nao_lanca_em_goal_de_outra_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mA = criar_metrica(client, alice, orgA, "A1").json()["id"]
    gid = client.post("/api/v1/goals/", json={"metric": mA, "alvo": "10"}, headers=auth(alice, orgA)).json()["id"]

    # bob tenta lançar na meta da org da alice
    r = client.post("/api/v1/logs/", json={"goal": gid, "data": "2026-07-11", "valor_logado": "3"}, headers=auth(bob, orgB))
    assert r.status_code == 404


def test_usuario_comum_lanca_na_org_marcada(client, session):
    """Membro NÃO-admin (papel 'user') lança e o registro pega a organização
    marcada na interface (header X-Org-Id), não outra."""
    admin, org = make_admin_org(client, session, "chefe")
    mid = criar_metrica(client, admin, org, "M1").json()["id"]
    gid = client.post("/api/v1/goals/", json={"metric": mid, "alvo": "10"}, headers=auth(admin, org)).json()["id"]

    colab = make_user(session, "colab")
    add_membro(session, colab, org, role="user")

    r = client.post(
        "/api/v1/logs/",
        json={"goal": gid, "data": "2026-07-12", "valor_logado": "4"},
        headers=auth(colab, org),
    )
    assert r.status_code == 201
    assert session.get(LogEntry, r.json()["id"]).organization_id == org


def test_usuario_comum_multi_org_lanca_na_org_do_header(client, session):
    """Membro comum de DUAS orgs: o lançamento cai na org marcada no header, e
    não dá para lançar numa meta de org diferente da marcada."""
    admin1, org1 = make_admin_org(client, session, "a1")
    admin2, org2 = make_admin_org(client, session, "a2")
    m1 = criar_metrica(client, admin1, org1, "M1").json()["id"]
    g1 = client.post("/api/v1/goals/", json={"metric": m1, "alvo": "10"}, headers=auth(admin1, org1)).json()["id"]

    colab = make_user(session, "colab")
    add_membro(session, colab, org1, role="user")
    add_membro(session, colab, org2, role="user")

    # marca org1 → cai em org1
    ok = client.post(
        "/api/v1/logs/",
        json={"goal": g1, "data": "2026-07-12", "valor_logado": "2"},
        headers=auth(colab, org1),
    )
    assert ok.status_code == 201
    assert session.get(LogEntry, ok.json()["id"]).organization_id == org1

    # marca org2 mas a meta é da org1 → recusado
    ruim = client.post(
        "/api/v1/logs/",
        json={"goal": g1, "data": "2026-07-12", "valor_logado": "2"},
        headers=auth(colab, org2),
    )
    assert ruim.status_code == 404


def test_lancamento_sem_organizacao_e_recusado(client, session):
    """Usuário SEM nenhuma organização não consegue lançar: o backend recusa
    (400), não aceita registro órfão."""
    admin, org = make_admin_org(client, session, "chefe")
    mid = criar_metrica(client, admin, org, "M1").json()["id"]
    gid = client.post("/api/v1/goals/", json={"metric": mid, "alvo": "10"}, headers=auth(admin, org)).json()["id"]

    solto = make_user(session, "solto")  # nenhum membership
    r = client.post(
        "/api/v1/logs/",
        json={"goal": gid, "data": "2026-07-12", "valor_logado": "3"},
        headers=auth(solto),  # sem X-Org-Id e sem org → sem org ativa
    )
    assert r.status_code == 400
    assert session.exec(select(LogEntry)).all() == []  # nada foi gravado


# ---------- Progress ----------

def test_apenas_inscritas_filtra_defaults_nao_assinadas(client, session):
    """A regra 'quais métricas o usuário acompanha' fica no backend: métricas da
    própria org sempre aparecem; métricas de catálogo (default) só se assinadas."""
    alice, orgA = make_admin_org(client, session, "alice")
    criar_metrica(client, alice, orgA, "PROP")  # própria da org
    d1 = Metric(codigo="PAD_A", descricao="p", is_default=True)
    d2 = Metric(codigo="PAD_B", descricao="p", is_default=True)
    session.add(d1)
    session.add(d2)
    session.commit()
    session.refresh(d1)

    # assina só a PAD_A
    client.post("/api/v1/subscriptions/", json={"metric_id": d1.id}, headers=auth(alice, orgA))

    todas = {m["codigo"] for m in client.get("/api/v1/metrics/", headers=auth(alice, orgA)).json()}
    assert {"PROP", "PAD_A", "PAD_B"} <= todas  # sem filtro: tudo que é visível

    inscritas = {
        m["codigo"]
        for m in client.get("/api/v1/metrics/?apenas_inscritas=true", headers=auth(alice, orgA)).json()
    }
    assert "PROP" in inscritas       # própria da org sempre aparece
    assert "PAD_A" in inscritas      # default assinada
    assert "PAD_B" not in inscritas  # default não assinada some


def test_progress_isolado_por_org(client, session):
    alice, orgA = make_admin_org(client, session, "alice")
    bob, orgB = make_admin_org(client, session, "bob")
    mA = criar_metrica(client, alice, orgA, "A1").json()["id"]

    # bob não enxerga métrica da alice no progress
    r = client.get(f"/api/v1/metrics/{mA}/progress?start=2026-07-01&end=2026-07-31", headers=auth(bob, orgB))
    assert r.status_code == 404
