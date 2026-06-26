"""Owner -> clients broadcast."""
import uuid
from datetime import date, time

from app.models import Booking, BookingStatus, Client, Service
from app.utils.auth import create_access_token


def _seed_client_with_booking(db, biz, tg_id="555000111"):
    svc = Service(
        id=uuid.uuid4(),
        business_id=biz.id,
        name="Soch",
        price=50000,
        duration_minutes=30,
    )
    c = Client(id=uuid.uuid4(), telegram_id=tg_id, first_name="Olim")
    db.add_all([svc, c])
    db.flush()
    bk = Booking(
        id=uuid.uuid4(),
        business_id=biz.id,
        service_id=svc.id,
        client_id=c.id,
        date=date(2026, 7, 1),
        start_time=time(10, 0),
        end_time=time(10, 30),
        status=BookingStatus.CONFIRMED,
    )
    db.add(bk)
    db.flush()
    return c


def test_broadcast_targets_own_clients(client, db, business_with_sub):
    biz = business_with_sub
    _seed_client_with_booking(db, biz)
    headers = {"Authorization": f"Bearer {create_access_token(str(biz.owner_id))}"}
    r = client.post(
        "/api/business/me/broadcast",
        json={"text": "Ertaga yopiq"},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    # One distinct client targeted; send fails (no real Telegram) but is counted.
    assert data["recipients"] == 1
    assert data["sent"] + data["failed"] == 1


def test_broadcast_requires_auth(client):
    r = client.post("/api/business/me/broadcast", json={"text": "hi"})
    assert r.status_code in (401, 403)
