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
}

celery_app.autodiscover_tasks(["app.tasks"])
import app.tasks.reminders  # noqa: E402,F401
