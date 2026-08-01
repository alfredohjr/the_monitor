"""Envio de Web Push (#327).

O envio é mockado — bater num servidor de push de verdade num teste seria lento
e dependeria de rede. O que se verifica aqui é o que decide QUEM recebe, EM QUE
IDIOMA, e o que acontece quando o endpoint morre.

Há também um teste que importa o `pywebpush` de verdade. É a lição do #204: lá
o `requests` faltava em produção e os testes não pegaram, porque mockavam o
próprio import — a suíte ficou verde enquanto o login quebrava para todo mundo.
"""
from datetime import date
from unittest.mock import patch

import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy.pool import StaticPool

import push_service
from models import Membership, Organization, PushSubscription, User


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


@pytest.fixture(autouse=True)
def chaves_configuradas():
    """Sem chaves VAPID o serviço é um no-op — o que é o comportamento certo em
    produção mal configurada, mas esconderia todos os testes abaixo."""
    with patch.object(push_service, "VAPID_PRIVATE_KEY", "chave-privada-de-teste"), patch.object(
        push_service, "VAPID_SUBJECT", "mailto:teste@themonitor.app"
    ):
        yield


def make_user(session: Session, username: str, locale: str = "en", paga: bool = True) -> User:
    user = User(username=username, email=f"{username}@example.com", hashed_password="x", locale=locale)
    session.add(user)
    session.commit()
    session.refresh(user)

    org = Organization(nome=f"Org de {username}", is_paid=paga)
    session.add(org)
    session.commit()
    session.refresh(org)
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()

    session.add(
        PushSubscription(
            user_id=user.id,
            organization_id=org.id,
            endpoint=f"https://fcm.example/{username}",
            p256dh="chave-p256dh",
            auth="chave-auth",
        )
    )
    session.commit()
    return user


class RespostaDePush:
    """Erro do servidor de push, no formato que o pywebpush levanta."""

    def __init__(self, status_code: int):
        self.status_code = status_code


def erro_de_push(status: int):
    from pywebpush import WebPushException

    return WebPushException("falhou", response=RespostaDePush(status))


# ---------------------------------------------------------------------------
# Quem recebe
# ---------------------------------------------------------------------------


def test_envia_para_o_aparelho_inscrito(session: Session):
    user = make_user(session, "ana")

    with patch.object(push_service, "webpush") as envio:
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 1
    assert envio.call_count == 1
    assinatura = envio.call_args.kwargs["subscription_info"]
    assert assinatura["endpoint"] == "https://fcm.example/ana"
    assert assinatura["keys"] == {"p256dh": "chave-p256dh", "auth": "chave-auth"}


def test_nao_envia_para_aparelho_de_outra_pessoa(session: Session):
    ana = make_user(session, "ana")
    make_user(session, "bob")

    with patch.object(push_service, "webpush") as envio:
        push_service.enviar_push_para_usuario(session, ana, "Título", "Corpo")

    assert envio.call_count == 1
    assert envio.call_args.kwargs["subscription_info"]["endpoint"] == "https://fcm.example/ana"


def test_usuario_sem_inscricao_nao_quebra(session: Session):
    user = User(username="sem-aparelho", hashed_password="x")
    session.add(user)
    session.commit()
    session.refresh(user)

    with patch.object(push_service, "webpush") as envio:
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 0
    assert envio.call_count == 0


def test_sem_chaves_vapid_nao_envia_e_nao_quebra(session: Session):
    """Produção mal configurada não pode derrubar quem está criando o log.

    O push é um efeito colateral de outra ação; falhar aqui não pode impedir o
    lançamento de ser gravado.
    """
    user = make_user(session, "ana")

    with patch.object(push_service, "VAPID_PRIVATE_KEY", ""), patch.object(push_service, "webpush") as envio:
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 0
    assert envio.call_count == 0


# ---------------------------------------------------------------------------
# Limpeza de inscrição morta
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("status", [404, 410])
def test_endpoint_morto_e_removido(session: Session, status: int):
    """410 Gone e 404 são o caso NORMAL, não erro excepcional.

    O usuário desinstalou o app ou limpou os dados do navegador. Sem a limpeza,
    a tabela vira lixo que só cresce, e cada envio gasta uma requisição para um
    endereço que nunca mais vai responder.
    """
    user = make_user(session, "ana")

    with patch.object(push_service, "webpush", side_effect=erro_de_push(status)):
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 0
    assert session.exec(select(PushSubscription)).all() == []


def test_erro_temporario_NAO_remove_a_inscricao(session: Session):
    """503 é o servidor de push fora do ar, não inscrição inválida.

    Apagar aqui desinscreveria o aparelho de alguém por causa de uma
    instabilidade momentânea — e ele nunca mais receberia nada.
    """
    user = make_user(session, "ana")

    with patch.object(push_service, "webpush", side_effect=erro_de_push(503)):
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 0
    assert len(session.exec(select(PushSubscription)).all()) == 1


def test_um_aparelho_morto_nao_impede_os_outros(session: Session):
    user = make_user(session, "ana")
    session.add(
        PushSubscription(
            user_id=user.id,
            organization_id=1,
            endpoint="https://fcm.example/ana-segundo",
            p256dh="k",
            auth="a",
        )
    )
    session.commit()

    def falha_no_primeiro(**kwargs):
        if kwargs["subscription_info"]["endpoint"].endswith("/ana"):
            raise erro_de_push(410)
        return None

    with patch.object(push_service, "webpush", side_effect=falha_no_primeiro):
        enviados = push_service.enviar_push_para_usuario(session, user, "Título", "Corpo")

    assert enviados == 1
    restantes = session.exec(select(PushSubscription)).all()
    assert [s.endpoint for s in restantes] == ["https://fcm.example/ana-segundo"]


# ---------------------------------------------------------------------------
# Resumo diário: idioma e conta free
# ---------------------------------------------------------------------------


def test_conta_free_nao_recebe_push_do_resumo_diario(session: Session):
    """Mesma regra do e-mail (#253).

    Se o push escapasse dela, a conta free receberia no celular exatamente o
    que a regra decidiu não mandar por e-mail.
    """
    make_user(session, "paga", paga=True)
    make_user(session, "gratuita", paga=False)

    with patch.object(push_service, "webpush") as envio:
        push_service.enviar_resumo_push_para_todos(session, date(2026, 8, 1))

    destinos = [c.kwargs["subscription_info"]["endpoint"] for c in envio.call_args_list]
    assert destinos == ["https://fcm.example/paga"]


def test_resumo_em_portugues_para_quem_escolheu_pt_BR(session: Session):
    make_user(session, "ana", locale="pt-BR")

    with patch.object(push_service, "webpush") as envio:
        push_service.enviar_resumo_push_para_todos(session, date(2026, 8, 1))

    import json

    corpo = json.loads(envio.call_args.kwargs["data"])
    assert "Resumo" in corpo["title"]


def test_resumo_em_ingles_por_padrao(session: Session):
    # O par EN/pt-BR é obrigatório: só o lado português passaria pelo motivo
    # errado, já que o texto original nasceria em português.
    make_user(session, "ann", locale="en")

    with patch.object(push_service, "webpush") as envio:
        push_service.enviar_resumo_push_para_todos(session, date(2026, 8, 1))

    import json

    corpo = json.loads(envio.call_args.kwargs["data"])
    assert "summary" in corpo["title"].lower()


def test_o_payload_leva_titulo_corpo_e_url(session: Session):
    user = make_user(session, "ana")

    with patch.object(push_service, "webpush") as envio:
        push_service.enviar_push_para_usuario(session, user, "Meta batida", "Você chegou lá", url="/notifications")

    import json

    corpo = json.loads(envio.call_args.kwargs["data"])
    assert corpo == {"title": "Meta batida", "body": "Você chegou lá", "url": "/notifications"}


# ---------------------------------------------------------------------------
# A dependência existe de verdade (#204)
# ---------------------------------------------------------------------------


def test_pywebpush_esta_instalado_de_verdade():
    """Importa sem mock, como em produção.

    No #204 o `requests` faltava no requirements e o login quebrava em produção
    com 401; os testes passavam porque mockavam o import. Este teste falha no
    CI se a dependência sumir do requirements.txt.
    """
    from pywebpush import WebPushException, webpush

    assert callable(webpush)
    assert issubclass(WebPushException, Exception)


def test_requirements_pina_a_versao_do_pywebpush():
    """Dep não pinada é o mesmo problema do #204 por outro caminho: a versão que
    o CI instala deixa de ser a que roda em produção."""
    import pathlib

    req = pathlib.Path(__file__).resolve().parent.parent / "requirements.txt"
    linhas = [l.strip() for l in req.read_text().splitlines()]
    pin = [l for l in linhas if l.startswith("pywebpush")]
    assert pin and "==" in pin[0], "pywebpush precisa estar pinado no requirements.txt"
