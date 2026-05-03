from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Business, User
from app.utils.auth import decode_token, get_user_from_token

security = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = get_user_from_token(db, creds.credentials)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
    return user


def get_owned_business(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Business:
    b = db.query(Business).filter(Business.owner_id == user.id).first()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return b


def get_owned_business_download(
    token: str | None = None,
    creds: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> Business:
    """Auth for endpoints meant to be opened directly in a browser tab
    (e.g. PDF download from a Telegram WebApp). Accepts the access
    token via Authorization header *or* `?token=` query param so the
    URL alone is enough to trigger a download — mobile WebApps can't
    inject custom headers when navigating to a link."""
    raw: str | None = None
    if creds and creds.scheme.lower() == "bearer":
        raw = creds.credentials
    elif token:
        raw = token
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = get_user_from_token(db, raw)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
    b = db.query(Business).filter(Business.owner_id == user.id).first()
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return b


def _admin_telegram_ids() -> set[int]:
    raw = get_settings().admin_telegram_ids or ""
    ids: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            ids.add(int(part))
        except ValueError:
            continue
    return ids


def is_admin_user(user: User) -> bool:
    admins = _admin_telegram_ids()
    if not admins:
        return False
    try:
        return int(user.telegram_id) in admins
    except (TypeError, ValueError):
        return False


def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
