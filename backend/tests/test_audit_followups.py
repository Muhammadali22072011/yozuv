"""Follow-up audit features: server-side onboarding flag, first-party event
sink, and the public register-QR for web guests."""
from app.utils.auth import create_access_token


def _headers(biz):
    return {"Authorization": f"Bearer {create_access_token(str(biz.owner_id))}"}


def test_mark_onboarding_seen_persists_and_reflects(client, db, business_with_sub):
    biz = business_with_sub
    assert biz.onboarding_seen is False

    r = client.put("/api/business/me/onboarding-seen", headers=_headers(biz))
    assert r.status_code == 200
    assert r.json() == {"ok": True}

    db.refresh(biz)
    assert biz.onboarding_seen is True

    me = client.get("/api/business/me", headers=_headers(biz)).json()
    assert me["onboarding_seen"] is True


def test_onboarding_seen_requires_auth(client):
    assert client.put("/api/business/me/onboarding-seen").status_code in (401, 403)


def test_events_sink_returns_204(client):
    r = client.post(
        "/api/events",
        json={"event": "cta_click", "props": {"where": "hero"}, "path": "/"},
    )
    assert r.status_code == 204


def test_events_sink_tolerates_garbage_body(client):
    r = client.post("/api/events", data="not json", headers={"Content-Type": "text/plain"})
    assert r.status_code == 204


def test_register_qr_returns_png(client):
    r = client.get("/api/auth/register-qr")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
