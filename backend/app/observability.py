"""Sentry integration.

Initialise once at process start in both the API (`app.main`) and the
Celery worker (`app.celery_app`). Idempotent: subsequent calls are a
no-op so reload-safe.

Configuration (all read from settings/env):
    SENTRY_DSN                 — required to enable. Empty string = disabled.
    APP_ENV                    — used as `environment` tag.
    SENTRY_ENVIRONMENT         — overrides APP_ENV when set.
    SENTRY_TRACES_SAMPLE_RATE  — float 0..1 for performance sampling.
"""

from __future__ import annotations

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)

_initialised = False


def init_sentry(component: str = "api") -> None:
    """Initialise Sentry. Safe to call multiple times.

    `component` is added as a tag so we can split issues by API vs.
    Celery worker vs. the bot's polling entrypoint.
    """
    global _initialised
    if _initialised:
        return

    settings = get_settings()
    if not settings.sentry_dsn:
        # Avoid noisy log on every dev startup; keep at debug.
        logger.debug("SENTRY_DSN not set — error tracking disabled")
        _initialised = True
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    except ImportError:
        logger.warning("sentry-sdk not installed; skipping Sentry init")
        _initialised = True
        return

    environment = (
        settings.sentry_environment.strip()
        or (settings.app_env or "development").lower()
    )

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=environment,
        traces_sample_rate=float(settings.sentry_traces_sample_rate or 0.0),
        # Don't ship request bodies / cookies / sessions to Sentry — bookings
        # carry phone numbers, payments carry receipts. The default sends
        # default PII off; we keep it explicit.
        send_default_pii=False,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            CeleryIntegration(),
            SqlalchemyIntegration(),
        ],
    )
    sentry_sdk.set_tag("component", component)
    logger.info("Sentry initialised (env=%s, component=%s)", environment, component)
    _initialised = True
