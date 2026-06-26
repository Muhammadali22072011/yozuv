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
from sqlalchemy import create_engine, event
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


# pysqlite manages transactions itself and emits BEGIN at the wrong time, which
# breaks SAVEPOINT-based test isolation (committed rows leak across tests). The
# documented fix: stop the driver from emitting BEGIN, and emit it ourselves.
@event.listens_for(engine, "connect")
def _sqlite_disable_autobegin(dbapi_connection, connection_record):
    dbapi_connection.isolation_level = None


@event.listens_for(engine, "begin")
def _sqlite_emit_begin(conn):
    conn.exec_driver_sql("BEGIN")


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    # Each test runs inside an outer transaction that is rolled back at
    # teardown, so committed rows never leak between tests. Endpoints under
    # test call session.commit(); join_transaction_mode="create_savepoint"
    # (SQLAlchemy 2.0) makes the session join the outer transaction via a
    # SAVEPOINT, so every commit is released only to that savepoint and the
    # outer rollback still wipes everything. Without it, a commit would reach
    # the real transaction and leak across tests.
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(
        bind=connection, join_transaction_mode="create_savepoint"
    )
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
