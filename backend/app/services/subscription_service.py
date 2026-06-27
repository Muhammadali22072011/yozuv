"""Subscription lifecycle helpers (manual-renewal model).

Yozuv bills via Payme/Click/manual-card, none of which give a reliable
recurring auto-charge in Uzbekistan. So the owner renews by hand and we
must (a) not drop them off a cliff the second they lapse, and (b) nudge
them on a real cadence. This module is the single source of truth for
"what state is this business's subscription in" — consumed by the booking
gate (``booking_service``), the dunning task (``tasks/reminders``) and the
``/subscription`` status endpoint, so all three agree.

Pure of FastAPI/aiogram: just SQLAlchemy + datetime, easy to unit-test.
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Subscription, SubscriptionPlan, SubscriptionStatus, SubscriptionTier

# Master (seat) cap per tier. None = unlimited. The value metric: all core
# features are in every tier — only the headcount differs.
TIER_SEAT_LIMIT = {
    SubscriptionTier.SOLO: 1,
    SubscriptionTier.SALON: 5,
    SubscriptionTier.BIZNES: None,
}

# Lifecycle phases. ACTIVE/GRACE allow new bookings; LOCKED/DORMANT block
# them (data is kept either way — we never delete on non-payment).
PHASE_ACTIVE = "active"
PHASE_GRACE = "grace"
PHASE_LOCKED = "locked"
PHASE_DORMANT = "dormant"
PHASE_NONE = "none"

# Phases in which the business may still take new bookings.
BOOKING_OK_PHASES = (PHASE_ACTIVE, PHASE_GRACE)


def _aware(dt: datetime) -> datetime:
    """Coerce a possibly-naive datetime to UTC-aware (SQLite drops tz)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def current_subscription(db: Session, business_id) -> Subscription | None:
    """The subscription that decides the business's current state: the
    latest non-cancelled row by ``expires_at``. A lapsed monthly plan keeps
    ``status=ACTIVE`` (nothing flips it on expiry), so we rank by date, not
    status, and just exclude CANCELLED (refund/explicit cancel)."""
    return (
        db.query(Subscription)
        .filter(
            Subscription.business_id == business_id,
            Subscription.status != SubscriptionStatus.CANCELLED,
        )
        .order_by(Subscription.expires_at.desc())
        .first()
    )


def days_left(sub: Subscription | None, now: datetime | None = None) -> int | None:
    """Whole days until expiry (ceil): 1 = expires within ~24h, 0 = today,
    negative = already lapsed. None when there's no subscription."""
    if sub is None:
        return None
    now = now or datetime.now(timezone.utc)
    delta = _aware(sub.expires_at) - now
    return math.ceil(delta.total_seconds() / 86400)


def phase(sub: Subscription | None, now: datetime | None = None) -> str:
    """Lifecycle phase for a subscription row (see module docstring)."""
    if sub is None:
        return PHASE_NONE
    now = now or datetime.now(timezone.utc)
    exp = _aware(sub.expires_at)
    s = get_settings()
    grace_end = exp + timedelta(days=s.subscription_grace_days)
    lock_end = grace_end + timedelta(days=s.subscription_lock_days)
    if now <= exp:
        return PHASE_ACTIVE
    if now <= grace_end:
        return PHASE_GRACE
    if now <= lock_end:
        return PHASE_LOCKED
    return PHASE_DORMANT


def seat_limit(db: Session, business_id) -> int | None:
    """Max number of masters the business's current tier allows, or None for
    unlimited. Trial (or no active sub, or already lapsed) → unlimited: we
    never cripple the trial, and a lapsed business is already blocked at the
    booking gate, so there's no point also blocking staff edits."""
    sub = current_subscription(db, business_id)
    if not sub or sub.plan == SubscriptionPlan.TRIAL:
        return None
    if phase(sub) not in BOOKING_OK_PHASES:
        return None
    raw = sub.tier
    if isinstance(raw, SubscriptionTier):
        tier = raw
    else:
        try:
            tier = SubscriptionTier(str(raw))
        except ValueError:
            tier = SubscriptionTier.SALON
    return TIER_SEAT_LIMIT.get(tier)


def booking_allowed(db: Session, business_id) -> bool:
    """True if the business may still take a new booking — i.e. it has a
    non-cancelled subscription whose expiry is still inside the grace
    window. Kept as a single ``filter(...).first()`` query so the existing
    mock-based unit test (and the booking gate) stay simple."""
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(days=get_settings().subscription_grace_days)
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.business_id == business_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > cutoff,
        )
        .first()
    )
    return sub is not None
