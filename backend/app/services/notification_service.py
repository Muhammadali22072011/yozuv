"""Wrappers around the Telegram Bot HTTP API.

Two flavours of every send:

* ``send_telegram_message`` / ``send_telegram_photo`` — synchronous.
  Used from Celery tasks and from any other sync context (where
  switching to async would require a much larger refactor).

* ``send_telegram_message_async`` / ``send_telegram_photo_async`` —
  use these from FastAPI ``async def`` handlers and anywhere that
  fans out (e.g. admin broadcasts). The sync versions block the
  uvicorn event loop, so a 1k-recipient broadcast made with the sync
  version stalled the whole worker for tens of seconds.
"""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


# --- sync (Celery / worker thread callers) ---------------------------------


def send_telegram_message(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        resp = httpx.post(url, json=payload, timeout=15)
        if resp.status_code >= 400:
            logger.warning(
                "Telegram sendMessage non-2xx for chat_id=%s: %s %s",
                chat_id, resp.status_code, resp.text[:200],
            )
    except Exception:
        logger.exception("send_telegram_message failed for chat_id=%s", chat_id)


def send_telegram_photo(chat_id: int, photo_path: str, caption: str = "") -> None:
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"
    try:
        with open(photo_path, "rb") as f:
            files = {"photo": f}
            data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
            resp = httpx.post(url, data=data, files=files, timeout=30)
            if resp.status_code >= 400:
                logger.warning(
                    "Telegram sendPhoto non-2xx for chat_id=%s: %s %s",
                    chat_id, resp.status_code, resp.text[:200],
                )
    except Exception:
        logger.exception("send_telegram_photo failed for chat_id=%s", chat_id)


# --- async (FastAPI async handlers, broadcasts) ----------------------------


async def send_telegram_message_async(
    chat_id: int,
    text: str,
    reply_markup: dict | None = None,
    client: httpx.AsyncClient | None = None,
) -> None:
    """Async sendMessage. Pass a shared AsyncClient when looping (e.g. broadcasts)
    so connection pooling kicks in; one-off callers can omit it."""
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup

    async def _do(c: httpx.AsyncClient) -> None:
        # Unlike the sync fire-and-forget sender, this RAISES on failure so
        # fan-out callers (broadcasts) can count real successes vs failures.
        # Swallowing here made every recipient count as "sent" even on 403
        # (blocked bot), 429 (rate limited) or network errors.
        resp = await c.post(url, json=payload, timeout=15)
        if resp.status_code >= 400:
            logger.warning(
                "Telegram sendMessage non-2xx for chat_id=%s: %s %s",
                chat_id, resp.status_code, resp.text[:200],
            )
            resp.raise_for_status()

    if client is not None:
        await _do(client)
    else:
        async with httpx.AsyncClient() as c:
            await _do(c)


async def send_telegram_photo_async(
    chat_id: int, photo_path: str, caption: str = ""
) -> None:
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"
    try:
        # We open the file synchronously — the read itself happens off the
        # event loop because httpx will stream it as needed during the
        # request. For typical receipt screenshots (<8 MB) this is fine.
        with open(photo_path, "rb") as f:
            files = {"photo": f}
            data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
            async with httpx.AsyncClient() as c:
                resp = await c.post(url, data=data, files=files, timeout=30)
                if resp.status_code >= 400:
                    logger.warning(
                        "Telegram sendPhoto non-2xx for chat_id=%s: %s %s",
                        chat_id, resp.status_code, resp.text[:200],
                    )
    except Exception:
        logger.exception("send_telegram_photo_async failed for chat_id=%s", chat_id)
