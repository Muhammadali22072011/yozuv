from io import BytesIO

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.models import Business, Service


BLACK = HexColor("#080808")
BLUE = HexColor("#005AFF")
CREAM = HexColor("#F2EFE8")
WHITE_BG = HexColor("#FAFAF7")
GRAY = HexColor("#6B6B6B")
SUBTLE = HexColor("#CCCCCC")
LIGHT_GRAY = HexColor("#888888")


CATEGORY_LABEL_UZ = {
    "barbershop": "Sartaroshxona",
    "salon": "Go'zallik saloni",
    "dentist": "Stomatologiya",
    "tutor": "Repetitor",
    "photo": "Fotograf",
    "massage": "Massaj / Spa",
    "fitness": "Fitnes / Trener",
    "clinic": "Shifokor / Klinika",
    "other": "Biznes",
}


def _category_text(category) -> str:
    raw = getattr(category, "value", category)
    return CATEGORY_LABEL_UZ.get(str(raw).lower(), "Biznes")


def _fit_font_size(canv: canvas.Canvas, text: str, font: str, desired: int, max_width: float) -> int:
    size = desired
    while size > 10 and canv.stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def _format_price(value: int) -> str:
    return f"{value:,}".replace(",", " ") + " so'm"


def build_brochure_pdf(
    business: Business,
    services: list[Service],
    qr_png_bytes: bytes,
    bot_username: str = "YozuvBot",
) -> bytes:
    buffer = BytesIO()
    width, height = 148 * mm, 210 * mm
    c = canvas.Canvas(buffer, pagesize=(width, height))

    # ───────────── HEADER (top 60mm dark) ─────────────
    header_h = 60 * mm
    c.setFillColor(BLACK)
    c.rect(0, height - header_h, width, header_h, fill=1, stroke=0)

    # Blue logo icon — rounded square
    icon_size = 10 * mm
    icon_x = 12 * mm
    icon_y = height - 20 * mm
    c.setFillColor(BLUE)
    c.roundRect(icon_x, icon_y, icon_size, icon_size, 2 * mm, fill=1, stroke=0)

    # White "Y" mark inside the icon
    c.setFillColor(WHITE_BG)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(icon_x + icon_size / 2, icon_y + icon_size / 2 - 3.2, "Y")

    # Wordmark next to logo
    c.setFillColor(WHITE_BG)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(icon_x + icon_size + 4 * mm, icon_y + 2.8, "Yozuv")

    # Business name
    name_max_w = width - 24 * mm
    name_size = _fit_font_size(c, business.name, "Helvetica-Bold", 22, name_max_w)
    c.setFillColor(WHITE_BG)
    c.setFont("Helvetica-Bold", name_size)
    c.drawString(12 * mm, height - 38 * mm, business.name)

    # Category
    c.setFillColor(LIGHT_GRAY)
    c.setFont("Helvetica", 11)
    c.drawString(12 * mm, height - 47 * mm, _category_text(business.category))

    # ───────────── QR CARD ─────────────
    qr_size = 44 * mm
    qr_x = (width - qr_size) / 2
    qr_y = height - header_h - 6 * mm - qr_size

    card_pad = 4 * mm
    c.setFillColor(WHITE_BG)
    c.roundRect(
        qr_x - card_pad,
        qr_y - card_pad,
        qr_size + 2 * card_pad,
        qr_size + 2 * card_pad,
        3 * mm,
        fill=1,
        stroke=0,
    )

    if qr_png_bytes:
        try:
            qr_image = ImageReader(BytesIO(qr_png_bytes))
            c.drawImage(qr_image, qr_x, qr_y, qr_size, qr_size, mask="auto")
        except Exception:
            pass

    # Caption under QR card
    caption_y = qr_y - card_pad - 6 * mm
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, caption_y, "Yozilish uchun skaner qiling")

    c.setFillColor(GRAY)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, caption_y - 5 * mm, f"t.me/{bot_username}")

    # ───────────── SERVICES ─────────────
    services_top = caption_y - 11 * mm
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(12 * mm, services_top, "Xizmatlar")

    active = [s for s in services if getattr(s, "is_active", True)]
    active.sort(key=lambda s: (getattr(s, "order", 0), s.name))
    visible = active[:5]

    row_h = 8 * mm
    row_gap = 2 * mm
    y = services_top - 5 * mm - row_h

    if visible:
        for svc in visible:
            # row background
            c.setFillColor(CREAM)
            c.roundRect(10 * mm, y, width - 20 * mm, row_h, 2 * mm, fill=1, stroke=0)

            # Service name (truncate if too long)
            name = svc.name
            name_max = (width - 20 * mm) - 42 * mm
            while c.stringWidth(name, "Helvetica", 10) > name_max and len(name) > 3:
                name = name[:-2]
            if name != svc.name:
                name = name.rstrip() + "…"

            c.setFillColor(BLACK)
            c.setFont("Helvetica", 10)
            c.drawString(14 * mm, y + row_h / 2 - 3, name)

            # Price on the right
            c.setFillColor(BLUE)
            c.setFont("Helvetica-Bold", 10)
            c.drawRightString(
                width - 14 * mm, y + row_h / 2 - 3, _format_price(int(svc.price or 0))
            )

            y -= row_h + row_gap
    else:
        c.setFillColor(GRAY)
        c.setFont("Helvetica", 10)
        c.drawString(12 * mm, y + row_h / 2 - 3, "Xizmatlar tez orada qo'shiladi")

    # ───────────── FOOTER ─────────────
    footer_y = 8 * mm

    # Thin blue separator line
    c.setFillColor(BLUE)
    c.rect(0, footer_y + 10 * mm, width, 0.6 * mm, fill=1, stroke=0)

    # Contacts (skip if empty)
    c.setFillColor(GRAY)
    c.setFont("Helvetica", 8)

    line_y = footer_y + 5 * mm
    if business.phone:
        c.drawString(12 * mm, line_y, f"Tel:  {business.phone}")
        line_y -= 4 * mm
    if business.address:
        addr = business.address
        if c.stringWidth(f"Manzil:  {addr}", "Helvetica", 8) > width - 48 * mm:
            while (
                c.stringWidth(f"Manzil:  {addr}…", "Helvetica", 8) > width - 48 * mm
                and len(addr) > 3
            ):
                addr = addr[:-2]
            addr = addr.rstrip() + "…"
        c.drawString(12 * mm, line_y, f"Manzil:  {addr}")

    # Powered by
    c.setFillColor(SUBTLE)
    c.setFont("Helvetica", 7)
    c.drawRightString(width - 12 * mm, footer_y + 5 * mm, "yozuv.uz orqali ishlaydi")

    c.showPage()
    c.save()
    return buffer.getvalue()
