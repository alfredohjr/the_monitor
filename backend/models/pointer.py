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
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LogEntry(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    goal: int = Field(foreign_key="goal.id")
    data: date
    valor_logado: str = Field(max_length=255)
    # Org a que o lançamento pertence (definida na criação, a partir da org ativa).
    organization_id: Optional[int] = Field(default=None, foreign_key="organization.id", index=True)
    deleted: bool = Field(default=False)
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
