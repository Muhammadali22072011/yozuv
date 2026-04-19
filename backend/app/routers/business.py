from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_owned_business
from app.models import Business, Service, User
from app.models.enums import BusinessCategory
from app.schemas.business import BusinessCreate, BusinessMe, BusinessPublic, BusinessUpdate

router = APIRouter(prefix="/business", tags=["business"])


@router.post("", response_model=BusinessMe)
def create_business(
    body: BusinessCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    existing = db.query(Business).filter(Business.owner_id == user.id).first()
    if existing:
        raise HTTPException(400, "Business already exists")

    slug_taken = db.query(Business).filter(Business.slug == body.slug).first()
    if slug_taken:
        raise HTTPException(400, "Slug already taken")

    from datetime import datetime, timedelta, timezone

    from app.models import Subscription, SubscriptionPlan, SubscriptionStatus

    b = Business(
        owner_id=user.id,
        name=body.name,
        slug=body.slug,
        category=body.category,
        description=body.description,
        address=body.address,
        phone=body.phone,
    )
    db.add(b)
    db.flush()

    now = datetime.now(timezone.utc)
    trial = Subscription(
        business_id=b.id,
        plan=SubscriptionPlan.TRIAL,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=14),
        amount_paid=0,
    )
    db.add(trial)
    db.commit()
    db.refresh(b)
    return b


@router.get("/me", response_model=BusinessMe)
def my_business(business: Business = Depends(get_owned_business)):
    return business


@router.put("/me", response_model=BusinessMe)
def update_business(
    body: BusinessUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(business, k, v)
    db.commit()
    db.refresh(business)
    return business


@router.get("/catalog", response_model=list[BusinessPublic])
def catalog(
    db: Session = Depends(get_db),
    category: BusinessCategory | None = None,
    q: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = db.query(Business).filter(Business.is_active.is_(True))
    if category:
        query = query.filter(Business.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(Business.name.ilike(like))
    return query.order_by(Business.name.asc()).offset(offset).limit(limit).all()


@router.get("/{slug}", response_model=BusinessPublic)
def public_business(slug: str, db: Session = Depends(get_db)):
    b = db.query(Business).filter(Business.slug == slug, Business.is_active.is_(True)).first()
    if not b:
        raise HTTPException(404, "Not found")
    return b


@router.get("/{slug}/services", response_model=list)
def public_services(slug: str, db: Session = Depends(get_db)):
    b = db.query(Business).filter(Business.slug == slug).first()
    if not b:
        raise HTTPException(404, "Not found")
    services = (
        db.query(Service)
        .filter(Service.business_id == b.id, Service.is_active.is_(True))
        .order_by(Service.order.asc(), Service.name.asc())
        .all()
    )
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "price": s.price,
            "duration_minutes": s.duration_minutes,
        }
        for s in services
    ]
