"""Unit tests for booking_service."""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.models.enums import BookingStatus, ConfirmationMode, SubscriptionStatus
from app.services.booking_service import (
    _check_active_subscription,
    _check_slot_available,
    get_or_create_client,
)


# ---------------------------------------------------------------------------
# _check_active_subscription
# ---------------------------------------------------------------------------
class TestCheckActiveSubscription:
    def _db_with_sub(self, active: bool):
        db = MagicMock()
        sub = MagicMock() if active else None
        db.query.return_value.filter.return_value.first.return_value = sub
        return db

    def test_active_subscription_passes(self):
        db = self._db_with_sub(active=True)
        # Should not raise
        _check_active_subscription(db, uuid.uuid4())

    def test_expired_subscription_raises(self):
        db = self._db_with_sub(active=False)
        with pytest.raises(ValueError, match="subscription has expired"):
            _check_active_subscription(db, uuid.uuid4())


# ---------------------------------------------------------------------------
# _check_slot_available
# ---------------------------------------------------------------------------
class TestCheckSlotAvailable:
    def _make_payload(self, d=None, start=None):
        p = MagicMock()
        p.date = d or date(2026, 5, 1)
        p.start_time = start or time(10, 0)
        return p

    def test_free_slot_passes(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = None
        # Should not raise
        _check_slot_available(db, uuid.uuid4(), self._make_payload(), time(10, 30))

    def test_conflict_raises(self):
        db = MagicMock()
        conflict = MagicMock()
        db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = conflict
        with pytest.raises(ValueError, match="no longer available"):
            _check_slot_available(db, uuid.uuid4(), self._make_payload(), time(10, 30))


# ---------------------------------------------------------------------------
# get_or_create_client
# ---------------------------------------------------------------------------
class TestGetOrCreateClient:
    def _payload(self, tid="123456789", fname="Ali", lname="Valiyev", phone="+998901234567"):
        p = MagicMock()
        p.client_telegram_id = tid
        p.client_first_name = fname
        p.client_last_name = lname
        p.client_phone = phone
        return p

    def test_creates_new_client_when_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        payload = self._payload()
        client = get_or_create_client(db, payload)
        db.add.assert_called_once()
        db.flush.assert_called_once()
        assert client.first_name == "Ali"

    def test_updates_existing_client(self):
        existing = MagicMock()
        existing.first_name = "Old"
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = existing
        payload = self._payload(fname="New")
        client = get_or_create_client(db, payload)
        assert client is existing
        assert existing.first_name == "New"
        db.add.assert_not_called()
