from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Business, Subscription, SubscriptionPlan, SubscriptionStatus
from app.services.payment_service import create_click_payment, create_payme_payment

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
