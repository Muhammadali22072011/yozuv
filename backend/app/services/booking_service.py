import hashlib
from datetime import date as _date, datetime, time as _time, timedelta
from uuid import UUID

from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingStatus,
    Business,
    Client,
    PaymentStatus,
    PromoCode,
    Service,
    Subscription,
    SubscriptionStatus,
)
from app.models.enums import ConfirmationMode
from app.schemas.booking import BookingCreatePublic


def _slot_lock_key_for(business_id: UUID, slot_date: _date, slot_start: _time) -> int:
    raw = f"{business_id}:{slot_date.isoformat()}:{slot_start.isoformat()}".encode()
    return int(hashlib.md5(raw).hexdigest()[:8], 16) & 0x7FFFFFFF


def acquire_slot_lock(
    db: Session, business_id: UUID, slot_date: _date, slot_start: _time
) -> None:
    """Take a transaction-scoped advisory lock so concurrent writes serialize on the same slot.

    SELECT FOR UPDATE only locks rows that already exist; for an empty
    slot there is nothing to lock, which lets two writers pass the
    conflict check at the same time and both insert. The advisory lock
    serializes them on (business_id, date, start_time) until the
    transaction commits. No-op outside Postgres so the SQLite test DB
    still works.
    """
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": _slot_lock_key_for(business_id, slot_date, slot_start)},
    )


def _acquire_slot_lock(db: Session, business_id: UUID, payload: BookingCreatePublic) -> None:
    """Backwards-compatible wrapper for the public-flow service callers."""
    acquire_slot_lock(db, business_id, payload.date, payload.start_time)


def get_or_create_client(db: Session, data: BookingCreatePublic) -> Client:
    c = db.query(Client).filter(Client.telegram_id == data.client_telegram_id).first()
    if c:
        if data.client_first_name:
            c.first_name = data.client_first_name
        if data.client_last_name:
            c.last_name = data.client_last_name
        if data.client_phone:
            c.phone = data.client_phone
        return c
    c = Client(
        telegram_id=data.client_telegram_id,
        first_name=data.client_first_name or "",
        last_name=data.client_last_name or "",
        phone=data.client_phone or "",
    )
    db.add(c)
    db.flush()
    return c


def _check_active_subscription(db: Session, business_id: UUID) -> None:
    """Raise ValueError if business has no active subscription."""
    from datetime import timezone
    now = datetime.now(timezone.utc)
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.business_id == business_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
        )
        .first()
    )
    if not sub:
        raise ValueError("Business subscription has expired")


def _check_slot_available(db: Session, business_id: UUID, payload: BookingCreatePublic, end_time) -> None:
    """Check that the requested slot is free — uses SELECT FOR UPDATE to prevent races."""
    conflict = (
        db.query(Booking)
        .filter(
            Booking.business_id == business_id,
            Booking.date == payload.date,
            Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            Booking.start_time < end_time,
            Booking.end_time > payload.start_time,
        )
        .with_for_update()
        .first()
    )
    if conflict:
        raise ValueError("Requested time slot is no longer available")


def create_booking(db: Session, payload: BookingCreatePublic) -> Booking:
    business = db.query(Business).filter(Business.id == payload.business_id).first()
    if not business:
        raise ValueError("Business not found")
    service = (
        db.query(Service)
        .filter(Service.id == payload.service_id, Service.business_id == business.id, Service.is_active.is_(True))
        .first()
    )
    if not service:
        raise ValueError("Service not found")

    _check_active_subscription(db, business.id)

    _acquire_slot_lock(db, business.id, payload)

    start_dt = datetime.combine(payload.date, payload.start_time)
    end_dt = start_dt + timedelta(minutes=service.duration_minutes)

    # If this client already has a booking at the exact same slot, return it
    # (idempotent: double-clicks / retries don't show misleading "slot taken").
    existing_client = (
        db.query(Client).filter(Client.telegram_id == payload.client_telegram_id).first()
    )
    if existing_client:
        own_existing = (
            db.query(Booking)
            .filter(
                Booking.business_id == business.id,
                Booking.client_id == existing_client.id,
                Booking.date == payload.date,
                Booking.start_time == payload.start_time,
                Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
            )
            .first()
        )
        if own_existing:
            return own_existing

    _check_slot_available(db, business.id, payload, end_dt.time())

    client = get_or_create_client(db, payload)

    try:
        mode = (
            business.confirmation_mode
            if isinstance(business.confirmation_mode, ConfirmationMode)
            else ConfirmationMode(str(business.confirmation_mode))
        )
    except ValueError:
        mode = ConfirmationMode.AUTO

    if mode == ConfirmationMode.AUTO:
        status = BookingStatus.CONFIRMED
    else:
        status = BookingStatus.PENDING

    final_price, promo = _apply_promo(db, business.id, payload.promo_code, service.price)

    # Loyalty stamp card: every Nth completed visit of this service for
    # this client is free. We compute against COMPLETED bookings only —
    # PENDING/CONFIRMED don't count yet (the visit hasn't happened) and
    # CANCELLED/NO_SHOW shouldn't either. The "+ 1" is for the booking
    # we're about to create: if it itself becomes the Nth completed
    # visit, we discount it now instead of after-the-fact.
    final_price = _maybe_apply_loyalty(
        db, service, client.id, base_price=final_price
    )

    booking = Booking(
        business_id=business.id,
        service_id=service.id,
        client_id=client.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=end_dt.time(),
        status=status,
        payment_status=PaymentStatus.UNPAID,
        payment_amount=final_price,
    )
    db.add(booking)
    db.flush()
    if promo is not None:
        promo.uses_count = (promo.uses_count or 0) + 1
    return booking


def _maybe_apply_loyalty(
    db: Session, service: Service, client_id, base_price: int
) -> int:
    """Apply 100% discount when the booking we're about to create lands
    on a stamp boundary (every Nth completed visit). Returns the
    possibly-discounted price."""
    n = int(getattr(service, "loyalty_after_visits", 0) or 0)
    if n <= 0:
        return base_price
    completed = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.service_id == service.id,
            Booking.client_id == client_id,
            Booking.status == BookingStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    # Visit number we are about to create (1-based). If it's a multiple
    # of N, this is a free stamp.
    next_visit = int(completed) + 1
    if next_visit % n == 0:
        return 0
    return base_price


def loyalty_progress(
    db: Session, service: Service, client_id
) -> tuple[int, int] | None:
    """(stamps_collected, stamps_required) for a (service, client) pair,
    or None when loyalty is disabled. Used by the bot UI to render the
    "3 / 5 ⭐" hint."""
    n = int(getattr(service, "loyalty_after_visits", 0) or 0)
    if n <= 0:
        return None
    completed = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.service_id == service.id,
            Booking.client_id == client_id,
            Booking.status == BookingStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    return int(completed) % n, n


def _apply_promo(db: Session, business_id: UUID, raw_code: str, base_price: int) -> tuple[int, PromoCode | None]:
    """Returns (final_price, promo_or_None). Silently ignores invalid codes."""
    code = (raw_code or "").strip().upper()
    if not code:
        return base_price, None
    p = (
        db.query(PromoCode)
        .filter(
            PromoCode.business_id == business_id,
            PromoCode.code == code,
            PromoCode.is_active.is_(True),
        )
        .with_for_update()
        .first()
    )
    if not p:
        return base_price, None
    if p.max_uses and (p.uses_count or 0) >= p.max_uses:
        return base_price, None
    discount = (base_price * (p.discount_percent or 0) // 100) + (p.discount_amount or 0)
    return max(0, base_price - discount), p


def validate_promo_for_business(db: Session, business_id: UUID, raw_code: str, base_price: int) -> dict | None:
    """Read-only validation for the bot/UI. Returns dict with discount info or None if invalid."""
    code = (raw_code or "").strip().upper()
    if not code:
        return None
    p = (
        db.query(PromoCode)
        .filter(
            PromoCode.business_id == business_id,
            PromoCode.code == code,
            PromoCode.is_active.is_(True),
        )
        .first()
    )
    if not p:
        return None
    if p.max_uses and (p.uses_count or 0) >= p.max_uses:
        return None
    discount = (base_price * (p.discount_percent or 0) // 100) + (p.discount_amount or 0)
    return {
        "code": p.code,
        "discount_percent": int(p.discount_percent or 0),
        "discount_amount": int(p.discount_amount or 0),
        "final_price": max(0, base_price - discount),
    }


def cancel_booking(db: Session, booking_id: UUID, business_id: UUID, reason: str = "") -> Booking | None:
    b = (
        db.query(Booking)
        .filter(Booking.id == booking_id, Booking.business_id == business_id)
        .first()
    )
    if not b:
        return None
    b.status = BookingStatus.CANCELLED
    b.cancel_reason = reason
    return b


def confirm_booking(db: Session, booking_id: UUID, business_id: UUID) -> Booking | None:
    b = (
        db.query(Booking)
        .filter(Booking.id == booking_id, Booking.business_id == business_id)
        .first()
    )
    if not b:
        return None
    b.status = BookingStatus.CONFIRMED
    return b
