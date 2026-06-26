"""Staff-aware availability: one master's booking only blocks that master."""
import uuid
from datetime import date, time

from app.models import Booking, BookingStatus, Client, Schedule, Service, Staff
from app.utils.slots import get_available_slots

# A Tuesday well in the future (weekday() == 1).
D = date(2026, 7, 7)


def _setup(db, biz):
    db.add(
        Schedule(
            id=uuid.uuid4(),
            business_id=biz.id,
            day_of_week=D.weekday(),
            is_working=True,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
    )
    svc = Service(id=uuid.uuid4(), business_id=biz.id, name="Soch", price=1, duration_minutes=30)
    a = Staff(id=uuid.uuid4(), business_id=biz.id, name="Usta A", is_active=True)
    b = Staff(id=uuid.uuid4(), business_id=biz.id, name="Usta B", is_active=True)
    c = Client(id=uuid.uuid4(), telegram_id="800100100", first_name="X")
    db.add_all([svc, a, b, c])
    db.flush()
    db.add(
        Booking(
            id=uuid.uuid4(),
            business_id=biz.id,
            service_id=svc.id,
            client_id=c.id,
            staff_id=a.id,
            date=D,
            start_time=time(10, 0),
            end_time=time(10, 30),
            status=BookingStatus.CONFIRMED,
        )
    )
    db.flush()
    return svc, a, b


def test_staff_aware_slots(db, business_with_sub):
    biz = business_with_sub
    svc, a, b = _setup(db, biz)

    free_a = get_available_slots(biz.id, D, 30, db, staff_id=a.id)
    free_b = get_available_slots(biz.id, D, 30, db, staff_id=b.id)
    per_biz = get_available_slots(biz.id, D, 30, db)  # legacy: no staff

    assert time(10, 0) not in free_a  # A is busy at 10:00
    assert time(10, 0) in free_b      # B is free at 10:00 (parallel)
    assert time(10, 0) not in per_biz  # per-business view still blocks it
