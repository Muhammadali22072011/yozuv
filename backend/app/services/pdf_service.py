from io import BytesIO

from reportlab.lib.colors import HexColor, Color
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.models import Business, Service


# Brand palette — mirrors frontend tailwind.config.ts + globals.css
INDIGO_500 = HexColor("#5B6BFF")
INDIGO_600 = HexColor("#4853F5")
INDIGO_700 = HexColor("#3640D4")
INDIGO_50 = HexColor("#EEF0FF")
INDIGO_100 = HexColor("#E0E4FF")
INK_900 = HexColor("#0B0F1F")
INK_500 = HexColor("#5A6078")
INK_400 = HexColor("#848AA2")
INK_200 = HexColor("#E3E5EC")
INK_100 = HexColor("#F2F3F7")
INK_50 = HexColor("#F8F9FC")
LEMON = HexColor("#FFC94A")
SUCCESS = HexColor("#0E9577")
SUCCESS_BG = HexColor("#E6FAF3")
WHITE = HexColor("#FFFFFF")


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


def _truncate(canv: canvas.Canvas, text: str, font: str, size: int, max_width: float) -> str:
    if canv.stringWidth(text, font, size) <= max_width:
        return text
    out = text
    while out and canv.stringWidth(out + "…", font, size) > max_width:
        out = out[:-1]
    return (out.rstrip() + "…") if out else "…"


def _format_price(value: int) -> str:
    return f"{value:,}".replace(",", " ") + " so'm"


def _draw_hero_gradient(c: canvas.Canvas, x: float, y: float, w: float, h: float):
    """Fake a 160deg indigo gradient by stacking 60 horizontal slices."""
    steps = 60
    # endpoints from globals.css .yz-hero
    start = (0x5B, 0x6B, 0xFF)  # #5B6BFF
    mid = (0x48, 0x53, 0xF5)    # #4853F5
    end = (0x36, 0x40, 0xD4)    # #3640D4
    for i in range(steps):
        t = i / (steps - 1)
        if t < 0.55:
            u = t / 0.55
            r = start[0] + (mid[0] - start[0]) * u
            g = start[1] + (mid[1] - start[1]) * u
            b = start[2] + (mid[2] - start[2]) * u
        else:
            u = (t - 0.55) / 0.45
            r = mid[0] + (end[0] - mid[0]) * u
            g = mid[1] + (end[1] - mid[1]) * u
            b = mid[2] + (end[2] - mid[2]) * u
        c.setFillColorRGB(r / 255, g / 255, b / 255)
        slice_h = h / steps + 0.5
        c.rect(x, y + h - (i + 1) * (h / steps) - 0.25, w, slice_h, fill=1, stroke=0)


def _draw_decorative_blobs(c: canvas.Canvas, hero_x: float, hero_y: float, hero_w: float, hero_h: float):
    """Soft white/lemon/lilac circles inside the hero — matches landing Hero."""
    c.saveState()
    # large white blob top-right
    c.setFillColor(WHITE)
    c.setFillAlpha(0.10)
    c.circle(hero_x + hero_w + 5 * mm, hero_y + hero_h - 5 * mm, 22 * mm, fill=1, stroke=0)
    # lemon top-right inner
    c.setFillColorRGB(1.0, 201 / 255, 74 / 255)
    c.setFillAlpha(0.22)
    c.circle(hero_x + hero_w - 18 * mm, hero_y + hero_h - 18 * mm, 9 * mm, fill=1, stroke=0)
    # lilac bottom-left
    c.setFillColorRGB(184 / 255, 166 / 255, 255 / 255)
    c.setFillAlpha(0.22)
    c.circle(hero_x - 8 * mm, hero_y + 12 * mm, 16 * mm, fill=1, stroke=0)
    c.setFillAlpha(1.0)
    c.restoreState()


def _draw_logo_mark(c: canvas.Canvas, x: float, y: float, size: float, on_dark: bool = True):
    """Y-mark matching frontend YzLogo. White on dark hero, gradient on light."""
    if on_dark:
        c.setFillColor(WHITE)
    else:
        c.setFillColor(INDIGO_600)
    c.roundRect(x, y, size, size, size * 0.28, fill=1, stroke=0)
    if on_dark:
        c.setFillColor(INDIGO_600)
    else:
        c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", size * 0.55)
    c.drawCentredString(x + size / 2, y + size / 2 - size * 0.18, "Y")


def _draw_pill(c: canvas.Canvas, x: float, y: float, text: str, font: str, size: int,
               bg: Color, fg: Color, pad_x: float = 3 * mm, pad_y: float = 1.5 * mm):
    """Rounded pill — used for category badge, price tag."""
    c.setFont(font, size)
    text_w = c.stringWidth(text, font, size)
    pill_w = text_w + pad_x * 2
    pill_h = size + pad_y * 2
    c.setFillColor(bg)
    c.roundRect(x, y, pill_w, pill_h, pill_h / 2, fill=1, stroke=0)
    c.setFillColor(fg)
    c.drawString(x + pad_x, y + pad_y + size * 0.18, text)
    return pill_w, pill_h


def build_brochure_pdf(
    business: Business,
    services: list[Service],
    qr_png_bytes: bytes,
    bot_username: str = "YozuvBot",
) -> bytes:
    buffer = BytesIO()
    width, height = 148 * mm, 210 * mm
    c = canvas.Canvas(buffer, pagesize=(width, height))

    # Page background — soft ink-50 like the dashboard
    c.setFillColor(INK_50)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    # ───────────── HERO (indigo gradient, top ~78mm) ─────────────
    hero_h = 78 * mm
    hero_y = height - hero_h
    _draw_hero_gradient(c, 0, hero_y, width, hero_h)
    _draw_decorative_blobs(c, 0, hero_y, width, hero_h)

    # Logo + wordmark (top-left)
    logo_size = 9 * mm
    logo_x = 12 * mm
    logo_y = height - 18 * mm
    _draw_logo_mark(c, logo_x, logo_y, logo_size, on_dark=False)  # white card with indigo Y

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(logo_x + logo_size + 3 * mm, logo_y + logo_size - 2.5 * mm, "TELEGRAM MINI APP")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(logo_x + logo_size + 3 * mm, logo_y + 1.0 * mm, "Yozuv")

    # Business name — large, white, tight tracking
    name_max_w = width - 24 * mm
    name_size = _fit_font_size(c, business.name, "Helvetica-Bold", 24, name_max_w)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", name_size)
    c.drawString(12 * mm, height - 38 * mm, business.name)

    # Category as a frosted pill
    cat_text = _category_text(business.category)
    c.saveState()
    c.setFillAlpha(0.22)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    pill_text_w = c.stringWidth(cat_text, "Helvetica-Bold", 9)
    pill_w = pill_text_w + 6 * mm
    pill_h = 6 * mm
    pill_x = 12 * mm
    pill_y = height - 47 * mm
    c.roundRect(pill_x, pill_y, pill_w, pill_h, pill_h / 2, fill=1, stroke=0)
    c.setFillAlpha(1.0)
    c.setFillColor(WHITE)
    c.drawString(pill_x + 3 * mm, pill_y + 1.6 * mm, cat_text)
    c.restoreState()

    # Trial banner — semi-translucent
    c.saveState()
    c.setFillAlpha(0.16)
    c.setFillColor(WHITE)
    banner_w = width - 24 * mm
    banner_x = 12 * mm
    banner_y = hero_y + 8 * mm
    c.roundRect(banner_x, banner_y, banner_w, 8 * mm, 3 * mm, fill=1, stroke=0)
    c.setFillAlpha(1.0)
    c.setFillColor(LEMON)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(banner_x + 4 * mm, banner_y + 2.7 * mm, "★")
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(banner_x + 8 * mm, banner_y + 2.7 * mm, "14 kun bepul · Karta talab qilinmaydi")
    c.restoreState()

    # ───────────── QR CARD (overlaps hero, white) ─────────────
    qr_size = 38 * mm
    card_pad_x = 5 * mm
    card_pad_y = 5 * mm
    qr_text_w = 60 * mm
    card_w = qr_size + card_pad_x * 2 + qr_text_w
    card_w = min(card_w, width - 24 * mm)
    card_h = qr_size + card_pad_y * 2
    card_x = (width - card_w) / 2
    card_y = hero_y - card_h / 2  # half-overlap into hero / page

    # subtle drop shadow
    c.saveState()
    c.setFillAlpha(0.10)
    c.setFillColor(INK_900)
    c.roundRect(card_x + 1, card_y - 2, card_w, card_h, 5 * mm, fill=1, stroke=0)
    c.setFillAlpha(1.0)
    c.restoreState()

    c.setFillColor(WHITE)
    c.roundRect(card_x, card_y, card_w, card_h, 5 * mm, fill=1, stroke=0)

    qr_x = card_x + card_pad_x
    qr_y = card_y + card_pad_y
    if qr_png_bytes:
        try:
            qr_image = ImageReader(BytesIO(qr_png_bytes))
            c.drawImage(qr_image, qr_x, qr_y, qr_size, qr_size, mask="auto")
        except Exception:
            pass

    # Caption next to QR
    text_x = qr_x + qr_size + 5 * mm
    text_top = card_y + card_h - 6 * mm
    c.setFillColor(INDIGO_600)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(text_x, text_top, "QR-KOD")
    c.setFillColor(INK_900)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(text_x, text_top - 6 * mm, "Skaner qiling")
    c.setFont("Helvetica-Bold", 13)
    c.drawString(text_x, text_top - 11 * mm, "va yoziling")

    handle = f"t.me/{bot_username}"
    handle = _truncate(c, handle, "Helvetica", 8, qr_text_w - 2 * mm)
    c.setFillColor(INK_500)
    c.setFont("Helvetica", 8)
    c.drawString(text_x, text_top - 18 * mm, handle)

    # ───────────── SERVICES ─────────────
    services_top = card_y - 9 * mm
    c.setFillColor(INDIGO_600)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(12 * mm, services_top, "XIZMATLAR")
    c.setFillColor(INK_900)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(12 * mm, services_top - 6 * mm, "Narxlar va imkoniyatlar")

    active = [s for s in services if getattr(s, "is_active", True)]
    active.sort(key=lambda s: (getattr(s, "order", 0), s.name))
    visible = active[:5]

    row_h = 10 * mm
    row_gap = 2.2 * mm
    list_top = services_top - 12 * mm
    y = list_top - row_h

    if visible:
        for svc in visible:
            # row card — white with soft shadow
            c.saveState()
            c.setFillAlpha(0.06)
            c.setFillColor(INK_900)
            c.roundRect(10 * mm + 0.5, y - 0.8, width - 20 * mm, row_h, 3 * mm, fill=1, stroke=0)
            c.setFillAlpha(1.0)
            c.restoreState()

            c.setFillColor(WHITE)
            c.roundRect(10 * mm, y, width - 20 * mm, row_h, 3 * mm, fill=1, stroke=0)

            # leading dot — indigo accent
            dot_size = 5 * mm
            dot_x = 13 * mm
            dot_y = y + (row_h - dot_size) / 2
            c.setFillColor(INDIGO_50)
            c.roundRect(dot_x, dot_y, dot_size, dot_size, 1.6 * mm, fill=1, stroke=0)
            c.setFillColor(INDIGO_600)
            c.setFont("Helvetica-Bold", 8)
            c.drawCentredString(dot_x + dot_size / 2, dot_y + dot_size / 2 - 2.5, "✓")

            # service name
            name = svc.name
            price_text = _format_price(int(svc.price or 0))
            duration = getattr(svc, "duration_minutes", None)
            duration_text = f"{duration} daq" if duration else ""

            price_w = c.stringWidth(price_text, "Helvetica-Bold", 10)
            name_max = (width - 20 * mm) - dot_size - 8 * mm - price_w - 6 * mm
            name = _truncate(c, name, "Helvetica-Bold", 11, name_max)

            c.setFillColor(INK_900)
            c.setFont("Helvetica-Bold", 11)
            c.drawString(dot_x + dot_size + 3 * mm, y + row_h / 2 + 0.6, name)

            if duration_text:
                c.setFillColor(INK_400)
                c.setFont("Helvetica", 8)
                c.drawString(dot_x + dot_size + 3 * mm, y + row_h / 2 - 3.2, duration_text)

            # price as success-pill
            c.saveState()
            c.setFillColor(SUCCESS_BG)
            pill_text_w = c.stringWidth(price_text, "Helvetica-Bold", 10)
            pill_w = pill_text_w + 4.5 * mm
            pill_h = 5.5 * mm
            pill_x = width - 11 * mm - pill_w
            pill_y = y + (row_h - pill_h) / 2
            c.roundRect(pill_x, pill_y, pill_w, pill_h, pill_h / 2, fill=1, stroke=0)
            c.setFillColor(SUCCESS)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(pill_x + 2.25 * mm, pill_y + 1.4 * mm, price_text)
            c.restoreState()

            y -= row_h + row_gap
    else:
        c.setFillColor(WHITE)
        c.roundRect(10 * mm, y, width - 20 * mm, row_h, 3 * mm, fill=1, stroke=0)
        c.setFillColor(INK_400)
        c.setFont("Helvetica", 9)
        c.drawCentredString(width / 2, y + row_h / 2 - 2.5, "Xizmatlar tez orada qo'shiladi")

    # ───────────── FOOTER (dark indigo card) ─────────────
    footer_h = 24 * mm
    footer_x = 6 * mm
    footer_y = 6 * mm
    footer_w = width - 12 * mm

    # gradient-ish dark
    c.setFillColor(HexColor("#0B0F1F"))
    c.roundRect(footer_x, footer_y, footer_w, footer_h, 5 * mm, fill=1, stroke=0)

    # decorative indigo blob inside footer
    c.saveState()
    c.setFillColor(INDIGO_600)
    c.setFillAlpha(0.30)
    c.circle(footer_x + footer_w - 8 * mm, footer_y + footer_h - 4 * mm, 14 * mm, fill=1, stroke=0)
    c.setFillAlpha(1.0)
    c.restoreState()

    # Phone
    line_y = footer_y + footer_h - 8 * mm
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(footer_x + 5 * mm, line_y, "BOG'LANISH")

    line_y -= 5 * mm
    if business.phone:
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(footer_x + 5 * mm, line_y, business.phone)
        line_y -= 4.5 * mm

    if business.address:
        addr = _truncate(c, business.address, "Helvetica", 9, footer_w - 50 * mm)
        c.setFillColor(HexColor("#B9BECD"))  # ink-300
        c.setFont("Helvetica", 9)
        c.drawString(footer_x + 5 * mm, line_y, addr)

    # Right-side branding
    _draw_logo_mark(c, footer_x + footer_w - 24 * mm, footer_y + footer_h - 11 * mm, 7 * mm, on_dark=False)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(footer_x + footer_w - 15 * mm, footer_y + footer_h - 8 * mm, "Yozuv")
    c.setFillColor(HexColor("#848AA2"))  # ink-400
    c.setFont("Helvetica", 7)
    c.drawRightString(footer_x + footer_w - 5 * mm, footer_y + 3.5 * mm, "yozuv.uz")

    c.showPage()
    c.save()
    return buffer.getvalue()
