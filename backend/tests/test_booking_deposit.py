"""Booking deposit: mint tx, confirm booking on webhook, idempotent."""
import base64
import uuid
from datetime import date, time

import pytest

from app.config import get_settings
from app.models import (
    Booking,
    BookingStatus,
    Client,
    PaymentProvider,
    PaymentRecordStatus,
    PaymentStatus,
    PaymentTransaction,
    Service,
)
from app.services.payment_service import (
    complete_booking_deposit,
    compute_deposit,
    create_booking_deposit,
)


def _booking(db, biz, *, amount=50000, status=BookingStatus.PENDING):
    svc = Service(id=uuid.uuid4(), business_id=biz.id, name="S", price=amount, duration_minutes=30)
    c = Client(id=uuid.uuid4(), telegram_id="900900900", first_name="Olim")
    db.add_all([svc, c])
    db.flush()
    b = Booking(
        id=uuid.uuid4(), business_id=biz.id, service_id=svc.id, client_id=c.id,
        date=date(2026, 8, 1), start_time=time(10, 0), end_time=time(10, 30),
        status=status, payment_status=PaymentStatus.UNPAID, payment_amount=amount,
    )
    db.add(b)
    db.flush()
    return b


def test_compute_deposit():
    assert compute_deposit(50000) == 15000  # 30%
    assert compute_deposit(0) == 1000       # floored


def test_create_booking_deposit_tx(db, business_with_sub):
    b = _booking(db, business_with_sub, amount=50000)
    tx, link = create_booking_deposit(db, b, PaymentProvider.PAYME)
    assert tx.kind == "deposit"
    assert tx.booking_id == b.id
    assert tx.amount == 15000
    assert tx.status == PaymentRecordStatus.PENDING
    # No gateway keys in tests → empty link, but the tx is persisted.
    assert link == ""


def test_complete_booking_deposit_confirms_and_idempotent(db, business_with_sub):
    b = _booking(db, business_with_sub)
    tx, _ = create_booking_deposit(db, b, PaymentProvider.PAYME)
    complete_booking_deposit(db, tx)
    db.flush()
    assert b.status == BookingStatus.CONFIRMED
    assert b.payment_status == PaymentStatus.PAID
    assert tx.status == PaymentRecordStatus.COMPLETED
    # Idempotent: a webhook retry doesn't double-process.
    complete_booking_deposit(db, tx)
    assert b.status == BookingStatus.CONFIRMED


@pytest.fixture()
def payme_secret():
    s = get_settings()
    old = s.payme_secret_key
    s.payme_secret_key = "test-payme-key"
    yield "test-payme-key"
    s.payme_secret_key = old


def test_payme_webhook_confirms_deposit(client, db, business_with_sub, payme_secret):
    b = _booking(db, business_with_sub)
    tx, _ = create_booking_deposit(db, b, PaymentProvider.PAYME)
    db.commit()

    auth = base64.b64encode(f"Paycom:{payme_secret}".encode()).decode()
    r = client.post(
        "/api/payments/payme/webhook",
        json={"method": "PerformTransaction", "params": {"account": {"id": str(tx.id)}}},
        headers={"Authorization": f"Basic {auth}"},
    )
    assert r.status_code == 200
    db.refresh(b)
    assert b.status == BookingStatus.CONFIRMED
    assert b.payment_status == PaymentStatus.PAID
