"""Regression tests for the prod-readiness audit fixes.

Lightweight unit tests (no DB/fixtures) that pin the behaviour of the
most security/money-sensitive fixes so they can't silently regress.
"""
from types import SimpleNamespace

import pytest

from app.services.booking_service import _promo_discount
from app.utils.ratelimit import _client_ip


class TestPromoExclusive:
    """Percent OR amount — never both (UI labels them as exclusive)."""

    def test_percent_takes_precedence_not_combined(self):
        p = SimpleNamespace(discount_percent=10, discount_amount=5000)
        # 10% of 100000 = 10000; the 5000 amount must NOT be added on top.
        assert _promo_discount(p, 100000) == 10000

    def test_amount_when_no_percent(self):
        p = SimpleNamespace(discount_percent=0, discount_amount=5000)
        assert _promo_discount(p, 100000) == 5000

    def test_zero_when_neither(self):
        p = SimpleNamespace(discount_percent=0, discount_amount=0)
        assert _promo_discount(p, 100000) == 0


class TestRateLimitClientIp:
    """X-Forwarded-For is client-controlled; we must trust the RIGHTMOST
    (proxy-appended) hop, not the spoofable leftmost one."""

    @staticmethod
    def _req(xff: str | None, peer: str = "10.0.0.1"):
        headers = {"x-forwarded-for": xff} if xff is not None else {}
        return SimpleNamespace(
            headers=SimpleNamespace(get=lambda k, d="": headers.get(k, d)),
            client=SimpleNamespace(host=peer),
        )

    def test_uses_rightmost_hop(self):
        # attacker prepends a spoofed value; real client appended by proxy.
        assert _client_ip(self._req("1.2.3.4, 203.0.113.9")) == "203.0.113.9"

    def test_single_value(self):
        assert _client_ip(self._req("203.0.113.9")) == "203.0.113.9"

    def test_falls_back_to_peer(self):
        assert _client_ip(self._req(None, peer="10.9.9.9")) == "10.9.9.9"


class TestSecretKeyProductionGate:
    """Weak SECRET_KEY must be rejected in production, gated on the parsed
    app_env field (so a value set only in .env is still caught)."""

    def _prod_kwargs(self, **over):
        base = dict(
            app_env="production",
            database_url="postgresql://u:p@db.example.com/yozuv",
            bot_token="123456:ABCDEF",
            cors_origins="https://app.example.com",
            public_api_url="https://api.example.com",
            webhook_secret="x" * 16,
            secret_key="x" * 40,
        )
        base.update(over)
        return base

    def test_weak_secret_rejected_in_production(self):
        from app.config import Settings

        with pytest.raises(Exception) as exc:
            Settings(**self._prod_kwargs(secret_key="change_me"))
        assert "SECRET_KEY" in str(exc.value)

    def test_strong_secret_accepted_in_production(self):
        from app.config import Settings

        s = Settings(**self._prod_kwargs())
        assert s.app_env == "production"

    def test_weak_secret_ok_in_development(self):
        from app.config import Settings

        s = Settings(app_env="development", database_url="sqlite://", secret_key="change_me")
        assert s.secret_key == "change_me"
