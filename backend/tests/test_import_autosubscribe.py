"""Import (normal e ancorado) auto-inscreve o usuário na métrica (#185).

Bug: meta importada numa métrica de catálogo (is_default) não aparecia nas telas
que filtram por `apenas_inscritas` (dashboard/simulação/GoalForm/métricas), só em
lançamentos. Correção: o import cria a UserMetricSubscription, então a métrica
passa a aparecer no conjunto inscrito.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Metric, ExternalIndex, ExternalIndexPoint, UserMetricSubscription
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


def make_user(session, username="admin"):
    u = User(username=username, hashed_password=hash_password("s"))
    session.add(u); session.commit(); session.refresh(u)
    return u


def auth(user, org=None):
    h = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if org is not None:
        h["X-Org-Id"] = str(org)
    return h


def make_default_metric(session, codigo="PAD_X"):
    m = Metric(codigo=codigo, descricao="catálogo", is_default=True, organization_id=None)
    session.add(m); session.commit(); session.refresh(m)
    return m


def setup(client, session):
    admin = make_user(session)
    org = client.post("/api/v1/organizations/", json={"nome": "Org"}, headers=auth(admin)).json()["id"]
    metric = make_default_metric(session)
    return admin, org, metric


def inscritas_codigos(client, user, org):
    return {m["codigo"] for m in client.get("/api/v1/metrics/?apenas_inscritas=true", headers=auth(user, org)).json()}


def test_metrica_catalogo_nao_aparece_antes_do_import(client, session):
    admin, org, metric = setup(client, session)
    assert "PAD_X" not in inscritas_codigos(client, admin, org)  # reproduz o cenário do bug


def test_import_normal_auto_inscreve(client, session):
    admin, org, metric = setup(client, session)
    r = client.post("/api/v1/goals/import", json={
        "metric_id": metric.id, "alvo_total": 100, "inicio": "2026-08-01", "fim": "2026-08-03",
        "estrategia": "linear", "dry_run": False,
    }, headers=auth(admin, org))
    assert r.status_code == 200
    sub = session.exec(select(UserMetricSubscription).where(
        UserMetricSubscription.user_id == admin.id, UserMetricSubscription.metric_id == metric.id)).first()
    assert sub is not None
    assert "PAD_X" in inscritas_codigos(client, admin, org)  # agora aparece nas telas


def test_import_dry_run_nao_inscreve(client, session):
    admin, org, metric = setup(client, session)
    client.post("/api/v1/goals/import", json={
        "metric_id": metric.id, "alvo_total": 100, "inicio": "2026-08-01", "fim": "2026-08-03",
        "estrategia": "linear", "dry_run": True,
    }, headers=auth(admin, org))
    sub = session.exec(select(UserMetricSubscription).where(UserMetricSubscription.metric_id == metric.id)).first()
    assert sub is None


def test_import_ancorado_auto_inscreve(client, session):
    admin, org, metric = setup(client, session)
    idx = ExternalIndex(code="IPCA", nome="IPCA", provider="bcb_sgs_433", frequencia="monthly", unidade="%", value_type="variacao_pct")
    session.add(idx); session.commit(); session.refresh(idx)
    session.add(ExternalIndexPoint(index_id=idx.id, ref_date="2026-01-01", value="10")); session.commit()

    r = client.post("/api/v1/goals/import-anchored", json={
        "metric_id": metric.id, "alvo_base": 100, "inicio": "2026-01-01", "fim": "2026-01-05",
        "index_code": "IPCA", "strategy": "real", "estrategia_base": "linear", "dry_run": False,
    }, headers=auth(admin, org))
    assert r.status_code == 200
    assert "PAD_X" in inscritas_codigos(client, admin, org)


def test_import_e_idempotente_na_inscricao(client, session):
    admin, org, metric = setup(client, session)
    body = {"metric_id": metric.id, "alvo_total": 100, "inicio": "2026-08-01", "fim": "2026-08-03",
            "estrategia": "linear", "dry_run": False}
    client.post("/api/v1/goals/import", json=body, headers=auth(admin, org))
    client.post("/api/v1/goals/import", json=body, headers=auth(admin, org))  # 2ª vez não duplica
    subs = session.exec(select(UserMetricSubscription).where(UserMetricSubscription.metric_id == metric.id)).all()
    assert len(subs) == 1
