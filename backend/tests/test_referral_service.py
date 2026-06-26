"""Client referral program — service-level coverage.

Exercises the full conversion path: mint code → friend opens link →
friend's first booking gets the discount and mints the referrer's reward.
"""
import uuid
from datetime import date, time, timedelta

from app.models import Client, Service
from app.models.enums import ReferralStatus
from app.schemas.booking import BookingCreatePublic
from app.services import booking_service, referral_service


def _service(db, biz, price=100_000):
    svc = Service(
        id=uuid.uuid4(),
        business_id=biz.id,
        name="Soch olish",
        price=price,
        duration_minutes=30,
        order=0,
        is_active=True,
    )
    db.add(svc)
    db.flush()
    return svc


def _client(db, tg_id, name):
    c = Client(id=uuid.uuid4(), telegram_id=tg_id, first_name=name)
    db.add(c)
    db.flush()
    return c


def _enable_referral(biz, friend=20, reward=15):
    biz.referral_enabled = True
    biz.referral_friend_percent = friend
    biz.referral_reward_percent = reward


def test_code_is_stable_per_business_client(db, business_with_sub):
    referrer = _client(db, 111, "Ref")
    a = referral_service.get_or_create_referral_code(db, business_with_sub.id, referrer.id)
    b = referral_service.get_or_create_referral_code(db, business_with_sub.id, referrer.id)
    assert a.code == b.code
    assert referral_service.resolve_referral_code(db, a.code.lower()).id == a.id


def test_register_pending_referral_guards(db, business_with_sub):
    _enable_referral(business_with_sub)
    referrer = _client(db, 111, "Ref")
    rc = referral_service.get_or_create_referral_code(db, business_with_sub.id, referrer.id)

    # Self-referral is rejected.
    assert referral_service.register_pending_referral(db, rc, referrer) is None

    friend = _client(db, 222, "Friend")
    ref = referral_service.register_pending_referral(db, rc, friend)
    assert ref is not None and ref.status == ReferralStatus.PENDING
    # Idempotent: a second open returns the same pending referral.
    again = referral_service.register_pending_referral(db, rc, friend)
    assert again.id == ref.id


def test_referral_converts_on_first_booking(db, business_with_sub):
    _enable_referral(business_with_sub, friend=20, reward=15)
    svc = _service(db, business_with_sub, price=100_000)
    referrer = _client(db, 111, "Ref")
    rc = referral_service.get_or_create_referral_code(db, business_with_sub.id, referrer.id)
    friend = _client(db, 222, "Friend")
    referral_service.register_pending_referral(db, rc, friend)

    slot = date.today() + timedelta(days=2)
    payload = BookingCreatePublic(
        business_id=business_with_sub.id,
        service_id=svc.id,
        client_telegram_id=222,
        client_first_name="Friend",
        date=slot,
        start_time=time(10, 0),
    )
    booking = booking_service.create_booking(db, payload)
    db.flush()

    # Friend got -20%.
    assert booking.payment_amount == 80_000

    ref = referral_service.find_pending_referral(db, business_with_sub.id, friend.id)
    assert ref is None  # no longer pending

    summary = referral_service.referral_summary_for_client(
        db, business_with_sub.id, referrer.id
    )
    assert summary["invited"] == 1
    assert summary["completed"] == 1
    assert len(summary["rewards"]) == 1
    assert summary["rewards"][0]["discount_percent"] == 15

    stats = referral_service.business_referral_stats(db, business_with_sub.id)
    assert stats == {"total": 1, "completed": 1, "pending": 0}


def test_no_discount_when_program_disabled(db, business_with_sub):
    # Program left off — a pending referral can't even be registered, and a
    # booking is charged full price.
    svc = _service(db, business_with_sub, price=50_000)
    referrer = _client(db, 111, "Ref")
    rc = referral_service.get_or_create_referral_code(db, business_with_sub.id, referrer.id)
    friend = _client(db, 222, "Friend")
    assert referral_service.register_pending_referral(db, rc, friend) is None

    payload = BookingCreatePublic(
        business_id=business_with_sub.id,
        service_id=svc.id,
        client_telegram_id=222,
        date=date.today() + timedelta(days=1),
        start_time=time(11, 0),
    )
    booking = booking_service.create_booking(db, payload)
    db.flush()
    assert booking.payment_amount == 50_000
