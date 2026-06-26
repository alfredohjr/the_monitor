"""Pacote de models, separado por domínio.

O `models.py` foi quebrado em submódulos (database, monitor, accounts,
pointer) para organizar o código. Tudo é re-exportado aqui para preservar
os imports existentes (`from models import X`).
"""

from .database import (
    DATABASE_URL,
    engine,
    create_db_and_tables,
    get_session,
)
from .monitor import Item, Historico, News
from .accounts import User, Organization, Membership
from .pointer import Metric, Goal, LogEntry

__all__ = [
    "DATABASE_URL",
    "engine",
    "create_db_and_tables",
    "get_session",
    "Item",
    "Historico",
    "News",
    "User",
    "Organization",
    "Membership",
    "Metric",
    "Goal",
    "LogEntry",
]
