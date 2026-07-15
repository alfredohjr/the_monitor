from typing import Optional
from datetime import datetime, date

from sqlmodel import Field, SQLModel, UniqueConstraint


class Metric(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    codigo: str = Field(unique=True, index=True, max_length=50)
    nome: str = Field(default="", max_length=150)
    descricao: str
    valor_padrao: Optional[str] = Field(default=None)
    tipo: str = Field(default="number", max_length=20)
    periodo: str = Field(default="daily", max_length=20)
    is_default: bool = Field(default=False)
    # Dono do dado. None = métrica global (catálogo padrão, is_default) visível a
    # todas as organizações. Caso contrário, só membros da org a enxergam.
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id", index=True)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Goal(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    metric: int = Field(foreign_key="metric.id")
    alvo: str = Field(max_length=255)
    periodo_referencia: str = Field(default="", max_length=50)
    # Org a que a meta pertence (definida na criação, a partir da org ativa).
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id", index=True)
    # Se a meta veio de um import ancorado num índice externo (#167), aponta para
    # o GoalAnchor com a fórmula (base + estratégia + índice) — habilita re-ancorar.
    anchor_id: Optional[int] = Field(default=None, foreign_key="goalanchor.id", index=True)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GoalAnchor(SQLModel, table=True):
    """Fórmula de uma meta ancorada num índice externo (#167). Snapshot: as metas
    diárias são gravadas resolvidas no import; re-ancorar sob demanda recomputa a
    partir desta fórmula com a série mais recente do índice."""
    id: int | None = Field(default=None, primary_key=True)
    metric_id: int = Field(foreign_key="metric.id", index=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)
    index_id: int = Field(foreign_key="externalindex.id", index=True)
    strategy: str = Field(max_length=20)          # "real" (acompanhar/indice+delta: futuro)
    estrategia_base: str = Field(default="linear", max_length=30)  # curva de distribuição
    alvo_base: str = Field(max_length=50)
    inicio: str = Field(max_length=10)
    fim: str = Field(max_length=10)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LogEntry(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    goal: int = Field(foreign_key="goal.id")
    data: date
    valor_logado: str = Field(max_length=255)
    # Org a que o lançamento pertence (definida na criação, a partir da org ativa).
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id", index=True)
    # Autor do lançamento (#164): habilita a regra "o lançador só mexe nos
    # próprios lançamentos". Nulo em registros antigos (pré-migração).
    created_by: Optional[int] = Field(default=None, foreign_key="user.id", index=True)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LogEntryAudit(SQLModel, table=True):
    """Trilha de auditoria de edição/exclusão de lançamento (#164): quem fez,
    quando e o valor anterior. Append-only (nunca é apagada)."""
    id: int | None = Field(default=None, primary_key=True)
    log_entry_id: int = Field(foreign_key="logentry.id", index=True)
    action: str = Field(max_length=20)  # "edit" | "delete"
    actor_id: int = Field(foreign_key="user.id", index=True)
    valor_anterior: Optional[str] = Field(default=None, max_length=255)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserMetricSubscription(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "metric_id"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    metric_id: int = Field(foreign_key="metric.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class UserMetricAssignment(SQLModel, table=True):
    """Atribuição controlada pelo admin: quais métricas um usuário lançador pode
    manipular numa organização (#163). Diferente de UserMetricSubscription (que é
    auto-assinatura do catálogo): aqui quem concede é o admin da org. Sem
    atribuição = sem acesso (403). Remover a atribuição não apaga lançamentos."""
    __table_args__ = (UniqueConstraint("user_id", "metric_id", "organization_id"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    metric_id: int = Field(foreign_key="metric.id", index=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)
    # Flags de permissão sobre lançamentos desta métrica (#164). Default seguro:
    # desligado — o lançador não edita/exclui até o admin ligar.
    can_edit_entry: bool = Field(default=False)
    can_delete_entry: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExternalIndex(SQLModel, table=True):
    """Série externa real, normalizada e curada (#167): IPCA (BCB/SGS), PMC (IBGE),
    ABRAS (manual). Global e read-only — a base para metas ancoradas no mundo real.
    Os pontos ficam em ExternalIndexPoint."""
    id: int | None = Field(default=None, primary_key=True)
    code: str = Field(unique=True, index=True, max_length=50)
    nome: str = Field(max_length=150)
    provider: str = Field(max_length=50)              # ex.: "bcb_sgs_433", "manual"
    frequencia: str = Field(default="monthly", max_length=20)
    unidade: str = Field(default="", max_length=20)
    value_type: str = Field(default="variacao_pct", max_length=20)  # variacao_pct | indice | nivel
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExternalIndexPoint(SQLModel, table=True):
    """Ponto de uma série externa. Idempotente: um valor por índice/mês."""
    __table_args__ = (UniqueConstraint("index_id", "ref_date"),)

    id: int | None = Field(default=None, primary_key=True)
    index_id: int = Field(foreign_key="externalindex.id", index=True)
    ref_date: str = Field(max_length=10)             # YYYY-MM-01 (mês de referência)
    value: str = Field(max_length=50)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class GoalTemplate(SQLModel, table=True):
    """Modelo de meta pronto (catálogo curado). Aponta para uma métrica do
    catálogo por código e sugere um alvo total + curva de distribuição. Importar
    a partir dele reusa POST /api/v1/goals/import (só pré-preenche os campos)."""
    id: int | None = Field(default=None, primary_key=True)
    nome: str = Field(max_length=150)
    descricao: str = Field(default="")
    metric_codigo: str = Field(max_length=50, index=True)
    alvo_sugerido: str = Field(max_length=255)
    estrategia: str = Field(default="linear", max_length=30)
    categoria: str = Field(default="", max_length=50)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
