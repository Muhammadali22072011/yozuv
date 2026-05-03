from io import BytesIO
from pathlib import Path

import qrcode
from PIL import Image
from qrcode.constants import ERROR_CORRECT_H
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import SolidFillColorMask
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer

# Brand colours that match the YzLogo gradient.
_FILL = (72, 83, 245)  # #4853F5 — indigo
_BG = (255, 255, 255)  # white card behind the QR

_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo.png"


def _logo_image() -> Image.Image | None:
    """Logo on a solid-white square plate for the QR centre. The white
    plate keeps scan reliability high because the data modules under it
    end up uniformly covered, not partially dimmed by transparent
    pixels."""
    if not _LOGO_PATH.exists():
        return None
    try:
        src = Image.open(_LOGO_PATH).convert("RGBA")
    except Exception:
        return None
    side = 220
    plate = Image.new("RGBA", (side, side), (255, 255, 255, 255))
    fitted = src.copy()
    fitted.thumbnail((side - 16, side - 16), Image.LANCZOS)
    x = (side - fitted.width) // 2
    y = (side - fitted.height) // 2
    plate.paste(fitted, (x, y), fitted)
    return plate


def generate_qr(business_slug: str, bot_username: str | None = None) -> bytes:
    username = bot_username or "YozuvBot"
    url = f"https://t.me/{username}?start={business_slug}"
    # ERROR_CORRECT_H tolerates ~30% damage — needed because we paint a
    # logo on top, which would otherwise corrupt the data modules.
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=14,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    logo = _logo_image()
    kwargs = dict(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(radius_ratio=0.85),
        color_mask=SolidFillColorMask(front_color=_FILL, back_color=_BG),
    )
    if logo is not None:
        kwargs["embeded_image"] = logo
    img = qr.make_image(**kwargs).convert("RGBA")

    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
