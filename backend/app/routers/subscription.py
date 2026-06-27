from uuid import UUID

from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business, get_current_user
from app.models import (
    Business,
    Membership,
    MembershipRole,
    PaymentProvider,
    Staff,
    SubscriptionPlan,
    SubscriptionStatus,
    SubscriptionTier,
    User,
)
from app.services.payment_service import (
    bulk_factor,
    compute_bulk_amount,
    create_bulk_subscription_payment,
    create_click_payment,
    create_payme_payment,
    get_plan_amount,
)
from app.services.subscription_service import (
    TIER_SEAT_LIMIT,
    current_subscription,
    days_left,
    phase,
    seat_limit,
)

router = APIRouter(prefix="/subscription", tags=["subscription"])


class UpgradeBody(BaseModel):
    plan: SubscriptionPlan = Field(..., description="MONTHLY or YEARLY")
    tier: SubscriptionTier = Field(default=SubscriptionTier.SALON)
    provider: str = Field(..., pattern="^(payme|click)$")


class SubscriptionStatusOut(BaseModel):
    plan: SubscriptionPlan
    tier: str
    status: SubscriptionStatus
    expires_at: str | None
    # Lifecycle phase (active/grace/locked/dormant) + whole days until
    # expiry (negative once lapsed) so the dashboard can render the renewal
    # banner / pay-wall without re-deriving the clock client-side.
    phase: str
    days_left: int | None
    # Seat usage for the current tier (None limit = unlimited).
    seat_limit: int | None
    seats_used: int

    class Config:
        from_attributes = True


class UpgradeOut(BaseModel):
    payment_url: str
    transaction_id: str


class TierPriceOut(BaseModel):
    tier: str
    monthly: int
    yearly: int
    seat_limit: int | None


@router.get("/plans", response_model=list[TierPriceOut])
def list_plans(db: Session = Depends(get_db)):
    """Live tier pricing (honours admin overrides) for the pricing page and
    the in-dashboard upgrade selector. Public — no auth needed to see prices."""
    return [
        TierPriceOut(
            tier=tier.value,
            monthly=get_plan_amount(db, SubscriptionPlan.MONTHLY, tier),
            yearly=get_plan_amount(db, SubscriptionPlan.YEARLY, tier),
            seat_limit=TIER_SEAT_LIMIT.get(tier),
        )
        for tier in (
            SubscriptionTier.SOLO,
            SubscriptionTier.SALON,
            SubscriptionTier.BIZNES,
        )
    ]


@router.get("", response_model=SubscriptionStatusOut)
def subscription_status(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    # Latest non-cancelled sub — returned even when lapsed, so the client
    # can show the grace/locked wall instead of a bare 404.
    sub = current_subscription(db, business.id)
    if not sub:
        raise HTTPException(404, "No subscription")
    seats_used = db.query(Staff).filter(Staff.business_id == business.id).count()
    return SubscriptionStatusOut(
        plan=sub.plan,
        tier=str(sub.tier),
        status=sub.status,
        expires_at=sub.expires_at.isoformat() if sub.expires_at else None,
        phase=phase(sub),
        days_left=days_left(sub),
        seat_limit=seat_limit(db, business.id),
        seats_used=seats_used,
    )


@router.post("/upgrade", response_model=UpgradeOut)
def upgrade(
    body: UpgradeBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    if body.plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")

    if body.provider == "payme":
        tx, url = create_payme_payment(db, business.id, body.plan, body.tier)
    else:
        tx, url = create_click_payment(db, business.id, body.plan, body.tier)
    db.commit()
    if not url:
        raise HTTPException(500, "Payment URL not generated (check credentials)")
    return UpgradeOut(payment_url=url, transaction_id=str(tx.id))


# ---------- Multi-business (bulk) billing ----------


class QuoteLine(BaseModel):
    position: int
    discount_percent: int
    amount: int


class QuoteOut(BaseModel):
    plan: SubscriptionPlan
    count: int
    unit_amount: int          # full price of a single business
    total_no_discount: int    # unit_amount * count
    total: int                # discounted total actually charged
    savings: int
    lines: list[QuoteLine]


@router.get("/quote", response_model=QuoteOut)
def bulk_quote(
    plan: SubscriptionPlan = Query(...),
    count: int = Query(..., ge=1, le=100),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    """Preview the volume-discounted total for paying `plan` for `count`
    businesses in one checkout. Drives the multi-business billing UI."""
    if plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")
    unit = get_plan_amount(db, plan)
    total = compute_bulk_amount(db, plan, count)
    lines = [
        QuoteLine(
            position=i + 1,
            discount_percent=int(round((1 - bulk_factor(i)) * 100)),
            amount=int(round(unit * bulk_factor(i))),
        )
        for i in range(count)
    ]
    return QuoteOut(
        plan=plan,
        count=count,
        unit_amount=unit,
        total_no_discount=unit * count,
        total=total,
        savings=unit * count - total,
        lines=lines,
    )


class BulkUpgradeBody(BaseModel):
    business_ids: list[UUID] = Field(..., min_length=1, max_length=100)
    plan: SubscriptionPlan = Field(...)
    provider: str = Field(..., pattern="^(payme|click)$")


@router.post("/upgrade-bulk", response_model=UpgradeOut)
def upgrade_bulk(
    body: BulkUpgradeBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Pay for several businesses at once with a single payment link.

    Every business must be one the caller OWNs (OWNER membership) — you
    can't top up someone else's branch. Duplicate ids are collapsed.
    """
    if body.plan not in (SubscriptionPlan.MONTHLY, SubscriptionPlan.YEARLY):
        raise HTTPException(400, "Invalid plan")

    # De-dup while preserving order so the discount ladder is stable.
    seen: set[UUID] = set()
    ids: list[UUID] = []
    for bid in body.business_ids:
        if bid not in seen:
            seen.add(bid)
            ids.append(bid)

    owned = {
        m.business_id
        for m in db.query(Membership)
        .filter(
            Membership.user_id == user.id,
            Membership.business_id.in_(ids),
            Membership.role == MembershipRole.OWNER,
        )
        .all()
    }
    missing = [b for b in ids if b not in owned]
    if missing:
        raise HTTPException(403, "Not an owner of every selected business")

    provider = (
        PaymentProvider.PAYME if body.provider == "payme" else PaymentProvider.CLICK
    )
    tx, url = create_bulk_subscription_payment(db, ids, body.plan, provider)
    db.commit()
    if not url:
        raise HTTPException(500, "Payment URL not generated (check credentials)")
    return UpgradeOut(payment_url=url, transaction_id=str(tx.id))
