"""initial schema

Revision ID: 001
Revises:
Create Date: 2026-04-15

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("first_name", sa.String(length=255), nullable=False),
        sa.Column("last_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
    )
    op.create_index(op.f("ix_users_telegram_id"), "users", ["telegram_id"], unique=False)

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("first_name", sa.String(length=255), nullable=False),
        sa.Column("last_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_clients_telegram_id"), "clients", ["telegram_id"], unique=False)

    op.create_table(
        "businesses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=128), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("address", sa.String(length=512), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("logo_url", sa.String(length=1024), nullable=False),
        sa.Column("welcome_text", sa.Text(), nullable=False),
        sa.Column("after_booking_text", sa.Text(), nullable=False),
        sa.Column("reminder_text", sa.Text(), nullable=False),
        sa.Column("confirmation_mode", sa.String(length=32), nullable=False),
        sa.Column("language", sa.String(length=8), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("owner_id"),
        sa.UniqueConstraint("slug", name="uq_businesses_slug"),
    )
    op.create_index(op.f("ix_businesses_slug"), "businesses", ["slug"], unique=False)

    op.create_table(
        "holiday_dates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_holiday_dates_business_id"), "holiday_dates", ["business_id"], unique=False)
    op.create_index(op.f("ix_holiday_dates_date"), "holiday_dates", ["date"], unique=False)

    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=16), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("raw_payload", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_payment_transactions_business_id"), "payment_transactions", ["business_id"], unique=False)
    op.create_index(op.f("ix_payment_transactions_external_id"), "payment_transactions", ["external_id"], unique=False)

    op.create_table(
        "schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("break_start", sa.Time(), nullable=True),
        sa.Column("break_end", sa.Time(), nullable=True),
        sa.Column("is_working", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "day_of_week", name="uq_schedule_business_day"),
    )
    op.create_index(op.f("ix_schedules_business_id"), "schedules", ["business_id"], unique=False)

    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("price", sa.Integer(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_services_business_id"), "services", ["business_id"], unique=False)

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("amount_paid", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_subscriptions_business_id"), "subscriptions", ["business_id"], unique=False)

    op.create_table(
        "bookings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("cancel_reason", sa.String(length=512), nullable=True),
        sa.Column("payment_status", sa.String(length=32), nullable=False),
        sa.Column("payment_amount", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["service_id"], ["services.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bookings_business_id"), "bookings", ["business_id"], unique=False)
    op.create_index(op.f("ix_bookings_client_id"), "bookings", ["client_id"], unique=False)
    op.create_index(op.f("ix_bookings_date"), "bookings", ["date"], unique=False)
    op.create_index(op.f("ix_bookings_service_id"), "bookings", ["service_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_bookings_service_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_date"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_client_id"), table_name="bookings")
    op.drop_index(op.f("ix_bookings_business_id"), table_name="bookings")
    op.drop_table("bookings")
    op.drop_index(op.f("ix_subscriptions_business_id"), table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_index(op.f("ix_services_business_id"), table_name="services")
    op.drop_table("services")
    op.drop_index(op.f("ix_schedules_business_id"), table_name="schedules")
    op.drop_table("schedules")
    op.drop_index(op.f("ix_payment_transactions_external_id"), table_name="payment_transactions")
    op.drop_index(op.f("ix_payment_transactions_business_id"), table_name="payment_transactions")
    op.drop_table("payment_transactions")
    op.drop_index(op.f("ix_holiday_dates_date"), table_name="holiday_dates")
    op.drop_index(op.f("ix_holiday_dates_business_id"), table_name="holiday_dates")
    op.drop_table("holiday_dates")
    op.drop_index(op.f("ix_businesses_slug"), table_name="businesses")
    op.drop_table("businesses")
    op.drop_index(op.f("ix_clients_telegram_id"), table_name="clients")
    op.drop_table("clients")
    op.drop_index(op.f("ix_users_telegram_id"), table_name="users")
    op.drop_table("users")
