"""Public storefront weekly-hours endpoint + server-computed open-now flag."""
from datetime import time

from app.models import HolidayDate, Schedule
from app.utils.clock import local_now, local_today


def _add_full_week(db, biz):
    """Every weekday working 00:00–23:59:59 so `open_now` is deterministically
    True regardless of the wall clock at test time."""
    for dow in range(7):
        db.add(
            Schedule(
                business_id=biz.id,
                day_of_week=dow,
                start_time=time(0, 0, 0),
                end_time=time(23, 59, 59),
                is_working=True,
            )
        )
    db.flush()


def test_public_hours_open_now(client, db, business_with_sub):
    biz = business_with_sub
    _add_full_week(db, biz)

    resp = client.get(f"/api/business/{biz.slug}/hours")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["days"]) == 7
    assert data["today"] == local_now().weekday()
    assert data["open_now"] is True
    assert data["is_holiday"] is False
    today_row = data["days"][data["today"]]
    assert today_row["is_working"] is True
    assert today_row["start_time"] == "00:00"


def test_public_hours_holiday_forces_closed(client, db, business_with_sub):
    biz = business_with_sub
    _add_full_week(db, biz)
    db.add(HolidayDate(business_id=biz.id, date=local_today(), reason="Bayram"))
    db.flush()

    data = client.get(f"/api/business/{biz.slug}/hours").json()
    assert data["is_holiday"] is True
    assert data["open_now"] is False


def test_public_hours_unknown_slug_404(client):
    assert client.get("/api/business/nope-not-real/hours").status_code == 404
