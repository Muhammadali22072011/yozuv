"""Owner-side CRUD for staff members + a public list for clients.

Public list: GET /api/business/{slug}/staff — used by the bot picker
and the SEO landing page so a client can choose a master before
seeing slots.

Owner CRUD lives under /api/business/me/staff.

Service-assignment is exposed as a separate sub-route so the typical
"pick a few services" UX doesn't have to PUT the whole record.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Business, Service, Staff

owner_router = APIRouter(prefix="/business/me", tags=["staff"])
public_router = APIRouter(prefix="/business", tags=["staff"])


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(default="", max_length=32)
    photo_url: str = Field(default="", max_length=1024)
    order: int = 0


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    photo_url: str | None = Field(default=None, max_length=1024)
    order: int | None = None


class StaffOut(BaseModel):
    id: UUID
    name: str
    phone: str
    photo_url: str
    is_active: bool
    order: int
    service_ids: list[UUID] = []

    class Config:
        from_attributes = True


def _serialize(s: Staff) -> dict:
    return {
        "id": str(s.id),
        "name": s.name,
        "phone": s.phone or "",
        "photo_url": s.photo_url or "",
        "is_active": bool(s.is_active),
        "order": int(s.order or 0),
        "service_ids": [str(svc.id) for svc in (s.services or [])],
    }


@owner_router.get("/staff")
def list_staff(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    rows = (
        db.query(Staff)
        .filter(Staff.business_id == business.id)
        .order_by(Staff.order.asc(), Staff.name.asc())
        .all()
    )
    return [_serialize(s) for s in rows]


@owner_router.post("/staff", status_code=201)
def create_staff(
    body: StaffCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    # Seat cap by tier (the value metric). Trial = unlimited, so this only
    # bites paid SOLO/SALON businesses past their headcount.
    from app.services.subscription_service import seat_limit

    limit = seat_limit(db, business.id)
    if limit is not None:
        count = db.query(Staff).filter(Staff.business_id == business.id).count()
        if count >= limit:
            raise HTTPException(
                402,
                f"Tarifingiz {limit} ta ustaga mo'ljallangan. "
                f"Ko'proq usta uchun yuqori tarifga o'ting.",
            )
    s = Staff(
        business_id=business.id,
        name=body.name,
        phone=body.phone or "",
        photo_url=body.photo_url or "",
        order=body.order or 0,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@owner_router.put("/staff/{staff_id}")
def update_staff(
    staff_id: UUID,
    body: StaffUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = (
        db.query(Staff)
        .filter(Staff.id == staff_id, Staff.business_id == business.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _serialize(s)


@owner_router.patch("/staff/{staff_id}/toggle")
def toggle_staff(
    staff_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = (
        db.query(Staff)
        .filter(Staff.id == staff_id, Staff.business_id == business.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Not found")
    s.is_active = not s.is_active
    db.commit()
    db.refresh(s)
    return _serialize(s)


@owner_router.delete("/staff/{staff_id}")
def delete_staff(
    staff_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    s = (
        db.query(Staff)
        .filter(Staff.id == staff_id, Staff.business_id == business.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Not found")
    # Existing bookings with this staff_id will have their FK set to
    # NULL by the ondelete=SET NULL rule — they fall back to the shared
    # calendar interpretation, which is the safe behaviour.
    db.delete(s)
    db.commit()
    return {"ok": True}


class AssignServicesBody(BaseModel):
    service_ids: list[UUID]


@owner_router.put("/staff/{staff_id}/services")
def assign_services(
    staff_id: UUID,
    body: AssignServicesBody,
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """Replace this staff member's service set. Validates that every
    listed service belongs to this business — otherwise an owner
    could attach a stranger's service id and confuse the booking
    flow."""
    s = (
        db.query(Staff)
        .filter(Staff.id == staff_id, Staff.business_id == business.id)
        .first()
    )
    if not s:
        raise HTTPException(404, "Not found")
    services: list[Service] = []
    if body.service_ids:
        services = (
            db.query(Service)
            .filter(
                Service.id.in_(body.service_ids),
                Service.business_id == business.id,
            )
            .all()
        )
        if len(services) != len(set(body.service_ids)):
            raise HTTPException(400, "One or more service ids are invalid")
    s.services = services
    db.commit()
    db.refresh(s)
    return _serialize(s)


@public_router.get("/{slug}/staff")
def public_list_staff(slug: str, db: Session = Depends(get_db)):
    biz = (
        db.query(Business)
        .filter(Business.slug == slug, Business.is_active.is_(True))
        .first()
    )
    if not biz:
        raise HTTPException(404, "Not found")
    rows = (
        db.query(Staff)
        .filter(Staff.business_id == biz.id, Staff.is_active.is_(True))
        .order_by(Staff.order.asc(), Staff.name.asc())
        .all()
    )
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "photo_url": s.photo_url or "",
            "service_ids": [str(svc.id) for svc in (s.services or [])],
        }
        for s in rows
    ]
