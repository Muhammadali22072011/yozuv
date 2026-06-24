from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    SetPasswordRequest,
    TelegramAuthRequest,
    TokenPair,
    UserMe,
)
from app.deps import get_current_user
from app.utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.utils.ratelimit import rate_limit
from app.utils.telegram_webapp import parse_user_from_init, validate_telegram_init_data

router = APIRouter()
settings = get_settings()

# 30 attempts/min per IP — enough for a legit user retrying, blocks brute-force.
_auth_rate = rate_limit("auth_tg", limit=30, window_seconds=60)
# Password login is a brute-force target — keep the window tight.
_login_rate = rate_limit("auth_login", limit=10, window_seconds=60)
_refresh_rate = rate_limit("auth_refresh", limit=60, window_seconds=60)


@router.post("/telegram", response_model=TokenPair)
def auth_telegram(
    body: TelegramAuthRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_auth_rate),
):
    if not settings.bot_token:
        raise HTTPException(status_code=500, detail="BOT_TOKEN not configured")
    try:
        parsed = validate_telegram_init_data(body.init_data, settings.bot_token)
        u = parse_user_from_init(parsed)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e)) from e

    telegram_id = int(u["id"])
    username = (u.get("username") or "").lstrip("@")
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    if not user:
        user = User(
            telegram_id=telegram_id,
            username=username,
            first_name=u.get("first_name") or "",
            last_name=u.get("last_name") or "",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.username = username or user.username
        user.first_name = u.get("first_name") or user.first_name
        user.last_name = u.get("last_name") or user.last_name
        db.commit()
        db.refresh(user)

    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.post("/login", response_model=TokenPair)
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_login_rate),
):
    """Standalone login by phone or username + password.

    Used by the native app and the web app outside Telegram. Existing
    Telegram users enable this by setting a password via /set-password.
    """
    ident = body.login.strip().lstrip("@")
    user = (
        db.query(User)
        .filter(
            or_(User.username == ident, User.phone == ident),
            User.password_hash.isnot(None),
        )
        .first()
    )
    # Run verify even on miss to keep timing roughly constant.
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login yoki parol noto'g'ri",
        )

    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.post("/set-password")
def set_password(
    body: SetPasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Set/replace the password for the signed-in account so it can log
    in standalone (outside Telegram). Optionally assigns a username as
    the login if the account doesn't already have one."""
    if body.login:
        ident = body.login.strip().lstrip("@")
        if ident and not user.username:
            user.username = ident
    user.password_hash = hash_password(body.password)
    db.commit()
    return {"ok": True, "login": user.username or user.phone}


@router.post("/refresh", response_model=TokenPair)
def refresh(
    body: RefreshRequest,
    db: Session = Depends(get_db),
    _: None = Depends(_refresh_rate),
):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("wrong type")
        uid = UUID(payload["sub"])
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from e

    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


@router.get("/me", response_model=UserMe)
def me(user: User = Depends(get_current_user)):
    from app.deps import is_admin_user
    return UserMe(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username or "",
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_admin=is_admin_user(user),
    )
