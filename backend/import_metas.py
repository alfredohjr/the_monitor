"""Importação de metas: distribuição de um alvo em valores diários.

Função pura, testável (padrão de `progress.py`). Dado um alvo total e uma lista
de datas, devolve o alvo de cada dia segundo uma curva. A soma dos dias sempre
bate com o total (ajustando o resíduo de arredondamento no último dia com peso).
"""
from datetime import date

# Peso padrão por dia da semana (Mon=0 .. Sun=6): dias úteis contam, fim de
# semana zera. Usado pela estratégia "peso_semana" quando nada é informado.
DEFAULT_PESOS_SEMANA = {0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 0, 6: 0}

ESTRATEGIAS = ("linear", "rampa_crescente", "rampa_decrescente", "peso_semana")


def _pesos(estrategia: str, datas: list[date], pesos_semana: dict[int, float] | None) -> list[float]:
    n = len(datas)
    if estrategia == "linear":
        return [1.0] * n
    if estrategia == "rampa_crescente":
        return [float(i + 1) for i in range(n)]
    if estrategia == "rampa_decrescente":
        return [float(n - i) for i in range(n)]
    if estrategia == "peso_semana":
        tabela = pesos_semana or DEFAULT_PESOS_SEMANA
        pesos = [float(tabela.get(d.weekday(), 0)) for d in datas]
        # Todos zerados (ex.: intervalo só de fim de semana) -> cai para linear
        # para não dividir por zero nem devolver tudo zero.
        if sum(pesos) == 0:
            return [1.0] * n
        return pesos
    raise ValueError(f"Estratégia desconhecida: {estrategia}")


def distribuir_alvo(
    total: float,
    datas: list[date],
    estrategia: str = "linear",
    pesos_semana: dict[int, float] | None = None,
    casas: int = 2,
) -> list[float]:
    """Distribui `total` entre `datas` segundo `estrategia`.

    Retorna uma lista de valores (alinhada a `datas`) cuja soma é `total`
    (arredondada a `casas` casas decimais). Valores inteiros saem como int.
    """
    if not datas:
        raise ValueError("Nenhuma data informada")
    if estrategia not in ESTRATEGIAS:
        raise ValueError(f"Estratégia desconhecida: {estrategia}")

    pesos = _pesos(estrategia, datas, pesos_semana)
    w = sum(pesos)
    valores = [round(total * p / w, casas) for p in pesos]

    # Ajusta o resíduo de arredondamento no último dia com peso > 0, para a soma
    # bater exatamente com o total.
    residuo = round(total - sum(valores), casas)
    if residuo:
        for i in range(len(valores) - 1, -1, -1):
            if pesos[i] > 0:
                valores[i] = round(valores[i] + residuo, casas)
                break

    return [int(v) if float(v).is_integer() else v for v in valores]
