import secrets
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_DEFAULTS = {"change_me", "secret", "changeme", "your_secret_key"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"

    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    secret_key: str = "change_me"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    bot_token: str = ""
    webhook_url: str = ""
    # Shared secret sent in X-Telegram-Bot-Api-Secret-Token. Random per-process
    # default keeps dev safe; production deployments must set WEBHOOK_SECRET so
    # restarts don't invalidate the registered webhook.
    webhook_secret: str = secrets.token_hex(16)

    paytech_license_api_key: str = ""

    payme_merchant_id: str = ""
    payme_secret_key: str = ""
    click_service_id: str = ""
    click_merchant_id: str = ""
    click_merchant_user_id: str = ""
    click_secret_key: str = ""

    public_app_url: str = "http://localhost:3000"
    cors_origins: str = "http://localhost:3000"

    next_public_bot_username: str = "Yozuv_cl_bot"

    admin_telegram_ids: str = ""
    uploads_dir: str = "/tmp/yozuv_uploads"
    public_api_url: str = "http://localhost:8000"

    # Google OAuth (Sign in with Google). Blank = Google login disabled.
    # Redirect URI to register in Google Cloud console:
    #   {public_api_url}/api/auth/google/callback
    google_client_id: str = ""
    google_client_secret: str = ""

    # Sentry — optional in dev, recommended in prod. Empty DSN disables init.
    sentry_dsn: str = ""
    sentry_traces_sample_rate: float = 0.0  # set to e.g. 0.1 for 10% perf samples
    sentry_environment: str = ""  # falls back to app_env when blank

    # Daily DB backup -> S3-compatible bucket. Leave bucket blank to
    # disable. Works with AWS S3, Backblaze B2 (set endpoint_url),
    # Cloudflare R2 (set endpoint_url), MinIO, etc.
    backup_s3_bucket: str = ""
    backup_s3_prefix: str = "yozuv/backups/"
    backup_s3_endpoint_url: str = ""  # blank = AWS S3 default
    backup_s3_region: str = "us-east-1"
    backup_s3_access_key_id: str = ""
    backup_s3_secret_access_key: str = ""
    # How many days of nightly snapshots to keep. Older objects are
    # pruned by the same task that writes the new snapshot.
    backup_s3_retention_days: int = 30

    @model_validator(mode="after")
    def validate_production(self):
        if (self.app_env or "").lower() != "production":
            return self
        errors: list[str] = []
        # Secret-key strength MUST be gated on the parsed app_env field (which
        # honours .env), not os.getenv("APP_ENV") — otherwise a deployment that
        # sets APP_ENV only in .env would silently skip the check and ship a
        # forgeable JWT signing key.
        if self.secret_key.lower() in _INSECURE_DEFAULTS or len(self.secret_key) < 32:
            errors.append(
                "SECRET_KEY must be a strong random value (>=32 chars) in production "
                "(generate: python -c \"import secrets; print(secrets.token_hex(32))\")"
            )
        if not self.bot_token or ":" not in self.bot_token:
            errors.append("BOT_TOKEN is missing or malformed")
        if not self.database_url or "localhost" in self.database_url:
            errors.append("DATABASE_URL is missing or points to localhost")
        cors = self.cors_origins or ""
        if not cors.strip() or "localhost" in cors:
            errors.append("CORS_ORIGINS is missing or contains localhost")
        if not self.public_api_url or "localhost" in self.public_api_url:
            errors.append("PUBLIC_API_URL is missing or points to localhost")
        if not self.webhook_secret or len(self.webhook_secret) < 16:
            errors.append("WEBHOOK_SECRET must be set (>=16 chars) in production")
        if errors:
            raise ValueError(
                "Production config errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
