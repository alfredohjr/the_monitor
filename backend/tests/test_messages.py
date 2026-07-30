"""Base de mensagens do backend (#299).

Espelha a decisão do front (#277): fallback para `en` e, na falta, a própria
chave — nunca `None`, porque `None` num `detail` vira erro sem texto.
"""
import pytest

from messages import LOCALE_PADRAO, MSG, locale_de_accept_language, t


# --- t(key, lang) -----------------------------------------------------------


def test_traduz_nos_dois_idiomas():
    assert t("erro.credenciais_invalidas", "en") == "Invalid credentials"
    assert t("erro.credenciais_invalidas", "pt-BR") == "Credenciais inválidas"


def test_locale_padrao_e_ingles():
    assert LOCALE_PADRAO == "en"
    assert t("erro.credenciais_invalidas") == t("erro.credenciais_invalidas", "en")


def test_chave_faltando_no_locale_cai_no_ingles(monkeypatch):
    # Os catálogos reais são completos (há teste de paridade), então o fallback
    # só se exercita com fixture.
    monkeypatch.setitem(MSG["en"], "so.em.ingles", "Only in English")
    assert t("so.em.ingles", "pt-BR") == "Only in English"


def test_chave_inexistente_devolve_a_propria_chave():
    assert t("nao.existe.mesmo", "en") == "nao.existe.mesmo"
    assert t("nao.existe.mesmo", "pt-BR") == "nao.existe.mesmo"


def test_locale_desconhecido_cai_no_ingles():
    assert t("erro.credenciais_invalidas", "klingon") == "Invalid credentials"


def test_catalogos_tem_exatamente_as_mesmas_chaves():
    """Guarda contra tradução esquecida — mesma ideia do teste do front."""
    assert sorted(MSG["en"]) == sorted(MSG["pt-BR"])


def test_interpolacao_por_chaves_nomeadas():
    # Frase inteira no catálogo, com placeholder — não concatenação de pedaços.
    MSG["en"]["_teste.interpola"] = "Imported {n} rows"
    MSG["pt-BR"]["_teste.interpola"] = "Importadas {n} linhas"
    try:
        assert t("_teste.interpola", "en", n=3) == "Imported 3 rows"
        assert t("_teste.interpola", "pt-BR", n=3) == "Importadas 3 linhas"
    finally:
        del MSG["en"]["_teste.interpola"]
        del MSG["pt-BR"]["_teste.interpola"]


def test_placeholder_sem_valor_fica_visivel():
    """Sumir da mensagem é bug silencioso; `{n}` aparecendo é bug reportável."""
    MSG["en"]["_teste.falta"] = "Imported {n} rows"
    try:
        assert t("_teste.falta", "en") == "Imported {n} rows"
    finally:
        del MSG["en"]["_teste.falta"]


# --- Accept-Language --------------------------------------------------------


@pytest.mark.parametrize(
    "header,esperado",
    [
        (None, "en"),
        ("", "en"),
        ("en", "en"),
        ("en-US,en;q=0.9", "en"),
        ("pt-BR", "pt-BR"),
        ("pt", "pt-BR"),
        ("pt-PT", "pt-BR"),
        # Ordem por qualidade: pt tem q maior, mesmo vindo depois.
        ("en;q=0.5,pt-BR;q=0.9", "pt-BR"),
        ("pt-BR;q=0.3,en;q=0.8", "en"),
        # Sem q explícito o padrão é 1.0, e o primeiro vence o empate.
        ("pt-BR,en", "pt-BR"),
        ("en,pt-BR", "en"),
        # Idioma que não atendemos é ignorado; sobra o que atendemos.
        ("de-DE,fr;q=0.9,pt-BR;q=0.1", "pt-BR"),
        ("de-DE,fr", "en"),
        # Lixo não pode explodir.
        ("???", "en"),
        ("pt-BR;q=abc", "pt-BR"),
        ("*", "en"),
    ],
)
def test_accept_language(header, esperado):
    assert locale_de_accept_language(header) == esperado


# --- Dependency do FastAPI --------------------------------------------------


def test_get_locale_le_o_header_da_requisicao():
    """O FastAPI mapeia o parâmetro `accept_language` para o header
    `Accept-Language`. Isso é convenção implícita do framework, então vale
    verificar de verdade em vez de assumir.

    A app aqui é local ao teste: o #299 não altera nenhuma rota do projeto.
    """
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from messages import LocaleDep

    app = FastAPI()

    @app.get("/_locale")
    def _rota(lang: LocaleDep):
        return {"lang": lang, "msg": t("erro.credenciais_invalidas", lang)}

    cliente = TestClient(app)

    assert cliente.get("/_locale").json() == {
        "lang": "en",
        "msg": "Invalid credentials",
    }
    assert cliente.get("/_locale", headers={"Accept-Language": "pt-BR"}).json() == {
        "lang": "pt-BR",
        "msg": "Credenciais inválidas",
    }
    # Header realista de navegador
    assert cliente.get(
        "/_locale", headers={"Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8"}
    ).json()["lang"] == "pt-BR"
