"""Telegram login keeps an auth_identities row in sync (identity migration)."""
import uuid

from app.models import AuthIdentity, AuthProvider, User
from app.routers.auth import _sync_telegram_identity


def test_sync_creates_then_updates(db):
    user = User(id=uuid.uuid4(), telegram_id=123123123, first_name="A")
    db.add(user)
    db.flush()

    _sync_telegram_identity(db, user, 123123123, "ali")
    rows = (
        db.query(AuthIdentity)
        .filter(
            AuthIdentity.provider == AuthProvider.TELEGRAM.value,
            AuthIdentity.subject == "123123123",
        )
        .all()
    )
    assert len(rows) == 1
    assert rows[0].user_id == user.id
    assert rows[0].display_name == "ali"

    # Second login: same single row, last_login_at refreshed (no duplicate).
    _sync_telegram_identity(db, user, 123123123, "ali2")
    rows = (
        db.query(AuthIdentity)
        .filter(AuthIdentity.subject == "123123123")
        .all()
    )
    assert len(rows) == 1
    assert rows[0].display_name == "ali2"
