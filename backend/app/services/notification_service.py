import httpx

from app.config import get_settings

settings = get_settings()


def send_telegram_message(chat_id: int, text: str, reply_markup: dict | None = None) -> None:
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendMessage"
    payload: dict = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    try:
        httpx.post(url, json=payload, timeout=15)
    except Exception:
        pass


def send_telegram_photo(chat_id: int, photo_path: str, caption: str = "") -> None:
    if not settings.bot_token:
        return
    url = f"https://api.telegram.org/bot{settings.bot_token}/sendPhoto"
    try:
        with open(photo_path, "rb") as f:
            files = {"photo": f}
            data = {"chat_id": str(chat_id), "caption": caption, "parse_mode": "HTML"}
            httpx.post(url, data=data, files=files, timeout=30)
    except Exception:
        pass
