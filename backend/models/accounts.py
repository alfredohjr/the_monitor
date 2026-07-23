from typing import Optional
from datetime import datetime

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(unique=True, index=True)
    hashed_password: str
    email: Optional[str] = Field(default=None, unique=True, index=True)
    email_verified: bool = Field(default=False)
    # Nome de exibição editável pelo usuário. No login por Google o username é o
    # e-mail; o display_name deixa a UI mostrar um nome amigável (#206).
    display_name: Optional[str] = Field(default=None, max_length=150)


class EmailVerificationToken(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    token: str = Field(unique=True, index=True, max_length=64)
    expires_at: datetime
    used_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Organization(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    nome: str = Field(max_length=150)
    # Código de acesso definido por quem cria a org no cadastro. Novos membros
    # precisam informá-lo para entrar (como 'user'). None = org sem código (não
    # aceita entrada por auto-cadastro).
    codigo_acesso: Optional[str] = Field(default=None, max_length=100)
    # Plano da organização (#216). Orgs free/pessoais (ex.: criadas no onboarding
    # de usuário único) não podem associar novos membros — isso exige um plano
    # pago. Marcado manualmente/por superadmin. Default: free.
    is_paid: bool = Field(default=False)
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
