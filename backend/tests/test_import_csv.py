"""Parser puro de CSV de lançamentos (#141)."""
from import_csv import parse_csv_lancamentos


def test_linhas_validas():
    linhas, erros = parse_csv_lancamentos("2026-08-03,5\n2026-08-04,7")
    assert erros == []
    assert linhas == [
        {"data": "2026-08-03", "valor": "5"},
        {"data": "2026-08-04", "valor": "7"},
    ]


def test_ignora_cabecalho_e_linhas_em_branco():
    texto = "data,valor\n2026-08-03,5\n\n  \n2026-08-04,7\n"
    linhas, erros = parse_csv_lancamentos(texto)
    assert erros == []
    assert [l["data"] for l in linhas] == ["2026-08-03", "2026-08-04"]


def test_aceita_ponto_e_virgula():
    linhas, erros = parse_csv_lancamentos("2026-08-03;5")
    assert erros == []
    assert linhas == [{"data": "2026-08-03", "valor": "5"}]


def test_erro_por_linha_nao_bloqueia_as_validas():
    texto = "2026-08-03,5\nlixo\n2026-13-40,9\n2026-08-05,3"
    linhas, erros = parse_csv_lancamentos(texto)
    # linhas 2 (colunas) e 3 (data inválida) com erro; 1 e 4 válidas
    assert [l["data"] for l in linhas] == ["2026-08-03", "2026-08-05"]
    assert {e["linha"] for e in erros} == {2, 3}


def test_valor_ou_data_vazios_sao_erro():
    linhas, erros = parse_csv_lancamentos("2026-08-03,\n,7")
    assert linhas == []
    assert {e["linha"] for e in erros} == {1, 2}


def test_texto_vazio():
    assert parse_csv_lancamentos("") == ([], [])
