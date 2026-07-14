"""ExternalIndex (#167): funções puras (nível de dado) + endpoints idempotentes."""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

import main
from main import app
from models import get_session, User, ExternalIndex, ExternalIndexPoint
from auth import hash_password, create_access_token
from external_index import acumular_variacoes, deflacionar, distribuir_total_mensal_em_dias


# ---------- funções puras ----------

def test_acumula_por_encadeamento_nao_por_soma():
    # 10% e 10% encadeados = 21%, não 20%.
    assert acumular_variacoes([10, 10]) == pytest.approx(0.21)


def test_deflacionar_recupera_o_real():
    # 121 nominais deflacionados por 10%+10% (fator 1.21) = 100 reais.
    assert deflacionar(121, [10, 10]) == pytest.approx(100.0)


def test_distribuicao_mensal_soma_bate_com_o_total():
    valores = distribuir_total_mensal_em_dias(100, 3)
    assert len(valores) == 3
    assert round(sum(valores), 2) == 100.0


def test_distribuicao_exige_dias_positivos():
    with pytest.raises(ValueError):
        distribuir_total_mensal_em_dias(100, 0)


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


def make_user(session, username="u"):
    u = User(username=username, hashed_password=hash_password("secret"))
    session.add(u); session.commit(); session.refresh(u)
    return u


def auth(user):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


def make_index(session, code="IPCA", provider="bcb_sgs_433"):
    idx = ExternalIndex(code=code, nome="IPCA", provider=provider, frequencia="monthly", unidade="%", value_type="variacao_pct")
    session.add(idx); session.commit(); session.refresh(idx)
    return idx


def test_lista_indices(client, session):
    make_index(session)
    u = make_user(session)
    r = client.get("/api/v1/external-indices/", headers=auth(u))
    assert r.status_code == 200
    assert any(i["code"] == "IPCA" for i in r.json())


def test_series_de_um_indice(client, session):
    idx = make_index(session)
    session.add(ExternalIndexPoint(index_id=idx.id, ref_date="2026-01-01", value="0.5"))
    session.commit()
    u = make_user(session)
    r = client.get("/api/v1/external-indices/IPCA/series", headers=auth(u))
    assert r.status_code == 200
    assert r.json()["pontos"][0]["ref_date"] == "2026-01-01"


def test_refresh_e_idempotente(client, session, monkeypatch):
    make_index(session)
    u = make_user(session)
    dados = [{"ref_date": "2026-01-01", "value": "0.5"}, {"ref_date": "2026-02-01", "value": "0.3"}]
    monkeypatch.setitem(main.EXTERNAL_PROVIDERS, "bcb_sgs_433", lambda: dados)

    r1 = client.post("/api/v1/external-indices/IPCA/refresh", headers=auth(u))
    assert r1.status_code == 200
    assert r1.json()["novos"] == 2
    # segunda chamada não duplica pontos (unique por index+ref_date)
    r2 = client.post("/api/v1/external-indices/IPCA/refresh", headers=auth(u))
    assert r2.json()["novos"] == 0
    assert len(session.exec(select(ExternalIndexPoint)).all()) == 2


def test_refresh_atualiza_revisao_sem_duplicar(client, session, monkeypatch):
    make_index(session)
    u = make_user(session)
    monkeypatch.setitem(main.EXTERNAL_PROVIDERS, "bcb_sgs_433", lambda: [{"ref_date": "2026-01-01", "value": "0.5"}])
    client.post("/api/v1/external-indices/IPCA/refresh", headers=auth(u))
    # revisão do mesmo mês
    monkeypatch.setitem(main.EXTERNAL_PROVIDERS, "bcb_sgs_433", lambda: [{"ref_date": "2026-01-01", "value": "0.6"}])
    client.post("/api/v1/external-indices/IPCA/refresh", headers=auth(u))
    pts = session.exec(select(ExternalIndexPoint).where(ExternalIndexPoint.ref_date == "2026-01-01")).all()
    assert len(pts) == 1
    assert pts[0].value == "0.6"


def test_refresh_sem_provider_automatico_400(client, session, monkeypatch):
    make_index(session, code="ABRAS", provider="manual")
    u = make_user(session)
    r = client.post("/api/v1/external-indices/ABRAS/refresh", headers=auth(u))
    assert r.status_code == 400


def test_indice_inexistente_404(client, session):
    u = make_user(session)
    assert client.get("/api/v1/external-indices/NOPE/series", headers=auth(u)).status_code == 404
