"""Waitlist write paths.

Two operations:

* ``join`` — when a client tries a slot and learns it's full, the bot
  flow can call this with their telegram_id to register interest.
  Idempotent thanks to the (business, service, date, start_time,
  client) unique constraint.

* ``notify_first_for_slot`` — call this right after a booking is
  cancelled so we can pull the head of the queue for that exact slot
  and message them. ``notified_at`` is set so the same entry isn't
  pinged twice for two consecutive cancellations of the same slot.
"""

from __future__ import annotations

from datetime import date as _date, datetime, time as _time, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Business, Client, Service, WaitlistEntry


def join(
    db: Session,
    *,
    business_id: UUID,
    service_id: UUID,
    slot_date: _date,
    slot_start: _time,
    client_telegram_id: int,
    client_first_name: str = "",
    client_last_name: str = "",
    client_phone: str = "",
) -> WaitlistEntry:
    """Add the client to the waitlist for this exact slot. Returns the
    existing entry if one is already there (the unique constraint makes
    this strictly idempotent)."""
    # Resolve / create the client row up front — same pattern as the
    # booking path, but without the bookings-side rules. We don't
    # update name/phone if there's already a row, to keep this routine
    # side-effect-light.
    client = (
        db.query(Client).filter(Client.telegram_id == client_telegram_id).first()
    )
    if client is None:
        client = Client(
            telegram_id=client_telegram_id,
            first_name=client_first_name or "",
            last_name=client_last_name or "",
            phone=client_phone or "",
        )
        db.add(client)
        db.flush()

    existing = (
        db.query(WaitlistEntry)
        .filter(
            WaitlistEntry.business_id == business_id,
            WaitlistEntry.service_id == service_id,
            WaitlistEntry.date == slot_date,
            WaitlistEntry.start_time == slot_start,
            WaitlistEntry.client_id == client.id,
        )
        .first()
    )
    if existing is not None:
        return existing

    entry = WaitlistEntry(
        business_id=business_id,
        service_id=service_id,
        client_id=client.id,
        date=slot_date,
        start_time=slot_start,
    )
    db.add(entry)
    db.flush()
    return entry


def notify_first_for_slot(
    db: Session,
    *,
    business_id: UUID,
    service_id: UUID | None,
    slot_date: _date,
    slot_start: _time,
) -> tuple[WaitlistEntry, Client, Business, Service] | None:
    """Pick the oldest non-notified entry for this slot, mark notified
    and return it. Caller is responsible for actually sending the
    Telegram message — keeping that out of here lets the unit tests
    run without any HTTP."""
    q = (
        db.query(WaitlistEntry)
        .filter(
            WaitlistEntry.business_id == business_id,
            WaitlistEntry.date == slot_date,
            WaitlistEntry.start_time == slot_start,
            WaitlistEntry.notified_at.is_(None),
        )
    )
    if service_id is not None:
        q = q.filter(WaitlistEntry.service_id == service_id)
    entry = q.order_by(WaitlistEntry.created_at.asc()).first()
    if entry is None:
        return None

    client = db.query(Client).filter(Client.id == entry.client_id).first()
    business = db.query(Business).filter(Business.id == entry.business_id).first()
    service = db.query(Service).filter(Service.id == entry.service_id).first()
    if client is None or business is None or service is None:
        # Stale row — skip rather than crash. Mark it so we don't
        # re-pick it next time.
        entry.notified_at = datetime.now(timezone.utc)
        return None

    entry.notified_at = datetime.now(timezone.utc)
    return entry, client, business, service
