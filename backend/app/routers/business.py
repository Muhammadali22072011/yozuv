from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_owned_business
from app.models import (
    Booking,
    BookingStatus,
    Business,
    Client,
    PromoCode,
    Review,
    Schedule,
    Service,
    Subscription,
    User,
)
from app.models.enums import BusinessCategory
from app.schemas.business import BusinessCreate, BusinessMe, BusinessPublic, BusinessUpdate
from app.utils.clock import local_today

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

    from datetime import datetime, time, timedelta, timezone

    from app.models import Subscription, SubscriptionPlan, SubscriptionStatus

    b = Business(
        owner_id=user.id,
        name=body.name,
        slug=body.slug,
        category=body.category,
        description=body.description,
        address=body.address,
        phone=body.phone,
        viloyat=body.viloyat,
        tuman=body.tuman,
        latitude=body.latitude,
        longitude=body.longitude,
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

    # Default schedule: Mon–Sat 09:00–18:00, Sun off. Owner can change in /dashboard/schedule.
    for dow in range(7):
        db.add(
            Schedule(
                business_id=b.id,
                day_of_week=dow,
                start_time=time(9, 0),
                end_time=time(18, 0),
                is_working=dow != 6,
            )
        )

    db.commit()
    db.refresh(b)
    return b


@router.get("/me", response_model=BusinessMe)
def my_business(business: Business = Depends(get_owned_business)):
    return business


@router.get("/me/dashboard")
def my_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    business: Business = Depends(get_owned_business),
):
    """One-shot payload that replaces ~10 calls from the dashboard page."""
    today = local_today()
    week_start = today - timedelta(days=7)

    active_bookings = ~(Booking.status == BookingStatus.CANCELLED)
    biz_bookings = Booking.business_id == business.id

    today_count = (
        db.query(func.count(Booking.id))
        .filter(biz_bookings, Booking.date == today, active_bookings)
        .scalar()
        or 0
    )
    today_revenue = (
        db.query(func.coalesce(func.sum(Booking.payment_amount), 0))
        .filter(biz_bookings, Booking.date == today, active_bookings)
        .scalar()
        or 0
    )
    week_revenue = (
        db.query(func.coalesce(func.sum(Booking.payment_amount), 0))
        .filter(biz_bookings, Booking.date >= week_start, Booking.date <= today, active_bookings)
        .scalar()
        or 0
    )
    week_clients = (
        db.query(func.count(func.distinct(Booking.client_id)))
        .filter(biz_bookings, Booking.date >= week_start, Booking.date <= today)
        .scalar()
        or 0
    )

    bookings_today = (
        db.query(Booking)
        .filter(biz_bookings, Booking.date == today)
        .order_by(Booking.start_time.asc())
        .all()
    )
    services = (
        db.query(Service)
        .filter(Service.business_id == business.id, Service.is_active.is_(True))
        .order_by(Service.order.asc(), Service.name.asc())
        .all()
    )
    clients = (
        db.query(Client)
        .join(Booking, Booking.client_id == Client.id)
        .filter(Booking.business_id == business.id)
        .group_by(Client.id)
        .order_by(func.max(Booking.date).desc())
        .all()
    )
    active_promo_count = (
        db.query(func.count(PromoCode.id))
        .filter(PromoCode.business_id == business.id, PromoCode.is_active.is_(True))
        .scalar()
        or 0
    )
    reviews_count = (
        db.query(func.count(Review.id)).filter(Review.business_id == business.id).scalar() or 0
    )
    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == business.id)
        .order_by(Subscription.expires_at.desc())
        .first()
    )

    return {
        "business": BusinessMe.model_validate(business).model_dump(mode="json"),
        "user": {"first_name": user.first_name or "", "last_name": user.last_name or ""},
        "summary": {
            "today": {"bookings_count": int(today_count), "revenue": int(today_revenue)},
            "week": {"revenue": int(week_revenue), "clients_count": int(week_clients)},
        },
        "bookings_today": [
            {
                "id": str(b.id),
                "business_id": str(b.business_id),
                "service_id": str(b.service_id) if b.service_id else None,
                "client_id": str(b.client_id) if b.client_id else None,
                "date": b.date.isoformat(),
                "start_time": b.start_time.strftime("%H:%M"),
                "end_time": b.end_time.strftime("%H:%M"),
                "status": b.status.value if hasattr(b.status, "value") else str(b.status),
                "payment_status": b.payment_status.value
                if hasattr(b.payment_status, "value")
                else str(b.payment_status),
                "payment_amount": int(b.payment_amount or 0),
                "notes": b.notes or "",
                "cancel_reason": b.cancel_reason,
                "created_at": b.created_at.isoformat() if b.created_at else None,
            }
            for b in bookings_today
        ],
        "services": [
            {
                "id": str(s.id),
                "name": s.name,
                "price": int(s.price or 0),
                "duration_minutes": int(s.duration_minutes or 0),
            }
            for s in services
        ],
        "clients": [
            {
                "id": str(c.id),
                "first_name": c.first_name or "",
                "last_name": c.last_name or "",
                "phone": c.phone or "",
            }
            for c in clients
        ],
        "counts": {
            "active_promo": int(active_promo_count),
            "reviews": int(reviews_count),
            "services": len(services),
        },
        "subscription": (
            {
                "plan": sub.plan.value if hasattr(sub.plan, "value") else str(sub.plan),
                "status": sub.status.value if hasattr(sub.status, "value") else str(sub.status),
                "expires_at": sub.expires_at.isoformat() if sub.expires_at else None,
            }
            if sub
            else None
        ),
    }


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


@router.get("/catalog")
def catalog(
    db: Session = Depends(get_db),
    category: BusinessCategory | None = None,
    q: str | None = None,
    viloyat: str | None = None,
    tuman: str | None = None,
    min_rating: float | None = Query(None, ge=0, le=5),
    sort: str = Query("name", pattern="^(name|rating|distance)$"),
    lat: float | None = None,
    lng: float | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    query = db.query(Business).filter(Business.is_active.is_(True))
    if category:
        query = query.filter(Business.category == category)
    if q:
        like = f"%{q}%"
        query = query.filter(Business.name.ilike(like))
    if viloyat:
        query = query.filter(Business.viloyat == viloyat)
    if tuman:
        query = query.filter(Business.tuman == tuman)

    items = query.order_by(Business.name.asc()).all()

    review_stats: dict = {}
    if items:
        biz_ids = [b.id for b in items]
        rows = (
            db.query(
                Review.business_id,
                func.coalesce(func.avg(Review.rating), 0).label("avg"),
                func.count(Review.id).label("cnt"),
            )
            .filter(Review.business_id.in_(biz_ids))
            .group_by(Review.business_id)
            .all()
        )
        review_stats = {r.business_id: (float(r.avg or 0), int(r.cnt or 0)) for r in rows}

    def _haversine(la1: float, ln1: float, la2: float, ln2: float) -> float:
        from math import asin, cos, radians, sin, sqrt
        r = 6371.0
        la1, ln1, la2, ln2 = map(radians, [la1, ln1, la2, ln2])
        dlat = la2 - la1
        dlng = ln2 - ln1
        a = sin(dlat / 2) ** 2 + cos(la1) * cos(la2) * sin(dlng / 2) ** 2
        return 2 * r * asin(sqrt(a))

    enriched = []
    for b in items:
        avg, cnt = review_stats.get(b.id, (0.0, 0))
        if min_rating is not None and avg < float(min_rating):
            continue
        distance_km: float | None = None
        if lat is not None and lng is not None and b.latitude is not None and b.longitude is not None:
            distance_km = round(_haversine(lat, lng, b.latitude, b.longitude), 2)
        enriched.append(
            {
                "id": str(b.id),
                "name": b.name,
                "slug": b.slug,
                "category": b.category.value if hasattr(b.category, "value") else str(b.category),
                "description": b.description,
                "address": b.address,
                "phone": b.phone,
                "logo_url": b.logo_url,
                "language": b.language.value if hasattr(b.language, "value") else str(b.language),
                "viloyat": b.viloyat or "",
                "tuman": b.tuman or "",
                "latitude": b.latitude,
                "longitude": b.longitude,
                "rating": round(avg, 2),
                "reviews_count": cnt,
                "distance_km": distance_km,
            }
        )

    if sort == "rating":
        enriched.sort(key=lambda x: (-x["rating"], -x["reviews_count"], x["name"]))
    elif sort == "distance":
        enriched.sort(
            key=lambda x: (
                x["distance_km"] if x["distance_km"] is not None else float("inf"),
                x["name"],
            )
        )

    return enriched[offset : offset + limit]


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
