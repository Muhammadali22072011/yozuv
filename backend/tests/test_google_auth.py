"""Smoke tests for the Sign-in-with-Google endpoints."""
import pytest

from app.config import get_settings


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
