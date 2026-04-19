from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas.auth import RefreshRequest, TelegramAuthRequest, TokenPair, UserMe
from app.deps import get_current_user
from app.utils.auth import create_access_token, create_refresh_token, decode_token
from app.utils.telegram_webapp import parse_user_from_init, validate_telegram_init_data

router = APIRouter()
settings = get_settings()


@router.post("/telegram", response_model=TokenPair)
def auth_telegram(body: TelegramAuthRequest, db: Session = Depends(get_db)):
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


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
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
