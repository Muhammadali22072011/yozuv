from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode: dict[str, Any] = {"exp": expire, "sub": subject, "type": "access"}
    if extra:
        to_encode.update(extra)
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode = {"exp": expire, "sub": subject, "type": "refresh"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def create_ephemeral_token(subject: str, ttl_minutes: int | None = None) -> str:
    """Mint a purpose-locked token for URLs the browser navigates to
    directly (SSE stream, PDF download) where a custom Authorization header
    isn't possible. type='ephemeral' is rejected by get_user_from_token, so
    even if this leaks (logs / Referer / Telegram link handler) it can only
    open those read-only endpoints — never authenticate a mutating API call.
    The primary access JWT must never travel in a URL."""
    minutes = ttl_minutes if ttl_minutes is not None else settings.access_token_expire_minutes
    expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    to_encode = {"exp": expire, "sub": subject, "type": "ephemeral"}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])


def get_user_from_token(db: Session, token: str) -> User | None:
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        user_id = UUID(sub)
    except (JWTError, ValueError):
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_user_from_browser_token(db: Session, token: str) -> User | None:
    """Resolve a user from an access OR ephemeral token. Used only by the
    browser-navigable download/stream endpoints, which accept a `?token=`
    query param. Mutating endpoints keep using get_user_from_token (access
    only), so an ephemeral token can't be replayed against them."""
    try:
        payload = decode_token(token)
        if payload.get("type") not in ("access", "ephemeral"):
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        user_id = UUID(sub)
    except (JWTError, ValueError):
        return None
    return db.query(User).filter(User.id == user_id).first()
