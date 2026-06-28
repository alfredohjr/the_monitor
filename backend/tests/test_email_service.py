import pytest
from datetime import date
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from main import app
from models import get_session, User, Metric, Goal, LogEntry
from auth import hash_password, create_access_token
from email_service import build_resumo, render_html


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def override():
        return session

    app.dependency_overrides[get_session] = override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def make_user(session: Session, username: str = "ana", email: str = "ana@test.com") -> User:
    user = User(username=username, hashed_password=hash_password("secret"), email=email)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def make_metric(session: Session, codigo: str = "VENDAS") -> Metric:
    m = Metric(codigo=codigo, nome="Vendas do dia", descricao="Total de vendas", tipo="number")
    session.add(m)
    session.commit()
    session.refresh(m)
    return m


def make_goal(session: Session, metric_id: int, alvo: str = "100") -> Goal:
    g = Goal(metric=metric_id, alvo=alvo, periodo_referencia="daily")
    session.add(g)
    session.commit()
    session.refresh(g)
    return g


def auth(user: User):
    return {"Authorization": f"Bearer {create_access_token(user.username)}"}


# --- build_resumo ---

def test_resumo_sem_metas(session):
    user = make_user(session)
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["username"] == "ana"
    assert resumo["data"] == "2026-06-28"
    assert resumo["itens"] == []


def test_resumo_sem_log_hoje(session):
    user = make_user(session)
    metric = make_metric(session)
    make_goal(session, metric.id)
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert len(resumo["itens"]) == 1
    item = resumo["itens"][0]
    assert item["valor_atual"] is None
    assert item["alvo"] == "100"
    assert item["metric_nome"] == "Vendas do dia"


def test_resumo_com_log_hoje(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id)
    log = LogEntry(goal=goal.id, data=date(2026, 6, 28), valor_logado="80")
    session.add(log)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"][0]["valor_atual"] == "80"


def test_resumo_ignora_log_de_outro_dia(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id)
    log = LogEntry(goal=goal.id, data=date(2026, 6, 27), valor_logado="80")
    session.add(log)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"][0]["valor_atual"] is None


def test_resumo_marca_em_risco_abaixo_de_70_porcento(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id, alvo="100")
    log = LogEntry(goal=goal.id, data=date(2026, 6, 28), valor_logado="50")
    session.add(log)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"][0]["em_risco"] is True


def test_resumo_nao_em_risco_acima_de_70_porcento(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id, alvo="100")
    log = LogEntry(goal=goal.id, data=date(2026, 6, 28), valor_logado="90")
    session.add(log)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"][0]["em_risco"] is False


def test_resumo_ignora_goal_deletado(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id)
    goal.deleted = True
    session.add(goal)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"] == []


def test_resumo_ignora_metrica_deletada(session):
    user = make_user(session)
    metric = make_metric(session)
    make_goal(session, metric.id)
    metric.deleted = True
    session.add(metric)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    assert resumo["itens"] == []


# --- render_html ---

def test_render_html_contem_username(session):
    user = make_user(session)
    resumo = build_resumo(user, session, date(2026, 6, 28))
    html = render_html(resumo)
    assert "ana" in html


def test_render_html_contem_data(session):
    user = make_user(session)
    resumo = build_resumo(user, session, date(2026, 6, 28))
    html = render_html(resumo)
    assert "2026-06-28" in html


def test_render_html_contem_meta(session):
    user = make_user(session)
    metric = make_metric(session)
    make_goal(session, metric.id)
    resumo = build_resumo(user, session, date(2026, 6, 28))
    html = render_html(resumo)
    assert "Vendas do dia" in html
    assert "100" in html


def test_render_html_exibe_alerta_risco(session):
    user = make_user(session)
    metric = make_metric(session)
    goal = make_goal(session, metric.id, alvo="100")
    log = LogEntry(goal=goal.id, data=date(2026, 6, 28), valor_logado="50")
    session.add(log)
    session.commit()
    resumo = build_resumo(user, session, date(2026, 6, 28))
    html = render_html(resumo)
    assert "risco" in html.lower()


# --- endpoint de preview ---

def test_preview_requer_autenticacao(client: TestClient):
    assert client.get("/api/v1/email/preview/").status_code == 403


def test_preview_retorna_html(client: TestClient, session: Session):
    user = make_user(session)
    resp = client.get("/api/v1/email/preview/", headers=auth(user))
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]
    assert "ana" in resp.text
