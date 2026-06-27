from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_active_business
from app.models import Booking, BookingStatus, Business, Service
from app.schemas.analytics import BookingsPoint, PopularService, RevenuePoint, SummaryAnalytics
from app.utils.clock import local_today

router = APIRouter(prefix="/business/me/analytics", tags=["analytics"])


def _period_start(period: str) -> date:
    today = local_today()
    if period == "today":
        return today
    if period == "week":
        return today - timedelta(days=7)
    if period == "month":
        return today - timedelta(days=30)
    if period == "year":
        return today - timedelta(days=365)
    return today - timedelta(days=7)


@router.get("/summary", response_model=SummaryAnalytics)
def summary(
    period: str = Query("week", pattern="^(today|week|month|year)$"),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    start_d = _period_start(period)
    today = local_today()
    bookings_count = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
            Booking.status != BookingStatus.CANCELLED,
        )
        .scalar()
        or 0
    )
    revenue = (
        db.query(func.coalesce(func.sum(Booking.payment_amount), 0))
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
            Booking.status != BookingStatus.CANCELLED,
        )
        .scalar()
        or 0
    )
    clients_count = (
        db.query(func.count(func.distinct(Booking.client_id)))
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
        )
        .scalar()
        or 0
    )
    return SummaryAnalytics(
        bookings_count=int(bookings_count),
        revenue=int(revenue),
        clients_count=int(clients_count),
    )


@router.get("/revenue", response_model=list[RevenuePoint])
def revenue_chart(
    days: int = Query(7, ge=1, le=400),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    out: list[RevenuePoint] = []
    today = local_today()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        amt = (
            db.query(func.coalesce(func.sum(Booking.payment_amount), 0))
            .filter(
                Booking.business_id == business.id,
                Booking.date == d,
                Booking.status != BookingStatus.CANCELLED,
            )
            .scalar()
            or 0
        )
        out.append(RevenuePoint(date=d.isoformat(), amount=int(amt)))
    return out


@router.get("/bookings-by-day", response_model=list[BookingsPoint])
def bookings_by_day(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    out: list[BookingsPoint] = []
    today = local_today()
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        cnt = (
            db.query(func.count(Booking.id))
            .filter(
                Booking.business_id == business.id,
                Booking.date == d,
                Booking.status != BookingStatus.CANCELLED,
            )
            .scalar()
            or 0
        )
        out.append(BookingsPoint(date=d.isoformat(), bookings=int(cnt)))
    return out


@router.get("/popular-services", response_model=list[PopularService])
def popular_services(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
    limit: int = Query(10, le=50),
):
    rows = (
        db.query(Service.id, Service.name, func.count(Booking.id).label("cnt"))
        .join(Booking, Booking.service_id == Service.id)
        .filter(Booking.business_id == business.id)
        .group_by(Service.id, Service.name)
        .order_by(func.count(Booking.id).desc())
        .limit(limit)
        .all()
    )
    return [PopularService(service_id=str(r.id), name=r.name, bookings=int(r.cnt)) for r in rows]


@router.get("/top-revenue-services")
def top_revenue_services(
    days: int = Query(90, ge=1, le=400),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
    limit: int = Query(5, ge=1, le=20),
):
    """Top services by revenue (price * count of completed/confirmed
    bookings) over the last `days` days. The dashboard renders this as
    a horizontal bar chart so the owner can see at a glance where the
    money actually comes from."""
    today = local_today()
    start_d = today - timedelta(days=days)
    rows = (
        db.query(
            Service.id,
            Service.name,
            func.count(Booking.id).label("bookings"),
            func.coalesce(func.sum(Booking.payment_amount), 0).label("revenue"),
        )
        .join(Booking, Booking.service_id == Service.id)
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
            Booking.status != BookingStatus.CANCELLED,
        )
        .group_by(Service.id, Service.name)
        .order_by(func.coalesce(func.sum(Booking.payment_amount), 0).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "service_id": str(r.id),
            "name": r.name,
            "bookings": int(r.bookings or 0),
            "revenue": int(r.revenue or 0),
        }
        for r in rows
    ]


@router.get("/heatmap")
def heatmap(
    days: int = Query(60, ge=7, le=365),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """7x24 grid of booking counts — rows are days of the week
    (0=Mon..6=Sun), columns are hours (0..23). The owner sees the
    fingerprint of when their place is busy vs dead, drives staffing
    and promo decisions ("Tuesday afternoons are dead → 20% off
    Tuesday")."""
    today = local_today()
    start_d = today - timedelta(days=days)
    rows = (
        db.query(Booking.date, Booking.start_time)
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
            Booking.status != BookingStatus.CANCELLED,
        )
        .all()
    )
    grid = [[0 for _ in range(24)] for _ in range(7)]
    for d, t in rows:
        if d is None or t is None:
            continue
        # Python's date.weekday() returns 0=Mon..6=Sun, which is what
        # we want for the dashboard (Monday-first week is the local
        # convention).
        grid[d.weekday()][t.hour] += 1
    return {
        "days": days,
        "grid": grid,
        "max": max((c for row in grid for c in row), default=0),
    }


@router.get("/retention")
def retention(
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """Cohort-style retention: of clients whose first visit was 30/60/
    90/180 days ago, what % had at least one more visit since? A
    direct read of the "are we keeping people?" question. Computed in
    Python over a single materialised list of (client, first_date)
    rather than a SQL pivot to keep it dialect-agnostic."""
    today = local_today()
    pairs = (
        db.query(Booking.client_id, func.min(Booking.date).label("first_date"))
        .filter(
            Booking.business_id == business.id,
            Booking.client_id.is_not(None),
            Booking.status != BookingStatus.CANCELLED,
        )
        .group_by(Booking.client_id)
        .all()
    )
    # Build a set of (client_id, last_date) too so we can answer
    # "did they come back?" without an N+1.
    last = (
        db.query(Booking.client_id, func.max(Booking.date).label("last_date"))
        .filter(
            Booking.business_id == business.id,
            Booking.client_id.is_not(None),
            Booking.status != BookingStatus.CANCELLED,
        )
        .group_by(Booking.client_id)
        .all()
    )
    last_by_client = {row.client_id: row.last_date for row in last}

    def cohort(window_days: int) -> dict:
        cutoff = today - timedelta(days=window_days)
        # Clients whose first visit was BEFORE the cutoff (i.e. we've
        # had `window_days` to retain them).
        eligible = [(cid, fd) for cid, fd in pairs if fd is not None and fd <= cutoff]
        returned = sum(
            1
            for cid, fd in eligible
            if last_by_client.get(cid) is not None and last_by_client[cid] > fd
        )
        return {
            "eligible": len(eligible),
            "returned": returned,
            "rate": (round(returned / len(eligible), 3) if eligible else 0.0),
        }

    return {
        "30d": cohort(30),
        "60d": cohort(60),
        "90d": cohort(90),
        "180d": cohort(180),
    }


@router.get("/funnel")
def funnel(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    business: Business = Depends(get_active_business),
):
    """Booking funnel for the last `days` days:
        created -> confirmed -> completed
    Cancellations and no-shows are reported separately so the owner
    sees both sides — completion rate alone hides whether problems are
    "owner rejected" vs "client never came".
    """
    today = local_today()
    start_d = today - timedelta(days=days)
    base = (
        db.query(Booking.status, func.count(Booking.id))
        .filter(
            Booking.business_id == business.id,
            Booking.date >= start_d,
            Booking.date <= today,
        )
        .group_by(Booking.status)
        .all()
    )
    counts = {str(status): int(cnt) for status, cnt in base}
    pending = counts.get("PENDING", 0)
    confirmed = counts.get("CONFIRMED", 0)
    completed = counts.get("COMPLETED", 0)
    cancelled = counts.get("CANCELLED", 0)
    no_show = counts.get("NO_SHOW", 0)
    created = pending + confirmed + completed + cancelled + no_show
    return {
        "created": created,
        "confirmed": confirmed + completed,
        "completed": completed,
        "cancelled": cancelled,
        "no_show": no_show,
        "completion_rate": round(completed / created, 3) if created else 0.0,
    }
