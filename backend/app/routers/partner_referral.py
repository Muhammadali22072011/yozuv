from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Business
from app.services import partner_referral_service

router = APIRouter(prefix="/business/me/partner-referral", tags=["partner-referral"])


class PartnerReferralOut(BaseModel):
    code: str
    invited: int
    paid: int
    pending_discount_percent: int
    reward_percent: int


@router.get("", response_model=PartnerReferralOut)
def get_partner_referral(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    summary = partner_referral_service.partner_summary(db, business)
    db.commit()  # persist a freshly-minted partner_code
    return PartnerReferralOut(**summary)
