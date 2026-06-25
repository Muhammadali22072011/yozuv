"""Auth integrity: case-insensitive username uniqueness + login lookup."""
import uuid

from app.models import User
from app.utils.auth import hash_password


def test_set_password_rejects_duplicate_username(client, db, owner_user, auth_headers):
    # Another account already owns the login "john".
    other = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        username="john",
        first_name="Other",
    )
    db.add(other)
    db.flush()

    # Caller tries to claim it with a different case — must be rejected.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "John"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    db.refresh(owner_user)
    assert not owner_user.username  # nothing assigned on rejection


def test_set_password_assigns_normalized_username(client, db, owner_user, auth_headers):
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "Alice"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    db.refresh(owner_user)
    assert owner_user.username == "alice"  # lowercased on store


def test_login_lookup_is_case_insensitive(client, db):
    user = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        username="john",
        password_hash=hash_password("secret123"),
    )
    db.add(user)
    db.flush()

    resp = client.post(
        "/api/auth/login",
        json={"login": "JOHN", "password": "secret123"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]
