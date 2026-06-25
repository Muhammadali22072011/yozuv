from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import AuthIdentity, AuthProvider, User
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
    ALGORITHM,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.utils.google_oauth import (
    build_auth_url,
    exchange_code,
    google_enabled,
    make_pkce,
    parse_id_token,
    random_state,
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


_GOOGLE_COOKIE = "yz_goauth"


def _secure_cookies() -> bool:
    return (settings.app_env or "").lower() == "production"


@router.get("/google/start")
def google_start():
    """Begin Sign-in-with-Google. Stashes PKCE verifier + CSRF state in a
    short-lived signed cookie, then 302s to Google's consent screen."""
    if not google_enabled():
        raise HTTPException(status_code=404, detail="Google login disabled")
    state = random_state()
    verifier, challenge = make_pkce()
    stash = jwt.encode(
        {
            "state": state,
            "cv": verifier,
            "type": "goauth",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        settings.secret_key,
        algorithm=ALGORITHM,
    )
    resp = RedirectResponse(build_auth_url(state, challenge), status_code=302)
    resp.set_cookie(
        _GOOGLE_COOKIE,
        stash,
        max_age=600,
        httponly=True,
        secure=_secure_cookies(),
        samesite="lax",
        path="/api/auth/google",
    )
    return resp


def _google_fail(msg: str = "google") -> RedirectResponse:
    app_url = settings.public_app_url.rstrip("/")
    resp = RedirectResponse(f"{app_url}/auth/login?e={msg}", status_code=302)
    resp.delete_cookie(_GOOGLE_COOKIE, path="/api/auth/google")
    return resp


@router.get("/google/callback")
def google_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Google redirects here with ?code&state. Verify CSRF state against the
    cookie, exchange the code, then find-or-create the google identity and
    hand the browser our tokens via the URL fragment (kept out of logs)."""
    if not google_enabled():
        raise HTTPException(status_code=404, detail="Google login disabled")
    if error or not code or not state:
        return _google_fail()

    stash = request.cookies.get(_GOOGLE_COOKIE)
    if not stash:
        return _google_fail()
    try:
        data = jwt.decode(stash, settings.secret_key, algorithms=[ALGORITHM])
        if data.get("type") != "goauth" or data.get("state") != state:
            return _google_fail()
        code_verifier = data["cv"]
    except Exception:
        return _google_fail()

    try:
        tokens = exchange_code(code, code_verifier)
        claims = parse_id_token(tokens["id_token"])
    except Exception:
        return _google_fail()

    # Never open an account on an unverified Google email (anti-takeover).
    if not claims.get("email_verified", False):
        return _google_fail("google_unverified")

    sub = str(claims["sub"])
    email = claims.get("email")
    name = claims.get("name") or claims.get("given_name") or ""
    now = datetime.now(timezone.utc)

    identity = (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.provider == AuthProvider.GOOGLE.value,
            AuthIdentity.subject == sub,
        )
        .first()
    )
    if identity:
        user = identity.user
        identity.last_login_at = now
        identity.email = email
        identity.email_verified = True
    else:
        # Phase 2: a new Google sub = a new account. Linking to an existing
        # account by matching email is deliberately NOT done here — that
        # requires proof of ownership and lands in the Settings link flow.
        user = User(
            telegram_id=None,
            first_name=(claims.get("given_name") or name or ""),
            last_name=(claims.get("family_name") or ""),
        )
        db.add(user)
        db.flush()
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider=AuthProvider.GOOGLE.value,
                subject=sub,
                email=email,
                email_verified=True,
                display_name=name,
                last_login_at=now,
            )
        )
    db.commit()
    db.refresh(user)

    sub_id = str(user.id)
    access = create_access_token(sub_id)
    refresh = create_refresh_token(sub_id)
    app_url = settings.public_app_url.rstrip("/")
    resp = RedirectResponse(
        f"{app_url}/auth/callback#access={access}&refresh={refresh}",
        status_code=302,
    )
    resp.delete_cookie(_GOOGLE_COOKIE, path="/api/auth/google")
    return resp


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
    ident = body.login.strip().lstrip("@").lower()
    user = (
        db.query(User)
        .filter(
            or_(func.lower(User.username) == ident, func.lower(User.phone) == ident),
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
        ident = body.login.strip().lstrip("@").lower()
        if ident and not user.username:
            # Reject if another account already claims this login as its
            # username or phone (case-insensitive) — otherwise password
            # login would resolve ambiguously between the two accounts.
            clash = (
                db.query(User.id)
                .filter(
                    User.id != user.id,
                    or_(func.lower(User.username) == ident, func.lower(User.phone) == ident),
                )
                .first()
            )
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Bu login allaqachon band",
                )
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
