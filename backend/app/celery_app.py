from celery import Celery
from celery.schedules import crontab

from app.config import get_settings
from app.observability import init_sentry

# Celery worker is a separate process from the FastAPI app, so it needs
# its own init. Tagged with component=worker so issues split cleanly.
init_sentry(component="worker")

settings = get_settings()

celery_app = Celery("yozuv", broker=settings.redis_url, backend=settings.redis_url)

celery_app.conf.timezone = "Asia/Tashkent"
celery_app.conf.beat_schedule = {
    "reminders-every-minute": {
        "task": "app.tasks.reminders.send_hourly_reminders",
        "schedule": crontab(minute="*"),
    },
    "trial-expiry-daily": {
        "task": "app.tasks.reminders.trial_expiry_warnings",
        "schedule": crontab(hour=9, minute=0),
    },
    # 02:30 Tashkent — quiet window. No-op when BACKUP_S3_BUCKET blank.
    "s3-backup-nightly": {
        "task": "app.tasks.backup.snapshot_to_s3",
        "schedule": crontab(hour=2, minute=30),
    },
    # 03:00 Tashkent — quiet hour, runs after even late-evening bookings.
    "flag-no-shows-nightly": {
        "task": "app.tasks.reminders.flag_no_shows",
        "schedule": crontab(hour=3, minute=0),
    },
}

celery_app.autodiscover_tasks(["app.tasks"])
import app.tasks.reminders  # noqa: E402,F401
import app.tasks.backup  # noqa: E402,F401
