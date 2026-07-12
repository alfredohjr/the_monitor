"""Parser de CSV para importação de lançamentos (#141).

Função pura, testável: recebe o texto colado/enviado (colunas data,valor) e
devolve as linhas válidas + os erros por linha (erro numa linha não invalida as
demais). Aceita vírgula ou ponto-e-vírgula como separador e ignora um cabeçalho
"data,valor" e linhas em branco.
"""
from datetime import date


def _delimitador(linha: str) -> str:
    return ";" if ";" in linha and "," not in linha else ","


def parse_csv_lancamentos(texto: str) -> tuple[list[dict], list[dict]]:
    """Devolve (linhas_validas, erros).

    linhas_validas: [{"data": "YYYY-MM-DD", "valor": "<str>"}]
    erros:          [{"linha": <int 1-based>, "motivo": <str>}]
    """
    linhas: list[dict] = []
    erros: list[dict] = []

    for i, bruto in enumerate((texto or "").splitlines(), start=1):
        linha = bruto.strip()
        if not linha:
            continue  # ignora linhas em branco
        delim = _delimitador(linha)
        partes = [p.strip() for p in linha.split(delim)]

        # Cabeçalho "data,valor" (em qualquer caixa) é ignorado.
        if [p.lower() for p in partes[:2]] == ["data", "valor"]:
            continue

        if len(partes) != 2 or not partes[0] or not partes[1]:
            erros.append({"linha": i, "motivo": "esperado 'data,valor'"})
            continue

        data_str, valor = partes
        try:
            date.fromisoformat(data_str)
        except ValueError:
            erros.append({"linha": i, "motivo": f"data inválida: {data_str}"})
            continue

        linhas.append({"data": data_str, "valor": valor})

    return linhas, erros
