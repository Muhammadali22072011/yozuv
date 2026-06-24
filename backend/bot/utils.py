"""Shared bot helpers."""

from __future__ import annotations

import logging
from typing import Optional

from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardMarkup
from sqlalchemy.orm import Session

from app.models import Booking, BookingStatus, Client
from app.utils.clock import local_today

logger = logging.getLogger(__name__)


def user_can_review(db: Session, business_id, telegram_id: int | None) -> bool:
    """True if this telegram user has a past COMPLETED booking with the
    business — the eligibility gate for leaving a review. Without it any
    user could open any business deep-link and post fake ratings, which
    feed the public sort/average shown in discovery."""
    if not telegram_id:
        return False
    client = db.query(Client).filter(Client.telegram_id == telegram_id).first()
    if not client:
        return False
    exists = (
        db.query(Booking.id)
        .filter(
            Booking.client_id == client.id,
            Booking.business_id == business_id,
            Booking.status == BookingStatus.COMPLETED,
            Booking.date <= local_today(),
        )
        .first()
    )
    return exists is not None


async def safe_edit_text(
    cb: CallbackQuery,
    text: str,
    reply_markup: Optional[InlineKeyboardMarkup] = None,
) -> None:
    """Edit message text, swallowing the harmless 'message is not modified' error.

    Telegram raises TelegramBadRequest when the new text+markup match the current
    ones — happens when a user taps the same nav button twice or a 'back' button
    that lands on the same screen. We treat it as a no-op so the user doesn't see
    a phantom error.
    """
    try:
        await cb.message.edit_text(text, reply_markup=reply_markup)
    except TelegramBadRequest as e:
        if "message is not modified" in str(e).lower():
            return
        logger.exception("safe_edit_text failed: %s", e)
        raise
