import logging
import os
from datetime import date

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


def send_email(to_email: str, subject: str, html: str) -> None:
    # stub — integrar com provedor após definição da issue #19
    logger.info("Email para %s | assunto: %s | (envio não configurado)", to_email, subject)


FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def send_verification_email(to_email: str, token: str) -> None:
    """Envia o link de verificação de e-mail (stub loga o link).

    O link aponta para o frontend, que consome o token via POST /verify-email/.
    Enquanto não há provedor configurado, o link fica visível nos logs do servidor.
    """
    link = f"{FRONTEND_URL}/verificar-email?token={token}"
    html = (
        f'<p>Confirme seu e-mail clicando no link abaixo (válido por 24h):</p>'
        f'<p><a href="{link}">{link}</a></p>'
    )
    logger.info("Verificação de e-mail para %s | link: %s", to_email, link)
    send_email(to_email, "Confirme seu e-mail — The Monitor", html)


def enviar_resumo_para_todos(session: Session) -> None:
    users = session.exec(select(User).where(User.email != None)).all()
    hoje = date.today()
    for user in users:
        resumo = build_resumo(user, session, hoje)
        html = render_html(resumo)
        send_email(user.email, f"Resumo de metas — {hoje}", html)
