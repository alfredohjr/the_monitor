import pytest
from sqlmodel import SQLModel, create_engine, Session, select
from sqlalchemy.pool import StaticPool

from models import Metric
from seed import seed_metricas_padrao


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


def test_seed_cria_metricas_padrao(session):
    seed_metricas_padrao(session)
    metrics = session.exec(select(Metric).where(Metric.is_default == True)).all()
    assert len(metrics) > 0


def test_seed_todas_as_padrao_tem_is_default_true(session):
    seed_metricas_padrao(session)
    for m in session.exec(select(Metric)).all():
        assert m.is_default is True


def test_seed_padrao_e_idempotente(session):
    seed_metricas_padrao(session)
    count_antes = len(session.exec(select(Metric)).all())
    seed_metricas_padrao(session)
    count_depois = len(session.exec(select(Metric)).all())
    assert count_antes == count_depois


def test_seed_cria_pelo_menos_quatro_metricas(session):
    seed_metricas_padrao(session)
    metrics = session.exec(select(Metric).where(Metric.is_default == True)).all()
    assert len(metrics) >= 4


def test_seed_inclui_metrica_currency(session):
    seed_metricas_padrao(session)
    metrics = session.exec(select(Metric).where(Metric.tipo == "currency")).all()
    assert len(metrics) >= 1


def test_seed_inclui_metrica_boolean(session):
    seed_metricas_padrao(session)
    metrics = session.exec(select(Metric).where(Metric.tipo == "boolean")).all()
    assert len(metrics) >= 1


def test_seed_nao_cria_duplicatas_por_codigo(session):
    seed_metricas_padrao(session)
    codigos = [m.codigo for m in session.exec(select(Metric)).all()]
    assert len(codigos) == len(set(codigos))
