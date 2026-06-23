from typing import Annotated
import datetime

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Field, Session, SQLModel, create_engine, select

from models import Item, Historico, News, create_db_and_tables, get_session

def agora():
    return datetime.datetime.now()

def nulo():
    return datetime.datetime(2000,1,1)

SessionDep = Annotated[Session, Depends(get_session)]

app = FastAPI()

@app.on_event("startup")
def on_startup():
    create_db_and_tables()

@app.get('/')
async def root():
    return {"messsage":"Hello world"}

@app.post('/items/')
def create_item(item:Item, session:SessionDep) -> Item:
    session.add(item)
    session.commit()
    session.refresh(item)
    return item

@app.get('/items/')
def read_items(session:SessionDep, offset:int=0, limit: Annotated[int, Query(le=100)] = 100) -> list[Item]:
    items = session.exec(select(Item).offset(offset).limit(limit)).all()
    return items

@app.get('/items/{item_id}')
def read_item(item_id:int, session:SessionDep) -> Item:
    item = session.get(Item,item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item nao existe")
    return item

@app.patch('/items/{item_id}')
def read_item(item_id:int, item_data:Item, session:SessionDep) -> Item:
    item = session.get(Item,item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item nao existe")
    
    item_valor_anterior = item.valor

    item_data = item_data.model_dump(exclude_unset=True)
    item.sqlmodel_update(item_data)
    session.add(item)
    session.commit()
    session.refresh(item)

    if item_valor_anterior != item_data['valor']:
        news = News(item_id=item.id, criado_em=agora(), atualizado_em=agora(), lido_em=nulo())
        session.add(news)
        session.commit()
        session.refresh(news)

        historico = Historico(item_id=item.id, tipo=1, valor_anterior=item_valor_anterior, valor_novo=item_data['valor'], criado_em=agora())
        session.add(historico)
        session.commit()
        session.refresh(historico)

    return item

@app.get('/news/')
def read_news(session:SessionDep, offset:int=0, limit: Annotated[int, Query(le=100)] = 100) -> list[News]:
    news_data = session.exec(select(News).where(News.lido_em==nulo()).offset(offset).limit(limit)).all()

    for nd in news_data:
        nd.lido_em = agora()

    session.add_all(news_data)
    session.commit()

    for nd in news_data:
        session.refresh(nd)

    return news_data

@app.get('/historico/{item_id}')
def read_historico(item_id:int, session:SessionDep) -> list[Historico]:
    item = session.get(Item,item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item nao existe")
    
    historico = session.exec(select(Historico).where(Historico.item_id==item_id).offset(0).limit(100)).all()

    return historico