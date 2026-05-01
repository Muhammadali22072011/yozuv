import logging

import httpx

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


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
