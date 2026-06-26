"""booking_service.reschedule_booking — move a booking, keep the row."""
import uuid
from datetime import date, time

import pytest

from app.models import Booking, BookingStatus, Client, Service
from app.services.booking_service import reschedule_booking


def _svc(db, biz):
    s = Service(id=uuid.uuid4(), business_id=biz.id, name="Soch", price=50000, duration_minutes=30)
    db.add(s)
    db.flush()
    return s


def _booking(db, biz, svc, client, d, t):
    b = Booking(
        id=uuid.uuid4(),
        business_id=biz.id,
        service_id=svc.id,
        client_id=client.id,
        date=d,
        start_time=t,
        end_time=time(t.hour, t.minute + 30) if t.minute == 0 else t,
        status=BookingStatus.CONFIRMED,
    )
    db.add(b)
    db.flush()
    return b


def test_reschedule_moves_same_row(db, business_with_sub):
    biz = business_with_sub
    svc = _svc(db, biz)
    c = Client(id=uuid.uuid4(), telegram_id="700100100", first_name="Olim")
    db.add(c)
    db.flush()
    b = _booking(db, biz, svc, c, date(2026, 7, 1), time(10, 0))

    out = reschedule_booking(
        db, b.id, date(2026, 7, 2), time(14, 0), business_id=biz.id,
        client_telegram_id=700100100,
    )
    assert out.id == b.id  # same row preserved
    assert out.date == date(2026, 7, 2)
    assert out.start_time == time(14, 0)
    assert out.end_time == time(14, 30)


def test_reschedule_conflict_raises(db, business_with_sub):
    biz = business_with_sub
    svc = _svc(db, biz)
    c = Client(id=uuid.uuid4(), telegram_id="700100101", first_name="A")
    db.add(c)
    db.flush()
    keep = _booking(db, biz, svc, c, date(2026, 7, 3), time(9, 0))
    move = _booking(db, biz, svc, c, date(2026, 7, 3), time(11, 0))
    # Move 'move' onto 'keep' (09:00) → overlap → ValueError.
    with pytest.raises(ValueError):
        reschedule_booking(db, move.id, date(2026, 7, 3), time(9, 0), business_id=biz.id)


def test_reschedule_wrong_client_raises(db, business_with_sub):
    biz = business_with_sub
    svc = _svc(db, biz)
    c = Client(id=uuid.uuid4(), telegram_id="700100102", first_name="B")
    db.add(c)
    db.flush()
    b = _booking(db, biz, svc, c, date(2026, 7, 4), time(10, 0))
    with pytest.raises(ValueError):
        reschedule_booking(db, b.id, date(2026, 7, 5), time(10, 0), client_telegram_id=999999)
