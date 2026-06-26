from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Business, Membership, MembershipRole, User
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


def is_admin_user(user: User, db: Session | None = None) -> bool:
    """True if the user is a platform admin.

    Env ``ADMIN_TELEGRAM_IDS`` are the immutable bootstrap admins. When a
    db session is provided we also honour panel-managed ``admin_users``
    rows, so additional admins can be granted at runtime.
    """
    if user is None:
        return False
    try:
        tg = int(user.telegram_id)
    except (TypeError, ValueError):
        return False
    if tg in _admin_telegram_ids():
        return True
    if db is not None:
        from app.models import AdminUser

        return (
            db.query(AdminUser.id).filter(AdminUser.telegram_id == tg).first()
            is not None
        )
    return False


def get_admin_user(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> User:
    if not is_admin_user(user, db):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def get_active_business(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_business_id: str | None = Header(default=None, alias="X-Business-Id"),
) -> Business:
    """Membership-aware version of `get_owned_business`.

    Picks the business this request is acting against by:

    1. If the client sends `X-Business-Id`, validate the user has a
       Membership for that business (any role) and use it. This is the
       multi-business path.
    2. Otherwise fall back to the legacy single-business case: the
       business this user owns via Business.owner_id.

    The legacy `get_owned_business` dep stays in place so existing
    routers that haven't been migrated yet keep working unchanged.
    Once every router has been moved over to this dep, owner_id can
    be retired.
    """
    if x_business_id:
        try:
            from uuid import UUID as _UUID
            biz_id = _UUID(x_business_id)
        except ValueError:
            raise HTTPException(400, "Invalid X-Business-Id") from None
        membership = (
            db.query(Membership)
            .filter(
                Membership.user_id == user.id,
                Membership.business_id == biz_id,
            )
            .first()
        )
        if membership is None:
            raise HTTPException(403, "No membership for that business")
        b = db.query(Business).filter(Business.id == biz_id).first()
        if b is None:
            raise HTTPException(404, "Business not found")
        return b

    # Legacy fallback — same as get_owned_business so non-migrated
    # callers keep working.
    b = db.query(Business).filter(Business.owner_id == user.id).first()
    if not b:
        raise HTTPException(404, "Business not found")
    return b


def require_role(*allowed: MembershipRole):
    """Dependency factory: require the caller's membership for the
    active business to have one of `allowed` roles. Use after
    `get_active_business` so the business has already been resolved.
    """

    def _dep(
        user: User = Depends(get_current_user),
        business: Business = Depends(get_active_business),
        db: Session = Depends(get_db),
    ) -> Business:
        m = (
            db.query(Membership)
            .filter(
                Membership.user_id == user.id,
                Membership.business_id == business.id,
            )
            .first()
        )
        if m is None or m.role not in {r.value for r in allowed} | set(allowed):
            raise HTTPException(403, "Insufficient role")
        return business

    return _dep
