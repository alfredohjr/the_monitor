from typing import Annotated
import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Field, Session, SQLModel, create_engine, select

from models import Item, Historico, News, Metric, Goal, LogEntry, User, create_db_and_tables, get_session
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user,
)


def agora():
    return datetime.datetime.now()

def nulo():
    return datetime.datetime(2000,1,1)

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]

app = FastAPI(title="The Monitor + The Pointer")

@app.on_event("startup")
def on_startup():
    create_db_and_tables()


# ---------- Original The Monitor endpoints ----------

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
def update_item(item_id:int, item_data:Item, session:SessionDep) -> Item:
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


# ---------- Auth ----------

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access: str
    refresh: str

@app.post('/api/v1/token/', response_model=TokenResponse)
def get_token(body: LoginRequest, session: SessionDep):
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    return TokenResponse(
        access=create_access_token(user.username),
        refresh=create_refresh_token(user.username),
    )


# ---------- Metrics ----------

class MetricCreate(BaseModel):
    codigo: str
    nome: str = ""
    descricao: str
    valor_padrao: str | None = None
    tipo: str = "number"
    periodo: str = "daily"

class MetricUpdate(MetricCreate):
    pass

@app.get('/api/v1/metrics/')
def list_metrics(session: SessionDep, _: CurrentUser) -> list[Metric]:
    return session.exec(select(Metric).where(Metric.deleted == False)).all()

@app.post('/api/v1/metrics/', status_code=201)
def create_metric(body: MetricCreate, session: SessionDep, _: CurrentUser) -> Metric:
    metric = Metric(**body.model_dump())
    session.add(metric)
    session.commit()
    session.refresh(metric)
    return metric

@app.get('/api/v1/metrics/{metric_id}/')
def get_metric(metric_id: int, session: SessionDep, _: CurrentUser) -> Metric:
    metric = session.get(Metric, metric_id)
    if not metric or metric.deleted:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    return metric

@app.put('/api/v1/metrics/{metric_id}/')
def update_metric(metric_id: int, body: MetricUpdate, session: SessionDep, _: CurrentUser) -> Metric:
    metric = session.get(Metric, metric_id)
    if not metric or metric.deleted:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    for key, val in body.model_dump().items():
        setattr(metric, key, val)
    session.add(metric)
    session.commit()
    session.refresh(metric)
    return metric

@app.delete('/api/v1/metrics/{metric_id}/', status_code=204)
def delete_metric(metric_id: int, session: SessionDep, _: CurrentUser):
    metric = session.get(Metric, metric_id)
    if not metric or metric.deleted:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    metric.deleted = True
    session.add(metric)
    session.commit()


# ---------- Goals ----------

class GoalCreate(BaseModel):
    metric: int
    alvo: str
    periodo_referencia: str = ""

class GoalUpdate(GoalCreate):
    pass

@app.get('/api/v1/goals/')
def list_goals(session: SessionDep, _: CurrentUser) -> list[Goal]:
    return session.exec(select(Goal).where(Goal.deleted == False)).all()

@app.post('/api/v1/goals/', status_code=201)
def create_goal(body: GoalCreate, session: SessionDep, _: CurrentUser) -> Goal:
    goal = Goal(**body.model_dump())
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal

@app.get('/api/v1/goals/{goal_id}/')
def get_goal(goal_id: int, session: SessionDep, _: CurrentUser) -> Goal:
    goal = session.get(Goal, goal_id)
    if not goal or goal.deleted:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return goal

@app.put('/api/v1/goals/{goal_id}/')
def update_goal(goal_id: int, body: GoalUpdate, session: SessionDep, _: CurrentUser) -> Goal:
    goal = session.get(Goal, goal_id)
    if not goal or goal.deleted:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    for key, val in body.model_dump().items():
        setattr(goal, key, val)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal

@app.delete('/api/v1/goals/{goal_id}/', status_code=204)
def delete_goal(goal_id: int, session: SessionDep, _: CurrentUser):
    goal = session.get(Goal, goal_id)
    if not goal or goal.deleted:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    goal.deleted = True
    session.add(goal)
    session.commit()


# ---------- LogEntries ----------

class LogCreate(BaseModel):
    goal: int
    data: str
    valor_logado: str

class LogUpdate(LogCreate):
    pass

@app.get('/api/v1/logs/')
def list_logs(session: SessionDep, _: CurrentUser) -> list[LogEntry]:
    return session.exec(select(LogEntry).where(LogEntry.deleted == False)).all()

@app.post('/api/v1/logs/', status_code=201)
def create_log(body: LogCreate, session: SessionDep, _: CurrentUser) -> LogEntry:
    from datetime import date as date_type
    log = LogEntry(goal=body.goal, data=date_type.fromisoformat(body.data), valor_logado=body.valor_logado)
    session.add(log)
    session.commit()
    session.refresh(log)
    return log

@app.get('/api/v1/logs/{log_id}/')
def get_log(log_id: int, session: SessionDep, _: CurrentUser) -> LogEntry:
    log = session.get(LogEntry, log_id)
    if not log or log.deleted:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return log

@app.put('/api/v1/logs/{log_id}/')
def update_log(log_id: int, body: LogUpdate, session: SessionDep, _: CurrentUser) -> LogEntry:
    from datetime import date as date_type
    log = session.get(LogEntry, log_id)
    if not log or log.deleted:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    log.goal = body.goal
    log.data = date_type.fromisoformat(body.data)
    log.valor_logado = body.valor_logado
    session.add(log)
    session.commit()
    session.refresh(log)
    return log

@app.delete('/api/v1/logs/{log_id}/', status_code=204)
def delete_log(log_id: int, session: SessionDep, _: CurrentUser):
    log = session.get(LogEntry, log_id)
    if not log or log.deleted:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    log.deleted = True
    session.add(log)
    session.commit()
