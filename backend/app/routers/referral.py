from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Business
from app.services import referral_service

router = APIRouter(prefix="/business/me/referral", tags=["referral"])


class ReferralConfigOut(BaseModel):
    enabled: bool
    friend_percent: int
    reward_percent: int
    total: int
    completed: int
    pending: int


class ReferralConfigUpdate(BaseModel):
    enabled: bool | None = None
    friend_percent: int | None = Field(None, ge=0, le=100)
    reward_percent: int | None = Field(None, ge=0, le=100)


def _to_out(business: Business, stats: dict) -> ReferralConfigOut:
    return ReferralConfigOut(
        enabled=bool(business.referral_enabled),
        friend_percent=int(business.referral_friend_percent or 0),
        reward_percent=int(business.referral_reward_percent or 0),
        total=stats["total"],
        completed=stats["completed"],
        pending=stats["pending"],
    )


@router.get("", response_model=ReferralConfigOut)
def get_referral(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    stats = referral_service.business_referral_stats(db, business.id)
    return _to_out(business, stats)


@router.patch("", response_model=ReferralConfigOut)
def update_referral(
    body: ReferralConfigUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    if body.enabled is not None:
        business.referral_enabled = body.enabled
    if body.friend_percent is not None:
        business.referral_friend_percent = body.friend_percent
    if body.reward_percent is not None:
        business.referral_reward_percent = body.reward_percent
    db.commit()
    db.refresh(business)
    stats = referral_service.business_referral_stats(db, business.id)
    return _to_out(business, stats)
