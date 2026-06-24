from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, HolidayDate, Schedule
from app.utils.clock import local_today

# Granularity of slot generation (minutes)
SLOT_STEP_MINUTES = 30
# How many days ahead to scan when looking for next working dates
MAX_WORKING_DATE_SCAN = 60


def _combine(d: date, t: time) -> datetime:
    return datetime.combine(d, t)


def get_schedule_for_weekday(db: Session, business_id, weekday: int) -> Schedule | None:
    return (
        db.query(Schedule)
        .filter(Schedule.business_id == business_id, Schedule.day_of_week == weekday)
        .first()
    )


def is_holiday(db: Session, business_id, d: date) -> bool:
    return (
        db.query(HolidayDate)
        .filter(HolidayDate.business_id == business_id, HolidayDate.date == d)
        .first()
        is not None
    )


def get_bookings_for_date(
    db: Session, business_id, d: date, staff_id=None
) -> list[Booking]:
    q = db.query(Booking).filter(
        Booking.business_id == business_id,
        Booking.date == d,
        Booking.status.in_([BookingStatus.PENDING, BookingStatus.CONFIRMED]),
    )
    # When a specific master is requested, only that master's bookings
    # block the slot — matching booking_service's per-staff conflict
    # check. NULL staff_id (legacy / no-staff calendar) is the shared case.
    if staff_id is not None:
        q = q.filter(Booking.staff_id == staff_id)
    return q.all()


def get_available_slots(
    business_id,
    d: date,
    service_duration: int,
    db: Session,
    staff_id=None,
) -> list[time]:
    schedule = get_schedule_for_weekday(db, business_id, d.weekday())
    if not schedule or not schedule.is_working:
        return []

    if is_holiday(db, business_id, d):
        return []

    existing_bookings = get_bookings_for_date(db, business_id, d, staff_id)

    start_dt = _combine(d, schedule.start_time)
    end_dt = _combine(d, schedule.end_time)
    duration = timedelta(minutes=service_duration)
    step = timedelta(minutes=SLOT_STEP_MINUTES)

    slots: list[time] = []
    current_dt = start_dt

    while current_dt + duration <= end_dt:
        slot_end_dt = current_dt + duration

        if schedule.break_start and schedule.break_end:
            bs = _combine(d, schedule.break_start)
            be = _combine(d, schedule.break_end)
            # Skip the slot if it overlaps the break at all — not just when its
            # start lands inside. Otherwise a 60-min service starting at 11:30
            # would be offered against a 12:00–13:00 break.
            if not (slot_end_dt <= bs or current_dt >= be):
                current_dt += step
                continue

        is_free = True
        for booking in existing_bookings:
            b_start = _combine(d, booking.start_time)
            b_end = _combine(d, booking.end_time)
            if not (slot_end_dt <= b_start or current_dt >= b_end):
                is_free = False
                break

        if is_free:
            slots.append(current_dt.time())

        current_dt += step

    return slots


def next_working_dates(db: Session, business_id, count: int = 7) -> list[date]:
    out: list[date] = []
    day = local_today()
    scanned = 0
    while len(out) < count and scanned < MAX_WORKING_DATE_SCAN:
        scanned += 1
        if not is_holiday(db, business_id, day):
            sched = get_schedule_for_weekday(db, business_id, day.weekday())
            if sched and sched.is_working:
                out.append(day)
        day += timedelta(days=1)
    return out
