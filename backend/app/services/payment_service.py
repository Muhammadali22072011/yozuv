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
from app.services import partner_referral_service
from app.services.notification_service import send_telegram_message

settings = get_settings()

MONTHLY_AMOUNT_UZS = 187_500
YEARLY_AMOUNT_UZS = 1_875_000


def _base_amount(plan: SubscriptionPlan) -> int:
    return MONTHLY_AMOUNT_UZS if plan == SubscriptionPlan.MONTHLY else YEARLY_AMOUNT_UZS


def _discounted_amount(db: Session, business_id: UUID, plan: SubscriptionPlan) -> tuple[int, int]:
    """Apply any partner-referral discount the business has earned. Returns
    (amount_to_charge, partner_discount_percent_applied)."""
    base = _base_amount(plan)
    business = db.query(Business).filter(Business.id == business_id).first()
    pct = int(getattr(business, "pending_partner_discount_percent", 0) or 0) if business else 0
    pct = max(0, min(100, pct))
    amount = base - base * pct // 100 if pct else base
    return amount, pct


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
    amount, partner_pct = _discounted_amount(db, business_id, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.PAYME,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
        partner_discount_percent=partner_pct,
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
    amount, partner_pct = _discounted_amount(db, business_id, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.CLICK,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
        partner_discount_percent=partner_pct,
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


def create_card_payment(
    db: Session, business_id: UUID, plan: SubscriptionPlan
) -> PaymentTransaction:
    amount, partner_pct = _discounted_amount(db, business_id, plan)
    tx = PaymentTransaction(
        business_id=business_id,
        provider=PaymentProvider.CARD,
        amount=amount,
        status=PaymentRecordStatus.PENDING,
        plan=plan.value,
        partner_discount_percent=partner_pct,
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
    activate_subscription(db, tx.business_id, plan, tx.amount)

    business = db.query(Business).filter(Business.id == tx.business_id).first()
    owner = db.query(User).filter(User.id == business.owner_id).first() if business else None
    if owner and owner.telegram_id:
        msg = (
            "✅ To'lov qabul qilindi. Obunangiz 30 kunga faollashtirildi."
            if plan == SubscriptionPlan.MONTHLY
            else "✅ To'lov qabul qilindi. Yillik obuna faollashtirildi."
        )
        send_telegram_message(int(owner.telegram_id), msg)

    # Partner (B2B) referral: if this is the referred business's first paid
    # subscription, reward its referrer; and spend any partner discount this
    # very payment used.
    if business is not None:
        reward = partner_referral_service.grant_reward_if_referred(db, business)
        if int(getattr(tx, "partner_discount_percent", 0) or 0) > 0:
            partner_referral_service.consume_discount(
                db, business, int(tx.partner_discount_percent or 0)
            )
        if reward and reward.get("referrer_owner_telegram"):
            try:
                send_telegram_message(
                    reward["referrer_owner_telegram"],
                    f"🎉 Siz taklif qilgan biznes «{reward['referred_name']}» to'lov qildi!\n"
                    f"Keyingi obunangizga -{reward['reward_percent']}% chegirma berildi.",
                )
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
    if owner:
        send_telegram_message(
            int(owner.telegram_id),
            f"♻️ To'lovingiz ({tx.amount:,} so'm) qaytarildi. Obunangiz bekor qilindi.",
        )

    db.flush()
    return tx
