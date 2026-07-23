"""Porta 465 = SSL implícito → o envio deve usar smtplib.SMTP_SSL (não STARTTLS).

Espelha o comportamento validado no script de teste do usuário (Titan/465).
Um SMTP_SSL na 465 conecta com TLS desde o início; usar SMTP()+starttls() na 465
falha, então este caso é regressão-crítica para o envio em produção.
"""
import pytest

import email_service
from email_service import send_email

SMTP_ENVS = ("SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_TLS", "FRONTEND_URL")


@pytest.fixture(autouse=True)
def limpa_env(monkeypatch):
    for var in SMTP_ENVS:
        monkeypatch.delenv(var, raising=False)


class FakeSMTPSSL:
    """Substitui smtplib.SMTP_SSL. Aceita o kwarg context; não toca a rede."""
    instances = []

    def __init__(self, host, port, timeout=None, context=None):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.context = context
        self.login_args = None
        self.enviadas = []
        FakeSMTPSSL.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def login(self, user, password):
        self.login_args = (user, password)

    def send_message(self, msg):
        self.enviadas.append(msg)


class SMTPProibido:
    """SMTP comum (não-SSL) NÃO pode ser usado na 465 — se for, falha o teste."""
    def __init__(self, *a, **k):
        raise AssertionError("Porta 465 deve usar SMTP_SSL, não smtplib.SMTP()")


@pytest.fixture
def ssl_465(monkeypatch):
    FakeSMTPSSL.instances = []
    monkeypatch.setattr(email_service.smtplib, "SMTP_SSL", FakeSMTPSSL)
    monkeypatch.setattr(email_service.smtplib, "SMTP", SMTPProibido)
    monkeypatch.setenv("SMTP_HOST", "smtp.titan.email")
    monkeypatch.setenv("SMTP_PORT", "465")
    monkeypatch.setenv("SMTP_USER", "no-reply@exemplo.com")
    monkeypatch.setenv("SMTP_PASSWORD", "segredo")
    monkeypatch.setenv("SMTP_FROM", "no-reply@exemplo.com")
    yield FakeSMTPSSL
    FakeSMTPSSL.instances = []


def test_porta_465_usa_smtp_ssl(ssl_465):
    enviado = send_email("ana@example.com", "Assunto", "<p>oi</p>")
    assert enviado is True
    assert len(ssl_465.instances) == 1
    conn = ssl_465.instances[0]
    assert (conn.host, conn.port) == ("smtp.titan.email", 465)
    assert conn.context is not None            # TLS desde o connect
    assert conn.login_args == ("no-reply@exemplo.com", "segredo")
    assert conn.enviadas[0]["To"] == "ana@example.com"


def test_porta_465_nao_usa_starttls(ssl_465):
    # FakeSMTPSSL nem tem starttls; e o SMTP comum está proibido. Se o código
    # tentasse STARTTLS/SMTP() na 465, o envio quebraria.
    assert send_email("bob@example.com", "x", "<p>y</p>") is True
