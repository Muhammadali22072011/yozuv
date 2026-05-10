import hashlib
import hmac
import time
from urllib.parse import parse_qsl

# How long Telegram WebApp initData stays valid after the auth_date the
# WebApp embedded in it. Telegram's spec only says "should be checked
# against replay" without a fixed cap, so this is a policy choice. One
# hour is the sweet spot: long enough to survive a slow user typing in
# a multi-step flow, short enough that an initData scraped from a
# referrer header / log line / proxied request is useless by the time
# an attacker can replay it.
INIT_DATA_TTL_SECONDS = 3600


def validate_telegram_init_data(init_data: str, bot_token: str) -> dict[str, str]:
    """
    Проверка подписи Telegram WebApp initData.
    https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    parsed = dict(parse_qsl(init_data, keep_blank_values=True))
    hash_received = parsed.pop("hash", None)
    if not hash_received:
        raise ValueError("Missing hash")

    data_check_parts = [f"{k}={v}" for k, v in sorted(parsed.items())]
    data_check_string = "\n".join(data_check_parts)

    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, hash_received):
        raise ValueError("Invalid initData signature")

    auth_date_raw = parsed.get("auth_date")
    if not auth_date_raw:
        raise ValueError("Missing auth_date")
    try:
        auth_date = int(auth_date_raw)
    except ValueError:
        raise ValueError("Invalid auth_date")
    if time.time() - auth_date > INIT_DATA_TTL_SECONDS:
        raise ValueError("auth_date expired")

    return parsed


def parse_user_from_init(parsed: dict[str, str]) -> dict:
    import json

    user_raw = parsed.get("user")
    if not user_raw:
        raise ValueError("Missing user in initData")
    return json.loads(user_raw)
