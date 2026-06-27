"""The client-facing booking confirmation text.

Covers that the owner's custom post-booking message (after_booking_text)
is appended to the receipt and HTML-escaped, and that a blank one is a
no-op so the default confirmation is unchanged.
"""
from datetime import date

from bot.handlers.booking import _success_text


def _info(**over) -> dict:
    base = {
        "status": "BookingStatus.CONFIRMED",
        "service_name": "Soch olish",
        "business_name": "Barber X",
        "after_booking_text": "",
    }
    base.update(over)
    return base


D = date(2026, 4, 16)


def test_confirmed_receipt_basics():
    out = _success_text(_info(), D, "10:00")
    assert "✅ Yozildingiz!" in out
    assert "Soch olish" in out
    assert "Barber X" in out


def test_pending_status_line():
    out = _success_text(_info(status="BookingStatus.PENDING"), D, "10:00")
    assert "So'rov yuborildi" in out
    assert "✅ Yozildingiz!" not in out


def test_after_booking_text_appended():
    out = _success_text(_info(after_booking_text="Naqd pul oling 💵"), D, "10:00")
    assert "Naqd pul oling 💵" in out


def test_after_booking_text_blank_is_noop():
    out = _success_text(_info(after_booking_text=""), D, "10:00")
    assert out.rstrip().endswith("eslatma yuboramiz")


def test_after_booking_text_is_html_escaped():
    # Owner free text must not inject HTML into Telegram's HTML parse mode.
    out = _success_text(_info(after_booking_text='<a href="http://x">click</a>'), D, "10:00")
    assert "<a href" not in out
    assert "&lt;a href" in out
