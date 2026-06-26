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


def test_set_password_with_phone_stores_in_phone_column(client, db, owner_user, auth_headers):
    # A phone-shaped login lands in `phone`, canonicalized to digits — never
    # in `username`, and the '+'/spacing is stripped.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "+998 90 123 45 67"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    db.refresh(owner_user)
    assert owner_user.phone == "998901234567"
    assert not owner_user.username


def test_login_by_phone_ignores_spacing(client, db):
    user = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        phone="998901234567",
        password_hash=hash_password("secret123"),
    )
    db.add(user)
    db.flush()

    resp = client.post(
        "/api/auth/login",
        # Same number, different spacing — canonicalization must match it.
        json={"login": "+998 90 123 45 67", "password": "secret123"},
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


def test_phone_canon_is_plus_stable_roundtrip(client, db, owner_user, auth_headers):
    # Store the phone WITHOUT '+', then log in WITH '+': both canonicalize to
    # the same digits, so the user is never locked out by the leading '+'.
    set_resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "998901112233"},
        headers=auth_headers,
    )
    assert set_resp.status_code == 200
    db.refresh(owner_user)
    assert owner_user.phone == "998901112233"

    login_resp = client.post(
        "/api/auth/login",
        json={"login": "+998 90 111 22 33", "password": "secret123"},
    )
    assert login_resp.status_code == 200


def test_set_password_rejects_phone_taken_by_another_account(client, db, owner_user, auth_headers):
    other = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        phone="998905556677",
        password_hash=hash_password("secret123"),
    )
    db.add(other)
    db.flush()

    # Same number with a '+' — canonicalization collapses it, so the clash
    # check must still reject it.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "+998 90 555 66 77"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    db.refresh(owner_user)
    assert not owner_user.phone


def test_set_password_never_clobbers_existing_username(client, db, owner_user, auth_headers):
    owner_user.username = "alice"
    db.flush()

    # Submitting a different login must NOT overwrite (and free) the handle.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "bob"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    db.refresh(owner_user)
    assert owner_user.username == "alice"


def test_set_password_requires_a_login_when_account_has_none(client, owner_user, auth_headers):
    # owner_user has neither username nor phone — a password with no login
    # would lock them out of standalone login, so it's rejected.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_set_password_rejects_unusable_login(client, owner_user, auth_headers):
    # "@@@" canonicalizes to an empty username — for an account with no login
    # on file that would set a password with no way to sign in. Reject it.
    resp = client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "@@@"},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_login_blank_ident_does_not_match_passwordless_default(client, db):
    # A user whose login is a phone (username left empty) must NOT be reachable
    # by a blank/whitespace login that canonicalizes to "".
    user = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        phone="+998900000000",
        password_hash=hash_password("secret123"),
    )
    db.add(user)
    db.flush()

    resp = client.post(
        "/api/auth/login",
        json={"login": "   ", "password": "secret123"},
    )
    assert resp.status_code == 401


def test_me_reports_has_password_flag(client, db, owner_user, auth_headers):
    before = client.get("/api/auth/me", headers=auth_headers)
    assert before.status_code == 200
    assert before.json()["has_password"] is False

    client.post(
        "/api/auth/set-password",
        json={"password": "secret123", "login": "haspwduser"},
        headers=auth_headers,
    )
    after = client.get("/api/auth/me", headers=auth_headers)
    assert after.json()["has_password"] is True
