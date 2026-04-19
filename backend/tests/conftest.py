"""
Shared pytest fixtures.

Uses an in-memory SQLite database so tests require no running Postgres.
FastAPI's TestClient is used for HTTP-level tests.
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Point settings at SQLite before importing anything from the app
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-32ch")
os.environ.setdefault("BOT_TOKEN", "0:test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("APP_ENV", "development")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Business, Subscription, User  # noqa: E402
from app.models.enums import SubscriptionPlan, SubscriptionStatus  # noqa: E402
from app.utils.auth import create_access_token  # noqa: E402

SQLITE_URL = "sqlite:///./test.db"
engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def owner_user(db):
    user = User(
        id=uuid.uuid4(),
        telegram_id=str(uuid.uuid4().int)[:15],
        first_name="Test",
        last_name="Owner",
    )
    db.add(user)
    db.flush()
    return user


@pytest.fixture()
def business_with_sub(db, owner_user):
    biz = Business(
        id=uuid.uuid4(),
        owner_id=owner_user.id,
        name="Test Barbershop",
        slug="test-barbershop",
        category="barbershop",
    )
    db.add(biz)
    db.flush()

    now = datetime.now(timezone.utc)
    from datetime import timedelta
    sub = Subscription(
        id=uuid.uuid4(),
        business_id=biz.id,
        plan=SubscriptionPlan.TRIAL,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=14),
        amount_paid=0,
    )
    db.add(sub)
    db.flush()
    return biz


@pytest.fixture()
def auth_headers(owner_user):
    token = create_access_token(str(owner_user.id))
    return {"Authorization": f"Bearer {token}"}
