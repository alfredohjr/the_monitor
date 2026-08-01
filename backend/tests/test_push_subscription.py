"""Inscrições de push (#326).

Testes a nível de dado, via TestClient: o que importa é o que sobra no banco
depois da requisição, não o formato da resposta.

O caso mais importante é a **idempotência**. O navegador reentrega a MESMA
inscrição a cada carregamento da página — se cada uma virasse linha nova, a
tabela cresceria sem limite e o mesmo aparelho receberia a notificação
repetida, uma vez por linha.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, create_engine, select
from sqlalchemy.pool import StaticPool

from main import app
from models import Membership, Organization, PushSubscription, User, get_session
from auth import create_access_token, hash_password


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


def make_user(session: Session, username: str) -> User:
    user = User(username=username, hashed_password=hash_password("secret"))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def make_org(session: Session, user: User, nome: str) -> Organization:
    org = Organization(nome=nome)
    session.add(org)
    session.commit()
    session.refresh(org)
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()
    return org


def auth(user: User, org: Organization | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {create_access_token(user.username)}"}
    if org is not None:
        headers["X-Org-Id"] = str(org.id)
    return headers


def inscricao(endpoint: str = "https://fcm.googleapis.com/fcm/send/abc123") -> dict:
    return {
        "endpoint": endpoint,
        "p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
        "auth": "tBHItJI5svbpez7KI4CCXg",
    }


def test_subscribe_exige_token(client: TestClient):
    assert client.post("/api/v1/push/subscribe/", json=inscricao()).status_code == 403


def test_subscribe_grava_a_inscricao(client: TestClient, session: Session):
    ana = make_user(session, "ana")
    org = make_org(session, ana, "Acme")

    resp = client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org))

    assert resp.status_code == 201
    guardadas = session.exec(select(PushSubscription)).all()
    assert len(guardadas) == 1
    assert guardadas[0].user_id == ana.id
    assert guardadas[0].organization_id == org.id
    # `platform` já existe pensando no app nativo da 0.7, que vai reusar esta
    # tabela. Web é o default para não exigir mudança no cliente atual.
    assert guardadas[0].platform == "web"


def test_subscribe_e_idempotente(client: TestClient, session: Session):
    """O mesmo endpoint duas vezes não vira duas linhas.

    O navegador reentrega a mesma inscrição a cada carregamento. Sem isto, a
    tabela cresce sem limite e o aparelho recebe a notificação uma vez por
    linha duplicada.
    """
    ana = make_user(session, "ana")
    org = make_org(session, ana, "Acme")

    primeira = client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org))
    segunda = client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org))

    assert primeira.status_code == 201
    assert segunda.status_code == 201
    assert len(session.exec(select(PushSubscription)).all()) == 1


def test_reinscricao_atualiza_as_chaves(client: TestClient, session: Session):
    """Mesmo endpoint, chaves novas: atualiza em vez de ignorar.

    O navegador pode renovar as chaves mantendo o endpoint. Ignorar a segunda
    chamada deixaria chave velha no banco, e o envio falharia com um erro de
    criptografia difícil de rastrear.
    """
    ana = make_user(session, "ana")
    org = make_org(session, ana, "Acme")
    client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org))

    renovada = inscricao()
    renovada["auth"] = "chaveNovaDepoisDaRenovacao"
    client.post("/api/v1/push/subscribe/", json=renovada, headers=auth(ana, org))

    guardadas = session.exec(select(PushSubscription)).all()
    assert len(guardadas) == 1
    assert guardadas[0].auth == "chaveNovaDepoisDaRenovacao"


def test_inscricao_fica_escopada_por_organizacao(client: TestClient, session: Session):
    """A mesma pessoa em duas orgs tem duas inscrições.

    Notificação é de uma organização; sem o escopo, quem participa de duas
    receberia no aparelho um aviso da org que não estava olhando.
    """
    ana = make_user(session, "ana")
    acme = make_org(session, ana, "Acme")
    beta = make_org(session, ana, "Beta")

    client.post("/api/v1/push/subscribe/", json=inscricao("https://fcm.example/aparelho-1"), headers=auth(ana, acme))
    client.post("/api/v1/push/subscribe/", json=inscricao("https://fcm.example/aparelho-2"), headers=auth(ana, beta))

    orgs = {s.organization_id for s in session.exec(select(PushSubscription)).all()}
    assert orgs == {acme.id, beta.id}


def test_delete_remove_a_inscricao(client: TestClient, session: Session):
    ana = make_user(session, "ana")
    org = make_org(session, ana, "Acme")
    client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org))

    resp = client.request(
        "DELETE", "/api/v1/push/subscribe/", json={"endpoint": inscricao()["endpoint"]}, headers=auth(ana, org)
    )

    assert resp.status_code == 204
    assert session.exec(select(PushSubscription)).all() == []


def test_delete_nao_remove_inscricao_de_outra_pessoa(client: TestClient, session: Session):
    """Endpoint alheio não é apagável.

    O endpoint vem do corpo da requisição, então qualquer pessoa autenticada
    poderia mandar o de outra. Sem o filtro por usuário, dava para desinscrever
    o aparelho de terceiros — silenciar as notificações de alguém.
    """
    ana = make_user(session, "ana")
    bob = make_user(session, "bob")
    org_ana = make_org(session, ana, "Acme")
    org_bob = make_org(session, bob, "Beta")
    client.post("/api/v1/push/subscribe/", json=inscricao(), headers=auth(ana, org_ana))

    resp = client.request(
        "DELETE", "/api/v1/push/subscribe/", json={"endpoint": inscricao()["endpoint"]}, headers=auth(bob, org_bob)
    )

    assert resp.status_code == 204  # idempotente: não revela que o endpoint existe
    assert len(session.exec(select(PushSubscription)).all()) == 1


def test_delete_exige_token(client: TestClient):
    resp = client.request("DELETE", "/api/v1/push/subscribe/", json={"endpoint": "https://fcm.example/x"})
    assert resp.status_code == 403


def test_dois_aparelhos_do_mesmo_usuario_coexistem(client: TestClient, session: Session):
    """Celular e desktop são inscrições distintas, não uma substituindo a outra."""
    ana = make_user(session, "ana")
    org = make_org(session, ana, "Acme")

    client.post("/api/v1/push/subscribe/", json=inscricao("https://fcm.example/celular"), headers=auth(ana, org))
    client.post("/api/v1/push/subscribe/", json=inscricao("https://fcm.example/desktop"), headers=auth(ana, org))

    assert len(session.exec(select(PushSubscription)).all()) == 2
