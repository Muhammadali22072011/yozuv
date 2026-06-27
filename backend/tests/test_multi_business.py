"""Multi-business ownership + billing.

Covers: a user owning several businesses, trial anti-farming, the
membership-aware active-business resolution (X-Business-Id), and the
volume-discounted bulk billing endpoints.
"""
import uuid

import pytest

from app.utils.auth import create_access_token


@pytest.fixture()
def headers(owner_user):
    token = create_access_token(str(owner_user.id))
    return {"Authorization": f"Bearer {token}"}


def _create(client, headers, name, slug, **extra):
    body = {"name": name, "slug": slug, "category": "barbershop", **extra}
    return client.post("/api/business", json=body, headers=headers)


def test_user_can_own_multiple_businesses(client, headers):
    r1 = _create(client, headers, "Salon One", "salon-one")
    assert r1.status_code == 200, r1.text
    r2 = _create(client, headers, "Salon Two", "salon-two")
    assert r2.status_code == 200, r2.text
    assert r1.json()["id"] != r2.json()["id"]


def test_second_business_gets_shorter_trial(client, headers, db):
    from app.models import Business, Subscription

    _create(client, headers, "First", "first-biz")
    _create(client, headers, "Second", "second-biz")

    def trial_days(slug):
        biz = db.query(Business).filter(Business.slug == slug).first()
        sub = (
            db.query(Subscription).filter(Subscription.business_id == biz.id).first()
        )
        return (sub.expires_at - sub.starts_at).days

    assert trial_days("first-biz") == 14
    assert trial_days("second-biz") == 7


def test_memberships_lists_all_owned(client, headers):
    _create(client, headers, "A", "biz-a")
    _create(client, headers, "B", "biz-b")
    r = client.get("/api/business/memberships", headers=headers)
    assert r.status_code == 200
    slugs = {row["slug"] for row in r.json()}
    assert {"biz-a", "biz-b"} <= slugs
    assert all(row["role"] == "OWNER" for row in r.json())


def test_active_business_header_selects_business(client, headers):
    a = _create(client, headers, "A", "biz-a").json()
    b = _create(client, headers, "B", "biz-b").json()

    # With the header → that exact business.
    r = client.get(
        "/api/business/me", headers={**headers, "X-Business-Id": b["id"]}
    )
    assert r.status_code == 200
    assert r.json()["id"] == b["id"]

    # Without the header → the primary (oldest) business.
    r = client.get("/api/business/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["id"] == a["id"]


def test_active_business_rejects_foreign_business(client, headers):
    _create(client, headers, "Mine", "mine-biz")
    r = client.get(
        "/api/business/me",
        headers={**headers, "X-Business-Id": str(uuid.uuid4())},
    )
    assert r.status_code == 403


def test_bulk_quote_applies_volume_discount(client, headers):
    r = client.get(
        "/api/subscription/quote",
        params={"plan": "MONTHLY", "count": 3},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    unit = data["unit_amount"]
    # 1.0 + 0.85 + 0.75 = 2.6 units, rounded to 100 so'm.
    assert data["total"] == round(unit * 2.6 / 100) * 100
    assert data["total_no_discount"] == unit * 3
    assert data["savings"] == data["total_no_discount"] - data["total"]


def test_bulk_upgrade_rejects_unowned_business(client, headers):
    owned = _create(client, headers, "Mine", "mine-biz").json()
    r = client.post(
        "/api/subscription/upgrade-bulk",
        json={
            "business_ids": [owned["id"], str(uuid.uuid4())],
            "plan": "MONTHLY",
            "provider": "payme",
        },
        headers=headers,
    )
    assert r.status_code == 403
