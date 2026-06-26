"""Business logo bytes survive in the DB blob store (not ephemeral disk).

Regression for the Render /tmp wipe that turned every uploaded logo into a
404. Upload → public fetch returns the exact bytes → delete → 404.
"""

import base64

# Minimal valid 1x1 PNG.
PNG = base64.b64decode(
    b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def test_logo_upload_fetch_delete(client, business_with_sub, auth_headers):
    res = client.post(
        "/api/business/me/logo",
        headers=auth_headers,
        files={"file": ("logo.png", PNG, "image/png")},
    )
    assert res.status_code == 200, res.text
    url = res.json()["logo_url"]
    assert url.startswith("/api/business/logos/")

    # Public fetch returns the exact bytes we stored.
    got = client.get(url)
    assert got.status_code == 200
    assert got.headers["content-type"].startswith("image/png")
    assert got.content == PNG

    # Delete clears the url and the blob.
    deleted = client.delete("/api/business/me/logo", headers=auth_headers)
    assert deleted.status_code == 200
    assert deleted.json()["logo_url"] == ""
    assert client.get(url).status_code == 404


def test_get_missing_logo_is_404(client):
    assert client.get("/api/business/logos/deadbeef.jpg").status_code == 404
