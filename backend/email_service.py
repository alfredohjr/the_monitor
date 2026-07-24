import logging
import os
import smtplib
import ssl
from datetime import date
from email.message import EmailMessage

from sqlmodel import Session, select

from models import Goal, LogEntry, Metric, User

logger = logging.getLogger(__name__)


def build_resumo(user: User, session: Session, hoje: date | None = None) -> dict:
    if hoje is None:
        hoje = date.today()

    goals = session.exec(select(Goal).where(Goal.deleted == False)).all()

    itens = []
    for goal in goals:
        metric = session.get(Metric, goal.metric)
        if not metric or metric.deleted:
            continue

        log = session.exec(
            select(LogEntry).where(
                LogEntry.goal == goal.id,
                LogEntry.data == hoje,
                LogEntry.deleted == False,
            )
        ).first()

        valor_atual = log.valor_logado if log else None

        em_risco = False
        if valor_atual is not None:
            try:
                if float(valor_atual) / float(goal.alvo) < 0.7:
                    em_risco = True
            except (ValueError, ZeroDivisionError):
                pass

        itens.append({
            "metric_nome": metric.nome or metric.codigo,
            "alvo": goal.alvo,
            "valor_atual": valor_atual,
            "em_risco": em_risco,
            "periodo_referencia": goal.periodo_referencia,
        })

    return {
        "username": user.username,
        "data": hoje.isoformat(),
        "itens": itens,
    }


def render_html(resumo: dict) -> str:
    itens_html = ""
    for item in resumo["itens"]:
        valor = item["valor_atual"] if item["valor_atual"] is not None else "—"
        risco_badge = ' <span style="color:#c0392b;font-weight:bold;">⚠ em risco</span>' if item["em_risco"] else ""
        itens_html += f"""
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">{item['metric_nome']}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{item['alvo']}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{valor}{risco_badge}</td>
        </tr>"""

    sem_metas = "<p>Nenhuma meta cadastrada ainda.</p>" if not resumo["itens"] else ""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Resumo diário de metas</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:40px auto;color:#333">
  <h2 style="color:#2c3e50">Resumo do dia — {resumo['data']}</h2>
  <p>Olá, <strong>{resumo['username']}</strong>!</p>
  {sem_metas}
  {"" if not resumo["itens"] else f'''
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Métrica</th>
        <th style="padding:8px">Alvo</th>
        <th style="padding:8px">Hoje</th>
      </tr>
    </thead>
    <tbody>{itens_html}</tbody>
  </table>'''}
  <hr style="margin-top:32px">
  <p style="font-size:12px;color:#999">The Monitor — acompanhamento de metas</p>
</body>
</html>"""


# Timeout do SMTP. Sem ele o socket usa o default do sistema (minutos), e como o
# envio acontece dentro do /register, um servidor morto penduraria o cadastro.
SMTP_TIMEOUT = 10


def _smtp_config() -> dict | None:
    """Config do SMTP, ou None se não houver host — aí o envio só loga.

    Lida a cada chamada (e não no import) para o ambiente poder mudar sem reimportar
    o módulo, e para os testes conseguirem sobrescrever com monkeypatch.
    """
    host = os.getenv("SMTP_HOST", "").strip()
    if not host:
        return None
    user = os.getenv("SMTP_USER", "").strip()
    return {
        "host": host,
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": user,
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from": os.getenv("SMTP_FROM", "").strip() or user,
        "tls": os.getenv("SMTP_TLS", "true").strip().lower() in ("1", "true", "yes"),
    }


def send_email(to_email: str, subject: str, html: str) -> bool:
    """Envia um e-mail. Retorna se foi enviado; NUNCA levanta.

    Quem chama (o /register, o resumo diário) não pode quebrar por causa de e-mail:
    o cadastro já commitou o usuário quando chega aqui, e no resumo um destinatário
    ruim não pode calar os demais. Falha vira log de erro + False.
    """
    config = _smtp_config()
    if config is None:
        logger.info("Email para %s | assunto: %s | (envio não configurado)", to_email, subject)
        return False

    if not config["from"]:
        # From vazio sai como envelope <>: provedor recusa ou marca spam. Com o
        # SMTP_HOST preenchido a intenção era enviar, então isto é erro de config.
        logger.error(
            "SMTP_HOST configurado mas sem remetente: defina SMTP_FROM (ou SMTP_USER). "
            "E-mail para %s não enviado.", to_email,
        )
        return False

    msg = EmailMessage()
    msg["From"] = config["from"]
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(html, subtype="html")

    try:
        if config["port"] == 465:
            # Porta 465 = SSL implícito (TLS já no connect) → SMTP_SSL, NÃO STARTTLS.
            # Ex.: Titan (smtp.titan.email). STARTTLS aqui trava/falha.
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(config["host"], config["port"], timeout=SMTP_TIMEOUT, context=context) as smtp:
                if config["user"]:
                    smtp.login(config["user"], config["password"])
                smtp.send_message(msg)
        else:
            # Porta 587 (padrão) = STARTTLS: conecta em claro e sobe pra TLS.
            with smtplib.SMTP(config["host"], config["port"], timeout=SMTP_TIMEOUT) as smtp:
                if config["tls"]:
                    smtp.starttls()
                if config["user"]:
                    smtp.login(config["user"], config["password"])
                smtp.send_message(msg)
    except Exception:
        logger.exception("Falha ao enviar e-mail para %s (assunto: %s)", to_email, subject)
        return False

    logger.info("Email enviado para %s | assunto: %s", to_email, subject)
    return True


def send_verification_email(to_email: str, token: str) -> bool:
    """Envia o link de verificação de e-mail.

    O link aponta para o frontend, que consome o token via POST /verify-email/.
    O link também vai pro log: se o envio falhar, é por ali que se destrava um
    usuário preso no 403 até existir uma tela de reenvio.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    link = f"{frontend_url}/verificar-email?token={token}"
    html = (
        f'<p>Confirme seu e-mail clicando no link abaixo (válido por 24h):</p>'
        f'<p><a href="{link}">{link}</a></p>'
    )
    logger.info("Verificação de e-mail para %s | link: %s", to_email, link)
    return send_email(to_email, "Confirme seu e-mail — The Monitor", html)


def send_password_reset_email(to_email: str, token: str) -> bool:
    """Envia o link de redefinição de senha (#242).

    O link aponta para o frontend (/redefinir-senha), que consome o token via
    POST /password-reset/confirm/. Vai também pro log, útil se o SMTP falhar.
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    link = f"{frontend_url}/redefinir-senha?token={token}"
    html = (
        f'<p>Recebemos um pedido para redefinir sua senha. Clique no link abaixo (válido por 1h):</p>'
        f'<p><a href="{link}">{link}</a></p>'
        f'<p>Se não foi você, ignore este e-mail.</p>'
    )
    logger.info("Redefinição de senha para %s | link: %s", to_email, link)
    return send_email(to_email, "Redefinição de senha — The Monitor", html)


def enviar_resumo_para_todos(session: Session) -> None:
    users = session.exec(select(User).where(User.email != None)).all()
    hoje = date.today()
    for user in users:
        resumo = build_resumo(user, session, hoje)
        html = render_html(resumo)
        send_email(user.email, f"Resumo de metas — {hoje}", html)
