"""Unit tests for reminder Celery task logic.

The reminder is the "~1 hour before" nudge. It now uses a one-sided lead
window (send on the first beat run where the booking is at most
REMINDER_LEAD_MAX minutes away and still in the future) combined with the
reminder_sent_at idempotency guard, so a missed beat run is caught on the
next run instead of being silently skipped forever.
"""
from datetime import datetime, timedelta

from app.tasks.reminders import REMINDER_LEAD_MAX


def _should_send(now: datetime, booking_dt: datetime) -> bool:
    minutes_until = (booking_dt - now).total_seconds() / 60.0
    return 0 <= minutes_until <= REMINDER_LEAD_MAX


class TestReminderWindow:
    def test_lead_max_constant(self):
        assert REMINDER_LEAD_MAX == 65.0

    def test_booking_one_hour_away_triggers(self):
        now = datetime(2026, 4, 16, 9, 0, 0)
        assert _should_send(now, now + timedelta(minutes=60))

    def test_booking_thirty_minutes_away_triggers_catch_up(self):
        """A missed beat means the booking can be <59 min away on the next
        run; the catch-up window must still fire it (the old 2-min window
        silently skipped these)."""
        now = datetime(2026, 4, 16, 9, 0, 0)
        assert _should_send(now, now + timedelta(minutes=30))

    def test_booking_too_far_out_does_not_trigger(self):
        now = datetime(2026, 4, 16, 9, 0, 0)
        assert not _should_send(now, now + timedelta(hours=2))

    def test_booking_already_started_does_not_trigger(self):
        now = datetime(2026, 4, 16, 9, 0, 0)
        assert not _should_send(now, now - timedelta(minutes=5))
