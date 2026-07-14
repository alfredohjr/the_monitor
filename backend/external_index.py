"""Funções puras de índices externos (#167) — a lógica de dado testável.

Regras-chave:
- Acumulação de variações por **encadeamento** (produtório de (1 + i)), nunca soma.
- Deflação ("valor real") = nominal / produtório(1 + i).
- Resolução **mensal → diária** determinística: a soma dos dias bate com o total do mês.
"""
from __future__ import annotations


def acumular_variacoes(variacoes_pct: list[float]) -> float:
    """Variação acumulada por encadeamento. Recebe variações mensais em % (ex.:
    [0.5, 0.3] = 0,5% e 0,3%) e retorna o fator acumulado como fração
    (ex.: 0.008015 = +0,8015%). NÃO é a soma simples."""
    fator = 1.0
    for v in variacoes_pct:
        fator *= (1.0 + v / 100.0)
    return fator - 1.0


def deflacionar(valor_nominal: float, variacoes_pct: list[float]) -> float:
    """Valor real = nominal / produtório(1 + i). Deflaciona pelo encadeamento das
    variações (poder de compra), não pela soma."""
    fator = 1.0
    for v in variacoes_pct:
        fator *= (1.0 + v / 100.0)
    return valor_nominal / fator


def distribuir_total_mensal_em_dias(total: float, n_dias: int) -> list[float]:
    """Distribui um total mensal em n_dias valores diários determinísticos cuja
    soma é exatamente `total` (o resíduo de arredondamento vai no último dia)."""
    if n_dias <= 0:
        raise ValueError("n_dias deve ser > 0")
    base = round(total / n_dias, 2)
    valores = [base] * n_dias
    residuo = round(total - base * n_dias, 2)
    valores[-1] = round(valores[-1] + residuo, 2)
    return valores
