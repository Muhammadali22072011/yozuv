"""Tests for config validation — secret_key enforcement in production."""
import os

import pytest


class TestSecretKeyValidation:
    def test_weak_key_rejected_in_production(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        monkeypatch.setenv("SECRET_KEY", "change_me")
        monkeypatch.setenv("CORS_ORIGINS", "https://example.com")

        # Clear lru_cache so Settings are re-evaluated
        from app.config import get_settings
        get_settings.cache_clear()

        from pydantic import ValidationError
        with pytest.raises((ValidationError, ValueError)):
            from app.config import Settings
            Settings()

        get_settings.cache_clear()

    def test_strong_key_accepted_in_production(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "production")
        strong_key = "a" * 32
        monkeypatch.setenv("SECRET_KEY", strong_key)
        # Provide every other production-required setting so this test asserts
        # the key check alone and doesn't depend on the ambient environment.
        monkeypatch.setenv("CORS_ORIGINS", "https://example.com")
        monkeypatch.setenv("BOT_TOKEN", "123456:test-token")
        monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@db.internal/app")
        monkeypatch.setenv("PUBLIC_API_URL", "https://api.example.com")
        monkeypatch.setenv("WEBHOOK_SECRET", "w" * 16)

        from app.config import get_settings
        get_settings.cache_clear()

        from app.config import Settings
        s = Settings()
        assert s.secret_key == strong_key

        get_settings.cache_clear()

    def test_weak_key_allowed_in_development(self, monkeypatch):
        monkeypatch.setenv("APP_ENV", "development")
        monkeypatch.setenv("SECRET_KEY", "change_me")

        from app.config import get_settings
        get_settings.cache_clear()

        from app.config import Settings
        s = Settings()
        assert s.secret_key == "change_me"

        get_settings.cache_clear()
