from typing import Optional
from datetime import datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    email: Optional[str] = Field(default=None, unique=True, index=True)


class Organization(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str = Field(max_length=150)
    deleted: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Membership(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    organization_id: int = Field(foreign_key="organization.id", index=True)
    # Papel do usuário nesta organização. String (não enum) para permitir novos
    # níveis no futuro sem migração de tipo. "user" = menor privilégio.
    role: str = Field(default="user", max_length=30)
    created_at: datetime = Field(default_factory=datetime.utcnow)
