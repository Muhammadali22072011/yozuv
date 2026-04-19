"""Unit tests for slot calculation logic (no DB needed)."""
from datetime import date, time
from unittest.mock import MagicMock, patch

import pytest

from app.utils.slots import SLOT_STEP_MINUTES, get_available_slots


def _make_schedule(start="09:00", end="18:00", break_start=None, break_end=None, is_working=True):
    sched = MagicMock()
    sched.is_working = is_working
    h, m = map(int, start.split(":"))
    sched.start_time = time(h, m)
    h, m = map(int, end.split(":"))
    sched.end_time = time(h, m)
    sched.break_start = None
    sched.break_end = None
    if break_start:
        h, m = map(int, break_start.split(":"))
        sched.break_start = time(h, m)
        h, m = map(int, break_end.split(":"))
        sched.break_end = time(h, m)
    return sched


def _mock_db(schedule=None, holiday=False, bookings=None):
    db = MagicMock()

    sched_query = MagicMock()
    sched_query.filter.return_value.first.return_value = schedule
    db.query.return_value = sched_query

    # Route different models to different mocks
    from app.models import Booking, HolidayDate, Schedule

    def side_effect(model):
        mock = MagicMock()
        if model is Schedule:
            mock.filter.return_value.first.return_value = schedule
        elif model is HolidayDate:
            mock.filter.return_value.first.return_value = MagicMock() if holiday else None
        elif model is Booking:
            mock.filter.return_value.all.return_value = bookings or []
        return mock

    db.query.side_effect = side_effect
    return db


class TestGetAvailableSlots:
    def test_non_working_day_returns_empty(self):
        db = _mock_db(schedule=_make_schedule(is_working=False))
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        assert slots == []

    def test_no_schedule_returns_empty(self):
        db = _mock_db(schedule=None)
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        assert slots == []

    def test_holiday_returns_empty(self):
        db = _mock_db(schedule=_make_schedule(), holiday=True)
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        assert slots == []

    def test_slots_are_multiples_of_step(self):
        db = _mock_db(schedule=_make_schedule(start="09:00", end="12:00"))
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        # 09:00, 09:30, 10:00, 10:30, 11:00, 11:30 → 6 slots
        assert len(slots) == 6
        assert slots[0] == time(9, 0)
        assert slots[-1] == time(11, 30)

    def test_break_slots_excluded(self):
        db = _mock_db(schedule=_make_schedule(start="09:00", end="13:00", break_start="12:00", break_end="13:00"))
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        # 09:00–11:30 (6 slots), 12:00 is break start so excluded
        slot_times = [s.strftime("%H:%M") for s in slots]
        assert "12:00" not in slot_times
        assert "09:00" in slot_times

    def test_existing_booking_blocks_slot(self):
        booked = MagicMock()
        booked.start_time = time(10, 0)
        booked.end_time = time(10, 30)
        db = _mock_db(schedule=_make_schedule(start="09:00", end="12:00"), bookings=[booked])
        slots = get_available_slots("biz-id", date(2026, 4, 14), 30, db)
        slot_times = [s.strftime("%H:%M") for s in slots]
        assert "10:00" not in slot_times
        assert "09:00" in slot_times
        assert "10:30" in slot_times

    def test_slot_step_constant_used(self):
        """Verify SLOT_STEP_MINUTES constant value is correct."""
        assert SLOT_STEP_MINUTES == 30
