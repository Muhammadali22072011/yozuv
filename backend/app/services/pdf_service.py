from io import BytesIO
from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.models import Business, Service

# Brand logo lives next to the PDF service so it ships with the backend
# image and doesn't need to be re-fetched at runtime.
_LOGO_PATH = Path(__file__).resolve().parent.parent / "assets" / "logo.png"


def _logo_reader() -> ImageReader | None:
    try:
        if _LOGO_PATH.exists():
            return ImageReader(str(_LOGO_PATH))
    except Exception:
        pass
    return None


# ───────── Design system ─────────
WHITE = HexColor("#FFFFFF")
PRIMARY = HexColor("#4853F5")        # main brand (indigo, matches the app)
PRIMARY_DARK = HexColor("#3640D4")
INK = HexColor("#0B0F1F")            # body text / footer
INK_MUTED = HexColor("#6B6B6B")      # secondary text
CREAM = HexColor("#F4F2EC")          # neutral block
MINT = HexColor("#0E9577")           # price accent

PAGE_W, PAGE_H = 148 * mm, 210 * mm

CATEGORY_LABEL_UZ = {
    "barbershop": "Sartaroshxona",
    "salon": "Goʻzallik saloni",
    "dentist": "Stomatologiya",
    "tutor": "Repetitor",
    "photo": "Fotograf",
    "massage": "Massaj / Spa",
    "fitness": "Fitnes / Trener",
    "clinic": "Shifokor / Klinika",
    "other": "Biznes",
}


def _category_label(category) -> str:
    raw = getattr(category, "value", category)
    return CATEGORY_LABEL_UZ.get(str(raw).lower(), str(raw or "Biznes"))


def _ascii_safe(text: str) -> str:
    """Helvetica is WinAnsi — replace characters it can't render."""
    if not text:
        return ""
    repl = {
        "ʻ": "'", "‘": "'", "’": "'", "ʼ": "'",
        "“": '"', "”": '"',
        "—": "-", "–": "-",
        "…": "...",
    }
    out = text
    for k, v in repl.items():
        out = out.replace(k, v)
    return out


def _truncate(c: canvas.Canvas, text: str, font: str, size: int, max_width: float) -> str:
    text = _ascii_safe(text)
    if c.stringWidth(text, font, size) <= max_width:
        return text
    out = text
    while out and c.stringWidth(out + "...", font, size) > max_width:
        out = out[:-1]
    return (out.rstrip() + "...") if out else "..."


def _fit_size(c: canvas.Canvas, text: str, font: str, desired: int, min_size: int, max_width: float) -> int:
    size = desired
    while size > min_size and c.stringWidth(text, font, size) > max_width:
        size -= 1
    return size


def _format_price(value) -> str:
    try:
        n = int(value or 0)
    except (TypeError, ValueError):
        n = 0
    return f"{n:,}".replace(",", " ") + " so'm"


def _generate_qr_bytes(slug: str, bot_username: str = "Yozuv_cl_bot") -> bytes:
    import qrcode

    url = f"https://t.me/{bot_username}?start={slug}"
    qr = qrcode.QRCode(version=1, box_size=10, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_brochure(
    business_name: str,
    business_slug: str,
    business_category: str,
    services: list[dict],
    address: str = "",
    phone: str = "",
    schedule_text: str = "",
    qr_image_bytes: bytes | None = None,
    bot_username: str = "Yozuv_cl_bot",
) -> bytes:
    """Render a single-page A5 brochure for a business. Returns PDF bytes.

    Layout (top→bottom): indigo cover (logo + name + category) · QR card ·
    services list (vertically centered so few services never leave a gap) ·
    contacts · footer.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    M = 10 * mm  # side margin

    # White page
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Band geometry (mm), bottom-up coordinates.
    header_h = 48 * mm
    footer_h = 12 * mm
    contacts_h = 24 * mm
    qr_card_h = 70 * mm
    qr_gap = 5 * mm  # gap between header and the QR card

    header_y = PAGE_H - header_h
    footer_y = 0
    contacts_y = footer_y + footer_h
    qr_card_top = header_y - qr_gap
    qr_card_bottom = qr_card_top - qr_card_h
    services_top = qr_card_bottom
    services_bottom = contacts_y + contacts_h

    # ───────────── 1. COVER (indigo) ─────────────
    c.setFillColor(PRIMARY)
    c.rect(0, header_y, PAGE_W, header_h, fill=1, stroke=0)

    # Logo — its PNG already carries a white circle, so it pops on indigo.
    logo = _logo_reader()
    logo_size = 18 * mm
    logo_x = (PAGE_W - logo_size) / 2
    logo_y = header_y + header_h - logo_size - 4 * mm
    if logo is not None:
        try:
            c.drawImage(
                logo, logo_x, logo_y, logo_size, logo_size,
                mask="auto", preserveAspectRatio=True,
            )
        except Exception:
            logo = None
    if logo is None:
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 18)
        c.drawCentredString(PAGE_W / 2, logo_y + 5 * mm, "YOZUV")

    # Business name — centered, autosized to fit.
    name_clean = _ascii_safe(business_name or "Yozuv")
    name_max = PAGE_W - 2 * M
    name_size = _fit_size(c, name_clean, "Helvetica-Bold", 22, 13, name_max)
    name_clean = _truncate(c, name_clean, "Helvetica-Bold", name_size, name_max)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", name_size)
    name_baseline = logo_y - 7 * mm
    c.drawCentredString(PAGE_W / 2, name_baseline, name_clean)

    # Category — centered, semi-transparent.
    c.saveState()
    c.setFillAlpha(0.8)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 10)
    c.drawCentredString(PAGE_W / 2, name_baseline - 6 * mm,
                        _truncate(c, _category_label(business_category), "Helvetica", 10, name_max))
    c.restoreState()

    # ───────────── 2. QR CARD ─────────────
    c.setFillColor(CREAM)
    c.roundRect(M, qr_card_bottom, PAGE_W - 2 * M, qr_card_h, 6 * mm, fill=1, stroke=0)

    qr_size = 46 * mm
    qr_x = (PAGE_W - qr_size) / 2
    qr_y = qr_card_top - 7 * mm - qr_size  # 7mm padding under the card's top
    # White plate behind the QR so it always scans on the cream card.
    c.setFillColor(WHITE)
    c.roundRect(qr_x - 3 * mm, qr_y - 3 * mm, qr_size + 6 * mm, qr_size + 6 * mm, 3 * mm, fill=1, stroke=0)

    qr_bytes = qr_image_bytes or _generate_qr_bytes(business_slug or "demo", bot_username)
    try:
        c.drawImage(ImageReader(BytesIO(qr_bytes)), qr_x, qr_y, qr_size, qr_size, mask="auto")
    except Exception:
        c.setFillColor(WHITE)
        c.rect(qr_x, qr_y, qr_size, qr_size, fill=1, stroke=0)

    cap_y = qr_y - 7 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(PAGE_W / 2, cap_y, _ascii_safe("Skaner qiling va yoziling"))

    handle = f"t.me/{bot_username}?start={business_slug or ''}"
    c.setFillColor(INK_MUTED)
    c.setFont("Helvetica", 8)
    c.drawCentredString(PAGE_W / 2, cap_y - 5 * mm, _truncate(c, handle, "Helvetica", 8, PAGE_W - 2 * M - 6 * mm))

    # ───────────── 3. SERVICES (vertically centered) ─────────────
    rows = list(services or [])[:6]
    title_h = 9 * mm
    line_h = 7 * mm
    block_h = title_h + (len(rows) * line_h if rows else line_h)
    region_h = services_top - services_bottom
    block_top = services_bottom + (region_h + block_h) / 2  # vertical center

    title_y = block_top - 5 * mm
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(M, title_y, "Xizmatlar")
    c.setStrokeColor(PRIMARY)
    c.setLineWidth(1.2)
    c.line(M, title_y - 2 * mm, M + 13 * mm, title_y - 2 * mm)

    if not rows:
        c.setFillColor(INK_MUTED)
        c.setFont("Helvetica", 9)
        c.drawCentredString(PAGE_W / 2, title_y - 10 * mm, _ascii_safe("Xizmatlar tez orada"))
    else:
        right_x = PAGE_W - M
        for i, svc in enumerate(rows):
            y = title_y - title_h - i * line_h + 2 * mm
            price_text = _format_price(svc.get("price"))
            duration = svc.get("duration_minutes")
            dur_text = f"{duration} daq" if duration else ""

            # Price (bold, right)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 9)
            price_w = c.stringWidth(price_text, "Helvetica-Bold", 9)
            c.drawString(right_x - price_w, y, price_text)

            # Duration (muted, left of price)
            dur_w = 0
            if dur_text:
                c.setFillColor(INK_MUTED)
                c.setFont("Helvetica", 7.5)
                dur_w = c.stringWidth(dur_text, "Helvetica", 7.5)
                c.drawString(right_x - price_w - 2 * mm - dur_w, y, dur_text)

            # Bullet + name (left)
            c.setFillColor(PRIMARY)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(M, y, "•")
            name_x = M + 4 * mm
            name_max_w = (right_x - price_w - dur_w - (3 * mm if dur_text else 0)) - name_x - 3 * mm
            name = _truncate(c, _ascii_safe(svc.get("name") or ""), "Helvetica", 9, max(name_max_w, 10 * mm))
            c.setFillColor(INK)
            c.setFont("Helvetica", 9)
            c.drawString(name_x, y, name)

    # ───────────── 4. CONTACTS ─────────────
    c.setFillColor(CREAM)
    c.rect(0, contacts_y, PAGE_W, contacts_h, fill=1, stroke=0)

    items = []
    if address:
        items.append(("Manzil", _ascii_safe(address)))
    if phone:
        items.append(("Tel", _ascii_safe(phone)))
    if schedule_text:
        items.append(("Vaqt", _ascii_safe(schedule_text)))

    if items:
        n = len(items)
        gap = contacts_h / (n + 1)
        for idx, (label, value) in enumerate(items):
            y = contacts_y + contacts_h - gap * (idx + 1) - 1 * mm
            label_text = f"{label}: "
            c.setFillColor(PRIMARY)
            c.setFont("Helvetica-Bold", 8.5)
            c.drawString(M, y, label_text)
            lw = c.stringWidth(label_text, "Helvetica-Bold", 8.5)
            c.setFillColor(INK)
            c.setFont("Helvetica", 8.5)
            c.drawString(M + lw, y, _truncate(c, value, "Helvetica", 8.5, PAGE_W - M - (M + lw)))

    # ───────────── 5. FOOTER ─────────────
    c.setFillColor(INK)
    c.rect(0, footer_y, PAGE_W, footer_h, fill=1, stroke=0)
    fb = footer_y + footer_h / 2 - 2.2
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7)
    c.drawString(M - 2 * mm, fb, "(c) YOZUV")
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(PAGE_W / 2, fb, "yozuv.uz")
    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - M + 2 * mm, fb, _ascii_safe("Online yozilish platformasi"))

    c.showPage()
    c.save()
    return buffer.getvalue()


# ───────── Backwards-compatible wrapper for existing routers ─────────

DAY_ABBR_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"]


def _format_schedule(schedules) -> str:
    """Compress weekly schedule into a short one-liner like 'Du-Ju: 9:00-20:00, Sh: 10:00-18:00'."""
    if not schedules:
        return ""

    by_day = {}
    for s in schedules:
        if not getattr(s, "is_working", True):
            continue
        d = getattr(s, "day_of_week", None)
        if d is None or d < 0 or d > 6:
            continue
        st = getattr(s, "start_time", None)
        et = getattr(s, "end_time", None)
        if st is None or et is None:
            continue
        by_day[d] = (st.strftime("%H:%M"), et.strftime("%H:%M"))

    if not by_day:
        return ""

    # Walk Mon..Sun, group consecutive days that share the same hours.
    groups = []
    current = None
    for d in range(7):
        if d not in by_day:
            if current:
                groups.append(current)
                current = None
            continue
        hours = by_day[d]
        if current and current["hours"] == hours and current["end"] == d - 1:
            current["end"] = d
        else:
            if current:
                groups.append(current)
            current = {"start": d, "end": d, "hours": hours}
    if current:
        groups.append(current)

    parts = []
    for g in groups:
        if g["start"] == g["end"]:
            label = DAY_ABBR_UZ[g["start"]]
        else:
            label = f"{DAY_ABBR_UZ[g['start']]}-{DAY_ABBR_UZ[g['end']]}"
        parts.append(f"{label}: {g['hours'][0]}-{g['hours'][1]}")
    return ", ".join(parts)


def build_brochure_pdf(
    business: Business,
    services: list[Service],
    qr_png_bytes: bytes,
    bot_username: str = "Yozuv_cl_bot",
) -> bytes:
    """Adapter used by the FastAPI router — flattens DB models into generate_brochure args."""
    schedule_text = _format_schedule(getattr(business, "schedules", None))
    svc_dicts = [
        {
            "name": s.name,
            "price": s.price,
            "duration_minutes": s.duration_minutes,
        }
        for s in services or []
        if getattr(s, "is_active", True)
    ]
    return generate_brochure(
        business_name=business.name,
        business_slug=business.slug,
        business_category=business.category,
        services=svc_dicts,
        address=business.address or "",
        phone=business.phone or "",
        schedule_text=schedule_text,
        qr_image_bytes=qr_png_bytes,
        bot_username=bot_username,
    )
