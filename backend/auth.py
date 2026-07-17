import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from models import User, get_session

# Este default é PÚBLICO — está no repositório. Existe só pra dev não precisar de
# setup; em produção o boot recusa subir com ele (ver validar_secret_key).
DEFAULT_SECRET_KEY = "dev-secret-key-change-in-production"

# `or` em vez do default do getenv: SECRET_KEY="" (como vem no .env.example) tem
# que cair no default e ser pega pela validação, e não virar chave vazia assinando
# os tokens.
SECRET_KEY = os.getenv("SECRET_KEY", "").strip() or DEFAULT_SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24
REFRESH_TOKEN_EXPIRE_DAYS = 7
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

bearer = HTTPBearer()


def validar_secret_key(secret: str, debug: bool) -> None:
    """Recusa subir em produção com o segredo público do repositório (#191).

    O mesmo SECRET_KEY assina e valida os JWT. Rodando com o default, qualquer um
    que leia o código forja um token válido pra qualquer usuário, inclusive admin
    — e nada na tela denuncia isso. Melhor não subir do que subir forjável em
    silêncio.

    Chamada no `on_startup` e não no import: o import roda nos testes (e no
    `importlib.reload` do test_swagger), que não têm SECRET_KEY nem DEBUG.
    """
    if debug or secret != DEFAULT_SECRET_KEY:
        return

    raise RuntimeError(
        "SECRET_KEY não configurada: o backend subiria com o default público do "
        "repositório, e qualquer um poderia forjar um JWT de admin. Defina SECRET_KEY "
        "no ambiente — gere uma com:\n"
        '  python -c "import secrets; print(secrets.token_urlsafe(48))"\n'
        "Em desenvolvimento, use DEBUG=true para manter o default."
    )


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}${digest}"


def verify_password(plain: str, stored: str) -> bool:
    try:
        salt, expected = stored.split("$", 1)
        actual = hashlib.sha256(f"{salt}{plain}".encode()).hexdigest()
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire, "type": "access"}, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": username, "exp": expire, "type": "refresh"}, SECRET_KEY, algorithm=ALGORITHM)


def verify_google_token(token: str) -> dict:
    """Verifica um ID token do Google e retorna os claims (email, etc.).

    Levanta exceção (ValueError) se o token for inválido. A verificação real
    é isolada aqui para poder ser mockada nos testes.
    """
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests

    return google_id_token.verify_oauth2_token(
        token, google_requests.Request(), GOOGLE_CLIENT_ID or None
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    session: Session = Depends(get_session),
) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise ValueError
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user = session.exec(select(User).where(User.username == username)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")
    return user
