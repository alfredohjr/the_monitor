from typing import Annotated
import datetime
import os

from fastapi import Depends, FastAPI, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlmodel import Field, Session, SQLModel, create_engine, select

from models import Item, Historico, News, Metric, Goal, GoalAnchor, LogEntry, LogEntryAudit, User, Organization, Membership, Notification, UserMetricSubscription, UserMetricAssignment, EmailVerificationToken, GoalTemplate, ExternalIndex, ExternalIndexPoint, get_session
import secrets

from db_migrations import run_migrations
from email_service import build_resumo, render_html, enviar_resumo_para_todos, send_verification_email
from seed import seed_exemplo, seed_metricas_padrao, seed_goal_templates, seed_external_indices
from progress import compute_progress
from import_metas import distribuir_alvo, ESTRATEGIAS
from external_index import resolver_alvo_ancorado
from import_csv import parse_csv_lancamentos
from auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    get_current_user, verify_google_token,
)


def agora():
    return datetime.datetime.now()

def nulo():
    return datetime.datetime(2000,1,1)

DEBUG = os.getenv("DEBUG", "false").lower() == "true"

# Versão da app. O default é a versão de desenvolvimento desta linha; em imagem
# publicada, o CI injeta APP_VERSION (build-arg → env) com a tag exata (ex.:
# "0.4.0"), então /version reflete o que foi realmente buildado.
APP_VERSION = os.getenv("APP_VERSION") or "0.4.0"

# Origens permitidas para CORS. Configuravel via env CORS_ORIGINS
# (lista separada por virgula); default cobre o front Next.js local.
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]

app = FastAPI(
    title="The Monitor + The Pointer",
    version=APP_VERSION,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    run_migrations()
    from models.database import engine
    with Session(engine) as session:
        seed_metricas_padrao(session)
        seed_goal_templates(session)
        seed_external_indices(session)
    _start_scheduler()


def _start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler
    from models.database import engine
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        _job_enviar_resumos,
        trigger="cron",
        hour=int(os.getenv("EMAIL_HORA", "7")),
        minute=0,
        id="email_diario",
    )
    scheduler.start()


def _job_enviar_resumos():
    from models.database import engine
    with Session(engine) as session:
        enviar_resumo_para_todos(session)


# ---------- Original The Monitor endpoints ----------

@app.get('/')
async def root():
    return {"messsage":"Hello world"}

@app.get('/version')
async def version():
    return {"version": APP_VERSION}

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

class RegisterRequest(BaseModel):
    username: str
    password: str
    # EmailStr só na entrada: e-mail malformado vira 422 antes de criar conta.
    # Segue opcional — cadastro sem e-mail não exige verificação.
    email: EmailStr | None = None
    organizacao: str
    codigo_organizacao: str

class UserResponse(BaseModel):
    id: int
    username: str
    # De propósito `str`, não EmailStr: numa resposta, uma linha legada com e-mail
    # inválido viraria ResponseValidationError (500) num endpoint de leitura.
    email: str | None = None

@app.post('/api/v1/register/', response_model=UserResponse, status_code=201)
def register(body: RegisterRequest, session: SessionDep):
    existing = session.exec(select(User).where(User.username == body.username)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username já cadastrado")
    if body.email:
        email_taken = session.exec(select(User).where(User.email == body.email)).first()
        if email_taken:
            raise HTTPException(status_code=400, detail="Email já cadastrado")

    nome_org = body.organizacao.strip()
    codigo = body.codigo_organizacao.strip()
    if not nome_org:
        raise HTTPException(status_code=400, detail="Organização é obrigatória")
    if not codigo:
        raise HTTPException(status_code=400, detail="Código da organização é obrigatório")

    # Resolve a org ANTES de criar o usuário: numa org existente com código
    # errado, o cadastro é recusado sem deixar usuário órfão.
    org = session.exec(
        select(Organization).where(Organization.nome == nome_org, Organization.deleted == False)
    ).first()
    if org is None:
        # Org nova: quem cadastra define o código e vira admin dela.
        role = "admin"
    else:
        # Org existente: só entra com o código correto, como usuário comum.
        if not org.codigo_acesso or not secrets.compare_digest(org.codigo_acesso, codigo):
            raise HTTPException(status_code=400, detail="Código da organização inválido")
        role = "user"

    # Cadastro por senha começa não-verificado; com e-mail, dispara o link de confirmação.
    user = User(
        username=body.username,
        hashed_password=hash_password(body.password),
        email=body.email,
        email_verified=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    if org is None:
        org = Organization(nome=nome_org, codigo_acesso=codigo)
        session.add(org)
        session.commit()
        session.refresh(org)

    session.add(Membership(user_id=user.id, organization_id=org.id, role=role))
    session.commit()

    seed_exemplo(user, org, session)

    if body.email:
        token = EmailVerificationToken(
            user_id=user.id,
            token=secrets.token_urlsafe(32),
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(hours=24),
        )
        session.add(token)
        session.commit()
        send_verification_email(body.email, token.token)

    return user

@app.post('/api/v1/token/', response_model=TokenResponse)
def get_token(body: LoginRequest, session: SessionDep):
    user = session.exec(select(User).where(User.username == body.username)).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")
    if user.email and not user.email_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="E-mail não verificado. Confira sua caixa de entrada.")
    return TokenResponse(
        access=create_access_token(user.username),
        refresh=create_refresh_token(user.username),
    )

class VerifyEmailRequest(BaseModel):
    token: str

@app.post('/api/v1/verify-email/')
def verify_email(body: VerifyEmailRequest, session: SessionDep):
    tok = session.exec(select(EmailVerificationToken).where(EmailVerificationToken.token == body.token)).first()
    if not tok or tok.used_at is not None:
        raise HTTPException(status_code=400, detail="Token inválido")
    if tok.expires_at < datetime.datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expirado")

    user = session.get(User, tok.user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Token inválido")

    user.email_verified = True
    tok.used_at = datetime.datetime.utcnow()
    session.add(user)
    session.add(tok)
    session.commit()
    return {"verified": True, "username": user.username}

class GoogleLoginRequest(BaseModel):
    credential: str

class GoogleAuthResponse(BaseModel):
    access: str
    refresh: str
    username: str

@app.post('/api/v1/auth/google/', response_model=GoogleAuthResponse)
def google_login(body: GoogleLoginRequest, session: SessionDep):
    try:
        claims = verify_google_token(body.credential)
        email = claims.get("email")
        if not email:
            raise ValueError("token sem email")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token Google inválido")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        # Login pelo Google já vem com e-mail verificado pelo provedor.
        user = User(
            username=email,
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            email_verified=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    return GoogleAuthResponse(
        access=create_access_token(user.username),
        refresh=create_refresh_token(user.username),
        username=user.username,
    )


# ---------- Perfil / RBAC ----------

def highest_role(session: Session, user_id: int) -> str:
    """Maior privilégio do usuário entre suas organizações. 'admin' > 'user'."""
    roles = session.exec(select(Membership.role).where(Membership.user_id == user_id)).all()
    return "admin" if any(r == "admin" for r in roles) else "user"


@app.get('/api/v1/me/')
def me(session: SessionDep, user: CurrentUser):
    memberships = session.exec(select(Membership).where(Membership.user_id == user.id)).all()
    orgs = []
    for m in memberships:
        org = session.get(Organization, m.organization_id)
        if org and not org.deleted:
            orgs.append({"id": org.id, "nome": org.nome, "role": m.role})
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "email_verified": user.email_verified,
        "role": highest_role(session, user.id),
        "organizations": orgs,
    }


# ---------- Organização ativa (escopo dos dados) ----------

def get_active_org_id(
    session: SessionDep,
    user: CurrentUser,
    x_org_id: Annotated[int | None, Header(alias="X-Org-Id")] = None,
) -> int | None:
    """Resolve a organização ativa da requisição.

    O front manda o header `X-Org-Id` (definido pelo switch de organização).
    Sem header, cai na primeira org do usuário. Um id de org onde o usuário não
    é membro é recusado (403) — ninguém enxerga dados de outra organização só
    trocando o header.
    """
    org_ids = set(
        session.exec(select(Membership.organization_id).where(Membership.user_id == user.id)).all()
    )
    if x_org_id is not None:
        if x_org_id not in org_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a esta organização")
        return x_org_id
    return min(org_ids) if org_ids else None


ActiveOrg = Annotated[int | None, Depends(get_active_org_id)]


def require_active_org(org_id: int | None) -> int:
    if org_id is None:
        raise HTTPException(status_code=400, detail="Nenhuma organização ativa")
    return org_id


def _visible_metric(metric_id: int, session: Session, org: int | None) -> Metric | None:
    """Métrica visível à org ativa: a própria da org ou uma padrão (catálogo)."""
    metric = session.get(Metric, metric_id)
    if not metric or metric.deleted:
        return None
    if metric.is_default or metric.organization_id == org:
        return metric
    return None


def _is_org_admin(session: Session, user_id: int, org_id: int | None) -> bool:
    """True se o usuário é admin da organização (papel 'admin')."""
    if org_id is None:
        return False
    m = session.exec(
        select(Membership).where(Membership.user_id == user_id, Membership.organization_id == org_id)
    ).first()
    return bool(m and m.role == "admin")


def _assigned_metric_ids(session: Session, user_id: int, org_id: int | None) -> set[int]:
    """Métricas atribuídas ao lançador nesta org pelo admin (#163)."""
    if org_id is None:
        return set()
    return set(
        session.exec(
            select(UserMetricAssignment.metric_id).where(
                UserMetricAssignment.user_id == user_id,
                UserMetricAssignment.organization_id == org_id,
            )
        ).all()
    )


def _assignment(session: Session, user_id: int, metric_id: int, org_id: int) -> UserMetricAssignment | None:
    return session.exec(
        select(UserMetricAssignment).where(
            UserMetricAssignment.user_id == user_id,
            UserMetricAssignment.metric_id == metric_id,
            UserMetricAssignment.organization_id == org_id,
        )
    ).first()


def _enforce_entry_permission(session: Session, user: User, log: LogEntry, org_id: int, action: str) -> None:
    """Regras de editar/excluir lançamento (#164). Admin passa livre. Lançador só
    mexe nos próprios lançamentos e só com a flag ligada; senão 403."""
    if _is_org_admin(session, user.id, org_id):
        return
    if log.created_by != user.id:
        raise HTTPException(status_code=403, detail="Você só pode alterar os próprios lançamentos")
    goal = session.get(Goal, log.goal)
    a = _assignment(session, user.id, goal.metric, org_id) if goal else None
    permitido = bool(a and (a.can_edit_entry if action == "edit" else a.can_delete_entry))
    if not permitido:
        verbo = "editar" if action == "edit" else "excluir"
        raise HTTPException(status_code=403, detail=f"Sem permissão para {verbo} este lançamento")


def _owned_metric(metric_id: int, session: Session, org: int | None) -> Metric | None:
    """Métrica que a org pode editar/excluir (a própria; padrão é read-only)."""
    metric = session.get(Metric, metric_id)
    if not metric or metric.deleted or metric.organization_id != org:
        return None
    return metric


def _owned_goal(goal_id: int, session: Session, org: int | None) -> Goal | None:
    goal = session.get(Goal, goal_id)
    if not goal or goal.deleted or goal.organization_id != org:
        return None
    return goal


# ---------- Metrics ----------

class MetricCreate(BaseModel):
    codigo: str
    nome: str = ""
    descricao: str
    valor_padrao: str | None = None
    tipo: str = "number"
    periodo: str = "daily"
    is_default: bool = False

class MetricUpdate(MetricCreate):
    pass

@app.get('/api/v1/metrics/')
def list_metrics(
    session: SessionDep, org: ActiveOrg, user: CurrentUser, apenas_inscritas: bool = False
) -> list[Metric]:
    # Métricas da org ativa + catálogo padrão (global).
    cond = Metric.is_default == True
    if org is not None:
        cond = cond | (Metric.organization_id == org)
    metrics = session.exec(select(Metric).where(Metric.deleted == False).where(cond)).all()
    if apenas_inscritas:
        # Regra: o usuário acompanha suas métricas da org (sempre) + as métricas
        # de catálogo (default) que ele assinou. Antes isso era filtrado no front;
        # ficou aqui, perto do dado.
        subs = set(
            session.exec(
                select(UserMetricSubscription.metric_id).where(UserMetricSubscription.user_id == user.id)
            ).all()
        )
        metrics = [m for m in metrics if not m.is_default or m.id in subs]
    # Enforcement de atribuição (#163): o lançador (não-admin) só vê as métricas
    # que o admin atribuiu a ele nesta org. Admin enxerga tudo.
    if org is not None and not _is_org_admin(session, user.id, org):
        atribuidas = _assigned_metric_ids(session, user.id, org)
        metrics = [m for m in metrics if m.id in atribuidas]
    return metrics

@app.post('/api/v1/metrics/', status_code=201)
def create_metric(body: MetricCreate, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Metric:
    org_id = require_active_org(org)
    metric = Metric(**body.model_dump(), organization_id=org_id)
    session.add(metric)
    session.commit()
    session.refresh(metric)
    return metric

@app.get('/api/v1/metrics/{metric_id}/')
def get_metric(metric_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Metric:
    metric = _visible_metric(metric_id, session, org)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    return metric

@app.put('/api/v1/metrics/{metric_id}/')
def update_metric(metric_id: int, body: MetricUpdate, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Metric:
    metric = _owned_metric(metric_id, session, org)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    for key, val in body.model_dump().items():
        setattr(metric, key, val)
    session.add(metric)
    session.commit()
    session.refresh(metric)
    return metric

@app.delete('/api/v1/metrics/{metric_id}/', status_code=204)
def delete_metric(metric_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    metric = _owned_metric(metric_id, session, org)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    metric.deleted = True
    session.add(metric)
    session.commit()


class ProgressPointResp(BaseModel):
    periodo: str
    realizado: float | None
    meta: float | None

class ProgressResp(BaseModel):
    tipo: str
    periodo: str
    pontos: list[ProgressPointResp]
    meta_total: float
    realizado_total: float
    pct: int

@app.get('/api/v1/metrics/{metric_id}/progress', response_model=ProgressResp)
def metric_progress(metric_id: int, start: str, end: str, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> ProgressResp:
    metric = _visible_metric(metric_id, session, org)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    try:
        start_d = datetime.date.fromisoformat(start)
        end_d = datetime.date.fromisoformat(end)
    except ValueError:
        raise HTTPException(status_code=422, detail="Datas inválidas (use YYYY-MM-DD)")
    goals = session.exec(
        select(Goal).where(Goal.metric == metric_id, Goal.deleted == False, Goal.organization_id == org)
    ).all()
    goal_ids = {g.id for g in goals}
    logs = [
        l for l in session.exec(select(LogEntry).where(LogEntry.deleted == False)).all()
        if l.goal in goal_ids
    ]
    prog = compute_progress(metric, goals, logs, start_d, end_d)
    return ProgressResp(
        tipo=prog.tipo,
        periodo=prog.periodo,
        pontos=[ProgressPointResp(periodo=p.periodo, realizado=p.realizado, meta=p.meta) for p in prog.pontos],
        meta_total=prog.meta_total,
        realizado_total=prog.realizado_total,
        pct=prog.pct,
    )


# ---------- Goals ----------

class GoalCreate(BaseModel):
    metric: int
    alvo: str
    periodo_referencia: str = ""

class GoalUpdate(GoalCreate):
    pass

@app.get('/api/v1/goals/')
def list_goals(session: SessionDep, org: ActiveOrg, _: CurrentUser) -> list[Goal]:
    return session.exec(select(Goal).where(Goal.deleted == False, Goal.organization_id == org)).all()

@app.post('/api/v1/goals/', status_code=201)
def create_goal(body: GoalCreate, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Goal:
    org_id = require_active_org(org)
    # A métrica-alvo precisa ser visível à org (a própria ou uma padrão).
    if not _visible_metric(body.metric, session, org_id):
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    goal = Goal(**body.model_dump(), organization_id=org_id)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal

@app.get('/api/v1/goals/{goal_id}/')
def get_goal(goal_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Goal:
    goal = _owned_goal(goal_id, session, org)
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    return goal

@app.put('/api/v1/goals/{goal_id}/')
def update_goal(goal_id: int, body: GoalUpdate, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> Goal:
    goal = _owned_goal(goal_id, session, org)
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    for key, val in body.model_dump().items():
        setattr(goal, key, val)
    session.add(goal)
    session.commit()
    session.refresh(goal)
    return goal

@app.delete('/api/v1/goals/{goal_id}/', status_code=204)
def delete_goal(goal_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    goal = _owned_goal(goal_id, session, org)
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    goal.deleted = True
    session.add(goal)
    session.commit()


# ---------- Import de metas (#140) ----------

class GoalImportRequest(BaseModel):
    metric_id: int
    alvo_total: float
    inicio: str          # YYYY-MM-DD
    fim: str             # YYYY-MM-DD
    estrategia: str = "linear"
    pesos: list[float] | None = None   # usado quando estrategia == "pesos_custom"
    dry_run: bool = False


def _ensure_subscription(session: Session, user_id: int, metric_id: int) -> None:
    """Inscreve o usuário na métrica se ainda não estiver (#185). Idempotente
    (unique user+metric). Faz a meta importada aparecer nas telas que filtram por
    `apenas_inscritas` (dashboard/simulação/GoalForm/métricas)."""
    ja = session.exec(
        select(UserMetricSubscription).where(
            UserMetricSubscription.user_id == user_id,
            UserMetricSubscription.metric_id == metric_id,
        )
    ).first()
    if not ja:
        session.add(UserMetricSubscription(user_id=user_id, metric_id=metric_id))
        session.commit()


@app.post('/api/v1/goals/import')
def import_goals(body: GoalImportRequest, session: SessionDep, org: ActiveOrg, user: CurrentUser):
    """Gera metas diárias a partir de um alvo total distribuído por uma curva.

    `dry_run=true` devolve a prévia (pontos + soma) sem gravar. Sem dry_run,
    cria um Goal por dia (com alvo > 0) na org ativa, de forma idempotente
    (não duplica um dia que já tenha meta para a mesma métrica/período)."""
    org_id = require_active_org(org)
    metric = _visible_metric(body.metric_id, session, org_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    if body.estrategia not in ESTRATEGIAS:
        raise HTTPException(status_code=422, detail="Estratégia inválida")
    try:
        d0 = datetime.date.fromisoformat(body.inicio)
        d1 = datetime.date.fromisoformat(body.fim)
    except ValueError:
        raise HTTPException(status_code=422, detail="Datas inválidas (use YYYY-MM-DD)")
    if d1 < d0:
        raise HTTPException(status_code=422, detail="Data fim anterior à início")
    dias = (d1 - d0).days + 1
    if dias > 366:
        raise HTTPException(status_code=422, detail="Intervalo muito longo (máx. 366 dias)")

    datas = [d0 + datetime.timedelta(days=i) for i in range(dias)]
    try:
        valores = distribuir_alvo(body.alvo_total, datas, body.estrategia, pesos_custom=body.pesos)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    pontos = [{"data": d.isoformat(), "alvo": v} for d, v in zip(datas, valores)]
    soma = round(sum(valores), 2)

    if body.dry_run:
        return {"dry_run": True, "pontos": pontos, "soma": soma}

    criadas = 0
    ignoradas = 0
    for d, v in zip(datas, valores):
        if v == 0:
            continue  # dia sem meta (ex.: fim de semana na curva peso_semana)
        ja_existe = session.exec(
            select(Goal).where(
                Goal.metric == body.metric_id,
                Goal.organization_id == org_id,
                Goal.periodo_referencia == d.isoformat(),
                Goal.deleted == False,
            )
        ).first()
        if ja_existe:
            ignoradas += 1
            continue
        session.add(Goal(
            metric=body.metric_id,
            alvo=str(v),
            periodo_referencia=d.isoformat(),
            organization_id=org_id,
        ))
        criadas += 1
    session.commit()
    _ensure_subscription(session, user.id, body.metric_id)  # #185: aparece nas telas
    return {"dry_run": False, "criadas": criadas, "ignoradas": ignoradas, "soma": soma}


# ---------- Clonar metas de um período (#142) ----------

class GoalCloneRequest(BaseModel):
    metric_id: int
    origem_inicio: str      # YYYY-MM-DD
    origem_fim: str
    destino_inicio: str     # onde começa a cópia (define o deslocamento de datas)
    escala: float = 1.0     # multiplica o alvo (ex.: 1.1 = +10%)
    dry_run: bool = False


@app.post('/api/v1/goals/clone')
def clone_goals(body: GoalCloneRequest, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    """Replica as metas diárias de um período para outro, deslocando as datas
    (origem_inicio → destino_inicio) e opcionalmente escalando o alvo. Idempotente
    por métrica/período; alvo não-numérico (ex.: boolean) é copiado sem escalar."""
    from datetime import date as date_type
    org_id = require_active_org(org)
    if not _visible_metric(body.metric_id, session, org_id):
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    try:
        oi = date_type.fromisoformat(body.origem_inicio)
        of = date_type.fromisoformat(body.origem_fim)
        di = date_type.fromisoformat(body.destino_inicio)
    except ValueError:
        raise HTTPException(status_code=422, detail="Datas inválidas (use YYYY-MM-DD)")
    if of < oi:
        raise HTTPException(status_code=422, detail="Fim da origem anterior ao início")
    offset = di - oi

    goals = session.exec(
        select(Goal).where(Goal.metric == body.metric_id, Goal.organization_id == org_id, Goal.deleted == False)
    ).all()
    criadas = ignoradas = 0
    soma = 0.0
    for g in goals:
        try:
            gd = date_type.fromisoformat(g.periodo_referencia)
        except ValueError:
            continue  # não é meta diária (ex.: período "2026-08")
        if not (oi <= gd <= of):
            continue
        novo_dia = (gd + offset).isoformat()
        try:
            v = round(float(g.alvo) * body.escala, 2)
            novo_alvo = str(int(v) if float(v).is_integer() else v)
            soma += v
        except ValueError:
            novo_alvo = g.alvo  # alvo não numérico: copia como está
        existe = session.exec(
            select(Goal).where(
                Goal.metric == body.metric_id,
                Goal.organization_id == org_id,
                Goal.periodo_referencia == novo_dia,
                Goal.deleted == False,
            )
        ).first()
        if existe:
            ignoradas += 1
            continue
        if not body.dry_run:
            session.add(Goal(metric=body.metric_id, alvo=novo_alvo, periodo_referencia=novo_dia, organization_id=org_id))
        criadas += 1

    if not body.dry_run:
        session.commit()
    return {"dry_run": body.dry_run, "criadas": criadas, "ignoradas": ignoradas, "soma": round(soma, 2)}


# ---------- Catálogo de metas-modelo (GoalTemplate) (#143) ----------

@app.get('/api/v1/goal-templates/')
def list_goal_templates(session: SessionDep, _: CurrentUser) -> list[GoalTemplate]:
    """Catálogo curado de metas-modelo. O front usa cada modelo para pré-preencher
    o import (métrica + alvo sugerido + curva) em POST /api/v1/goals/import."""
    return session.exec(select(GoalTemplate).where(GoalTemplate.deleted == False)).all()


# ---------- Índices externos (#167) ----------
# Provider layer: mapeia o `provider` do índice para a função que puxa a série
# normalizada [{ref_date, value}]. Fontes sem API estável (ex.: ABRAS) usam
# "manual" (sem provider automático) — entram por seed/import curado.

def _fetch_bcb_sgs_433() -> list[dict]:
    """IPCA mensal via BCB/SGS (série 433). Retorna [{data:'DD/MM/YYYY', valor}]."""
    import httpx
    url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json"
    r = httpx.get(url, timeout=30)
    r.raise_for_status()
    out = []
    for x in r.json():
        d, m, a = x["data"].split("/")
        out.append({"ref_date": f"{a}-{m}-{d}", "value": str(x["valor"])})
    return out


EXTERNAL_PROVIDERS = {"bcb_sgs_433": _fetch_bcb_sgs_433}


@app.get('/api/v1/external-indices/')
def list_external_indices(session: SessionDep, _: CurrentUser) -> list[ExternalIndex]:
    return session.exec(select(ExternalIndex)).all()


@app.get('/api/v1/external-indices/{code}/series')
def external_index_series(code: str, session: SessionDep, _: CurrentUser):
    idx = session.exec(select(ExternalIndex).where(ExternalIndex.code == code)).first()
    if not idx:
        raise HTTPException(status_code=404, detail="Índice não encontrado")
    pts = session.exec(
        select(ExternalIndexPoint).where(ExternalIndexPoint.index_id == idx.id).order_by(ExternalIndexPoint.ref_date)
    ).all()
    return {"code": idx.code, "value_type": idx.value_type,
            "pontos": [{"ref_date": p.ref_date, "value": p.value} for p in pts]}


@app.post('/api/v1/external-indices/{code}/refresh')
def refresh_external_index(code: str, session: SessionDep, _: CurrentUser):
    """Puxa a série do provider e faz upsert idempotente (unique por índice/mês);
    revisões atualizam o ponto existente em vez de duplicar."""
    idx = session.exec(select(ExternalIndex).where(ExternalIndex.code == code)).first()
    if not idx:
        raise HTTPException(status_code=404, detail="Índice não encontrado")
    provider = EXTERNAL_PROVIDERS.get(idx.provider)
    if not provider:
        raise HTTPException(status_code=400, detail=f"Índice '{code}' não tem provider automático (entra por import curado)")
    novos = 0
    for d in provider():
        existente = session.exec(
            select(ExternalIndexPoint).where(
                ExternalIndexPoint.index_id == idx.id,
                ExternalIndexPoint.ref_date == d["ref_date"],
            )
        ).first()
        if existente:
            existente.value = str(d["value"])
            session.add(existente)
        else:
            session.add(ExternalIndexPoint(index_id=idx.id, ref_date=d["ref_date"], value=str(d["value"])))
            novos += 1
    session.commit()
    total = len(session.exec(select(ExternalIndexPoint).where(ExternalIndexPoint.index_id == idx.id)).all())
    return {"code": idx.code, "novos": novos, "total": total}


# ---------- Metas ancoradas em índice (#167) ----------

class GoalAnchoredImportRequest(BaseModel):
    metric_id: int
    alvo_base: float
    inicio: str
    fim: str
    index_code: str
    strategy: str = "real"
    estrategia_base: str = "linear"
    dry_run: bool = False


def _serie_indice(session: Session, index_id: int) -> list[tuple[str, float]]:
    pts = session.exec(select(ExternalIndexPoint).where(ExternalIndexPoint.index_id == index_id)).all()
    return [(p.ref_date, float(p.value)) for p in pts]


def _resolver_curva_ancorada(session: Session, idx: ExternalIndex, body_or_anchor, alvo_base: float,
                             inicio: str, fim: str, estrategia_base: str, strategy: str):
    """Resolve o alvo corrigido e a curva diária. Levanta 422 em datas/strategy inválidas."""
    import datetime as _dt
    try:
        d0 = _dt.date.fromisoformat(inicio)
        d1 = _dt.date.fromisoformat(fim)
    except ValueError:
        raise HTTPException(status_code=422, detail="Datas inválidas (use YYYY-MM-DD)")
    if d1 < d0:
        raise HTTPException(status_code=422, detail="Data fim anterior à início")
    serie = _serie_indice(session, idx.id)
    try:
        alvo_corrigido = resolver_alvo_ancorado(alvo_base, serie, inicio, fim, strategy)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    datas = [d0 + _dt.timedelta(days=i) for i in range((d1 - d0).days + 1)]
    valores = distribuir_alvo(alvo_corrigido, datas, estrategia_base)
    return alvo_corrigido, datas, valores


@app.post('/api/v1/goals/import-anchored')
def import_anchored_goals(body: GoalAnchoredImportRequest, session: SessionDep, org: ActiveOrg, user: CurrentUser):
    """Importa metas ancoradas num índice externo (#167). Snapshot: resolve a curva
    agora e grava; guarda o GoalAnchor (fórmula) para re-ancorar sob demanda."""
    org_id = require_active_org(org)
    if not _visible_metric(body.metric_id, session, org_id):
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    idx = session.exec(select(ExternalIndex).where(ExternalIndex.code == body.index_code)).first()
    if not idx:
        raise HTTPException(status_code=404, detail="Índice não encontrado")

    alvo_corrigido, datas, valores = _resolver_curva_ancorada(
        session, idx, body, body.alvo_base, body.inicio, body.fim, body.estrategia_base, body.strategy)
    soma = round(sum(valores), 2)

    if body.dry_run:
        return {"dry_run": True, "alvo_base": body.alvo_base, "alvo_corrigido": alvo_corrigido,
                "soma": soma, "pontos": [{"data": d.isoformat(), "alvo": v} for d, v in zip(datas, valores)]}

    anchor = GoalAnchor(metric_id=body.metric_id, organization_id=org_id, index_id=idx.id,
                        strategy=body.strategy, estrategia_base=body.estrategia_base,
                        alvo_base=str(body.alvo_base), inicio=body.inicio, fim=body.fim)
    session.add(anchor)
    session.commit()
    session.refresh(anchor)

    criadas = ignoradas = 0
    for d, v in zip(datas, valores):
        if v == 0:
            continue
        ja = session.exec(select(Goal).where(
            Goal.metric == body.metric_id, Goal.organization_id == org_id,
            Goal.periodo_referencia == d.isoformat(), Goal.deleted == False)).first()
        if ja:
            ignoradas += 1
            continue
        session.add(Goal(metric=body.metric_id, alvo=str(v), periodo_referencia=d.isoformat(),
                         organization_id=org_id, anchor_id=anchor.id))
        criadas += 1
    session.commit()
    _ensure_subscription(session, user.id, body.metric_id)  # #185: aparece nas telas
    return {"dry_run": False, "anchor_id": anchor.id, "alvo_corrigido": alvo_corrigido,
            "criadas": criadas, "ignoradas": ignoradas, "soma": soma}


@app.post('/api/v1/goals/anchors/{anchor_id}/re-anchor')
def re_anchor_goals(anchor_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    """Re-ancora sob demanda: recomputa a curva com a série mais recente do índice
    e substitui as metas daquele anchor (snapshot novo)."""
    org_id = require_active_org(org)
    anchor = session.get(GoalAnchor, anchor_id)
    if not anchor or anchor.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Âncora não encontrada")
    idx = session.get(ExternalIndex, anchor.index_id)
    if not idx:
        raise HTTPException(status_code=404, detail="Índice não encontrado")

    alvo_corrigido, datas, valores = _resolver_curva_ancorada(
        session, idx, anchor, float(anchor.alvo_base), anchor.inicio, anchor.fim,
        anchor.estrategia_base, anchor.strategy)

    # Substitui as metas do anchor (soft-delete as antigas, recria resolvidas).
    antigas = session.exec(select(Goal).where(Goal.anchor_id == anchor_id, Goal.deleted == False)).all()
    for g in antigas:
        g.deleted = True
        session.add(g)
    atualizadas = 0
    for d, v in zip(datas, valores):
        if v == 0:
            continue
        session.add(Goal(metric=anchor.metric_id, alvo=str(v), periodo_referencia=d.isoformat(),
                         organization_id=org_id, anchor_id=anchor_id))
        atualizadas += 1
    session.commit()
    return {"anchor_id": anchor_id, "alvo_corrigido": alvo_corrigido, "atualizadas": atualizadas,
            "soma": round(sum(valores), 2)}


# ---------- LogEntries ----------

class LogCreate(BaseModel):
    goal: int
    data: str
    valor_logado: str

class LogUpdate(LogCreate):
    pass

@app.get('/api/v1/logs/')
def list_logs(session: SessionDep, org: ActiveOrg, _: CurrentUser) -> list[LogEntry]:
    return session.exec(select(LogEntry).where(LogEntry.deleted == False, LogEntry.organization_id == org)).all()

def _to_float(valor) -> float | None:
    try:
        return float(valor)
    except (TypeError, ValueError):
        return None


def _notify_if_goal_reached(new_log: LogEntry, session: Session, user: User) -> None:
    """Cria notificação in-app quando a soma dos lançamentos da meta cruza o
    alvo (dispara uma única vez, no lançamento que atinge/ultrapassa o alvo)."""
    goal = session.get(Goal, new_log.goal)
    if not goal or goal.deleted:
        return
    alvo = _to_float(goal.alvo)
    if alvo is None or alvo <= 0:
        return
    logs = session.exec(
        select(LogEntry).where(LogEntry.goal == new_log.goal, LogEntry.deleted == False)
    ).all()
    total = sum(v for v in (_to_float(l.valor_logado) for l in logs) if v is not None)
    novo = _to_float(new_log.valor_logado) or 0.0
    total_antes = total - novo
    if total_antes < alvo <= total:
        metric = session.get(Metric, goal.metric)
        nome = (metric.nome or metric.codigo) if metric else f"Meta #{goal.id}"
        mensagem = f"🎯 Meta atingida: {nome} ({total:g}/{alvo:g})"
        session.add(Notification(user_id=user.id, mensagem=mensagem))
        session.commit()


@app.post('/api/v1/logs/', status_code=201)
def create_log(body: LogCreate, session: SessionDep, org: ActiveOrg, user: CurrentUser) -> LogEntry:
    from datetime import date as date_type
    org_id = require_active_org(org)
    # Só lança em meta da própria org.
    goal = _owned_goal(body.goal, session, org_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    # Enforcement de atribuição (#163): lançador só lança em métrica atribuída.
    if not _is_org_admin(session, user.id, org_id):
        if goal.metric not in _assigned_metric_ids(session, user.id, org_id):
            raise HTTPException(status_code=403, detail="Métrica não atribuída a você")
    log = LogEntry(
        goal=body.goal,
        data=date_type.fromisoformat(body.data),
        valor_logado=body.valor_logado,
        organization_id=org_id,
        created_by=user.id,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    _notify_if_goal_reached(log, session, user)
    return log

@app.get('/api/v1/logs/{log_id}/')
def get_log(log_id: int, session: SessionDep, org: ActiveOrg, _: CurrentUser) -> LogEntry:
    log = session.get(LogEntry, log_id)
    if not log or log.deleted or log.organization_id != org:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    return log

@app.put('/api/v1/logs/{log_id}/')
def update_log(log_id: int, body: LogUpdate, session: SessionDep, org: ActiveOrg, user: CurrentUser) -> LogEntry:
    from datetime import date as date_type
    org_id = require_active_org(org)
    log = session.get(LogEntry, log_id)
    if not log or log.deleted or log.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    _enforce_entry_permission(session, user, log, org_id, "edit")
    # A meta destino também precisa ser da org ativa.
    if not _owned_goal(body.goal, session, org_id):
        raise HTTPException(status_code=404, detail="Meta não encontrada")
    # Auditoria: registra o valor anterior antes de sobrescrever (#164).
    session.add(LogEntryAudit(log_entry_id=log.id, action="edit", actor_id=user.id, valor_anterior=log.valor_logado))
    log.goal = body.goal
    log.data = date_type.fromisoformat(body.data)
    log.valor_logado = body.valor_logado
    session.add(log)
    session.commit()
    session.refresh(log)
    return log

@app.delete('/api/v1/logs/{log_id}/', status_code=204)
def delete_log(log_id: int, session: SessionDep, org: ActiveOrg, user: CurrentUser):
    org_id = require_active_org(org)
    log = session.get(LogEntry, log_id)
    if not log or log.deleted or log.organization_id != org_id:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    _enforce_entry_permission(session, user, log, org_id, "delete")
    session.add(LogEntryAudit(log_entry_id=log.id, action="delete", actor_id=user.id, valor_anterior=log.valor_logado))
    log.deleted = True
    session.add(log)
    session.commit()


# ---------- Import de lançamentos / histórico (#144) ----------

class LogImportItem(BaseModel):
    data: str            # YYYY-MM-DD
    valor: str

class LogImportRequest(BaseModel):
    metric_id: int
    lancamentos: list[LogImportItem]
    dry_run: bool = False


def _importar_lancamentos(session: Session, org_id: int, metric_id: int, itens, dry_run: bool) -> dict:
    """Casa cada (data, valor) com a meta diária do mesmo dia e cria o LogEntry.
    `itens`: iterável de (date, valor_str). Idempotente por meta+data; dias sem
    meta contam em `sem_meta`. Não dispara notificação (import em massa)."""
    criadas = ignoradas = sem_meta = 0
    for d, valor in itens:
        goal = session.exec(
            select(Goal).where(
                Goal.metric == metric_id,
                Goal.organization_id == org_id,
                Goal.periodo_referencia == d.isoformat(),
                Goal.deleted == False,
            )
        ).first()
        if not goal:
            sem_meta += 1
            continue
        ja_existe = session.exec(
            select(LogEntry).where(
                LogEntry.goal == goal.id,
                LogEntry.data == d,
                LogEntry.deleted == False,
            )
        ).first()
        if ja_existe:
            ignoradas += 1
            continue
        if not dry_run:
            session.add(LogEntry(goal=goal.id, data=d, valor_logado=valor, organization_id=org_id))
        criadas += 1

    if not dry_run:
        session.commit()
    return {"criadas": criadas, "ignoradas": ignoradas, "sem_meta": sem_meta}


@app.post('/api/v1/logs/import')
def import_logs(body: LogImportRequest, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    """Importa lançamentos (histórico realizado) em lote. Ver _importar_lancamentos."""
    from datetime import date as date_type
    org_id = require_active_org(org)
    if not _visible_metric(body.metric_id, session, org_id):
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    itens = []
    for item in body.lancamentos:
        try:
            itens.append((date_type.fromisoformat(item.data), item.valor))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Data inválida: {item.data}")
    res = _importar_lancamentos(session, org_id, body.metric_id, itens, body.dry_run)
    return {"dry_run": body.dry_run, **res}


class LogImportCSVRequest(BaseModel):
    metric_id: int
    csv: str
    dry_run: bool = False


@app.post('/api/v1/logs/import-csv')
def import_logs_csv(body: LogImportCSVRequest, session: SessionDep, org: ActiveOrg, _: CurrentUser):
    """Importa lançamentos a partir de um CSV (colunas data,valor). Erros por
    linha são devolvidos em `erros` (linhas válidas são importadas mesmo assim)."""
    from datetime import date as date_type
    org_id = require_active_org(org)
    if not _visible_metric(body.metric_id, session, org_id):
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    linhas, erros = parse_csv_lancamentos(body.csv)
    itens = [(date_type.fromisoformat(l["data"]), l["valor"]) for l in linhas]
    res = _importar_lancamentos(session, org_id, body.metric_id, itens, body.dry_run)
    return {"dry_run": body.dry_run, **res, "erros": erros}


# ---------- Organizations ----------

class OrganizationCreate(BaseModel):
    nome: str

@app.get('/api/v1/organizations/')
def list_organizations(session: SessionDep, user: CurrentUser) -> list[Organization]:
    return session.exec(
        select(Organization)
        .join(Membership, Membership.organization_id == Organization.id)
        .where(Membership.user_id == user.id, Organization.deleted == False)
    ).all()

@app.post('/api/v1/organizations/', status_code=201)
def create_organization(body: OrganizationCreate, session: SessionDep, user: CurrentUser) -> Organization:
    nome = body.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome da organização é obrigatório")
    duplicada = session.exec(
        select(Organization).where(Organization.nome == nome, Organization.deleted == False)
    ).first()
    if duplicada:
        raise HTTPException(status_code=400, detail="Nome de organização já está em uso")

    org = Organization(nome=nome)
    session.add(org)
    session.commit()
    session.refresh(org)

    # Quem cria a organização vira admin dela.
    session.add(Membership(user_id=user.id, organization_id=org.id, role="admin"))
    session.commit()
    session.refresh(org)
    return org


# ---------- Admin: gestão de usuários da organização ----------

def require_org_admin(session: Session, user: User, org_id: int) -> Organization:
    """Garante que `user` é admin da organização `org_id`. Levanta 404/403."""
    org = session.get(Organization, org_id)
    if not org or org.deleted:
        raise HTTPException(status_code=404, detail="Organização não encontrada")
    membership = session.exec(
        select(Membership).where(
            Membership.user_id == user.id,
            Membership.organization_id == org_id,
        )
    ).first()
    if not membership or membership.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao admin da organização")
    return org


class OrgUserCreate(BaseModel):
    email: EmailStr


@app.get('/api/v1/organizations/{org_id}/users/')
def list_org_users(org_id: int, session: SessionDep, user: CurrentUser):
    require_org_admin(session, user, org_id)
    memberships = session.exec(select(Membership).where(Membership.organization_id == org_id)).all()
    out = []
    for m in memberships:
        u = session.get(User, m.user_id)
        if u:
            out.append({"id": u.id, "username": u.username, "email": u.email, "role": m.role})
    return out


@app.post('/api/v1/organizations/{org_id}/users/', status_code=201)
def create_org_user(org_id: int, body: OrgUserCreate, session: SessionDep, user: CurrentUser):
    """Admin adiciona um membro à org só com o e-mail.

    - E-mail já cadastrado: vincula a conta existente à org (papel 'user').
    - E-mail novo: cria a conta (username = e-mail, sem senha utilizável) e
      vincula. A pessoa entra depois pelo login com Google usando o mesmo
      e-mail (o backend casa por e-mail).
    """
    require_org_admin(session, user, org_id)

    email = body.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="E-mail é obrigatório")

    existente = session.exec(select(User).where(User.email == email)).first()
    if existente:
        ja_membro = session.exec(
            select(Membership).where(
                Membership.user_id == existente.id,
                Membership.organization_id == org_id,
            )
        ).first()
        if ja_membro:
            raise HTTPException(status_code=400, detail="Usuário já é membro desta organização")
        session.add(Membership(user_id=existente.id, organization_id=org_id, role="user"))
        session.commit()
        return {"id": existente.id, "username": existente.username, "email": existente.email, "role": "user"}

    # E-mail novo: cria a conta pronta para login por Google. Senha aleatória
    # (não utilizável para login por senha) evita conta sem hash.
    novo = User(
        username=email,
        hashed_password=hash_password(secrets.token_urlsafe(32)),
        email=email,
        email_verified=True,
    )
    session.add(novo)
    session.commit()
    session.refresh(novo)

    session.add(Membership(user_id=novo.id, organization_id=org_id, role="user"))
    session.commit()
    return {"id": novo.id, "username": novo.username, "email": novo.email, "role": "user"}


@app.delete('/api/v1/organizations/{org_id}/users/{user_id}/')
def remove_org_user(org_id: int, user_id: int, session: SessionDep, user: CurrentUser):
    require_org_admin(session, user, org_id)
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Você não pode remover a si mesmo")

    membership = session.exec(
        select(Membership).where(
            Membership.user_id == user_id,
            Membership.organization_id == org_id,
        )
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Usuário não pertence a esta organização")

    session.delete(membership)
    session.commit()
    return {"removed": True}


# ---------- Atribuição de métricas ao lançador (#163) ----------

class MetricAssignmentItem(BaseModel):
    metric_id: int
    can_edit: bool = False
    can_delete: bool = False


class MetricAssignmentUpdate(BaseModel):
    # Compat #163: aceita `metric_ids` (flags desligadas) OU `assignments` com flags.
    metric_ids: list[int] | None = None
    assignments: list[MetricAssignmentItem] | None = None


def _require_member(session: Session, user_id: int, org_id: int) -> Membership:
    m = session.exec(
        select(Membership).where(Membership.user_id == user_id, Membership.organization_id == org_id)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Usuário não pertence a esta organização")
    return m


@app.get('/api/v1/organizations/{org_id}/users/{user_id}/metrics/')
def list_user_metric_assignments(org_id: int, user_id: int, session: SessionDep, user: CurrentUser):
    """Lista as métricas atribuídas ao lançador + as flags de permissão (#163/#164)."""
    require_org_admin(session, user, org_id)
    _require_member(session, user_id, org_id)
    rows = session.exec(
        select(UserMetricAssignment).where(
            UserMetricAssignment.user_id == user_id,
            UserMetricAssignment.organization_id == org_id,
        )
    ).all()
    return {
        "metric_ids": sorted(r.metric_id for r in rows),
        "assignments": [
            {"metric_id": r.metric_id, "can_edit": r.can_edit_entry, "can_delete": r.can_delete_entry}
            for r in sorted(rows, key=lambda r: r.metric_id)
        ],
    }


@app.put('/api/v1/organizations/{org_id}/users/{user_id}/metrics/')
def set_user_metric_assignments(org_id: int, user_id: int, body: MetricAssignmentUpdate, session: SessionDep, user: CurrentUser):
    """Substitui o conjunto de métricas atribuídas ao lançador (idempotente) e suas
    flags de permissão. Só aceita métricas visíveis à org. Remover uma atribuição
    não apaga os lançamentos históricos daquele usuário (só o vínculo é removido)."""
    require_org_admin(session, user, org_id)
    _require_member(session, user_id, org_id)

    # Normaliza para um dict metric_id -> (can_edit, can_delete).
    if body.assignments is not None:
        pedidos = {it.metric_id: (it.can_edit, it.can_delete) for it in body.assignments}
    else:
        pedidos = {mid: (False, False) for mid in (body.metric_ids or [])}
    validos = {mid: flags for mid, flags in pedidos.items() if _visible_metric(mid, session, org_id)}

    atuais = session.exec(
        select(UserMetricAssignment).where(
            UserMetricAssignment.user_id == user_id,
            UserMetricAssignment.organization_id == org_id,
        )
    ).all()
    for a in atuais:
        session.delete(a)
    session.flush()  # aplica os deletes antes dos inserts (evita colisão no unique)
    for mid, (can_edit, can_delete) in validos.items():
        session.add(UserMetricAssignment(
            user_id=user_id, metric_id=mid, organization_id=org_id,
            can_edit_entry=can_edit, can_delete_entry=can_delete,
        ))
    session.commit()
    return {
        "metric_ids": sorted(validos),
        "assignments": [
            {"metric_id": mid, "can_edit": f[0], "can_delete": f[1]}
            for mid, f in sorted(validos.items())
        ],
    }


@app.get('/api/v1/me/log-permissions/')
def my_log_permissions(session: SessionDep, org: ActiveOrg, user: CurrentUser):
    """Permissões efetivas do usuário atual sobre lançamentos na org ativa — a UI
    usa para mostrar/esconder os botões de editar/excluir (#164)."""
    org_id = require_active_org(org)
    is_admin = _is_org_admin(session, user.id, org_id)
    rows = session.exec(
        select(UserMetricAssignment).where(
            UserMetricAssignment.user_id == user.id,
            UserMetricAssignment.organization_id == org_id,
        )
    ).all()
    return {
        "is_admin": is_admin,
        "user_id": user.id,
        "metrics": {str(r.metric_id): {"can_edit": r.can_edit_entry, "can_delete": r.can_delete_entry} for r in rows},
    }


# ---------- Email ----------

from fastapi.responses import HTMLResponse

@app.get('/api/v1/email/preview/', response_class=HTMLResponse)
def email_preview(session: SessionDep, user: CurrentUser):
    resumo = build_resumo(user, session)
    return render_html(resumo)


# ---------- Notifications ----------

class NotificationCreate(BaseModel):
    mensagem: str

@app.get('/api/v1/notifications/')
def list_notifications(session: SessionDep, user: CurrentUser) -> list[Notification]:
    return session.exec(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
    ).all()

@app.post('/api/v1/notifications/', status_code=201)
def create_notification(body: NotificationCreate, session: SessionDep, user: CurrentUser) -> Notification:
    notification = Notification(user_id=user.id, mensagem=body.mensagem)
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification

@app.post('/api/v1/notifications/{notification_id}/read/')
def mark_notification_read(notification_id: int, session: SessionDep, user: CurrentUser) -> Notification:
    notification = session.get(Notification, notification_id)
    if not notification or notification.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    notification.lida = True
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification


# ---------- Subscriptions ----------

class SubscriptionCreate(BaseModel):
    metric_id: int

class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    metric_id: int

@app.get('/api/v1/subscriptions/')
def list_subscriptions(session: SessionDep, user: CurrentUser) -> list[SubscriptionResponse]:
    subs = session.exec(select(UserMetricSubscription).where(UserMetricSubscription.user_id == user.id)).all()
    return [SubscriptionResponse(id=s.id, user_id=s.user_id, metric_id=s.metric_id) for s in subs]

@app.post('/api/v1/subscriptions/', status_code=201)
def create_subscription(body: SubscriptionCreate, session: SessionDep, user: CurrentUser) -> SubscriptionResponse:
    metric = session.get(Metric, body.metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Métrica não encontrada")
    existing = session.exec(
        select(UserMetricSubscription)
        .where(UserMetricSubscription.user_id == user.id)
        .where(UserMetricSubscription.metric_id == body.metric_id)
    ).first()
    if existing:
        return SubscriptionResponse(id=existing.id, user_id=existing.user_id, metric_id=existing.metric_id)
    sub = UserMetricSubscription(user_id=user.id, metric_id=body.metric_id)
    session.add(sub)
    session.commit()
    session.refresh(sub)
    return SubscriptionResponse(id=sub.id, user_id=sub.user_id, metric_id=sub.metric_id)

@app.delete('/api/v1/subscriptions/{sub_id}/', status_code=204)
def delete_subscription(sub_id: int, session: SessionDep, user: CurrentUser):
    sub = session.get(UserMetricSubscription, sub_id)
    if not sub or sub.user_id != user.id:
        raise HTTPException(status_code=404, detail="Subscrição não encontrada")
    session.delete(sub)
    session.commit()
