"""Distribuição do alvo de um período em valores diários (função pura).

Núcleo da importação de metas (#140): dado um alvo total e um intervalo de
datas, gerar o alvo de cada dia segundo uma curva. A soma dos dias tem que
bater com o total.
"""
from datetime import date

import pytest

from import_metas import distribuir_alvo


def datas(inicio: str, n: int):
    from datetime import timedelta
    d0 = date.fromisoformat(inicio)
    return [d0 + timedelta(days=i) for i in range(n)]


# ---------- linear ----------

def test_linear_divide_igual_e_soma_bate():
    vals = distribuir_alvo(100, datas("2026-08-03", 4), "linear")  # seg..qui
    assert vals == [25, 25, 25, 25]
    assert sum(vals) == 100


def test_linear_ajusta_resto_no_ultimo_dia():
    vals = distribuir_alvo(100, datas("2026-08-03", 3), "linear")
    assert vals == [33.33, 33.33, 33.34]
    assert round(sum(vals), 2) == 100


# ---------- rampa ----------

def test_rampa_crescente():
    vals = distribuir_alvo(60, datas("2026-08-03", 3), "rampa_crescente")
    assert vals == [10, 20, 30]
    assert sum(vals) == 60


def test_rampa_decrescente():
    vals = distribuir_alvo(60, datas("2026-08-03", 3), "rampa_decrescente")
    assert vals == [30, 20, 10]
    assert sum(vals) == 60


# ---------- peso por dia da semana ----------

def test_peso_semana_zera_fim_de_semana_por_padrao():
    # 2026-08-03 é segunda; 7 dias -> seg..dom
    vals = distribuir_alvo(100, datas("2026-08-03", 7), "peso_semana")
    # 5 dias úteis dividem 100; sáb/dom = 0
    assert vals[5] == 0 and vals[6] == 0       # sábado e domingo
    assert all(v == 20 for v in vals[:5])
    assert sum(vals) == 100


def test_peso_semana_customizado():
    # dobra o peso da segunda; resto util = 1; fim de semana = 0
    pesos = {0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 0, 6: 0}
    vals = distribuir_alvo(60, datas("2026-08-03", 5), "peso_semana", pesos_semana=pesos)
    # pesos seg..sex = [2,1,1,1,1], W=6 -> [20,10,10,10,10]
    assert vals == [20, 10, 10, 10, 10]
    assert sum(vals) == 60


def test_peso_semana_so_fim_de_semana_cai_para_linear():
    # 2026-08-08 é sábado; 2 dias (sáb, dom) todos com peso 0 -> evita divisão
    # por zero caindo em distribuição linear.
    vals = distribuir_alvo(50, datas("2026-08-08", 2), "peso_semana")
    assert sum(vals) == 50
    assert vals == [25, 25]


# ---------- validação ----------

def test_estrategia_invalida_erro():
    with pytest.raises(ValueError):
        distribuir_alvo(100, datas("2026-08-03", 3), "inexistente")


def test_sem_dias_erro():
    with pytest.raises(ValueError):
        distribuir_alvo(100, [], "linear")
