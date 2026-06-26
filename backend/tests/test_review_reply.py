"""Owner reply to a review + public reviews list."""
import uuid

from app.models import Review


def test_owner_can_reply_and_public_list_shows_it(client, db, business_with_sub):
    biz = business_with_sub
    r = Review(id=uuid.uuid4(), business_id=biz.id, rating=5, comment="Zo'r joy")
    db.add(r)
    db.flush()

    from app.utils.auth import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(str(biz.owner_id))}"}
    resp = client.put(
        f"/api/business/me/reviews/{r.id}/reply",
        json={"reply": "Rahmat, yana kuting!"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["owner_reply"] == "Rahmat, yana kuting!"
    assert resp.json()["replied_at"] is not None

    pub = client.get(f"/api/business/{biz.slug}/reviews")
    assert pub.status_code == 200
    items = pub.json()
    assert len(items) == 1
    assert items[0]["owner_reply"] == "Rahmat, yana kuting!"
    assert items[0]["client_name"]  # only first name, no PII leak beyond that


def test_reply_other_business_404(client, db, business_with_sub):
    biz = business_with_sub
    r = Review(id=uuid.uuid4(), business_id=uuid.uuid4(), rating=4, comment="x")
    db.add(r)
    db.flush()
    from app.utils.auth import create_access_token

    headers = {"Authorization": f"Bearer {create_access_token(str(biz.owner_id))}"}
    resp = client.put(
        f"/api/business/me/reviews/{r.id}/reply",
        json={"reply": "hi"},
        headers=headers,
    )
    assert resp.status_code == 404
