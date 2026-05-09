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
