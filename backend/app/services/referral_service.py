"""Client referral program — "invite a friend".

Reuses the existing PromoCode discount mechanic: the friend's discount is
applied inline on their first booking (see booking_service.create_booking),
and the referrer's reward is minted as a one-time PromoCode they can enter
on their next booking like any other code.
"""

import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Booking, Business, Client, PromoCode
from app.models.enums import ReferralStatus
from app.models.referral import Referral, ReferralCode

# Drop visually ambiguous characters (I/O/0/1) so codes survive being read
# aloud or copied from a screenshot.
_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _gen_code(prefix: str, n: int = 6) -> str:
    return prefix + "".join(secrets.choice(_CODE_ALPHABET) for _ in range(n))


def get_or_create_referral_code(db: Session, business_id: UUID, client_id: UUID) -> ReferralCode:
    rc = (
        db.query(ReferralCode)
        .filter(ReferralCode.business_id == business_id, ReferralCode.client_id == client_id)
        .first()
    )
    if rc:
        return rc
    code = _gen_code("R")
    for _ in range(8):
        if not db.query(ReferralCode.id).filter(ReferralCode.code == code).first():
            break
        code = _gen_code("R")
    rc = ReferralCode(business_id=business_id, client_id=client_id, code=code)
    db.add(rc)
    db.flush()
    return rc


def resolve_referral_code(db: Session, code: str) -> ReferralCode | None:
    code = (code or "").strip().upper()
    if not code:
        return None
    return db.query(ReferralCode).filter(ReferralCode.code == code).first()


def _has_any_booking(db: Session, business_id: UUID, client_id: UUID) -> bool:
    return (
        db.query(Booking.id)
        .filter(Booking.business_id == business_id, Booking.client_id == client_id)
        .first()
        is not None
    )


def register_pending_referral(db: Session, rc: ReferralCode, friend: Client) -> Referral | None:
    """A friend opened a referral link. Record a PENDING referral so their
    first booking auto-applies the friend discount and rewards the referrer.

    Returns the Referral, or None when not eligible: self-referral, the
    program is off, or the friend is already a client of this business.
    """
    if rc is None or friend is None:
        return None
    if rc.client_id == friend.id:
        return None  # can't refer yourself
    biz = db.query(Business).filter(Business.id == rc.business_id).first()
    if not biz or not biz.referral_enabled:
        return None
    # Only brand-new clients convert a referral — existing customers can't
    # be "invited" retroactively.
    if _has_any_booking(db, rc.business_id, friend.id):
        return None
    existing = (
        db.query(Referral)
        .filter(
            Referral.business_id == rc.business_id,
            Referral.referred_client_id == friend.id,
        )
        .first()
    )
    if existing:
        return existing
    ref = Referral(
        business_id=rc.business_id,
        referrer_client_id=rc.client_id,
        referred_client_id=friend.id,
        status=ReferralStatus.PENDING,
    )
    db.add(ref)
    db.flush()
    return ref


def find_pending_referral(db: Session, business_id: UUID, client_id: UUID) -> Referral | None:
    return (
        db.query(Referral)
        .filter(
            Referral.business_id == business_id,
            Referral.referred_client_id == client_id,
            Referral.status == ReferralStatus.PENDING,
        )
        .first()
    )


def complete_referral(
    db: Session, ref: Referral, booking: Booking, reward_percent: int
) -> PromoCode | None:
    """Convert a PENDING referral: tie it to the friend's first booking and
    mint the referrer's one-time reward promo code. Returns the reward
    PromoCode (or None when reward_percent <= 0)."""
    ref.referred_booking_id = booking.id
    ref.status = ReferralStatus.COMPLETED
    ref.completed_at = _utcnow()

    reward_percent = int(reward_percent or 0)
    if reward_percent <= 0:
        return None

    code = _gen_code("RW")
    for _ in range(8):
        exists = (
            db.query(PromoCode.id)
            .filter(PromoCode.business_id == ref.business_id, PromoCode.code == code)
            .first()
        )
        if not exists:
            break
        code = _gen_code("RW")
    reward = PromoCode(
        business_id=ref.business_id,
        code=code,
        discount_percent=reward_percent,
        discount_amount=0,
        max_uses=1,
        is_active=True,
    )
    db.add(reward)
    db.flush()
    ref.reward_promo_id = reward.id
    return reward


def referral_summary_for_client(db: Session, business_id: UUID, client_id: UUID) -> dict:
    """Client-facing summary for the bot 'invite a friend' screen."""
    rc = get_or_create_referral_code(db, business_id, client_id)
    invited = (
        db.query(func.count(Referral.id))
        .filter(Referral.business_id == business_id, Referral.referrer_client_id == client_id)
        .scalar()
        or 0
    )
    completed = (
        db.query(func.count(Referral.id))
        .filter(
            Referral.business_id == business_id,
            Referral.referrer_client_id == client_id,
            Referral.status == ReferralStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    rewards = (
        db.query(PromoCode)
        .join(Referral, Referral.reward_promo_id == PromoCode.id)
        .filter(
            Referral.business_id == business_id,
            Referral.referrer_client_id == client_id,
            PromoCode.is_active.is_(True),
            PromoCode.uses_count < PromoCode.max_uses,
        )
        .all()
    )
    return {
        "code": rc.code,
        "invited": int(invited),
        "completed": int(completed),
        "rewards": [
            {"code": p.code, "discount_percent": int(p.discount_percent or 0)} for p in rewards
        ],
    }


def business_referral_stats(db: Session, business_id: UUID) -> dict:
    """Owner-facing counts for the dashboard referral tab."""
    total = (
        db.query(func.count(Referral.id))
        .filter(Referral.business_id == business_id)
        .scalar()
        or 0
    )
    completed = (
        db.query(func.count(Referral.id))
        .filter(
            Referral.business_id == business_id,
            Referral.status == ReferralStatus.COMPLETED,
        )
        .scalar()
        or 0
    )
    return {"total": int(total), "completed": int(completed), "pending": int(total) - int(completed)}
