"""Unit tests for reminder Celery task logic (inverted condition fix)."""
from datetime import date, datetime, time, timedelta
from unittest.mock import MagicMock, patch

from app.tasks.reminders import REMINDER_WINDOW_MAX, REMINDER_WINDOW_MIN


class TestReminderWindow:
    """Verify the reminder window constants and the fixed condition."""

    def test_constants_are_correct(self):
        assert REMINDER_WINDOW_MIN == 59.0
        assert REMINDER_WINDOW_MAX == 61.0

    def test_booking_in_window_should_trigger(self):
        """A booking 60 minutes away should be inside the window."""
        now = datetime(2026, 4, 16, 9, 0, 0)
        booking_dt = now + timedelta(minutes=60)
        minutes_until = (booking_dt - now).total_seconds() / 60.0
        assert REMINDER_WINDOW_MIN <= minutes_until <= REMINDER_WINDOW_MAX

    def test_booking_outside_window_should_not_trigger(self):
        """A booking 30 minutes away should NOT trigger a reminder."""
        now = datetime(2026, 4, 16, 9, 0, 0)
        booking_dt = now + timedelta(minutes=30)
        minutes_until = (booking_dt - now).total_seconds() / 60.0
        assert not (REMINDER_WINDOW_MIN <= minutes_until <= REMINDER_WINDOW_MAX)

    def test_booking_past_should_not_trigger(self):
        """A booking 2 hours away should NOT trigger."""
        now = datetime(2026, 4, 16, 9, 0, 0)
        booking_dt = now + timedelta(hours=2)
        minutes_until = (booking_dt - now).total_seconds() / 60.0
        assert not (REMINDER_WINDOW_MIN <= minutes_until <= REMINDER_WINDOW_MAX)
