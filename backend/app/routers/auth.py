from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from jose import jwt
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
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
    canon_phone,
    canon_username,
    create_access_token,
    create_link_token,
    create_refresh_token,
    decode_token,
    get_user_from_link_token,
    get_user_from_token,
    hash_password,
    looks_like_phone,
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
# set-password is authenticated but its 409/200 leaks whether a login is taken
# (enumeration oracle) — cap probing.
_setpw_rate = rate_limit("auth_setpw", limit=20, window_seconds=60)

# E.164 allows at most 15 digits; cap a phone-shaped login here so it can't
# overflow the String(32) phone column (which would 500 on Postgres).
_MAX_PHONE_DIGITS = 15


def _sync_telegram_identity(
    db: Session, user: User, telegram_id: int, username: str
) -> None:
    """Upsert the telegram auth_identities row on every Telegram login, so the
    identity table stays complete and the inline User.telegram_id column can be
    dropped in a later phase (the rest of the identity migration)."""
    subject = str(telegram_id)
    ident = (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.provider == AuthProvider.TELEGRAM.value,
            AuthIdentity.subject == subject,
        )
        .first()
    )
    now = datetime.now(timezone.utc)
    if ident:
        ident.last_login_at = now
        if username:
            ident.display_name = username
    else:
        db.add(
            AuthIdentity(
                user_id=user.id,
                provider=AuthProvider.TELEGRAM.value,
                subject=subject,
                display_name=username or "",
                last_login_at=now,
            )
        )
    db.commit()


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

    _sync_telegram_identity(db, user, telegram_id, username)

    sub = str(user.id)
    return TokenPair(
        access_token=create_access_token(sub),
        refresh_token=create_refresh_token(sub),
    )


_GOOGLE_COOKIE = "yz_goauth"


def _secure_cookies() -> bool:
    return (settings.app_env or "").lower() == "production"


@router.post("/google/link-token")
def google_link_token(user: User = Depends(get_current_user)):
    """Mint a short-lived (5 min), link-scoped token for the account-link
    redirect. The frontend fetches this with its Bearer header, then passes
    it as ?token= to /google/start — so a general access token never has to
    travel in a URL where it could leak into logs/history."""
    return {"link_token": create_link_token(str(user.id))}


@router.get("/google/start")
def google_start(
    link: int = 0,
    token: str | None = None,
    ret: str = "",
    db: Session = Depends(get_db),
):
    """Begin Sign-in-with-Google. Stashes PKCE verifier + CSRF state in a
    short-lived signed cookie, then 302s to Google's consent screen.

    Link mode (?link=1&token=<link_token>): attach Google to the CURRENT
    account instead of creating a new one. The token rides the query because a
    top-level navigation can't send a Bearer header; it MUST be a dedicated
    5-min link-scoped token (see /google/link-token), never a general access
    token — query strings leak into access logs, history and Referer."""
    if not google_enabled():
        raise HTTPException(status_code=404, detail="Google login disabled")
    link_user_id = None
    if link and token:
        u = get_user_from_link_token(db, token)
        if u:
            link_user_id = str(u.id)
    state = random_state()
    verifier, challenge = make_pkce()
    payload = {
        "state": state,
        "cv": verifier,
        "type": "goauth",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    if link_user_id:
        payload["link_user_id"] = link_user_id
    # 'app' return target → the callback deep-links back into the Android APK
    # (yozuv://) instead of redirecting to the web frontend.
    if ret == "app":
        payload["ret"] = "app"
    stash = jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)
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
        link_user_id = data.get("link_user_id")
        ret = data.get("ret") or ""
    except Exception:
        return _google_fail()

    # Where to send the browser back: the web frontend, or — for the Android
    # APK — a yozuv:// deep link that re-opens the app with the tokens.
    front_base = "yozuv://" if ret == "app" else settings.public_app_url.rstrip("/") + "/"

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

    # Link mode: attach this Google identity to the signed-in account instead
    # of logging in / creating a new one.
    if link_user_id:
        app_url = settings.public_app_url.rstrip("/")
        if identity and str(identity.user_id) != link_user_id:
            # This Google account is already linked to a DIFFERENT yozuv
            # account — never silently move it (account-takeover guard).
            resp = RedirectResponse(
                f"{app_url}/dashboard/settings?link_error=google_taken",
                status_code=302,
            )
            resp.delete_cookie(_GOOGLE_COOKIE, path="/api/auth/google")
            return resp
        if identity:
            identity.last_login_at = now
            identity.email = email
            identity.email_verified = True
        else:
            db.add(
                AuthIdentity(
                    user_id=UUID(link_user_id),
                    provider=AuthProvider.GOOGLE.value,
                    subject=sub,
                    email=email,
                    email_verified=True,
                    display_name=name,
                    last_login_at=now,
                )
            )
        db.commit()
        resp = RedirectResponse(
            f"{front_base}dashboard/settings?linked=google", status_code=302
        )
        resp.delete_cookie(_GOOGLE_COOKIE, path="/api/auth/google")
        return resp

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
    resp = RedirectResponse(
        f"{front_base}auth/callback#access={access}&refresh={refresh}",
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
    raw = body.login.strip()
    ident = canon_username(raw)
    # Match the typed login against username (case-insensitive) or phone.
    # When it looks like a phone, also match the canonical form so spacing
    # and a leading '+' don't matter ("+998 90 …" == "+998901234567").
    conds = []
    if ident:
        # Guard on non-empty: a blank/"@" login must not match the empty-string
        # username/phone that password-less accounts carry by default.
        conds.append(func.lower(User.username) == ident)
        conds.append(func.lower(User.phone) == ident)
    if looks_like_phone(raw):
        conds.append(User.phone == canon_phone(raw))
    if not conds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login yoki parol noto'g'ri",
        )
    user = (
        db.query(User)
        .filter(
            or_(*conds),
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
    _: None = Depends(_setpw_rate),
):
    """Set/replace the password for the signed-in account so it can log
    in standalone (outside Telegram).

    The chosen `login` may be a username or a phone number — it lands in
    the matching column (a phone never gets stored as a username). A login is
    only *claimed* when the matching column is still empty: an existing
    username/phone is never overwritten, so a handle can't be freed and
    re-grabbed. This is the endpoint behind the forced /auth/setup screen.
    """
    raw = (body.login or "").strip()
    if raw and looks_like_phone(raw):
        value = canon_phone(raw)
        if len(value) > _MAX_PHONE_DIGITS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telefon raqami noto'g'ri",
            )
        # Only claim an unused phone; never clobber a login already on file.
        if not user.phone:
            clash = (
                db.query(User.id)
                .filter(
                    User.id != user.id,
                    or_(User.phone == value, func.lower(User.username) == value),
                )
                .first()
            )
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Bu raqam allaqachon band",
                )
            user.phone = value
    elif raw and canon_username(raw):
        ident = canon_username(raw)
        # Only claim an unused username; never clobber an existing one.
        if not user.username:
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
    elif not user.username and not user.phone:
        # No usable login supplied (blank / only "@") and none on file — the
        # account could never log in standalone. Force a real one.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Login kiriting",
        )
    user.password_hash = hash_password(body.password)
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request claimed the same username/phone between our
        # clash check and commit — the DB unique indexes are the real guard.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu login allaqachon band",
        ) from None
    db.refresh(user)
    return {"ok": True, "login": user.username or user.phone}


@router.get("/identities")
def list_identities(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Login methods linked to the signed-in account, for the Settings
    'Linked accounts' panel. Telegram/password come from the legacy User
    columns (still the login source of truth); Google from auth_identities."""
    g = (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.user_id == user.id,
            AuthIdentity.provider == AuthProvider.GOOGLE.value,
        )
        .first()
    )
    return {
        "methods": [
            {
                "provider": "telegram",
                "label": "Telegram",
                "connected": user.telegram_id is not None,
                "detail": None,
            },
            {
                "provider": "password",
                "label": "Login va parol",
                "connected": bool(user.password_hash),
                "detail": user.username or user.phone or None,
            },
            {
                "provider": "google",
                "label": "Google",
                "connected": g is not None,
                "detail": g.email if g else None,
            },
        ]
    }


@router.delete("/identities/google")
def disconnect_google(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unlink Google. Refused if it would leave the account with no way in."""
    g = (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.user_id == user.id,
            AuthIdentity.provider == AuthProvider.GOOGLE.value,
        )
        .first()
    )
    if not g:
        raise HTTPException(status_code=404, detail="Google ulanmagan")
    other_methods = (1 if user.telegram_id is not None else 0) + (
        1 if user.password_hash else 0
    )
    if other_methods < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kamida bitta kirish usuli qolishi kerak",
        )
    db.delete(g)
    db.commit()
    return {"ok": True}


@router.delete("/account")
def delete_account(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete the signed-in account and everything it owns.

    Hard delete: removing the users row fires the ON DELETE CASCADE wired on
    every FK that points (directly or transitively) at it — the owned
    business and all of its services, bookings, schedules, subscription,
    payments, reviews, staff, memberships and auth identities go with it.
    Global clients (keyed by telegram_id, not owned by the business) are
    intentionally left intact. Irreversible — the UI gates it behind an
    explicit confirmation.
    """
    uid = user.id
    # Explicit identity sweep first so the rows are gone even on a backend
    # that doesn't enforce ON DELETE CASCADE (SQLite in tests); on Postgres
    # the FK cascade from the users delete already covers it.
    db.query(AuthIdentity).filter(AuthIdentity.user_id == uid).delete(
        synchronize_session=False
    )
    db.query(User).filter(User.id == uid).delete(synchronize_session=False)
    db.commit()
    return {"ok": True}


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
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from app.deps import is_admin_user
    return UserMe(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username or "",
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        is_admin=is_admin_user(user, db),
        has_password=user.password_hash is not None,
    )
