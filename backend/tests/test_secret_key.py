"""SECRET_KEY obrigatória fora de dev (#191).

O default está no repositório: com ele, qualquer um que leia o código forja um
JWT válido pra qualquer usuário, inclusive admin. O boot tem que recusar subir
assim — melhor não subir do que subir forjável em silêncio.

A validação roda no `on_startup` (e não no import) de propósito: o import é
carregado pelos testes e pelo `importlib.reload` do test_swagger, que não têm
SECRET_KEY nem DEBUG setados. `TestClient(app)` sem `with` não dispara startup,
então a checagem só vale em execução real (uvicorn).
"""
import importlib

import pytest

import auth
from auth import DEFAULT_SECRET_KEY, validar_secret_key


def test_recusa_default_publico_fora_de_dev():
    with pytest.raises(RuntimeError) as exc:
        validar_secret_key(DEFAULT_SECRET_KEY, debug=False)

    # a mensagem tem que dizer o que fazer, não só que deu errado
    msg = str(exc.value)
    assert "SECRET_KEY" in msg
    assert "token_urlsafe" in msg, "mensagem deve ensinar a gerar a chave"


def test_permite_default_em_dev():
    # dev não pode exigir setup pra rodar o projeto
    validar_secret_key(DEFAULT_SECRET_KEY, debug=True)


def test_aceita_chave_propria_fora_de_dev():
    validar_secret_key("uma-chave-longa-e-aleatoria-de-verdade", debug=False)


def test_aceita_chave_propria_em_dev():
    validar_secret_key("uma-chave-longa-e-aleatoria-de-verdade", debug=True)


@pytest.mark.parametrize("valor", ["", "   "])
def test_secret_key_vazia_no_ambiente_cai_no_default(monkeypatch, valor):
    # O .env.example vem com `SECRET_KEY=` (vazio). Quem copia e não preenche não
    # pode acabar com uma chave vazia assinando os tokens — tem que cair no
    # default e ser pego pela validação.
    monkeypatch.setenv("SECRET_KEY", valor)
    importlib.reload(auth)
    try:
        assert auth.SECRET_KEY == DEFAULT_SECRET_KEY
        with pytest.raises(RuntimeError):
            auth.validar_secret_key(auth.SECRET_KEY, debug=False)
    finally:
        monkeypatch.undo()
        importlib.reload(auth)


def test_secret_key_do_ambiente_e_usada(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "chave-vinda-do-ambiente")
    importlib.reload(auth)
    try:
        assert auth.SECRET_KEY == "chave-vinda-do-ambiente"
    finally:
        monkeypatch.undo()
        importlib.reload(auth)


def test_startup_valida_a_secret_key_antes_de_tudo(monkeypatch):
    """O boot real (uvicorn) valida — e antes de tocar no banco.

    Se a app não pode subir, não faz sentido rodar migration nem seed primeiro.
    """
    import main

    class Sentinela(Exception):
        pass

    def falso_validar(secret, debug):
        raise Sentinela

    monkeypatch.setattr(main, "validar_secret_key", falso_validar)
    monkeypatch.setattr(
        main, "run_migrations",
        lambda: pytest.fail("migrations rodaram antes da validação da SECRET_KEY"),
    )

    with pytest.raises(Sentinela):
        main.on_startup()
