"""B2B partner-program summary endpoint (GET /business/me/referrals).

Backs the dashboard ReferralCard: who joined via this business's partner_code
and how many free days that earned. An invitee counts as 'subscribed' once
partner_reward_claimed flips (set on their first paid subscription).
"""
import pytest

from app.utils.auth import create_access_token


@pytest.fixture()
def headers(owner_user):
    token = create_access_token(str(owner_user.id))
    return {"Authorization": f"Bearer {token}"}


def _create(client, headers, name, slug, **extra):
    body = {"name": name, "slug": slug, "category": "barbershop", **extra}
    return client.post("/api/business", json=body, headers=headers)


def test_referrals_lists_invited_business(client, headers):
    inviter = _create(client, headers, "Inviter", "inviter-biz").json()
    code = inviter["partner_code"]
    assert code

    _create(client, headers, "Friend", "friend-biz", ref=code)

    r = client.get(
        "/api/business/me/referrals",
        headers={**headers, "X-Business-Id": inviter["id"]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["code"] == code
    assert data["invited"] == 1
    assert data["subscribed"] == 0
    assert data["days_earned"] == 0
    assert [i["name"] for i in data["invitees"]] == ["Friend"]
    assert data["invitees"][0]["subscribed"] is False


def test_referrals_counts_subscribed_invitee(client, headers, db):
    from app.models import Business

    inviter = _create(client, headers, "Inviter2", "inviter2-biz").json()
    code = inviter["partner_code"]
    _create(client, headers, "Paid Friend", "paid-friend", ref=code)

    friend = db.query(Business).filter(Business.slug == "paid-friend").first()
    friend.partner_reward_claimed = True
    db.commit()

    r = client.get(
        "/api/business/me/referrals",
        headers={**headers, "X-Business-Id": inviter["id"]},
    )
    data = r.json()
    assert data["invited"] == 1
    assert data["subscribed"] == 1
    assert data["days_earned"] == 30
    assert data["invitees"][0]["subscribed"] is True


def test_referrals_empty_for_organic_business(client, headers):
    biz = _create(client, headers, "Organic", "organic-biz").json()
    r = client.get(
        "/api/business/me/referrals",
        headers={**headers, "X-Business-Id": biz["id"]},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["invited"] == 0
    assert data["invitees"] == []
