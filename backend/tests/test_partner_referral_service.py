"""Partner (B2B) referral — service-level coverage.

Salon A invites salon B; when B makes its first paid subscription, A earns a
discount on A's next subscription payment.
"""
import uuid

from app.models import Business, Subscription, User
from app.models.enums import (
    ReferralStatus,
    SubscriptionPlan,
    SubscriptionStatus,
)
from app.services import partner_referral_service, payment_service


def _business(db, slug, name="Salon"):
    owner = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        first_name="Owner",
    )
    db.add(owner)
    db.flush()
    biz = Business(id=uuid.uuid4(), owner_id=owner.id, name=name, slug=slug, category="salon")
    db.add(biz)
    db.flush()
    return biz


def test_partner_code_is_stable(db, business_with_sub):
    c1 = partner_referral_service.get_or_create_partner_code(db, business_with_sub)
    c2 = partner_referral_service.get_or_create_partner_code(db, business_with_sub)
    assert c1 == c2
    assert c1.startswith("P")
    assert partner_referral_service.resolve_partner_code(db, c1.lower()).id == business_with_sub.id


def test_full_partner_flow(db, business_with_sub):
    referrer = business_with_sub
    code = partner_referral_service.get_or_create_partner_code(db, referrer)

    # New salon signs up with the referrer's code.
    new_biz = _business(db, "new-salon", "New Salon")
    partner_referral_service.attach_referral_on_signup(db, new_biz, code)
    assert new_biz.referred_by_business_id == referrer.id

    # Self-referral is a no-op.
    partner_referral_service.attach_referral_on_signup(db, referrer, code)

    # New salon makes its first payment → referrer earns a discount.
    reward = partner_referral_service.grant_reward_if_referred(db, new_biz)
    assert reward is not None
    assert reward["reward_percent"] == partner_referral_service.PARTNER_REFERRAL_REWARD_PERCENT
    db.flush()
    assert referrer.pending_partner_discount_percent == 50

    # Granting again does nothing (referral already COMPLETED).
    assert partner_referral_service.grant_reward_if_referred(db, new_biz) is None

    # Referrer's next payment is discounted.
    amount, pct = payment_service._discounted_amount(db, referrer.id, SubscriptionPlan.MONTHLY)
    assert pct == 50
    assert amount == payment_service.MONTHLY_AMOUNT_UZS // 2

    # Spending the credit clears it.
    partner_referral_service.consume_discount(db, referrer, pct)
    assert referrer.pending_partner_discount_percent == 0

    summary = partner_referral_service.partner_summary(db, referrer)
    assert summary["invited"] == 1
    assert summary["paid"] == 1


def test_no_discount_without_pending(db, business_with_sub):
    amount, pct = payment_service._discounted_amount(
        db, business_with_sub.id, SubscriptionPlan.MONTHLY
    )
    assert pct == 0
    assert amount == payment_service.MONTHLY_AMOUNT_UZS
