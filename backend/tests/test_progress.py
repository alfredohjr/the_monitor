import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, Goal
from auth import hash_password, create_access_token
from progress import compute_progress, bucket_key


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


def make_user(session, username="ana"):
    u = User(username=username, hashed_password=hash_password("s"))
    session.add(u); session.commit(); session.refresh(u)
    return u


def make_metric(session, periodo="daily", tipo="currency"):
    m = Metric(codigo="REC", nome="Receita", descricao="d", tipo=tipo, periodo=periodo)
    session.add(m); session.commit(); session.refresh(m)
    return m


def add_goal(session, metric_id, alvo, ref):
    g = Goal(metric=metric_id, alvo=alvo, periodo_referencia=ref)
    session.add(g); session.commit(); session.refresh(g)
    return g


def auth(u):
    return {"Authorization": f"Bearer {create_access_token(u.username)}"}


def test_realizado_atribuido_ao_periodo_da_meta_nao_a_data_do_log(client, session):
    """Reproduz o bug do dashboard: lançamentos registrados todos no mesmo dia
    (data=2026-07-08) mas para metas de dias diferentes. O realizado deve cair
    no periodo_referencia da meta, não na data do check-in."""
    u = make_user(session)
    m = make_metric(session, periodo="daily")
    g1 = add_goal(session, m.id, "300", "2026-07-01")
    g2 = add_goal(session, m.id, "300", "2026-07-05")
    # todos os lançamentos com data 2026-07-08:
    for goal_id, valor in [(g1.id, "800"), (g1.id, "50"), (g2.id, "300")]:
        client.post("/api/v1/logs/", json={"goal": goal_id, "data": "2026-07-08", "valor_logado": valor}, headers=auth(u))

    resp = client.get(f"/api/v1/metrics/{m.id}/progress?start=2026-07-01&end=2026-07-31", headers=auth(u))
    assert resp.status_code == 200
    pontos = {p["periodo"]: p for p in resp.json()["pontos"]}

    # realizado alinhado com a meta, por dia-alvo — NÃO em 2026-07-08
    assert "2026-07-08" not in pontos
    assert pontos["2026-07-01"]["realizado"] == 850  # 800 + 50
    assert pontos["2026-07-01"]["meta"] == 300
    assert pontos["2026-07-05"]["realizado"] == 300
    assert pontos["2026-07-05"]["meta"] == 300


def test_totais_e_percentual(client, session):
    u = make_user(session, "bob")
    m = make_metric(session, periodo="daily")
    g1 = add_goal(session, m.id, "300", "2026-07-01")
    g2 = add_goal(session, m.id, "300", "2026-07-05")
    client.post("/api/v1/logs/", json={"goal": g1.id, "data": "2026-07-08", "valor_logado": "150"}, headers=auth(u))
    client.post("/api/v1/logs/", json={"goal": g2.id, "data": "2026-07-08", "valor_logado": "300"}, headers=auth(u))

    body = client.get(f"/api/v1/metrics/{m.id}/progress?start=2026-07-01&end=2026-07-31", headers=auth(u)).json()
    assert body["meta_total"] == 600
    assert body["realizado_total"] == 450
    assert body["pct"] == 75


def test_meta_fora_do_intervalo_e_ignorada(client, session):
    u = make_user(session, "cid")
    m = make_metric(session, periodo="daily")
    dentro = add_goal(session, m.id, "100", "2026-07-10")
    fora = add_goal(session, m.id, "100", "2026-08-10")
    client.post("/api/v1/logs/", json={"goal": dentro.id, "data": "2026-07-08", "valor_logado": "40"}, headers=auth(u))
    client.post("/api/v1/logs/", json={"goal": fora.id, "data": "2026-07-08", "valor_logado": "90"}, headers=auth(u))

    pontos = {p["periodo"]: p for p in client.get(f"/api/v1/metrics/{m.id}/progress?start=2026-07-01&end=2026-07-31", headers=auth(u)).json()["pontos"]}
    assert "2026-08-10" not in pontos
    assert pontos["2026-07-10"]["realizado"] == 40


def test_bucket_mensal_agrega_por_mes(client, session):
    u = make_user(session, "dan")
    m = make_metric(session, periodo="monthly")
    g = add_goal(session, m.id, "1000", "2026-07")
    client.post("/api/v1/logs/", json={"goal": g.id, "data": "2026-07-03", "valor_logado": "400"}, headers=auth(u))
    client.post("/api/v1/logs/", json={"goal": g.id, "data": "2026-07-28", "valor_logado": "600"}, headers=auth(u))
    pontos = {p["periodo"]: p for p in client.get(f"/api/v1/metrics/{m.id}/progress?start=2026-07-01&end=2026-07-31", headers=auth(u)).json()["pontos"]}
    assert pontos["2026-07"]["realizado"] == 1000
    assert pontos["2026-07"]["meta"] == 1000


def test_bucket_key_semanal_iso():
    from datetime import date
    # 2026-07-08 é uma quarta-feira -> semana ISO
    assert bucket_key(date(2026, 7, 8), "weekly").startswith("2026-W")
    # dias da mesma semana ISO caem no mesmo bucket
    assert bucket_key(date(2026, 7, 6), "weekly") == bucket_key(date(2026, 7, 12), "weekly")
