from typing import Annotated, Optional
import os

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Field, Session, SQLModel, create_engine, select
from datetime import datetime, date

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///database.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

class Item(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    titulo: str = Field(index=True)
    descricao: str
    valor: float
    tipo: str
    objetivo: int
    cor:str
    desastre:float
    desastre_cor:str
    valor_ok:str
    ativo:bool

class Historico(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_id:int = Field(foreign_key='item.id')
    tipo:int
    valor_anterior:float
    valor_novo:float
    criado_em:datetime

class News(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    item_id:int = Field(foreign_key='item.id')
    criado_em:datetime
    atualizado_em:datetime
    lido_em:datetime


# --- the_pointer domain models ---

class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str


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