"""Unit tests for payment_service — refund logic."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, call, patch

import pytest

from app.models.enums import PaymentRecordStatus, SubscriptionStatus
from app.services.payment_service import refund_transaction


def _make_tx(status=PaymentRecordStatus.COMPLETED, business_id=None):
    tx = MagicMock()
    tx.id = uuid.uuid4()
    tx.business_id = business_id or uuid.uuid4()
    tx.status = status
    tx.amount = 187_500
    return tx


class TestRefundTransaction:
    def _db_returning(self, tx):
        db = MagicMock()

        def query_side(model):
            m = MagicMock()
            from app.models import Business, Subscription, User
            from app.models import PaymentTransaction as PT

            if model is PT:
                m.filter.return_value.first.return_value = tx
            elif model is Subscription:
                sub = MagicMock()
                sub.status = SubscriptionStatus.ACTIVE
                m.filter.return_value.order_by.return_value.first.return_value = sub
            elif model is Business:
                biz = MagicMock()
                biz.owner_id = uuid.uuid4()
                m.filter.return_value.first.return_value = biz
            elif model is User:
                user = MagicMock()
                user.telegram_id = "123456"
                m.filter.return_value.first.return_value = user
            return m

        db.query.side_effect = query_side
        return db

    def test_refund_sets_status_to_refunded(self):
        biz_id = uuid.uuid4()
        tx = _make_tx(business_id=biz_id)
        db = self._db_returning(tx)

        with patch("app.services.payment_service.send_telegram_message"):
            result = refund_transaction(db, tx.id, biz_id)

        assert result.status == PaymentRecordStatus.REFUNDED

    def test_refund_wrong_business_raises(self):
        tx = _make_tx()
        db = self._db_returning(tx)
        wrong_biz = uuid.uuid4()

        with pytest.raises(ValueError, match="does not belong"):
            refund_transaction(db, tx.id, wrong_biz)

    def test_refund_pending_tx_raises(self):
        biz_id = uuid.uuid4()
        tx = _make_tx(status=PaymentRecordStatus.PENDING, business_id=biz_id)
        db = self._db_returning(tx)

        with pytest.raises(ValueError, match="Cannot refund"):
            refund_transaction(db, tx.id, biz_id)

    def test_refund_nonexistent_tx_raises(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            refund_transaction(db, uuid.uuid4(), uuid.uuid4())
