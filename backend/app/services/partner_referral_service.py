"""Partner (B2B) referral program — salon invites another salon to Yozuv.

The new salon signs up with the referrer's partner code. When it makes its
first paid subscription, the referrer earns a discount on their NEXT
subscription payment (held on Business.pending_partner_discount_percent and
applied/consumed by payment_service).
"""

import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Business, User
from app.models.business_referral import BusinessReferral
from app.models.enums import ReferralStatus

# Reward the referrer gets (percent off their next subscription payment) when
# a salon they invited makes its first payment. Platform-level lever — bump
# it here (or move to PlatformSettings later) to run a stronger promo.
PARTNER_REFERRAL_REWARD_PERCENT = 50

_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code(n: int = 6) -> str:
    return "P" + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(n))


def get_or_create_partner_code(db: Session, business: Business) -> str:
    if business.partner_code:
        return business.partner_code
    code = _gen_code()
    for _ in range(8):
        if not db.query(Business.id).filter(Business.partner_code == code).first():
            break
        code = _gen_code()
    business.partner_code = code
    db.flush()
    return code


def resolve_partner_code(db: Session, code: str) -> Business | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    return db.query(Business).filter(Business.partner_code == code).first()


def attach_referral_on_signup(db: Session, new_business: Business, code: str) -> None:
    """Called at business creation. If a valid partner code was supplied,
    link the new business to its referrer and open a PENDING referral."""
    ref_biz = resolve_partner_code(db, code)
    if ref_biz is None or ref_biz.id == new_business.id:
        return
    if new_business.referred_by_business_id:
        return
    existing = (
        db.query(BusinessReferral)
        .filter(BusinessReferral.referred_business_id == new_business.id)
        .first()
    )
    if existing:
        return
    new_business.referred_by_business_id = ref_biz.id
    db.add(
        BusinessReferral(
            referrer_business_id=ref_biz.id,
            referred_business_id=new_business.id,
            status=ReferralStatus.PENDING,
            reward_percent=PARTNER_REFERRAL_REWARD_PERCENT,
        )
    )
    db.flush()


def grant_reward_if_referred(db: Session, paid_business: Business) -> dict | None:
    """Called when a business completes a subscription payment. If that
    business was referred and the referral is still PENDING, convert it and
    credit the referrer's next payment. Returns notify info or None."""
    ref = (
        db.query(BusinessReferral)
        .filter(
            BusinessReferral.referred_business_id == paid_business.id,
            BusinessReferral.status == ReferralStatus.PENDING,
        )
        .first()
    )
    if ref is None:
        return None
    ref.status = ReferralStatus.COMPLETED
    ref.completed_at = _utcnow()

    referrer = (
        db.query(Business)
        .filter(Business.id == ref.referrer_business_id)
        .with_for_update()
        .first()
    )
    if referrer is None:
        return None
    reward = int(ref.reward_percent or 0)
    referrer.pending_partner_discount_percent = min(
        100, int(referrer.pending_partner_discount_percent or 0) + reward
    )

    owner = db.query(User).filter(User.id == referrer.owner_id).first()
    owner_tg = None
    if owner and owner.telegram_id:
        try:
            owner_tg = int(owner.telegram_id)
        except (TypeError, ValueError):
            owner_tg = None
    return {
        "referrer_owner_telegram": owner_tg,
        "reward_percent": reward,
        "referred_name": paid_business.name,
    }


def consume_discount(db: Session, business: Business, percent: int) -> None:
    """Called after a discounted payment completes — spend the credit."""
    if percent and percent > 0:
        business.pending_partner_discount_percent = max(
            0, int(business.pending_partner_discount_percent or 0) - int(percent)
        )


def partner_summary(db: Session, business: Business) -> dict:
    code = get_or_create_partner_code(db, business)
    invited = (
        db.query(func.count(BusinessReferral.id))
        .filter(BusinessReferral.referrer_business_id == business.id)
        .scalar()
        or 0
    )
    paid = (
        db.query(func.count(BusinessReferral.id))
        .filter(
            BusinessReferral.referrer_business_id == business.id,
            BusinessReferral.status == ReferralStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    return {
        "code": code,
        "invited": int(invited),
        "paid": int(paid),
        "pending_discount_percent": int(business.pending_partner_discount_percent or 0),
        "reward_percent": PARTNER_REFERRAL_REWARD_PERCENT,
    }
