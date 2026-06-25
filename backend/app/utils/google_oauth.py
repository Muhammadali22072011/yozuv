"""Minimal Google OAuth 2.0 / OpenID Connect helpers (Authorization Code + PKCE).

The ID token is fetched directly from Google's token endpoint over TLS during
the code exchange, so per Google's own guidance its claims can be trusted
without re-verifying the signature locally — we still validate iss / aud / exp.
"""

import base64
import hashlib
import secrets
import time
from urllib.parse import urlencode

import httpx
from jose import jwt

from app.config import get_settings

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_VALID_ISS = {"https://accounts.google.com", "accounts.google.com"}


def google_enabled() -> bool:
    s = get_settings()
    return bool(s.google_client_id and s.google_client_secret)


def callback_url() -> str:
    return get_settings().public_api_url.rstrip("/") + "/api/auth/google/callback"


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def make_pkce() -> tuple[str, str]:
    """Return (code_verifier, code_challenge) for the S256 PKCE method."""
    verifier = _b64url(secrets.token_bytes(32))
    challenge = _b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def random_state() -> str:
    return _b64url(secrets.token_bytes(16))


def build_auth_url(state: str, code_challenge: str) -> str:
    s = get_settings()
    params = {
        "client_id": s.google_client_id,
        "redirect_uri": callback_url(),
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str, code_verifier: str) -> dict:
    """Trade the authorization code for tokens. Returns the token response."""
    s = get_settings()
    data = {
        "code": code,
        "client_id": s.google_client_id,
        "client_secret": s.google_client_secret,
        "redirect_uri": callback_url(),
        "grant_type": "authorization_code",
        "code_verifier": code_verifier,
    }
    with httpx.Client(timeout=10) as client:
        resp = client.post(GOOGLE_TOKEN_URL, data=data)
    resp.raise_for_status()
    return resp.json()


def parse_id_token(id_token: str) -> dict:
    """Validate iss/aud/exp on the directly-fetched ID token and return claims."""
    s = get_settings()
    claims = jwt.get_unverified_claims(id_token)
    if claims.get("iss") not in _VALID_ISS:
        raise ValueError("Bad token issuer")
    if claims.get("aud") != s.google_client_id:
        raise ValueError("Token audience mismatch")
    exp = claims.get("exp")
    if not exp or int(exp) < int(time.time()):
        raise ValueError("Token expired")
    if not claims.get("sub"):
        raise ValueError("Token missing subject")
    return claims
