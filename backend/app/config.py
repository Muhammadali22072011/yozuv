import os
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {"change_me", "secret", "changeme", "your_secret_key"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql://yozuv:yozuv@localhost:5432/yozuv"
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change_me"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        # In production (non-local) environments, reject insecure defaults
        env = os.getenv("APP_ENV", "development").lower()
        if env == "production":
            if v.lower() in _INSECURE_DEFAULTS or len(v) < 32:
                raise ValueError(
                    "SECRET_KEY must be set to a strong random value (>=32 chars) in production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
                )
        return v

    bot_token: str = ""
    webhook_url: str = ""

    paytech_license_api_key: str = ""

    payme_merchant_id: str = ""
    payme_secret_key: str = ""
    click_service_id: str = ""
    click_merchant_id: str = ""
    click_merchant_user_id: str = ""
    click_secret_key: str = ""

    public_app_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    next_public_bot_username: str = "YozuvBot"

    admin_telegram_ids: str = ""
    uploads_dir: str = "/tmp/yozuv_uploads"
    public_api_url: str = "http://localhost:8000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
