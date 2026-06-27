"""Unit tests for the bot 'fun' layer (pure copy/render helpers) and the
booking success-screen rendering that depends on it. No DB / network — these
guard the loyalty math, jackpot detection, milestone gating and HTML balance
so a future copy tweak can't silently break the celebratory moments."""

from datetime import date

from bot import fun
from bot.handlers import booking


# --- pick / determinism ----------------------------------------------------

def test_pick_seeded_is_stable():
    pool = ["a", "b", "c", "d"]
    assert fun.pick(pool, seed="booking-123") == fun.pick(pool, seed="booking-123")


def test_pick_empty_pool():
    assert fun.pick([]) == ""


# --- stamp bar -------------------------------------------------------------

def test_stamp_bar_basic():
    assert fun.stamp_bar(3, 5) == "🟢🟢🟢⚪⚪"


def test_stamp_bar_caps_width():
    bar = fun.stamp_bar(10, 20)
    assert len(bar) == 10  # capped at max_width, not 20 cells


def test_stamp_bar_clamps_overflow():
    assert fun.stamp_bar(99, 5) == "🟢🟢🟢🟢🟢"


# --- loyalty rendering -----------------------------------------------------

def test_loyalty_block_near_complete_promises_free():
    assert "BEPUL" in fun.loyalty_success_block(4, 5)


def test_loyalty_block_midway_counts_down():
    block = fun.loyalty_success_block(2, 5)
    assert "3" in block and "BEPUL" not in block


def test_loyalty_disabled_renders_nothing():
    assert fun.loyalty_success_block(0, 0) == ""
    assert fun.loyalty_service_hint(0, 0) == ""


# --- rating-aware thanks ---------------------------------------------------

def test_review_thanks_buckets():
    assert fun.review_thanks(5) in fun.REVIEW_THANKS_HIGH
    assert fun.review_thanks(4) in fun.REVIEW_THANKS_HIGH
    assert fun.review_thanks(3) in fun.REVIEW_THANKS_MID
    assert fun.review_thanks(1) in fun.REVIEW_THANKS_LOW


# --- milestones ------------------------------------------------------------

def test_milestone_only_on_round_numbers():
    assert fun.client_milestone(1) is not None
    assert fun.client_milestone(5) is not None
    assert fun.client_milestone(2) is None
    assert fun.client_milestone(7) is None
    assert fun.client_milestone(None) is None


# --- jackpot detection -----------------------------------------------------

def test_jackpot_true_only_on_explicit_loyalty_flag():
    assert booking._jackpot({"loyalty_free": True})


def test_jackpot_false_without_flag_even_if_price_is_zero():
    # A 100% promo/referral also zeroes the price — must NOT read as a loyalty
    # jackpot. Only the explicit loyalty_free flag counts.
    assert not booking._jackpot(
        {"payment_amount": 0, "service_price": 50000, "promo_code": "", "loyalty_free": False}
    )
    assert not booking._jackpot({"payment_amount": 0, "service_price": 50000})


def test_jackpot_false_when_paid():
    assert not booking._jackpot({"loyalty_free": False, "payment_amount": 50000})


# --- success-screen rendering ---------------------------------------------

def _info(**over):
    base = {
        "status": "BookingStatus.CONFIRMED",
        "service_name": "Soch olish",
        "business_name": "Barber Pro",
        "booking_id": "bk-1",
        "service_price": 50000,
        "payment_amount": 50000,
        "promo_code": "",
        "loyalty_done": None,
        "loyalty_total": None,
        "loyalty_free": False,
        "visit_no": 2,
    }
    base.update(over)
    return base


def test_success_text_plain_confirmed():
    text = booking._success_text(_info(), date(2026, 6, 28), "15:00")
    assert "Soch olish" in text
    assert "Barber Pro" in text
    # confirmed → a reminder line is appended
    assert any(r in text for r in fun.REMINDER_LINE)
    # ordinary visit, paid → no jackpot, no milestone
    assert not any(j in text for j in fun.JACKPOT_BANNER)


def test_success_text_shows_progress_card_when_not_free():
    # Paid visit with stamps in progress → loyalty card visible, no jackpot.
    text = booking._success_text(
        _info(loyalty_done=3, loyalty_total=5), date(2026, 6, 28), "15:00"
    )
    assert "Sovg'a kartangiz" in text
    assert not any(j in text for j in fun.JACKPOT_BANNER)


def test_success_text_jackpot_suppresses_contradictory_card():
    text = booking._success_text(
        _info(payment_amount=0, loyalty_free=True, loyalty_done=4, loyalty_total=5, visit_no=5),
        date(2026, 6, 28),
        "15:00",
    )
    assert any(j in text for j in fun.JACKPOT_BANNER)  # free visit banner
    assert "5-chi" in text  # 5th-visit milestone
    # The (N-1)/N "next is free" card must NOT show next to "this visit is free".
    assert "Sovg'a kartangiz" not in text


def test_success_text_pending_has_no_reminder():
    text = booking._success_text(
        _info(status="BookingStatus.PENDING"), date(2026, 6, 28), "15:00"
    )
    assert any(p in text for p in fun.SUCCESS_PENDING)
    assert not any(r in text for r in fun.REMINDER_LINE)
