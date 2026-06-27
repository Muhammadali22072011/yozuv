"""Owner new-booking alert respects the Sozlamalar → Bildirishnomalar
toggle (business.notifications_enabled, carried into the booking info
dict as owner_notifications_enabled)."""
import asyncio
from datetime import date
from unittest.mock import patch

from bot.handlers import booking as bk


class _FakeUser:
    first_name = "Ali"
    last_name = "Valiyev"
    username = "ali"


def _info(**over) -> dict:
    base = {
        "owner_telegram_id": 555,
        "owner_notifications_enabled": True,
        "status": "BookingStatus.CONFIRMED",
        "service_name": "Soch olish",
        "service_price": 50000,
        "payment_amount": 50000,
        "promo_code": "",
        "business_name": "Barber X",
    }
    base.update(over)
    return base


def _run_notify(info):
    with patch.object(bk, "send_telegram_message") as m:
        asyncio.run(
            bk._notify_owner_of_booking(info, date(2026, 4, 16), "10:00", _FakeUser())
        )
        return m


def test_owner_notified_when_enabled():
    m = _run_notify(_info(owner_notifications_enabled=True))
    m.assert_called_once()


def test_owner_not_notified_when_disabled():
    m = _run_notify(_info(owner_notifications_enabled=False))
    m.assert_not_called()


def test_owner_not_notified_without_chat_id():
    m = _run_notify(_info(owner_telegram_id=None))
    m.assert_not_called()


def test_missing_flag_defaults_to_enabled():
    info = _info()
    del info["owner_notifications_enabled"]
    m = _run_notify(info)
    m.assert_called_once()
