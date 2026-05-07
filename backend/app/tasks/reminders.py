from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.celery_app import celery_app

# Minutes before booking to send reminder (inclusive range)
REMINDER_WINDOW_MIN = 59.0
REMINDER_WINDOW_MAX = 61.0
from app.database import SessionLocal
from app.models import Booking, BookingStatus, Business, Client, Service, Subscription, SubscriptionPlan, SubscriptionStatus
from app.services.notification_service import send_telegram_message
from app.utils.htmlsafe import h
from bot.locales import t


def _session() -> Session:
    return SessionLocal()


TZ = ZoneInfo("Asia/Tashkent")


@celery_app.task(name="app.tasks.reminders.send_hourly_reminders")
def send_hourly_reminders() -> None:
    db = _session()
    try:
        # Booking date+time are stored as the owner's local Tashkent time, so
        # the "now" we compare against has to be local too. Using utcnow()
        # made the reminder fire ~5 hours late.
        now_local = datetime.now(TZ).replace(tzinfo=None)

        bookings = (
            db.query(Booking)
            .filter(
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
                Booking.date >= now_local.date(),
                Booking.reminder_sent_at.is_(None),
            )
            .all()
        )
        for b in bookings:
            bt = datetime.combine(b.date, b.start_time)
            minutes_until = (bt - now_local).total_seconds() / 60.0
            if not (REMINDER_WINDOW_MIN <= minutes_until <= REMINDER_WINDOW_MAX):
                continue
            client = db.query(Client).filter(Client.id == b.client_id).first()
            business = db.query(Business).filter(Business.id == b.business_id).first()
            service = db.query(Service).filter(Service.id == b.service_id).first()
            if client and business:
                lang = str(business.language)
                text = t(lang, "reminder").format(
                    service=h(service.name) if service else "",
                    business=h(business.name),
                )
                send_telegram_message(int(client.telegram_id), text)
            # Mark sent even when client/business is missing — otherwise the
            # broken row would re-enter the window every minute forever.
            b.reminder_sent_at = datetime.now(TZ)
            db.commit()
    finally:
        db.close()


@celery_app.task(name="app.tasks.reminders.trial_expiry_warnings")
def trial_expiry_warnings() -> None:
    db = _session()
    try:
        # Use local-Tashkent "tomorrow" so a UTC midnight cron doesn't
        # silently look at the wrong calendar day.
        tomorrow = (datetime.now(TZ).date()) + timedelta(days=1)
        subs = (
            db.query(Subscription)
            .filter(
                Subscription.plan == SubscriptionPlan.TRIAL,
                Subscription.status == SubscriptionStatus.ACTIVE,
            )
            .all()
        )
        for s in subs:
            expires_local = s.expires_at
            if expires_local.tzinfo is not None:
                expires_local = expires_local.astimezone(TZ)
            if expires_local.date() != tomorrow:
                continue
            business = db.query(Business).filter(Business.id == s.business_id).first()
            if not business:
                continue
            from app.models import User

            owner = db.query(User).filter(User.id == business.owner_id).first()
            if owner:
                send_telegram_message(
                    int(owner.telegram_id),
                    "⚠️ Trial tugashiga 1 kun qoldi. Obunani yangilang.",
                )
    finally:
        db.close()
