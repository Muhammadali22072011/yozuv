from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Business, PromoCode

router = APIRouter(prefix="/business/me/promo-codes", tags=["promo"])


class PromoCreate(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    discount_percent: int = Field(0, ge=0, le=100)
    discount_amount: int = Field(0, ge=0)
    max_uses: int = Field(0, ge=0)


class PromoOut(BaseModel):
    id: str
    code: str
    discount_percent: int
    discount_amount: int
    max_uses: int
    uses_count: int
    is_active: bool


def _to_out(p: PromoCode) -> PromoOut:
    return PromoOut(
        id=str(p.id),
        code=p.code,
        discount_percent=p.discount_percent,
        discount_amount=p.discount_amount,
        max_uses=p.max_uses,
        uses_count=p.uses_count,
        is_active=p.is_active,
    )


@router.get("", response_model=list[PromoOut])
def list_promos(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = (
        db.query(PromoCode)
        .filter(PromoCode.business_id == business.id)
        .order_by(PromoCode.created_at.desc())
        .all()
    )
    return [_to_out(p) for p in rows]


@router.post("", response_model=PromoOut)
def create_promo(
    body: PromoCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    code = body.code.strip().upper()
    if not code:
        raise HTTPException(400, "Code is required")
    if body.discount_percent == 0 and body.discount_amount == 0:
        raise HTTPException(400, "Specify either percent or amount")
    exists = (
        db.query(PromoCode)
        .filter(PromoCode.business_id == business.id, PromoCode.code == code)
        .first()
    )
    if exists:
        raise HTTPException(400, "Code already exists")
    p = PromoCode(
        business_id=business.id,
        code=code,
        discount_percent=body.discount_percent,
        discount_amount=body.discount_amount,
        max_uses=body.max_uses,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.patch("/{promo_id}/toggle", response_model=PromoOut)
def toggle_promo(
    promo_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id, PromoCode.business_id == business.id).first()
    if not p:
        raise HTTPException(404, "Not found")
    p.is_active = not p.is_active
    db.commit()
    db.refresh(p)
    return _to_out(p)


@router.delete("/{promo_id}")
def delete_promo(
    promo_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    p = db.query(PromoCode).filter(PromoCode.id == promo_id, PromoCode.business_id == business.id).first()
    if not p:
        raise HTTPException(404, "Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}


@router.post("/validate")
def validate_promo(
    body: dict,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    """Used by bot / frontend to check a code and get discount."""
    code = str(body.get("code", "")).strip().upper()
    if not code:
        raise HTTPException(400, "Code required")
    p = (
        db.query(PromoCode)
        .filter(PromoCode.business_id == business.id, PromoCode.code == code, PromoCode.is_active.is_(True))
        .first()
    )
    if not p:
        raise HTTPException(404, "Invalid code")
    if p.max_uses and p.uses_count >= p.max_uses:
        raise HTTPException(400, "Code usage limit reached")
    return {
        "discount_percent": p.discount_percent,
        "discount_amount": p.discount_amount,
    }
