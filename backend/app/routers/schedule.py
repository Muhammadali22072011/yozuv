from datetime import date, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_owned_business
from app.models import Business, HolidayDate, Schedule

router = APIRouter(prefix="/business/me", tags=["schedule"])


class ScheduleItem(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    break_start: time | None = None
    break_end: time | None = None
    is_working: bool = True


class SchedulePut(BaseModel):
    days: list[ScheduleItem]


class HolidayCreate(BaseModel):
    date: date
    reason: str = ""


class HolidayOut(BaseModel):
    id: UUID
    date: date
    reason: str

    class Config:
        from_attributes = True


@router.get("/schedule", response_model=list[ScheduleItem])
def get_schedule(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    rows = db.query(Schedule).filter(Schedule.business_id == business.id).all()
    return [
        ScheduleItem(
            day_of_week=r.day_of_week,
            start_time=r.start_time,
            end_time=r.end_time,
            break_start=r.break_start,
            break_end=r.break_end,
            is_working=r.is_working,
        )
        for r in rows
    ]


@router.put("/schedule")
def put_schedule(
    body: SchedulePut,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    db.query(Schedule).filter(Schedule.business_id == business.id).delete()
    for d in body.days:
        db.add(
            Schedule(
                business_id=business.id,
                day_of_week=d.day_of_week,
                start_time=d.start_time,
                end_time=d.end_time,
                break_start=d.break_start,
                break_end=d.break_end,
                is_working=d.is_working,
            )
        )
    db.commit()
    return {"ok": True}


@router.post("/holidays", response_model=HolidayOut)
def add_holiday(
    body: HolidayCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    h = HolidayDate(business_id=business.id, date=body.date, reason=body.reason)
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: UUID,
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    h = db.query(HolidayDate).filter(HolidayDate.id == holiday_id, HolidayDate.business_id == business.id).first()
    if not h:
        raise HTTPException(404, "Not found")
    db.delete(h)
    db.commit()
    return {"ok": True}
