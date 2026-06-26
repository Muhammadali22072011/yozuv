import json
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, get_owned_business, get_owned_business_download
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

    # Mirror the legacy owner_id link in the new Membership graph so
    # both code paths see this business going forward.
    from app.models import Membership, MembershipRole

    db.add(
        Membership(
            user_id=user.id,
            business_id=b.id,
            role=MembershipRole.OWNER,
        )
    )

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

    # Partner (B2B) referral: if this owner signed up with another salon's
    # code, link them so the referrer is rewarded on this business's first payment.
    if getattr(body, "partner_code", ""):
        from app.services import partner_referral_service

        partner_referral_service.attach_referral_on_signup(db, b, body.partner_code)

    db.commit()
    db.refresh(b)
    return b


@router.get("/me", response_model=BusinessMe)
def my_business(business: Business = Depends(get_owned_business)):
    return business


@router.get("/memberships")
def list_memberships(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Every business this user has access to, with the role they hold.

    Used by the upcoming "switch business" UI so an owner of three
    salons sees all three and can pick which calendar to look at
    (the X-Business-Id header carries the choice forward).
    """
    from app.models import Membership

    rows = (
        db.query(Membership, Business)
        .join(Business, Business.id == Membership.business_id)
        .filter(Membership.user_id == user.id, Business.deleted_at.is_(None))
        .order_by(Business.name.asc())
        .all()
    )
    return [
        {
            "business_id": str(b.id),
            "name": b.name,
            "slug": b.slug,
            "logo_url": b.logo_url or "",
            "role": getattr(m.role, "value", str(m.role)),
            "is_active": bool(b.is_active),
        }
        for m, b in rows
    ]


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
                "telegram_id": int(c.telegram_id) if c.telegram_id else None,
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


@router.get("/me/notifications")
def my_notifications(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    items: list[dict] = []

    recent_bookings = (
        db.query(Booking)
        .filter(
            Booking.business_id == business.id,
            Booking.created_at >= week_ago,
        )
        .order_by(Booking.created_at.desc())
        .limit(20)
        .all()
    )
    client_ids = [b.client_id for b in recent_bookings if b.client_id]
    clients_by_id: dict = {}
    if client_ids:
        clients_by_id = {
            c.id: c
            for c in db.query(Client).filter(Client.id.in_(client_ids)).all()
        }
    for b in recent_bookings:
        client = clients_by_id.get(b.client_id) if b.client_id else None
        client_name = (
            f"{client.first_name or ''} {client.last_name or ''}".strip()
            if client
            else "Mijoz"
        )
        is_cancel = b.status == BookingStatus.CANCELLED
        items.append(
            {
                "id": f"booking:{b.id}",
                "type": "booking_cancelled" if is_cancel else "booking_new",
                "title": "Bron bekor qilindi" if is_cancel else "Yangi bron",
                "body": f"{client_name} · {b.date.isoformat()} {b.start_time.strftime('%H:%M')}",
                "created_at": b.created_at.isoformat() if b.created_at else now.isoformat(),
                "link": "/dashboard/bookings",
            }
        )

    recent_reviews = (
        db.query(Review)
        .filter(
            Review.business_id == business.id,
            Review.created_at >= week_ago,
        )
        .order_by(Review.created_at.desc())
        .limit(10)
        .all()
    )
    for r in recent_reviews:
        items.append(
            {
                "id": f"review:{r.id}",
                "type": "review_new",
                "title": f"Yangi izoh ({int(r.rating or 0)}★)",
                "body": (r.comment or "")[:120] or "Izohsiz baho",
                "created_at": r.created_at.isoformat() if r.created_at else now.isoformat(),
                "link": "/dashboard/reviews",
            }
        )

    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == business.id)
        .order_by(Subscription.expires_at.desc())
        .first()
    )
    if sub and sub.expires_at:
        days_left = (sub.expires_at - now).days
        if 0 <= days_left <= 7:
            items.append(
                {
                    "id": f"sub:{sub.id}",
                    "type": "subscription_expiring",
                    "title": "Obuna tugayapti",
                    "body": f"{days_left} kun qoldi · {sub.expires_at.date().isoformat()}",
                    "created_at": now.isoformat(),
                    "link": "/dashboard/settings",
                }
            )
        elif days_left < 0:
            items.append(
                {
                    "id": f"sub:{sub.id}",
                    "type": "subscription_expired",
                    "title": "Obuna tugagan",
                    "body": f"{sub.expires_at.date().isoformat()} dan beri",
                    "created_at": now.isoformat(),
                    "link": "/dashboard/settings",
                }
            )

    items.sort(key=lambda x: x["created_at"], reverse=True)
    return {"items": items, "generated_at": now.isoformat()}


@router.get("/me/notifications/stream")
async def notifications_stream(
    # SSE: native EventSource can't send custom headers, so we accept
    # the access token via ?token= as well as the usual Authorization
    # header (same pattern as the brochure download).
    business: Business = Depends(get_owned_business_download),
):
    """Server-Sent Events feed for the dashboard bell.

    The dashboard previously polled /notifications every 60 seconds,
    which generated 60k requests per hour per 1k owners regardless of
    whether anything changed. This endpoint emits one event per real
    change (booking, review, subscription update) so the frontend
    only re-fetches when there's actually new data.

    Format: one `event:` block per kind, plus a `ping` heartbeat every
    30s so proxies don't kill an otherwise-quiet connection.
    """
    from app.services.event_bus import subscribe

    async def gen():
        # Tell the client they're connected so we have something to
        # write before the first real event — long flushes through
        # an idle proxy can otherwise close the stream early.
        yield "event: connected\ndata: {}\n\n"
        try:
            async for kind in subscribe(business.id):
                payload = json.dumps({"kind": kind})
                yield f"event: {kind}\ndata: {payload}\n\n"
        except Exception:
            # Either the client disconnected or the producer died.
            # Either way — close cleanly so the frontend can retry.
            return

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            # Disable proxy buffering — Render/Railway have nginx in
            # front and it'll otherwise sit on the response for ~60s.
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


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
    # Mirror the public detail endpoint above: a deactivated/soft-deleted
    # business shouldn't keep advertising its menu.
    b = (
        db.query(Business)
        .filter(Business.slug == slug, Business.is_active.is_(True))
        .first()
    )
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
