from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Business, Service

router = APIRouter(prefix="/business/me", tags=["services"])


class ServiceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    price: int = 0
    price_max: int | None = None
    description: str | None = None
    duration_minutes: int = 30
    order: int = 0


class ServiceUpdate(BaseModel):
    name: str | None = None
    price: int | None = None
    price_max: int | None = None
    description: str | None = None
    duration_minutes: int | None = None
    order: int | None = None


class ServiceOut(BaseModel):
    id: UUID
    name: str
    price: int
    price_max: int | None = None
    description: str | None = None
    duration_minutes: int
    is_active: bool
    order: int

    class Config:
        from_attributes = True


@router.get("/services", response_model=list[ServiceOut])
def list_services(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    return (
        db.query(Service)
        .filter(Service.business_id == business.id)
        .order_by(Service.order.asc(), Service.name.asc())
        .all()
    )


@router.post("/services", response_model=ServiceOut)
def create_service(
    body: ServiceCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = Service(
        business_id=business.id,
        name=body.name,
        price=body.price,
        price_max=body.price_max,
        description=body.description,
        duration_minutes=body.duration_minutes,
        order=body.order,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/services/{service_id}", response_model=ServiceOut)
def update_service(
    service_id: UUID,
    body: ServiceUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = db.query(Service).filter(Service.id == service_id, Service.business_id == business.id).first()
    if not s:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/services/{service_id}")
def delete_service(
    service_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = db.query(Service).filter(Service.id == service_id, Service.business_id == business.id).first()
    if not s:
        raise HTTPException(404, "Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.patch("/services/{service_id}/toggle", response_model=ServiceOut)
def toggle_service(
    service_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = db.query(Service).filter(Service.id == service_id, Service.business_id == business.id).first()
    if not s:
        raise HTTPException(404, "Not found")
    s.is_active = not s.is_active
    db.commit()
    db.refresh(s)
    return s
