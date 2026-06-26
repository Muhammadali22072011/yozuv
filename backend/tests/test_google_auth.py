"""Smoke tests for the Sign-in-with-Google endpoints."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.config import get_settings
from app.models import AuthIdentity, AuthProvider, User
from app.utils.auth import ALGORITHM, create_access_token, hash_password


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


def _goauth_cookie(link_user_id, state="st", cv="cv"):
    """Build the signed PKCE/CSRF stash cookie google_start would have set."""
    s = get_settings()
    return jwt.encode(
        {
            "state": state,
            "cv": cv,
            "type": "goauth",
            "link_user_id": str(link_user_id),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
        },
        s.secret_key,
        algorithm=ALGORITHM,
    )


def _mock_google(monkeypatch, sub, email="g@example.com"):
    monkeypatch.setattr(
        "app.routers.auth.exchange_code", lambda code, cv: {"id_token": "tok"}
    )
    monkeypatch.setattr(
        "app.routers.auth.parse_id_token",
        lambda tok: {
            "sub": sub,
            "email": email,
            "email_verified": True,
            "name": "G User",
            "given_name": "G",
            "family_name": "User",
        },
    )


@pytest.fixture()
def google_disabled():
    s = get_settings()
    old = (s.google_client_id, s.google_client_secret)
    s.google_client_id = ""
    s.google_client_secret = ""
    yield
    s.google_client_id, s.google_client_secret = old


@pytest.fixture()
def google_enabled():
    s = get_settings()
    old = (s.google_client_id, s.google_client_secret)
    s.google_client_id = "test-client.apps.googleusercontent.com"
    s.google_client_secret = "test-secret"
    yield
    s.google_client_id, s.google_client_secret = old


def test_start_404_when_disabled(client, google_disabled):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code == 404


def test_start_redirects_to_google_when_enabled(client, google_enabled):
    r = client.get("/api/auth/google/start", follow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers["location"]
    assert loc.startswith("https://accounts.google.com/o/oauth2/v2/auth")
    assert "client_id=test-client.apps.googleusercontent.com" in loc
    assert "code_challenge=" in loc
    assert "code_challenge_method=S256" in loc
    assert "scope=openid" in loc
    # PKCE state stashed in an httpOnly cookie
    assert "yz_goauth" in r.headers.get("set-cookie", "")


def test_callback_bad_state_redirects_to_login(client, google_enabled):
    # No cookie / no matching state → bounce back to login, not a 500.
    r = client.get(
        "/api/auth/google/callback?code=abc&state=nope", follow_redirects=False
    )
    assert r.status_code in (302, 307)
    assert "/auth/login" in r.headers["location"]


def test_callback_missing_code_redirects(client, google_enabled):
    r = client.get("/api/auth/google/callback", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert "/auth/login" in r.headers["location"]


def test_identities_lists_methods(client, owner_user):
    r = client.get("/api/auth/identities", headers=_auth(owner_user))
    assert r.status_code == 200
    methods = {m["provider"]: m for m in r.json()["methods"]}
    assert methods["telegram"]["connected"] is True
    assert methods["google"]["connected"] is False
    assert methods["password"]["connected"] is False


def test_disconnect_google_not_connected_404(client, owner_user):
    r = client.delete("/api/auth/identities/google", headers=_auth(owner_user))
    assert r.status_code == 404


def test_link_start_redirects_to_google(client, owner_user, google_enabled):
    token = create_access_token(str(owner_user.id))
    r = client.get(
        f"/api/auth/google/start?link=1&token={token}", follow_redirects=False
    )
    assert r.status_code in (302, 307)
    assert r.headers["location"].startswith("https://accounts.google.com")


def test_link_absorbs_empty_orphan_account(
    client, db, owner_user, google_enabled, monkeypatch
):
    # A stray past Google login made an empty orphan account holding the sub.
    orphan = User(id=uuid.uuid4(), telegram_id=None, first_name="Orphan")
    db.add(orphan)
    db.flush()
    db.add(
        AuthIdentity(
            user_id=orphan.id,
            provider=AuthProvider.GOOGLE.value,
            subject="g-orphan",
            email="g@example.com",
            email_verified=True,
        )
    )
    db.flush()

    _mock_google(monkeypatch, "g-orphan")
    client.cookies.set("yz_goauth", _goauth_cookie(owner_user.id))
    r = client.get(
        "/api/auth/google/callback?code=c&state=st", follow_redirects=False
    )

    assert r.status_code in (302, 307)
    assert "linked=google" in r.headers["location"]
    # Identity moved to the signed-in account; orphan gone.
    moved = (
        db.query(AuthIdentity).filter(AuthIdentity.subject == "g-orphan").first()
    )
    assert moved is not None and moved.user_id == owner_user.id
    assert db.query(User).filter(User.id == orphan.id).first() is None


def test_link_refused_when_other_account_is_real(
    client, db, owner_user, google_enabled, monkeypatch
):
    # The other account has a password — a real account, not an orphan.
    other = User(
        id=uuid.uuid4(),
        telegram_id=None,
        first_name="Real",
        username="realuser",
        password_hash=hash_password("secret123"),
    )
    db.add(other)
    db.flush()
    db.add(
        AuthIdentity(
            user_id=other.id,
            provider=AuthProvider.GOOGLE.value,
            subject="g-real",
            email="g@example.com",
            email_verified=True,
        )
    )
    db.flush()

    _mock_google(monkeypatch, "g-real")
    client.cookies.set("yz_goauth", _goauth_cookie(owner_user.id))
    r = client.get(
        "/api/auth/google/callback?code=c&state=st", follow_redirects=False
    )

    assert r.status_code in (302, 307)
    assert "link_error=google_taken" in r.headers["location"]
    # Nothing moved; the real account keeps its identity.
    kept = db.query(AuthIdentity).filter(AuthIdentity.subject == "g-real").first()
    assert kept is not None and kept.user_id == other.id
    assert db.query(User).filter(User.id == other.id).first() is not None
