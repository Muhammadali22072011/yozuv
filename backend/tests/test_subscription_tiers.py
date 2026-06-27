"""Tiers (seat metric), founder pricing, and the B2B partner referral."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models import (
    Business,
    PlatformSettings,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionTier,
)
from app.services.payment_service import (
    apply_founder_discount,
    get_plan_amount,
    grant_partner_reward,
)
from app.services.subscription_service import seat_limit


def _paid_sub(db, business_id, tier, days=30, plan=SubscriptionPlan.MONTHLY):
    now = datetime.now(timezone.utc)
    sub = Subscription(
        id=uuid.uuid4(),
        business_id=business_id,
        plan=plan,
        tier=tier,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=days),
        amount_paid=1,
    )
    db.add(sub)
    db.flush()
    return sub


class TestTierPricing:
    def test_default_monthly_prices(self, db):
        assert get_plan_amount(db, SubscriptionPlan.MONTHLY, SubscriptionTier.SOLO) == 99_000
        assert get_plan_amount(db, SubscriptionPlan.MONTHLY, SubscriptionTier.SALON) == 199_000
        assert get_plan_amount(db, SubscriptionPlan.MONTHLY, SubscriptionTier.BIZNES) == 399_000

    def test_yearly_is_ten_months(self, db):
        assert get_plan_amount(db, SubscriptionPlan.YEARLY, SubscriptionTier.SOLO) == 990_000
        assert get_plan_amount(db, SubscriptionPlan.YEARLY, SubscriptionTier.BIZNES) == 3_990_000

    def test_admin_override_wins(self, db):
        db.add(PlatformSettings(id=1, solo_price=120_000))
        db.flush()
        assert get_plan_amount(db, SubscriptionPlan.MONTHLY, SubscriptionTier.SOLO) == 120_000
        assert get_plan_amount(db, SubscriptionPlan.YEARLY, SubscriptionTier.SOLO) == 1_200_000

    def test_default_tier_is_salon(self, db):
        # Back-compat: callers that omit tier get SALON pricing.
        assert get_plan_amount(db, SubscriptionPlan.MONTHLY) == 199_000


class TestSeatLimit:
    def test_trial_is_unlimited(self, db, business_with_sub):
        assert seat_limit(db, business_with_sub.id) is None

    def test_solo_is_one(self, db, business_with_sub):
        _paid_sub(db, business_with_sub.id, SubscriptionTier.SOLO, days=60)
        assert seat_limit(db, business_with_sub.id) == 1

    def test_salon_is_five(self, db, business_with_sub):
        _paid_sub(db, business_with_sub.id, SubscriptionTier.SALON, days=60)
        assert seat_limit(db, business_with_sub.id) == 5

    def test_biznes_is_unlimited(self, db, business_with_sub):
        _paid_sub(db, business_with_sub.id, SubscriptionTier.BIZNES, days=60)
        assert seat_limit(db, business_with_sub.id) is None


class TestFounderDiscount:
    def test_no_discount_when_not_founder(self, db, business_with_sub):
        assert apply_founder_discount(db, business_with_sub.id, 199_000) == 199_000

    def test_discount_applied_for_founder(self, db, business_with_sub):
        business_with_sub.is_founder = True
        db.add(PlatformSettings(id=1, founder_discount_percent=20))
        db.flush()
        assert apply_founder_discount(db, business_with_sub.id, 100_000) == 80_000


def _days_between(a, b):
    # SQLite hands datetimes back tz-naive; normalise before subtracting.
    a = a.replace(tzinfo=None) if a.tzinfo else a
    b = b.replace(tzinfo=None) if b.tzinfo else b
    return (a - b).days


class TestPartnerReferral:
    def test_reward_extends_both_and_is_once(self, db, owner_user):
        inviter = Business(id=uuid.uuid4(), owner_id=owner_user.id, name="Inviter", slug="inv", category="barbershop")
        referred = Business(id=uuid.uuid4(), owner_id=owner_user.id, name="Referred", slug="ref", category="barbershop")
        db.add_all([inviter, referred])
        db.flush()
        referred.referred_by_id = inviter.id
        inv_sub = _paid_sub(db, inviter.id, SubscriptionTier.SALON, days=10)
        ref_sub = _paid_sub(db, referred.id, SubscriptionTier.SOLO, days=10)
        inv_before = inv_sub.expires_at
        ref_before = ref_sub.expires_at

        with patch("app.services.payment_service.send_telegram_message"):
            grant_partner_reward(db, referred.id)

        # Assert on the in-session objects (the test session has autoflush off,
        # so a refresh would discard the un-flushed change; production commits).
        assert _days_between(inv_sub.expires_at, inv_before) == 30
        assert _days_between(ref_sub.expires_at, ref_before) == 30
        assert referred.partner_reward_claimed is True

        # Second call (e.g. a renewal) must NOT grant again.
        with patch("app.services.payment_service.send_telegram_message"):
            grant_partner_reward(db, referred.id)
        assert _days_between(inv_sub.expires_at, inv_before) == 30

    def test_no_reward_without_referrer(self, db, business_with_sub):
        # Best-effort no-op when the business wasn't referred.
        with patch("app.services.payment_service.send_telegram_message"):
            grant_partner_reward(db, business_with_sub.id)  # must not raise
