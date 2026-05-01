"""Shared bot helpers."""

from __future__ import annotations

import logging
from typing import Optional

from aiogram.exceptions import TelegramBadRequest
from aiogram.types import CallbackQuery, InlineKeyboardMarkup

logger = logging.getLogger(__name__)


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
