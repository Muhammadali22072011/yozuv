"""In-process periodic job runner.

The product's 1-hour reminders, birthday greetings, no-show flagging,
re-engagement nudges and scheduled broadcasts are defined as Celery
tasks (``app/tasks/*``) and wired into a Celery beat schedule. Running
them, however, requires a separate Celery worker+beat process — which a
single-service deploy (one web dyno, bot in webhook mode) does not have.
Without that worker none of those jobs ever fire and the reminders the
UI promises silently never arrive.

This module mirrors the beat schedule inside the FastAPI process: a
lightweight asyncio loop that, every minute (Asia/Tashkent), runs the
per-minute jobs and, at the configured wall-clock times, the daily ones.
Each job is the very same callable Celery would run; we just invoke it
directly in a worker thread (the task bodies are synchronous and open
their own DB session, and the Telegram sender talks to the HTTP API
directly, so no Celery/Redis is involved).

Guarded by ``settings.inprocess_scheduler`` so a deploy that DOES run a
dedicated worker can turn this off and avoid double-sends.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

logger = logging.getLogger("app.scheduler")

TZ = ZoneInfo("Asia/Tashkent")


async def _safe_run(fn, name: str) -> None:
    """Run a sync job in a worker thread; never let one failure kill the loop."""
    try:
        await asyncio.to_thread(fn)
    except Exception:
        logger.exception("scheduled job %s failed", name)


async def run_scheduler(stop: asyncio.Event) -> None:
    # Imported lazily so the task modules (and their bot/db imports) only
    # load when the scheduler is actually enabled.
    from app.tasks.broadcasts import send_scheduled_broadcasts
    from app.tasks.reminders import (
        flag_no_shows,
        send_birthday_greetings,
        send_hourly_reminders,
        send_reengagement_nudges,
        subscription_expiry_warnings,
    )

    # (hour, minute, name, callable) — mirrors celery_app.beat_schedule.
    # The S3 backup job is intentionally omitted: it's heavy and
    # storage-only, not a customer-facing promise.
    daily_jobs = [
        (3, 0, "flag_no_shows", flag_no_shows),
        (9, 0, "subscription_expiry_warnings", subscription_expiry_warnings),
        (9, 30, "send_birthday_greetings", send_birthday_greetings),
        (10, 0, "send_reengagement_nudges", send_reengagement_nudges),
    ]

    last_minute: str | None = None
    last_daily: dict[str, str] = {}
    logger.info("in-process scheduler started (tz=%s)", TZ.key)

    while not stop.is_set():
        now = datetime.now(TZ)
        minute_key = now.strftime("%Y-%m-%d %H:%M")
        if minute_key != last_minute:
            last_minute = minute_key
            # Per-minute jobs (idempotent: reminders dedup via
            # reminder_sent_at, broadcasts via status flip).
            await _safe_run(send_hourly_reminders, "send_hourly_reminders")
            await _safe_run(send_scheduled_broadcasts, "send_scheduled_broadcasts")
            # Daily jobs — fire once when the clock first hits their minute.
            today = now.strftime("%Y-%m-%d")
            for hh, mm, name, fn in daily_jobs:
                if now.hour == hh and now.minute == mm and last_daily.get(name) != today:
                    last_daily[name] = today
                    await _safe_run(fn, name)
        # Wake roughly every 20s so a minute boundary is never missed and
        # shutdown stays responsive.
        try:
            await asyncio.wait_for(stop.wait(), timeout=20)
        except asyncio.TimeoutError:
            pass

    logger.info("in-process scheduler stopped")
