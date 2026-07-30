"""Mensagens de import, índices externos e admin por Accept-Language (#302).

Fecha a migração do backend: com esta fatia, nenhum `detail=` literal em
português sobra no main.py.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from auth import create_access_token, hash_password
from main import app
from models import Membership, Metric, Organization, User, get_session

PT = {"Accept-Language": "pt-BR"}


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
    cliente = TestClient(app)
    yield cliente
    app.dependency_overrides.clear()


@pytest.fixture(name="admin")
def admin_fixture(session: Session):
    user = User(username="chefe", hashed_password=hash_password("secret"))
    org = Organization(nome="Acme")
    session.add(user)
    session.add(org)
    session.commit()
    session.refresh(user)
    session.refresh(org)
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()
    return user


def auth(user: User, extra: dict | None = None):
    h = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if extra:
        h.update(extra)
    return h


def _metrica(session: Session) -> Metric:
    org = session.exec(select(Organization)).first()
    m = Metric(
        codigo="M", nome="M", descricao="d", tipo="number",
        periodo="daily", organization_id=org.id,
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


# --- Importação de metas ----------------------------------------------------


def test_estrategia_invalida_nos_dois_idiomas(client, admin, session: Session):
    m = _metrica(session)
    corpo = {
        "metric_id": m.id, "alvo_total": 100,
        "inicio": "2026-01-01", "fim": "2026-01-10",
        "estrategia": "nao_existe", "dry_run": True,
    }
    r = client.post("/api/v1/goals/import", json=corpo, headers=auth(admin))
    assert r.status_code == 422
    assert r.json()["detail"] == "Invalid strategy"

    r = client.post("/api/v1/goals/import", json=corpo, headers=auth(admin, PT))
    assert r.json()["detail"] == "Estratégia inválida"


def test_data_fim_anterior_ao_inicio_nos_dois_idiomas(client, admin, session: Session):
    m = _metrica(session)
    corpo = {
        "metric_id": m.id, "alvo_total": 100,
        "inicio": "2026-01-10", "fim": "2026-01-01",
        "estrategia": "linear", "dry_run": True,
    }
    assert client.post("/api/v1/goals/import", json=corpo, headers=auth(admin)).json()["detail"] == (
        "End date is before the start"
    )
    assert client.post("/api/v1/goals/import", json=corpo, headers=auth(admin, PT)).json()["detail"] == (
        "Data fim anterior à início"
    )


# --- Índices externos -------------------------------------------------------


def test_indice_nao_encontrado_nos_dois_idiomas(client, admin):
    r = client.get("/api/v1/external-indices/nao_existe/series", headers=auth(admin))
    assert r.status_code == 404
    assert r.json()["detail"] == "Index not found"

    r = client.get("/api/v1/external-indices/nao_existe/series", headers=auth(admin, PT))
    assert r.json()["detail"] == "Índice não encontrado"


# --- Admin da organização ---------------------------------------------------


def test_plano_free_bloqueia_membro_nos_dois_idiomas(client, admin, session: Session):
    """Org free não adiciona membros (#216) — e o 403 fala o idioma do cliente.

    Este teste substituiu um de "e-mail obrigatório": aquela mensagem é
    INALCANÇÁVEL pela API. O campo é `EmailStr`, então o pydantic recusa
    qualquer valor sem "@" com um 422 de validação antes da rota rodar, e
    `body.email.strip()` nunca chega a ficar vazio. Está anotado no PR.
    """
    org = session.exec(select(Organization)).first()
    url = f"/api/v1/organizations/{org.id}/users/"
    corpo = {"email": "novo@x.com"}

    r = client.post(url, json=corpo, headers=auth(admin))
    assert r.status_code == 403
    assert r.json()["detail"] == "Adding members requires a paid plan for this organization"

    r = client.post(url, json=corpo, headers=auth(admin, PT))
    assert r.json()["detail"] == "Adicionar membros exige um plano pago para esta organização"


def test_nao_pode_remover_a_si_mesmo_nos_dois_idiomas(client, admin, session: Session):
    org = session.exec(select(Organization)).first()
    url = f"/api/v1/organizations/{org.id}/users/{admin.id}/"

    assert client.delete(url, headers=auth(admin)).json()["detail"] == "You cannot remove yourself"
    assert client.delete(url, headers=auth(admin, PT)).json()["detail"] == (
        "Você não pode remover a si mesmo"
    )


def test_acesso_restrito_ao_admin_nos_dois_idiomas(client, admin, session: Session):
    """Lançador comum não administra a org — e o 403 fala o idioma do cliente."""
    org = session.exec(select(Organization)).first()
    comum = User(username="peao", hashed_password=hash_password("secret"))
    session.add(comum)
    session.commit()
    session.refresh(comum)
    session.add(Membership(user_id=comum.id, organization_id=org.id, role="user"))
    session.commit()

    url = f"/api/v1/organizations/{org.id}/users/"
    assert client.get(url, headers=auth(comum)).json()["detail"] == (
        "Restricted to the organization admin"
    )
    assert client.get(url, headers=auth(comum, PT)).json()["detail"] == (
        "Acesso restrito ao admin da organização"
    )


# --- Fecha a migração -------------------------------------------------------


def test_nenhum_detail_literal_em_portugues_sobrou_no_main():
    """Guarda de fim de migração: `detail="..."` literal não volta sem alguém ver.

    Vale para qualquer literal, não só português: mensagem nova de rota tem que
    nascer no catálogo, senão só existe num idioma.
    """
    import pathlib
    import re

    fonte = pathlib.Path(__file__).resolve().parent.parent / "main.py"
    literais = re.findall(r'detail="[^"]*"', fonte.read_text())
    assert literais == [], f"detail= literal fora do catálogo: {literais}"
