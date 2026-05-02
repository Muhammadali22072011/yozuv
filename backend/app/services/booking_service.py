import hashlib
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Business, Client, PaymentStatus, Service, Subscription, SubscriptionStatus
from app.models.enums import ConfirmationMode
from app.schemas.booking import BookingCreatePublic


def _slot_lock_key(business_id: UUID, payload: BookingCreatePublic) -> int:
    raw = f"{business_id}:{payload.date.isoformat()}:{payload.start_time.isoformat()}".encode()
    return int(hashlib.md5(raw).hexdigest()[:8], 16) & 0x7FFFFFFF


def _acquire_slot_lock(db: Session, business_id: UUID, payload: BookingCreatePublic) -> None:
    """Take a transaction-scoped advisory lock so concurrent bookers serialize on the same slot.

    SELECT FOR UPDATE only locks existing rows; for an empty slot there is nothing to lock,
    which lets two clients pass the conflict check at the same time. The advisory lock
    serializes them on (business_id, date, start_time) until the transaction commits.
    """
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": _slot_lock_key(business_id, payload)},
    )


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

    booking = Booking(
        business_id=business.id,
        service_id=service.id,
        client_id=client.id,
        date=payload.date,
        start_time=payload.start_time,
        end_time=end_dt.time(),
        status=status,
        payment_status=PaymentStatus.UNPAID,
        payment_amount=service.price,
    )
    db.add(booking)
    db.flush()
    return booking


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
