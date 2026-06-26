from typing import Optional
from datetime import datetime, date

from sqlmodel import Field, SQLModel


class Metric(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    codigo: str = Field(unique=True, index=True, max_length=50)
    nome: str = Field(default="", max_length=150)
    descricao: str
    valor_padrao: Optional[str] = Field(default=None)
    tipo: str = Field(default="number", max_length=20)
    periodo: str = Field(default="daily", max_length=20)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Goal(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    metric: int = Field(foreign_key="metric.id")
    alvo: str = Field(max_length=255)
    periodo_referencia: str = Field(default="", max_length=50)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LogEntry(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    goal: int = Field(foreign_key="goal.id")
    data: date
    valor_logado: str = Field(max_length=255)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
