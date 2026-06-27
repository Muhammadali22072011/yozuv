"""Smoke tests for the Sign-in-with-Google endpoints."""
import re

import pytest

from app.config import get_settings
from app.utils.auth import create_access_token, decode_token


def _cookie(r, name: str) -> str | None:
    m = re.search(rf"{name}=([^;]+)", r.headers.get("set-cookie", ""))
    return m.group(1) if m else None


def _auth(user):
    return {"Authorization": f"Bearer {create_access_token(str(user.id))}"}


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


def test_link_token_requires_auth(client):
    assert client.post("/api/auth/google/link-token").status_code == 401


def test_link_token_is_link_scoped(client, owner_user):
    r = client.post("/api/auth/google/link-token", headers=_auth(owner_user))
    assert r.status_code == 200
    assert decode_token(r.json()["link_token"])["type"] == "link"


def test_link_start_attaches_user_with_link_token(client, owner_user, google_enabled):
    lt = (
        client.post("/api/auth/google/link-token", headers=_auth(owner_user))
        .json()["link_token"]
    )
    r = client.get(
        f"/api/auth/google/start?link=1&token={lt}", follow_redirects=False
    )
    assert r.status_code in (302, 307)
    assert r.headers["location"].startswith("https://accounts.google.com")
    # The link target user must be stashed in the signed state cookie.
    cookie = _cookie(r, "yz_goauth")
    assert cookie is not None
    assert decode_token(cookie)["link_user_id"] == str(owner_user.id)


def test_link_start_rejects_access_token(client, owner_user, google_enabled):
    # A general access token must NOT work for link mode anymore — only a
    # dedicated link-scoped token attaches the account.
    at = create_access_token(str(owner_user.id))
    r = client.get(
        f"/api/auth/google/start?link=1&token={at}", follow_redirects=False
    )
    assert r.status_code in (302, 307)  # still redirects to Google
    cookie = _cookie(r, "yz_goauth")
    assert cookie is not None
    assert "link_user_id" not in decode_token(cookie)
