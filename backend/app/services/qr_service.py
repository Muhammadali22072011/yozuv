from functools import lru_cache
from io import BytesIO
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw
from qrcode.constants import ERROR_CORRECT_H

# Brand colours that match the YzLogo gradient.
_FILL = (72, 83, 245)  # #4853F5 — indigo
_BG = (255, 255, 255)  # white

_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo.png"


@lru_cache(maxsize=1)
def _logo_plate(side: int = 220) -> Image.Image | None:
    """Logo on a solid-white square plate. Loaded from disk once and
    cached for the lifetime of the process — the file never changes."""
    if not _LOGO_PATH.exists():
        return None
    try:
        src = Image.open(_LOGO_PATH).convert("RGBA")
    except Exception:
        return None
    plate = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    fitted = src.copy()
    fitted.thumbnail((side - 16, side - 16), Image.LANCZOS)
    x = (side - fitted.width) // 2
    y = (side - fitted.height) // 2
    plate.paste(fitted, (x, y), fitted)
    return plate


def _render_qr(url: str) -> Image.Image:
    """Hand-rolled rounded-module renderer. The qrcode library's
    StyledPilImage was taking 2-7 seconds per QR; PIL primitives bring
    that down to ~25ms with the same look."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=0,
    )
    qr.add_data(url)
    qr.make(fit=True)
    matrix = qr.get_matrix()
    n = len(matrix)

    box = 14
    border_modules = 2
    side_px = (n + border_modules * 2) * box
    img = Image.new("RGB", (side_px, side_px), _BG)
    draw = ImageDraw.Draw(img)
    radius = int(box * 0.42)
    for r, row in enumerate(matrix):
        for col, on in enumerate(row):
            if not on:
                continue
            x0 = (col + border_modules) * box
            y0 = (r + border_modules) * box
            draw.rounded_rectangle(
                (x0, y0, x0 + box - 1, y0 + box - 1),
                radius=radius,
                fill=_FILL,
            )

    logo = _logo_plate()
    if logo is not None:
        # Embed area is ~22% of the QR side — well within H-level
        # error-correction tolerance.
        embed_side = int(side_px * 0.22)
        scaled = logo.resize((embed_side, embed_side), Image.LANCZOS)
        ox = (side_px - embed_side) // 2
        oy = (side_px - embed_side) // 2
        img.paste(scaled, (ox, oy), scaled)
    return img


@lru_cache(maxsize=512)
def _generate_qr_cached(business_slug: str, bot_username: str) -> bytes:
    # Mini App deep link (?startapp=) so scanning opens the in-Telegram booking
    # app, matching the storefront/brochure CTAs — not the plain ?start= bot.
    url = f"https://t.me/{bot_username}?startapp={business_slug}"
    img = _render_qr(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def generate_qr(business_slug: str, bot_username: str | None = None) -> bytes:
    return _generate_qr_cached(business_slug, bot_username or "Yozuv_cl_bot")


@lru_cache(maxsize=64)
def generate_url_qr(url: str) -> bytes:
    """QR PNG for an arbitrary URL — e.g. the bot register deep link shown to
    a guest on the web login page so a desktop visitor can start from their
    phone. Cached per-URL (callers pass stable links)."""
    img = _render_qr(url)
    buffer = BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()
