"""Metas ancoradas em índice externo — estratégia 'real' (#167 follow-up).

Snapshot no import + re-ancorar sob demanda. Regra de dado: alvo corrigido pela
variação acumulada do índice no período (encadeamento), distribuído em dias cuja
soma bate com o alvo corrigido.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from main import app
from models import get_session, User, Membership, Goal, GoalAnchor, ExternalIndex, ExternalIndexPoint
from auth import hash_password, create_access_token
from external_index import resolver_alvo_ancorado, fator_indice_no_periodo


# ---------- funções puras ----------

def test_fator_no_periodo_encadeia_por_mes():
    serie = [("2026-01-01", 10.0), ("2026-02-01", 10.0), ("2026-03-01", 5.0)]
    # só jan+fev no período -> 1.1*1.1 = 1.21
    assert fator_indice_no_periodo(serie, "2026-01-01", "2026-02-28") == pytest.approx(1.21)


def test_resolver_real_corrige_pelo_indice():
    serie = [("2026-01-01", 10.0)]
    assert resolver_alvo_ancorado(100, serie, "2026-01-01", "2026-01-31", "real") == pytest.approx(110.0)


def test_strategy_nao_suportada():
    with pytest.raises(ValueError):
        resolver_alvo_ancorado(100, [], "2026-01-01", "2026-01-31", "acompanhar")


# ---------- endpoints ----------

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


def setup(client, session, ipca_jan="10"):
    admin = make_user(session)
    org = client.post("/api/v1/organizations/", json={"nome": "Org"}, headers=auth(admin)).json()["id"]
    mid = client.post("/api/v1/metrics/", json={"codigo": "REC", "descricao": "x"}, headers=auth(admin, org)).json()["id"]
    idx = ExternalIndex(code="IPCA", nome="IPCA", provider="bcb_sgs_433", frequencia="monthly", unidade="%", value_type="variacao_pct")
    session.add(idx); session.commit(); session.refresh(idx)
    session.add(ExternalIndexPoint(index_id=idx.id, ref_date="2026-01-01", value=ipca_jan)); session.commit()
    return admin, org, mid


def payload(mid, dry_run=False):
    return {"metric_id": mid, "alvo_base": 100, "inicio": "2026-01-01", "fim": "2026-01-05",
            "index_code": "IPCA", "strategy": "real", "estrategia_base": "linear", "dry_run": dry_run}


def test_import_ancorado_dry_run_mostra_alvo_corrigido(client, session):
    admin, org, mid = setup(client, session)
    r = client.post("/api/v1/goals/import-anchored", json=payload(mid, dry_run=True), headers=auth(admin, org))
    assert r.status_code == 200
    d = r.json()
    assert d["alvo_corrigido"] == pytest.approx(110.0)
    assert round(d["soma"], 2) == 110.0


def test_import_ancorado_cria_metas_e_anchor(client, session):
    admin, org, mid = setup(client, session)
    r = client.post("/api/v1/goals/import-anchored", json=payload(mid), headers=auth(admin, org))
    assert r.status_code == 200
    anchor_id = r.json()["anchor_id"]
    goals = session.exec(select(Goal).where(Goal.anchor_id == anchor_id, Goal.deleted == False)).all()
    assert len(goals) == 5
    assert round(sum(float(g.alvo) for g in goals), 2) == 110.0
    assert session.get(GoalAnchor, anchor_id) is not None


def test_re_ancorar_recomputa_com_indice_revisado(client, session):
    admin, org, mid = setup(client, session, ipca_jan="10")
    anchor_id = client.post("/api/v1/goals/import-anchored", json=payload(mid), headers=auth(admin, org)).json()["anchor_id"]
    # índice revisado: jan passa de 10% para 20%
    ponto = session.exec(select(ExternalIndexPoint).where(ExternalIndexPoint.ref_date == "2026-01-01")).first()
    ponto.value = "20"; session.add(ponto); session.commit()

    r = client.post(f"/api/v1/goals/anchors/{anchor_id}/re-anchor", headers=auth(admin, org))
    assert r.status_code == 200
    assert r.json()["alvo_corrigido"] == pytest.approx(120.0)
    goals = session.exec(select(Goal).where(Goal.anchor_id == anchor_id, Goal.deleted == False)).all()
    assert round(sum(float(g.alvo) for g in goals), 2) == 120.0


def test_import_ancorado_indice_inexistente_404(client, session):
    admin, org, mid = setup(client, session)
    body = payload(mid); body["index_code"] = "NOPE"
    r = client.post("/api/v1/goals/import-anchored", json=body, headers=auth(admin, org))
    assert r.status_code == 404
