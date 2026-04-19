from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Booking, Business, Client, Review

router = APIRouter(tags=["reviews"])


class ReviewCreate(BaseModel):
    booking_id: UUID
    rating: int = Field(..., ge=1, le=5)
    comment: str = ""
    client_telegram_id: int | None = None


class ReviewOut(BaseModel):
    id: str
    booking_id: str
    rating: int
    comment: str
    client_name: str
    created_at: str


@router.post("/reviews", response_model=ReviewOut)
def submit_review(body: ReviewCreate, db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == body.booking_id).first()
    if not booking:
        raise HTTPException(404, "Booking not found")

    # Ensure client owns the booking (match by telegram id)
    if body.client_telegram_id and booking.client_id:
        client = db.query(Client).filter(Client.id == booking.client_id).first()
        if not client or int(client.telegram_id or 0) != int(body.client_telegram_id):
            raise HTTPException(403, "Not your booking")

    existing = db.query(Review).filter(Review.booking_id == booking.id).first()
    if existing:
        existing.rating = body.rating
        existing.comment = body.comment.strip()[:2000]
        db.commit()
        db.refresh(existing)
        review = existing
    else:
        review = Review(
            business_id=booking.business_id,
            booking_id=booking.id,
            client_id=booking.client_id,
            rating=body.rating,
            comment=body.comment.strip()[:2000],
        )
        db.add(review)
        db.commit()
        db.refresh(review)

    client_name = "Mijoz"
    if review.client_id:
        c = db.query(Client).filter(Client.id == review.client_id).first()
        if c:
            client_name = f"{c.first_name or ''} {c.last_name or ''}".strip() or "Mijoz"
    return ReviewOut(
        id=str(review.id),
        booking_id=str(review.booking_id),
        rating=review.rating,
        comment=review.comment,
        client_name=client_name,
        created_at=review.created_at.isoformat() if review.created_at else "",
    )


@router.get("/business/me/reviews", response_model=list[ReviewOut])
def list_reviews(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = (
        db.query(Review)
        .filter(Review.business_id == business.id)
        .order_by(Review.created_at.desc())
        .limit(200)
        .all()
    )
    out: list[ReviewOut] = []
    for r in rows:
        name = "Mijoz"
        if r.client_id:
            c = db.query(Client).filter(Client.id == r.client_id).first()
            if c:
                name = f"{c.first_name or ''} {c.last_name or ''}".strip() or "Mijoz"
        out.append(
            ReviewOut(
                id=str(r.id),
                booking_id=str(r.booking_id),
                rating=r.rating,
                comment=r.comment,
                client_name=name,
                created_at=r.created_at.isoformat() if r.created_at else "",
            )
        )
    return out


@router.get("/business/me/reviews/summary")
def reviews_summary(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    avg = (
        db.query(func.avg(Review.rating))
        .filter(Review.business_id == business.id)
        .scalar()
    )
    cnt = (
        db.query(func.count(Review.id))
        .filter(Review.business_id == business.id)
        .scalar()
    )
    return {"average_rating": round(float(avg or 0), 2), "count": int(cnt or 0)}
