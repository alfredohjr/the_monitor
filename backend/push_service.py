"""Envio de Web Push com VAPID (#327).

O push é sempre **efeito colateral** de outra ação — criar uma notificação,
rodar o resumo diário. Por isso nada aqui levanta exceção para fora: falhar no
envio não pode impedir o lançamento de ser gravado nem derrubar o worker.

As chaves VAPID vêm do ambiente. Sem elas o módulo inteiro vira no-op, que é o
comportamento certo numa instalação ainda não configurada: o app funciona, só
não manda push.
"""
import json
import logging
import os
from datetime import date

from sqlmodel import Session, select

from messages import t
from models import Membership, Organization, PushSubscription, User

logger = logging.getLogger(__name__)

# Import no topo, sem try/except: se o pacote sumir do requirements, o erro
# aparece na subida e não meses depois num envio silencioso (lição do #204).
from pywebpush import WebPushException, webpush

# Par VAPID. A pública também vai para o frontend (#328); a privada nunca sai
# daqui. Geradas uma vez com `vapid --gen` e guardadas como segredo do servidor.
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
# O padrão VAPID exige um contato para o servidor de push avisar sobre abusos.
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "")

# Status que significam "este endpoint não existe mais": o usuário desinstalou
# o app ou limpou os dados do navegador. É o caso normal, não erro excepcional.
STATUS_INSCRICAO_MORTA = (404, 410)


def push_configurado() -> bool:
    return bool(VAPID_PRIVATE_KEY and VAPID_SUBJECT)


def _payload(titulo: str, corpo: str, url: str) -> str:
    # O service worker lê exatamente estas três chaves no evento `push`.
    return json.dumps({"title": titulo, "body": corpo, "url": url})


def enviar_push_para_usuario(
    session: Session, user: User, titulo: str, corpo: str, url: str = "/notifications"
) -> int:
    """Manda o push para todos os aparelhos do usuário.

    Devolve quantos foram entregues ao servidor de push. Inscrição com endpoint
    morto é **removida**; erro temporário é apenas registrado — apagar num 503
    desinscreveria o aparelho de alguém por causa de uma instabilidade
    momentânea, e ele nunca mais receberia nada.
    """
    if not push_configurado():
        logger.debug("push não configurado; nada enviado")
        return 0

    inscricoes = session.exec(select(PushSubscription).where(PushSubscription.user_id == user.id)).all()
    if not inscricoes:
        return 0

    dados = _payload(titulo, corpo, url)
    enviados = 0
    mortas: list[PushSubscription] = []

    for inscricao in inscricoes:
        try:
            webpush(
                subscription_info={
                    "endpoint": inscricao.endpoint,
                    "keys": {"p256dh": inscricao.p256dh, "auth": inscricao.auth},
                },
                data=dados,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": VAPID_SUBJECT},
            )
            enviados += 1
        except WebPushException as erro:
            status = getattr(getattr(erro, "response", None), "status_code", None)
            if status in STATUS_INSCRICAO_MORTA:
                mortas.append(inscricao)
            else:
                # Um aparelho com problema não pode impedir os outros de receber.
                logger.warning("falha ao enviar push para %s: %s", inscricao.endpoint, erro)
        except Exception as erro:  # noqa: BLE001 - efeito colateral nunca derruba o chamador
            logger.warning("erro inesperado no push para %s: %s", inscricao.endpoint, erro)

    for inscricao in mortas:
        session.delete(inscricao)
    if mortas:
        session.commit()

    return enviados


def _ids_de_usuarios_pagos(session: Session) -> set[int]:
    """Mesma regra do e-mail (#253), com a mesma consulta.

    Não é reuso por preguiça: se as duas divergirem, a conta free recebe no
    celular exatamente o que a regra decidiu não mandar por e-mail.
    """
    rows = session.exec(
        select(Membership.user_id)
        .join(Organization, Organization.id == Membership.organization_id)
        .where(Organization.is_paid == True, Organization.deleted == False)  # noqa: E712
    ).all()
    return set(rows)


def enviar_resumo_push_para_todos(session: Session, hoje: date | None = None) -> int:
    """Push do resumo diário, acompanhando o e-mail.

    O idioma sai de `User.locale` (#304), não de header nenhum: aqui não existe
    requisição — é um worker.
    """
    if not push_configurado():
        return 0

    del hoje  # a data não entra no texto do push; o corpo é curto de propósito
    pagos = _ids_de_usuarios_pagos(session)
    total = 0

    for user in session.exec(select(User)).all():
        if user.id not in pagos:
            continue  # conta free não recebe notificação (#253)
        total += enviar_push_para_usuario(
            session,
            user,
            t("push.resumo_titulo", user.locale),
            t("push.resumo_corpo", user.locale),
        )

    return total
