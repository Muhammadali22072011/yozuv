from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.celery_app import celery_app

# Reminder is the "~1 hour before" nudge. We send it on the first beat run
# where the booking is at most this many minutes away and still in the future.
# A wide upper bound + the reminder_sent_at idempotency guard means a missed
# beat run (worker restart, redis hiccup, deploy) is caught on the next run
# instead of silently skipping the reminder forever.
REMINDER_LEAD_MAX = 65.0
from app.database import SessionLocal
from app.models import Booking, BookingStatus, Business, Client, Service, Subscription, SubscriptionPlan, SubscriptionStatus
from app.services.notification_service import send_telegram_message
from app.utils.htmlsafe import h
from bot.locales import t


def _session() -> Session:
    return SessionLocal()


TZ = ZoneInfo("Asia/Tashkent")


def _render_reminder(template: str, *, service: str, business: str) -> str:
    """Fill the {service}/{business} placeholders in a reminder template.

    The owner's custom reminder_text is free text: it may contain neither
    placeholder (a plain message) or a stray ``{`` that isn't a valid
    field. Never crash the whole beat run on one bad template — fall back
    to sending it verbatim if ``str.format`` chokes.
    """
    try:
        return template.format(service=service, business=business)
    except (KeyError, IndexError, ValueError):
        return template


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
            # Skip if the slot is too far out (not yet within the lead window)
            # or already started/past (the no-show task owns those).
            if minutes_until < 0 or minutes_until > REMINDER_LEAD_MAX:
                continue
            client = db.query(Client).filter(Client.id == b.client_id).first()
            business = db.query(Business).filter(Business.id == b.business_id).first()
            service = db.query(Service).filter(Service.id == b.service_id).first()
            if client and business:
                lang = str(business.language)
                # Owner-customised reminder text (Profil → Eslatma matni)
                # wins over the default locale template. It's free text, so
                # escape it for HTML mode before placeholder substitution.
                custom = (business.reminder_text or "").strip()
                template = h(custom) if custom else t(lang, "reminder")
                text = _render_reminder(
                    template,
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


# How long after a booking's end_time we wait before flipping it to
# NO_SHOW. A grace period gives the owner time to mark COMPLETED if
# they're slow with the dashboard. Two hours is generous for typical
# barbershop / salon flows.
NO_SHOW_GRACE_HOURS = 2


@celery_app.task(name="app.tasks.reminders.flag_no_shows")
def flag_no_shows() -> None:
    """Auto-flag past PENDING/CONFIRMED bookings as NO_SHOW.

    Runs nightly. A booking that's still PENDING or CONFIRMED N hours
    after its end_time means the owner never marked it COMPLETED — most
    likely the client didn't turn up.
    """
    db = _session()
    try:
        cutoff_local = (
            datetime.now(TZ).replace(tzinfo=None) - timedelta(hours=NO_SHOW_GRACE_HOURS)
        )
        candidates = (
            db.query(Booking)
            .filter(
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
                Booking.date <= cutoff_local.date(),
            )
            .all()
        )
        flipped = 0
        for b in candidates:
            slot_end = datetime.combine(b.date, b.end_time)
            if slot_end > cutoff_local:
                continue
            b.status = BookingStatus.NO_SHOW
            flipped += 1
        if flipped:
            db.commit()
    finally:
        db.close()


# How long since the last completed visit before we treat a client as
# "we've lost them". 30..60 days — earlier feels pushy, later desperate.
REENGAGE_AFTER_DAYS = 30
REENGAGE_BEFORE_DAYS = 60

# Don't send any retention message more often than this — two weeks so
# birthday + re-engagement don't stack into spam.
OUTREACH_COOLDOWN_DAYS = 14


def _under_cooldown(client: Client, now_utc: datetime) -> bool:
    last = client.last_outreach_at
    if last is None:
        return False
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return now_utc - last < timedelta(days=OUTREACH_COOLDOWN_DAYS)


@celery_app.task(name="app.tasks.reminders.send_birthday_greetings")
def send_birthday_greetings() -> None:
    db = _session()
    try:
        today_local = datetime.now(TZ).date()
        now_utc = datetime.now(timezone.utc)
        candidates = (
            db.query(Client)
            .filter(
                Client.birthday.is_not(None),
                func.extract("month", Client.birthday) == today_local.month,
                func.extract("day", Client.birthday) == today_local.day,
            )
            .all()
        )
        for client in candidates:
            if _under_cooldown(client, now_utc):
                continue
            last_biz_id = (
                db.query(Booking.business_id)
                .filter(Booking.client_id == client.id)
                .order_by(Booking.date.desc(), Booking.start_time.desc())
                .limit(1)
                .scalar()
            )
            if not last_biz_id:
                continue
            biz = db.query(Business).filter(Business.id == last_biz_id).first()
            if not biz:
                continue
            name = (client.first_name or "").strip() or "Aziz mijoz"
            send_telegram_message(
                int(client.telegram_id),
                f"🎂 Tug'ilgan kuningiz bilan, <b>{name}</b>!\n"
                f"<b>{biz.name}</b> sizni har doim kutadi.",
            )
            client.last_outreach_at = now_utc
        db.commit()
    finally:
        db.close()


@celery_app.task(name="app.tasks.reminders.send_reengagement_nudges")
def send_reengagement_nudges() -> None:
    db = _session()
    try:
        today_local = datetime.now(TZ).date()
        now_utc = datetime.now(timezone.utc)
        oldest_last_visit = today_local - timedelta(days=REENGAGE_BEFORE_DAYS)
        newest_last_visit = today_local - timedelta(days=REENGAGE_AFTER_DAYS)

        rows = (
            db.query(
                Booking.client_id,
                func.max(Booking.date).label("last_date"),
            )
            .filter(Booking.status == BookingStatus.COMPLETED)
            .group_by(Booking.client_id)
            .all()
        )
        for client_id, last_date in rows:
            if not client_id or not last_date:
                continue
            if last_date > newest_last_visit:
                continue
            if last_date < oldest_last_visit:
                continue
            client = db.query(Client).filter(Client.id == client_id).first()
            if client is None or _under_cooldown(client, now_utc):
                continue
            last_biz_id = (
                db.query(Booking.business_id)
                .filter(
                    Booking.client_id == client_id,
                    Booking.status == BookingStatus.COMPLETED,
                    Booking.date == last_date,
                )
                .limit(1)
                .scalar()
            )
            if not last_biz_id:
                continue
            biz = db.query(Business).filter(Business.id == last_biz_id).first()
            if not biz:
                continue
            name = (client.first_name or "").strip() or "Aziz mijoz"
            send_telegram_message(
                int(client.telegram_id),
                f"👋 <b>{name}</b>, ancha vaqt bo'ldi!\n"
                f"<b>{biz.name}</b> da yozilishni unutmang.",
            )
            client.last_outreach_at = now_utc
        db.commit()
    finally:
        db.close()


# Days-before/after expiry on which we send a dunning message, mapped to
# copy. Positive = days remaining, 0 = expires today, negative = already
# lapsed. The daily scheduler fires this once per Tashkent calendar day, so
# matching an exact offset sends each stage exactly once. SMS is deliberately
# NOT used here (it costs money in UZ) — bot only; the in-app banner covers
# owners without a Telegram id.
DUNNING_OFFSETS = (7, 3, 1, 0, -3, -7)


def _dunning_message(plan, days_left: int) -> str | None:
    """Warm Uzbek dunning copy for a given plan + day-offset, or None if
    this offset isn't a dunning stage. Pure (no DB/IO) so it unit-tests on
    its own. Tone: never threatening, always 'your data is safe'."""
    plan_val = plan.value if hasattr(plan, "value") else str(plan)
    is_trial = plan_val == SubscriptionPlan.TRIAL.value

    if days_left == 7:
        return (
            "⏳ Bepul sinovingizga 7 kun qoldi. Yoqqan bo'lsa — obunani "
            "rasmiylashtiring, ma'lumotlaringiz saqlanib qoladi."
            if is_trial
            else "⏳ Obunangizga 7 kun qoldi. Uzaytirish: Sozlamalar → Obuna."
        )
    if days_left == 3:
        return (
            "⏳ Sinovga 3 kun qoldi. Bir bosishda obuna bo'ling — hech narsa "
            "avtomatik yechilmaydi."
            if is_trial
            else "⏳ Obunaga 3 kun qoldi. Uzaytirib qo'ying, uzilish bo'lmasin."
        )
    if days_left == 1:
        return (
            "⚠️ Ertaga obunangiz tugaydi. Uzaytirmasangiz yangi yozuvlar "
            "to'xtaydi — lekin ma'lumotlaringiz joyida qoladi."
        )
    if days_left == 0:
        return (
            "⚠️ Obunangiz bugun tugaydi. Yana 3 kun imkoniyat bor, keyin yangi "
            "yozuvlar to'xtaydi. Sozlamalar → Obuna."
        )
    if days_left == -3:
        return (
            "⛔ Obuna tugadi — yangi yozuvlar vaqtincha to'xtatildi. "
            "Ma'lumotlaringiz o'chmadi 🤍 To'lasangiz darrov davom etadi."
        )
    if days_left == -7:
        return (
            "🤍 Sog'indik! Qaytib keling — Sozlamalar → Obuna orqali bir "
            "bosishda tiklang. Hammasi joyida turibdi."
        )
    return None


@celery_app.task(name="app.tasks.reminders.subscription_expiry_warnings")
def subscription_expiry_warnings() -> None:
    """Daily dunning for ALL plans (trial + paid). Manual-renewal billing
    means these nudges ARE the retention mechanism — without them a paying
    owner silently lapses. Sends on a T-7…T+7 cadence via the bot."""
    db = _session()
    try:
        from app.models import User

        # Local-Tashkent "today" so a UTC-midnight run looks at the right
        # calendar day; offsets are computed in whole local days.
        today = datetime.now(TZ).date()
        subs = (
            db.query(Subscription)
            .filter(Subscription.status == SubscriptionStatus.ACTIVE)
            .all()
        )
        for s in subs:
            expires_local = s.expires_at
            if expires_local.tzinfo is not None:
                expires_local = expires_local.astimezone(TZ)
            days_left = (expires_local.date() - today).days
            if days_left not in DUNNING_OFFSETS:
                continue
            msg = _dunning_message(s.plan, days_left)
            if not msg:
                continue
            business = db.query(Business).filter(Business.id == s.business_id).first()
            if not business:
                continue
            owner = db.query(User).filter(User.id == business.owner_id).first()
            if owner and owner.telegram_id:
                try:
                    send_telegram_message(int(owner.telegram_id), msg)
                except Exception:
                    pass
    finally:
        db.close()


@celery_app.task(name="app.tasks.reminders.trial_expiry_warnings")
def trial_expiry_warnings() -> None:
    """Back-compat shim. The old job was trial-only, 1 day before expiry;
    it now delegates to the full dunning cadence so any lingering beat key
    or reference keeps working."""
    subscription_expiry_warnings()
