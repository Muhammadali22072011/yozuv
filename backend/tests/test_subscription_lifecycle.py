"""Unit tests for the manual-renewal subscription lifecycle:
grace-period phases, days-left maths, the booking gate, and the dunning
copy cadence. All pure / mock-based — no Postgres, no Telegram.
"""
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.models.enums import SubscriptionPlan
from app.services.subscription_service import (
    PHASE_ACTIVE,
    PHASE_DORMANT,
    PHASE_GRACE,
    PHASE_LOCKED,
    PHASE_NONE,
    booking_allowed,
    days_left,
    phase,
)
from app.tasks.reminders import DUNNING_OFFSETS, _dunning_message

# Default config: grace_days=3, lock_days=7 → grace ends +3d, lock ends +10d.
NOW = datetime(2026, 6, 1, 12, 0, tzinfo=timezone.utc)


def _sub(days_offset: float):
    """A fake subscription expiring `days_offset` days from NOW (negative =
    already lapsed)."""
    return SimpleNamespace(expires_at=NOW + timedelta(days=days_offset))


class TestPhase:
    def test_none_when_no_sub(self):
        assert phase(None, now=NOW) == PHASE_NONE

    def test_active_before_expiry(self):
        assert phase(_sub(5), now=NOW) == PHASE_ACTIVE

    def test_grace_within_three_days_after_expiry(self):
        assert phase(_sub(-1), now=NOW) == PHASE_GRACE
        assert phase(_sub(-3), now=NOW) == PHASE_GRACE

    def test_locked_after_grace_until_lock_end(self):
        assert phase(_sub(-5), now=NOW) == PHASE_LOCKED
        assert phase(_sub(-10), now=NOW) == PHASE_LOCKED

    def test_dormant_after_lock_window(self):
        assert phase(_sub(-11), now=NOW) == PHASE_DORMANT
        assert phase(_sub(-90), now=NOW) == PHASE_DORMANT

    def test_naive_expires_at_is_treated_as_utc(self):
        # SQLite hands back tz-naive datetimes — must not crash on compare.
        naive = SimpleNamespace(expires_at=datetime(2026, 6, 6, 12, 0))
        assert phase(naive, now=NOW) == PHASE_ACTIVE


class TestDaysLeft:
    def test_none_sub(self):
        assert days_left(None, now=NOW) is None

    def test_future_whole_days(self):
        assert days_left(_sub(5), now=NOW) == 5

    def test_partial_day_rounds_up(self):
        assert days_left(_sub(2.2), now=NOW) == 3

    def test_lapsed_is_negative(self):
        assert days_left(_sub(-2), now=NOW) == -2


class TestBookingAllowed:
    def test_allowed_when_query_returns_row(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock()
        assert booking_allowed(db, uuid.uuid4()) is True

    def test_blocked_when_query_returns_none(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        assert booking_allowed(db, uuid.uuid4()) is False


class TestDunningMessage:
    def test_offsets_constant(self):
        assert set(DUNNING_OFFSETS) == {7, 3, 1, 0, -3, -7}

    def test_every_stage_has_copy(self):
        for off in DUNNING_OFFSETS:
            msg = _dunning_message(SubscriptionPlan.MONTHLY, off)
            assert msg and isinstance(msg, str)

    def test_non_stage_offsets_return_none(self):
        for off in (6, 5, 2, -1, -2, -4, -5, 10, -30):
            assert _dunning_message(SubscriptionPlan.MONTHLY, off) is None

    def test_trial_copy_differs_from_paid(self):
        assert _dunning_message(SubscriptionPlan.TRIAL, 7) != _dunning_message(
            SubscriptionPlan.MONTHLY, 7
        )

    def test_accepts_plain_string_plan(self):
        assert _dunning_message("TRIAL", 3) == _dunning_message(
            SubscriptionPlan.TRIAL, 3
        )

    def test_post_expiry_copy_reassures_data_is_safe(self):
        # The warm "your data is safe" promise is the whole point — it must
        # be present once bookings have actually stopped.
        assert "o'chmadi" in _dunning_message(SubscriptionPlan.MONTHLY, -3)
