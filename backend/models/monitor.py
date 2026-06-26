from datetime import datetime

from sqlmodel import Field, SQLModel


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
