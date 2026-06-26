"""Scheduled broadcast delivery.

An admin can queue a broadcast for a future time via
POST /admin/broadcast/schedule, which writes a BroadcastMessage row with
status="scheduled" and a scheduled_at. This beat task (every minute)
picks up due rows, fans the message out to the stored recipient filter,
records the result, and flips the row to status="sent".
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import BroadcastMessage
from app.services.notification_service import send_telegram_message


def _session() -> Session:
    return SessionLocal()


@celery_app.task(name="app.tasks.broadcasts.send_scheduled_broadcasts")
def send_scheduled_broadcasts() -> None:
    # Imported here (not at module load) to avoid a router<->task import
    # cycle at startup.
    from app.routers.admin import recipients_from_filter_dict

    db = _session()
    try:
        now = datetime.now(timezone.utc)
        due = (
            db.query(BroadcastMessage)
            .filter(
                BroadcastMessage.status == "scheduled",
                BroadcastMessage.scheduled_at.isnot(None),
                BroadcastMessage.scheduled_at <= now,
            )
            .all()
        )
        for msg in due:
            rows = recipients_from_filter_dict(db, msg.filters or {})
            sent = 0
            failed = 0
            failed_ids: list[int] = []
            for _b, owner in rows:
                if not owner or not owner.telegram_id:
                    failed += 1
                    continue
                try:
                    send_telegram_message(int(owner.telegram_id), msg.text)
                    sent += 1
                except Exception:
                    failed += 1
                    failed_ids.append(int(owner.telegram_id))
            msg.sent_count = sent
            msg.failed_count = failed
            msg.failed_recipients = failed_ids
            msg.status = "sent"
            db.commit()
    finally:
        db.close()
