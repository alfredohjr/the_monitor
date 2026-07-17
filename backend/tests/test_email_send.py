"""Envio real de e-mail via SMTP.

O contrato central é: `send_email` NUNCA levanta exceção. Ela é chamada de dentro
do /register (depois do commit do usuário), então uma falha de SMTP que propagasse
devolveria 500 com o usuário já criado — username queimado e sem e-mail enviado.

Sem SMTP_HOST configurado o comportamento antigo é preservado (só loga), o que
mantém dev e os testes existentes funcionando sem configuração nenhuma.
"""
import logging

import pytest
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

import email_service
from email_service import send_email, send_verification_email, enviar_resumo_para_todos
from models import User
from auth import hash_password


SMTP_ENVS = (
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD",
    "SMTP_FROM", "SMTP_TLS", "FRONTEND_URL",
)


@pytest.fixture(autouse=True)
def limpa_env(monkeypatch):
    # Existe um .env real na raiz do repo; sem isto o teste dependeria da máquina.
    for var in SMTP_ENVS:
        monkeypatch.delenv(var, raising=False)


class FakeSMTP:
    """Substitui smtplib.SMTP. Grava o que recebeu; não toca a rede."""

    instances = []
    falha_no_envio = False
    falhar_para = set()      # destinatários cujo envio levanta

    def __init__(self, host, port, timeout=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.tls = False
        self.login_args = None
        self.enviadas = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self):
        self.tls = True

    def login(self, user, password):
        self.login_args = (user, password)

    def send_message(self, msg):
        if FakeSMTP.falha_no_envio or msg["To"] in FakeSMTP.falhar_para:
            raise OSError("smtp caiu")
        self.enviadas.append(msg)

    @classmethod
    def todas_enviadas(cls):
        return [msg for conn in cls.instances for msg in conn.enviadas]


@pytest.fixture(name="smtp")
def smtp_fixture(monkeypatch):
    FakeSMTP.instances = []
    FakeSMTP.falha_no_envio = False
    FakeSMTP.falhar_para = set()
    monkeypatch.setattr(email_service.smtplib, "SMTP", FakeSMTP)
    yield FakeSMTP
    FakeSMTP.instances = []
    FakeSMTP.falha_no_envio = False
    FakeSMTP.falhar_para = set()


@pytest.fixture(name="smtp_configurado")
def smtp_configurado_fixture(monkeypatch, smtp):
    monkeypatch.setenv("SMTP_HOST", "smtp.exemplo.com")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USER", "robo@exemplo.com")
    monkeypatch.setenv("SMTP_PASSWORD", "segredo")
    monkeypatch.setenv("SMTP_FROM", "The Monitor <nao-responda@exemplo.com>")
    return smtp


def test_send_email_sem_smtp_host_apenas_loga(smtp, caplog):
    with caplog.at_level(logging.INFO):
        enviado = send_email("ana@example.com", "Assunto", "<p>oi</p>")

    assert enviado is False
    assert smtp.instances == []          # não tentou conectar em nada
    assert "envio não configurado" in caplog.text


def test_send_email_com_smtp_monta_e_envia_mensagem(smtp_configurado):
    enviado = send_email("ana@example.com", "Assunto", "<p>corpo html</p>")

    assert enviado is True
    assert len(smtp_configurado.instances) == 1
    conn = smtp_configurado.instances[0]
    assert (conn.host, conn.port) == ("smtp.exemplo.com", 587)
    assert conn.timeout is not None      # sem timeout um SMTP morto trava o /register

    msg = conn.enviadas[0]
    assert msg["To"] == "ana@example.com"
    assert msg["Subject"] == "Assunto"
    assert msg["From"] == "The Monitor <nao-responda@exemplo.com>"
    assert "corpo html" in msg.get_body(preferencelist=("html",)).get_content()


def test_send_email_usa_starttls_por_padrao(smtp_configurado):
    send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert smtp_configurado.instances[0].tls is True


def test_send_email_sem_tls_quando_desligado(monkeypatch, smtp_configurado):
    monkeypatch.setenv("SMTP_TLS", "false")
    send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert smtp_configurado.instances[0].tls is False


def test_send_email_autentica_quando_ha_smtp_user(smtp_configurado):
    send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert smtp_configurado.instances[0].login_args == ("robo@exemplo.com", "segredo")


def test_send_email_sem_user_nao_autentica(monkeypatch, smtp):
    # Relay interno aberto: sem credencial, mas ainda precisa de remetente.
    monkeypatch.setenv("SMTP_HOST", "smtp.interno")
    monkeypatch.setenv("SMTP_FROM", "robo@interno")
    send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert smtp.instances[0].login_args is None


def test_send_email_sem_remetente_nao_envia(monkeypatch, smtp, caplog):
    # Sem SMTP_FROM nem SMTP_USER o From sairia vazio e o envelope como <>:
    # provedor real rejeita ou marca como spam. Melhor não enviar e gritar no log.
    monkeypatch.setenv("SMTP_HOST", "smtp.exemplo.com")

    with caplog.at_level(logging.ERROR):
        enviado = send_email("ana@example.com", "Assunto", "<p>oi</p>")

    assert enviado is False
    assert smtp.instances == []
    assert "remetente" in caplog.text.lower()


def test_send_email_from_cai_no_user_quando_nao_definido(monkeypatch, smtp):
    monkeypatch.setenv("SMTP_HOST", "smtp.exemplo.com")
    monkeypatch.setenv("SMTP_USER", "robo@exemplo.com")
    monkeypatch.setenv("SMTP_PASSWORD", "segredo")
    send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert smtp.instances[0].enviadas[0]["From"] == "robo@exemplo.com"


def test_send_email_nao_levanta_quando_smtp_falha(smtp_configurado, caplog):
    smtp_configurado.falha_no_envio = True

    with caplog.at_level(logging.ERROR):
        enviado = send_email("ana@example.com", "Assunto", "<p>oi</p>")

    assert enviado is False              # falhou, mas quem chamou não explode
    assert "smtp caiu" in caplog.text    # e o erro real fica no log


def test_send_verification_email_usa_frontend_url_do_ambiente(monkeypatch, smtp_configurado):
    monkeypatch.setenv("FRONTEND_URL", "https://app.exemplo.com")

    send_verification_email("ana@example.com", "tok-123")

    msg = smtp_configurado.instances[0].enviadas[0]
    corpo = msg.get_body(preferencelist=("html",)).get_content()
    assert "https://app.exemplo.com/verificar-email?token=tok-123" in corpo
    assert "localhost:3000" not in corpo


def test_send_verification_email_assunto_e_destinatario(smtp_configurado):
    send_verification_email("ana@example.com", "tok-123")

    msg = smtp_configurado.instances[0].enviadas[0]
    assert msg["To"] == "ana@example.com"
    assert "Confirme seu e-mail" in msg["Subject"]


def test_enviar_resumo_para_todos_continua_apos_falha(smtp_configurado):
    """Uma caixa postal quebrada não pode calar o resumo de todo o resto."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(User(username="ana", hashed_password=hash_password("x"), email="ana@example.com"))
        session.add(User(username="bia", hashed_password=hash_password("x"), email="bia@example.com"))
        session.commit()

        smtp_configurado.falhar_para = {"ana@example.com"}

        enviar_resumo_para_todos(session)   # não pode levantar

    destinatarios = [msg["To"] for msg in smtp_configurado.todas_enviadas()]
    assert destinatarios == ["bia@example.com"], "o loop abortou no primeiro erro"
