"""Agregação de progresso de uma métrica: realizado x meta por período.

Regra central (corrige o bug do dashboard): o *realizado* de um lançamento é
atribuído ao período da **meta** a que ele pertence (`goal.periodo_referencia`),
e NÃO à data em que o check-in foi registrado (`log.data`). Assim realizado e
meta ficam alinhados no mesmo bucket de período.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date


def get_week_pattern(d: date) -> str:
    """Semana ISO 8601 no formato YYYY-Www (bate com o <input type=week>)."""
    iso_year, iso_week, _ = d.isocalendar()
    return f"{iso_year}-W{iso_week:02d}"


def bucket_key(d: date, periodo: str) -> str:
    """Converte uma data para a chave de bucket do período da métrica."""
    if periodo == "weekly":
        return get_week_pattern(d)
    if periodo == "monthly":
        return f"{d.year:04d}-{d.month:02d}"
    if periodo == "yearly":
        return f"{d.year:04d}"
    return d.isoformat()  # daily / default


def _to_float(valor) -> float | None:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


@dataclass
class ProgressPoint:
    periodo: str
    realizado: float | None
    meta: float | None


@dataclass
class Progress:
    tipo: str
    periodo: str
    pontos: list[ProgressPoint]
    meta_total: float
    realizado_total: float
    pct: int


def compute_progress(metric, goals, logs, start: date, end: date) -> Progress:
    """`metric`: objeto com .tipo e .periodo. `goals`: metas da métrica (com
    .id, .alvo, .periodo_referencia). `logs`: lançamentos (com .goal,
    .valor_logado). `start`/`end`: intervalo (datas)."""
    start_bucket = bucket_key(start, metric.periodo)
    end_bucket = bucket_key(end, metric.periodo)

    # soma dos lançamentos por meta
    realizado_por_goal: dict[int, float] = {}
    for lg in logs:
        val = _to_float(lg.valor_logado)
        if val is None:
            continue
        realizado_por_goal[lg.goal] = realizado_por_goal.get(lg.goal, 0.0) + val

    realizado: dict[str, float] = {}
    meta: dict[str, float] = {}
    for g in goals:
        ref = g.periodo_referencia
        if not ref or not (start_bucket <= ref <= end_bucket):
            continue
        alvo = _to_float(g.alvo)
        if alvo is not None:
            meta[ref] = alvo
        if g.id in realizado_por_goal:
            realizado[ref] = realizado.get(ref, 0.0) + realizado_por_goal[g.id]

    buckets = sorted(set(realizado) | set(meta))
    pontos = [
        ProgressPoint(
            periodo=b,
            realizado=realizado[b] if b in realizado else None,
            meta=meta.get(b),
        )
        for b in buckets
    ]
    meta_total = sum(meta.values())
    realizado_total = sum(realizado.values())
    pct = round(realizado_total / meta_total * 100) if meta_total > 0 else 0
    return Progress(
        tipo=metric.tipo,
        periodo=metric.periodo,
        pontos=pontos,
        meta_total=meta_total,
        realizado_total=realizado_total,
        pct=pct,
    )
