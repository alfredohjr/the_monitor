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


def fator_indice_no_periodo(serie: list[tuple[str, float]], inicio_iso: str, fim_iso: str) -> float:
    """Fator acumulado (produtório de 1 + valor/100) dos pontos MENSAIS da série
    cujo mês de referência (ref_date 'YYYY-MM-01') cai em [inicio, fim]. Série de
    variação %; encadeamento, não soma. Sem pontos no período → 1.0 (neutro)."""
    ini, fim = inicio_iso[:7], fim_iso[:7]
    fator = 1.0
    for ref_date, valor in serie:
        if ini <= ref_date[:7] <= fim:
            fator *= (1.0 + float(valor) / 100.0)
    return fator


def resolver_alvo_ancorado(alvo_base: float, serie: list[tuple[str, float]],
                           inicio_iso: str, fim_iso: str, strategy: str) -> float:
    """Resolve o alvo total ancorado num índice para o período (#167).
    - 'real': corrige o alvo pela variação do índice no período (preserva poder de
      compra) → alvo_base * fator. (acompanhar/indice+delta virão com o índice setorial.)
    """
    if strategy == "real":
        return round(alvo_base * fator_indice_no_periodo(serie, inicio_iso, fim_iso), 2)
    raise ValueError(f"strategy ancorada não suportada nesta fatia: {strategy}")


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
