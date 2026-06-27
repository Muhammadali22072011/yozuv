from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import (
    Business,
    PaymentProvider,
    PaymentRecordStatus,
    PaymentTransaction,
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    User,
)
from app.services.notification_service import send_telegram_message

settings = get_settings()

MONTHLY_AMOUNT_UZS = 187_500
YEARLY_AMOUNT_UZS = 1_875_000


def get_plan_amount(db: Session, plan: SubscriptionPlan) -> int:
    """Resolve a plan price, preferring the admin-configured value.

    PlatformSettings stores 0 when a price hasn't been overridden, in
    which case we fall back to the historical code constants so pricing
    is never accidentally set to zero.
    """
    from app.models import PlatformSettings

    ps = db.query(PlatformSettings).filter(PlatformSettings.id == 1).first()
    if plan == SubscriptionPlan.MONTHLY:
        return int(ps.monthly_price) if ps and ps.monthly_price else MONTHLY_AMOUNT_UZS
    if plan == SubscriptionPlan.YEARLY:
        return int(ps.yearly_price) if ps and ps.yearly_price else YEARLY_AMOUNT_UZS
    return 0


# Volume discount for paying for several businesses in one checkout:
# 1st at full price, 2nd at -15%, 3rd and beyond at -25%. Rewards owners
# who run a network of branches without giving the whole platform away.
_BULK_FACTORS = (1.0, 0.85)
_BULK_FACTOR_REST = 0.75


def bulk_factor(position: int) -> float:
    """Discount multiplier for the business at 0-based `position` in a
    multi-business checkout."""
    if position < len(_BULK_FACTORS):
        return _BULK_FACTORS[position]
    return _BULK_FACTOR_REST


def compute_bulk_amount(db: Session, plan: SubscriptionPlan, count: int) -> int:
    """Discounted total for buying `plan` for `count` businesses at once,
    rounded to the nearest 100 so'm."""
    base = get_plan_amount(db, plan)
    total = sum(base * bulk_factor(i) for i in range(max(0, count)))
    return int(round(total / 100) * 100)


def tx_business_ids(tx: PaymentTransaction) -> list[UUID]:
    """Business ids a subscription tx pays for. A normal tx pays for its
    own business_id; a bulk tx stashes the full list in raw_payload as
    {"business_ids": [...]}. Always returns at least [tx.business_id]."""
    import json

    try:
        data = json.loads(tx.raw_payload or "")
        ids = data.get("business_ids") if isinstance(data, dict) else None
        if ids:
            out: list[UUID] = []
            for x in ids:
                try:
                    out.append(UUID(str(x)))
                except (ValueError, TypeError):
                    continue
            if out:
                return out
    except (ValueError, TypeError):
        pass
    return [tx.business_id]


def activate_subscription(db: Session, business_id: UUID, plan: SubscriptionPlan, amount_paid: int) -> Subscription:
    now = datetime.now(timezone.utc)
    if plan == SubscriptionPlan.MONTHLY:
        expires = now + timedelta(days=30)
    elif plan == SubscriptionPlan.YEARLY:
        expires = now + timedelta(days=365)
    else:
        expires = now + timedelta(days=14)

    # Lock the business row to serialize concurrent activations (e.g. webhook retries).
    db.query(Business).filter(Business.id == business_id).with_for_update().first()

    sub = (
        db.query(Subscription)
        .filter(Subscription.business_id == business_id, Subscription.status == SubscriptionStatus.ACTIVE)
        .order_by(Subscription.expires_at.desc())
        .with_for_update()
        .first()
    )
    if sub:
        sub.status = SubscriptionStatus.EXPIRED

    new_sub = Subscription(
        business_id=business_id,
        plan=plan,
        status=SubscriptionStatus.ACTIVE,
        starts_at=now,
        expires_at=expires,
        amount_paid=amount_paid,
    )
    db.add(new_sub)
    db.flush()
    return new_sub


def create_payme_payment(db: Session, business_id: UUID, plan: SubscriptionPlan) -> tuple[PaymentTransaction, str]:
    amount = get_plan_amount(db, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.PAYME,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
    )
    db.add(tx)
    db.flush()

    if not settings.payme_merchant_id or not settings.payme_secret_key:
        return tx, ""

    try:
        from paytechuz.gateways.payme import PaymeGateway

        payme = PaymeGateway(
            payme_id=settings.payme_merchant_id,
            payme_key=settings.payme_secret_key,
            is_test_mode=(settings.app_env != "production"),
        )
        link = payme.create_payment(
            id=str(tx.id),
            amount=amount,
            return_url=settings.public_app_url + "/dashboard/settings",
            account_field_name="id",
        )
        return tx, link
    except Exception:
        return tx, ""


def create_click_payment(db: Session, business_id: UUID, plan: SubscriptionPlan) -> tuple[PaymentTransaction, str]:
    amount = get_plan_amount(db, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.CLICK,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
    )
    db.add(tx)
    db.flush()

    if not all(
        [
            settings.click_service_id,
            settings.click_merchant_id,
            settings.click_merchant_user_id,
            settings.click_secret_key,
        ]
    ):
        return tx, ""

    try:
        from paytechuz.gateways.click import ClickGateway

        click = ClickGateway(
            service_id=settings.click_service_id,
            merchant_id=settings.click_merchant_id,
            merchant_user_id=settings.click_merchant_user_id,
            secret_key=settings.click_secret_key,
            is_test_mode=(settings.app_env != "production"),
        )
        link = click.create_payment(
            id=str(tx.id),
            amount=amount,
            description="Yozuv subscription",
            return_url=settings.public_app_url + "/dashboard/settings",
        )
        return tx, link
    except Exception:
        return tx, ""


def create_bulk_subscription_payment(
    db: Session,
    business_ids: list[UUID],
    plan: SubscriptionPlan,
    provider: PaymentProvider,
) -> tuple[PaymentTransaction, str]:
    """One checkout that pays the (volume-discounted) `plan` for several
    businesses. Creates a single PaymentTransaction whose amount is the
    discounted total and whose raw_payload carries the full id list, then
    builds the provider pay link. The webhook activates every listed
    business on completion (see complete_transaction_and_notify)."""
    import json

    if not business_ids:
        raise ValueError("No businesses selected")
    amount = compute_bulk_amount(db, plan, len(business_ids))
    primary = business_ids[0]
    tx = PaymentTransaction(
        business_id=primary,
        provider=provider,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
        raw_payload=json.dumps({"business_ids": [str(b) for b in business_ids]}),
    )
    db.add(tx)
    db.flush()

    return_url = settings.public_app_url + "/dashboard/settings"
    try:
        if provider == PaymentProvider.PAYME:
            if not settings.payme_merchant_id or not settings.payme_secret_key:
                return tx, ""
            from paytechuz.gateways.payme import PaymeGateway

            payme = PaymeGateway(
                payme_id=settings.payme_merchant_id,
                payme_key=settings.payme_secret_key,
                is_test_mode=(settings.app_env != "production"),
            )
            link = payme.create_payment(
                id=str(tx.id),
                amount=amount,
                return_url=return_url,
                account_field_name="id",
            )
            return tx, link
        if provider == PaymentProvider.CLICK:
            if not all(
                [
                    settings.click_service_id,
                    settings.click_merchant_id,
                    settings.click_merchant_user_id,
                    settings.click_secret_key,
                ]
            ):
                return tx, ""
            from paytechuz.gateways.click import ClickGateway

            click = ClickGateway(
                service_id=settings.click_service_id,
                merchant_id=settings.click_merchant_id,
                merchant_user_id=settings.click_merchant_user_id,
                secret_key=settings.click_secret_key,
                is_test_mode=(settings.app_env != "production"),
            )
            link = click.create_payment(
                id=str(tx.id),
                amount=amount,
                description="Yozuv subscription (bulk)",
                return_url=return_url,
            )
            return tx, link
    except Exception:
        return tx, ""
    return tx, ""


def create_card_payment(
    db: Session, business_id: UUID, plan: SubscriptionPlan
) -> PaymentTransaction:
    amount = get_plan_amount(db, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.CARD,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
    )
    db.add(tx)
    db.flush()
    return tx


# Share of the service price taken as a deposit to hold the slot.
DEPOSIT_PERCENT = 30


def compute_deposit(price: int) -> int:
    """30% of the price, floored at 1000 so'm and rounded to the nearest 100."""
    raw = max(1000, round(int(price or 0) * DEPOSIT_PERCENT / 100))
    return int(round(raw / 100) * 100)


def create_booking_deposit(
    db: Session, booking, provider: PaymentProvider
) -> tuple[PaymentTransaction, str]:
    """Mint a deposit PaymentTransaction for a booking + a paytechuz pay link.
    The webhook flips the booking to CONFIRMED once the deposit is paid."""
    amount = compute_deposit(int(getattr(booking, "payment_amount", 0) or 0))
    tx = PaymentTransaction(
        business_id=booking.business_id,
        provider=provider,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        kind="deposit",
        booking_id=booking.id,
    )
    db.add(tx)
    db.flush()

    return_url = settings.public_app_url + "/dashboard/bookings"
    try:
        if provider == PaymentProvider.PAYME:
            if not settings.payme_merchant_id or not settings.payme_secret_key:
                return tx, ""
            from paytechuz.gateways.payme import PaymeGateway

            payme = PaymeGateway(
                payme_id=settings.payme_merchant_id,
                payme_key=settings.payme_secret_key,
                is_test_mode=(settings.app_env != "production"),
            )
            link = payme.create_payment(
                id=str(tx.id),
                amount=amount,
                return_url=return_url,
                account_field_name="id",
            )
            return tx, link
        if provider == PaymentProvider.CLICK:
            if not all(
                [
                    settings.click_service_id,
                    settings.click_merchant_id,
                    settings.click_merchant_user_id,
                    settings.click_secret_key,
                ]
            ):
                return tx, ""
            from paytechuz.gateways.click import ClickGateway

            click = ClickGateway(
                service_id=settings.click_service_id,
                merchant_id=settings.click_merchant_id,
                merchant_user_id=settings.click_merchant_user_id,
                secret_key=settings.click_secret_key,
                is_test_mode=(settings.app_env != "production"),
            )
            link = click.create_payment(
                id=str(tx.id),
                amount=amount,
                description="Yozuv deposit",
                return_url=return_url,
            )
            return tx, link
    except Exception:
        return tx, ""
    return tx, ""


def complete_booking_deposit(db: Session, tx: PaymentTransaction) -> None:
    """Mark a deposit tx COMPLETED and CONFIRM its booking. Idempotent — a
    webhook retry on an already-completed tx is a no-op."""
    from app.models import Booking, BookingStatus, PaymentStatus

    if tx.status == PaymentRecordStatus.COMPLETED:
        return
    tx.status = PaymentRecordStatus.COMPLETED
    if tx.booking_id:
        booking = (
            db.query(Booking)
            .filter(Booking.id == tx.booking_id)
            .with_for_update()
            .first()
        )
        if booking and booking.status != BookingStatus.CANCELLED:
            booking.status = BookingStatus.CONFIRMED
            booking.payment_status = PaymentStatus.PAID


def approve_card_payment(
    db: Session, tx_id: UUID, admin_telegram_id: str
) -> PaymentTransaction:
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
    if not tx:
        raise ValueError("Transaction not found")
    if tx.provider != PaymentProvider.CARD:
        raise ValueError("Only card payments can be approved manually")
    if tx.status == PaymentRecordStatus.COMPLETED:
        return tx
    if tx.status not in (
        PaymentRecordStatus.AWAITING_APPROVAL,
        PaymentRecordStatus.PENDING,
    ):
        raise ValueError(f"Cannot approve transaction in status '{tx.status}'")

    tx.reviewed_by = admin_telegram_id
    tx.reviewed_at = datetime.now(timezone.utc)
    complete_transaction_and_notify(db, tx)
    return tx


def reject_card_payment(
    db: Session, tx_id: UUID, admin_telegram_id: str, reason: str = ""
) -> PaymentTransaction:
    tx = db.query(PaymentTransaction).filter(PaymentTransaction.id == tx_id).first()
    if not tx:
        raise ValueError("Transaction not found")
    if tx.provider != PaymentProvider.CARD:
        raise ValueError("Only card payments can be rejected manually")
    if tx.status == PaymentRecordStatus.COMPLETED:
        raise ValueError("Transaction already completed")

    tx.status = PaymentRecordStatus.REJECTED
    tx.reviewed_by = admin_telegram_id
    tx.reviewed_at = datetime.now(timezone.utc)

    business = db.query(Business).filter(Business.id == tx.business_id).first()
    owner = db.query(User).filter(User.id == business.owner_id).first() if business else None
    if owner and owner.telegram_id:
        msg = "❌ To'lovingiz tasdiqlanmadi."
        if reason:
            msg += f"\nSabab: {reason}"
        try:
            send_telegram_message(int(owner.telegram_id), msg)
        except Exception:
            pass
    db.flush()
    return tx


def complete_transaction_and_notify(db: Session, tx: PaymentTransaction) -> None:
    tx.status = PaymentRecordStatus.COMPLETED
    if tx.plan == "YEARLY":
        plan = SubscriptionPlan.YEARLY
    else:
        plan = SubscriptionPlan.MONTHLY
    # One tx may cover several businesses (multi-business checkout). Activate
    # each; split the recorded amount evenly for the per-sub bookkeeping.
    business_ids = tx_business_ids(tx)
    per_amount = int(tx.amount // len(business_ids)) if business_ids else tx.amount
    for bid in business_ids:
        activate_subscription(db, bid, plan, per_amount)

    business = db.query(Business).filter(Business.id == tx.business_id).first()
    owner = db.query(User).filter(User.id == business.owner_id).first() if business else None
    # telegram_id is nullable (Google/password-only owners). Never let a
    # missing/None id or a failed notification abort the activation commit.
    if owner and owner.telegram_id:
        msg = (
            "✅ To'lov qabul qilindi. Obunangiz 30 kunga faollashtirildi."
            if plan == SubscriptionPlan.MONTHLY
            else "✅ To'lov qabul qilindi. Yillik obuna faollashtirildi."
        )
        try:
            send_telegram_message(int(owner.telegram_id), msg)
        except Exception:
            pass


def refund_transaction(db: Session, tx_id: UUID, business_id: UUID) -> PaymentTransaction:
    """
    Mark a completed transaction as REFUNDED and cancel the linked subscription.
    Raises ValueError if transaction is not found, belongs to another business,
    or is not in COMPLETED state.
    """
    # Lock the tx row and re-check status under the lock, mirroring
    # activate_subscription. Without this a webhook retry (activate) and a
    # manual refund can interleave: the refund reads a stale ACTIVE sub,
    # activation swaps it, and the refund then cancels the wrong row.
    tx = (
        db.query(PaymentTransaction)
        .filter(PaymentTransaction.id == tx_id)
        .with_for_update()
        .first()
    )
    if not tx:
        raise ValueError("Transaction not found")
    if tx.business_id != business_id:
        raise ValueError("Transaction does not belong to this business")
    if tx.status != PaymentRecordStatus.COMPLETED:
        raise ValueError(f"Cannot refund a transaction with status '{tx.status}'")

    tx.status = PaymentRecordStatus.REFUNDED

    # Cancel the currently active subscription for this business
    now = datetime.now(timezone.utc)
    active_sub = (
        db.query(Subscription)
        .filter(
            Subscription.business_id == business_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expires_at > now,
        )
        .order_by(Subscription.expires_at.desc())
        .with_for_update()
        .first()
    )
    if active_sub:
        active_sub.status = SubscriptionStatus.CANCELLED

    # Notify owner
    business = db.query(Business).filter(Business.id == business_id).first()
    owner = db.query(User).filter(User.id == business.owner_id).first() if business else None
    if owner and owner.telegram_id:
        try:
            send_telegram_message(
                int(owner.telegram_id),
                f"♻️ To'lovingiz ({tx.amount:,} so'm) qaytarildi. Obunangiz bekor qilindi.",
            )
        except Exception:
            pass

    db.flush()
    return tx
