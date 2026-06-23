from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Field, Session, SQLModel, create_engine, select
from datetime import datetime

sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"

connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)


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