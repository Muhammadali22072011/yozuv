import re
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import bcrypt
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import User

settings = get_settings()

ALGORITHM = "HS256"

# Login identifiers can be a username or a phone number. We canonicalize each
# the same way at store time (set-password) and lookup time (login) so that
# "+998 90 123 45 67" and "+998901234567" always resolve to the same account.
_PHONE_CHARS = re.compile(r"^[+\d\s().\-]+$")


def looks_like_phone(raw: str) -> bool:
    """True when the login is phone-ish: only phone characters and at least
    7 digits. Below that it's treated as a username (so short handles win)."""
    s = raw.strip()
    if not s or _PHONE_CHARS.match(s) is None:
        return False
    return len(re.sub(r"\D", "", s)) >= 7


def canon_phone(raw: str) -> str:
    """Canonical phone: digits only. Deliberately drops the leading '+',
    spacing and separators so the SAME number always maps to ONE string —
    '+998 90 123 45 67' and '998901234567' both become '998901234567'.
    Store and look up on this form so the two can never fork into two
    accounts or miss each other at login."""
    return re.sub(r"\D", "", raw)


def canon_username(raw: str) -> str:
    """Canonical username: stripped, leading '@' removed, lowercased."""
    return raw.strip().lstrip("@").lower()

# bcrypt hashes at most the first 72 bytes of a password; bcrypt >=4.1 raises
# instead of truncating silently, so we slice to 72 bytes ourselves. Slicing on
# the raw UTF-8 bytes (not the str) matches bcrypt's own byte-level truncation.
_BCRYPT_MAX_BYTES = 72


def _encode(plain: str) -> bytes:
    return plain.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(_encode(plain), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(_encode(plain), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/unknown hash in DB — treat as no-match, never 500.
        return False


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
