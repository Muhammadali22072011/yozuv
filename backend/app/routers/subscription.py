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
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
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

router = APIRouter(prefix="/subscription", tags=["subscription"])


class UpgradeBody(BaseModel):
    plan: SubscriptionPlan = Field(..., description="MONTHLY or YEARLY")
    provider: str = Field(..., pattern="^(payme|click)$")


class SubscriptionStatusOut(BaseModel):
    plan: SubscriptionPlan
    status: SubscriptionStatus
    expires_at: str | None

    class Config:
        from_attributes = True


class UpgradeOut(BaseModel):
    payment_url: str
    transaction_id: str


@router.get("", response_model=SubscriptionStatusOut)
def subscription_status(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == business.id, Subscription.status == SubscriptionStatus.ACTIVE)
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(404, "No subscription")
    return SubscriptionStatusOut(
        plan=sub.plan,
        status=sub.status,
        expires_at=sub.expires_at.isoformat() if sub.expires_at else None,
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
        tx, url = create_payme_payment(db, business.id, body.plan)
    else:
        tx, url = create_click_payment(db, business.id, body.plan)
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
