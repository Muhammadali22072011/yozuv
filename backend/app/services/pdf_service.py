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
PRIMARY = HexColor("#005AFF")        # main brand
INK = HexColor("#080808")            # body text / footer
INK_MUTED = HexColor("#6B6B6B")      # secondary text
CREAM = HexColor("#F2EFE8")          # neutral block

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
    """Render single-page A5 brochure for a business. Returns PDF bytes."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    # Page background — pure white
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # Vertical layout (mm) — each band stacked top→bottom, no gaps:
    # header 45 + qr 70 + services 58 + contacts 25 + footer 12 = 210mm exactly.
    header_h = 45 * mm
    qr_h = 70 * mm
    services_h = 58 * mm
    contacts_h = 25 * mm
    footer_h = 12 * mm

    header_y = PAGE_H - header_h
    qr_y = header_y - qr_h
    services_y = qr_y - services_h
    contacts_y = services_y - contacts_h
    footer_y = 0

    # ───────────── 1. HEADER ─────────────
    c.setFillColor(PRIMARY)
    c.rect(0, header_y, PAGE_W, header_h, fill=1, stroke=0)

    # Visual baseline rows for the header — both sides share the same two baselines.
    name_baseline = header_y + 25 * mm
    sub_baseline = header_y + 17 * mm

    # Left — brand logo (transparent PNG); falls back to a wordmark if
    # the file is missing so the PDF never crashes.
    left_x = 10 * mm
    logo = _logo_reader()
    logo_size = 22 * mm
    logo_y = (header_y + (header_h - logo_size) / 2)
    if logo is not None:
        try:
            c.drawImage(
                logo,
                left_x,
                logo_y,
                logo_size,
                logo_size,
                mask="auto",
                preserveAspectRatio=True,
            )
        except Exception:
            logo = None
    if logo is None:
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 28)
        c.drawString(left_x, name_baseline, "YOZUV")
        c.setFont("Helvetica", 8)
        c.drawString(left_x, sub_baseline, _ascii_safe("Mijozlar uchun aqlli yozilish"))

    # Right — business name + category (right-aligned, same baselines)
    right_x = PAGE_W - 10 * mm
    name_max = PAGE_W / 2 - 6 * mm
    name_clean = _ascii_safe(business_name or "")
    name_size = _fit_size(c, name_clean, "Helvetica-Bold", 18, 11, name_max)
    name_clean = _truncate(c, name_clean, "Helvetica-Bold", name_size, name_max)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", name_size)
    c.drawRightString(right_x, name_baseline + 2 * mm, name_clean)

    cat_clean = _truncate(c, _category_label(business_category), "Helvetica", 10, name_max)
    c.saveState()
    c.setFillAlpha(0.7)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 10)
    c.drawRightString(right_x, sub_baseline, cat_clean)
    c.restoreState()

    # Thin semi-transparent divider at the bottom of the header
    c.saveState()
    c.setStrokeColor(WHITE)
    c.setStrokeAlpha(0.35)
    c.setLineWidth(0.4)
    c.line(8 * mm, header_y + 0.6 * mm, PAGE_W - 8 * mm, header_y + 0.6 * mm)
    c.restoreState()

    # ───────────── 2. QR BLOCK ─────────────
    c.setFillColor(CREAM)
    c.rect(0, qr_y, PAGE_W, qr_h, fill=1, stroke=0)

    qr_size = 60 * mm
    qr_x = (PAGE_W - qr_size) / 2
    # Leave 10mm at the bottom of the cream block for caption + handle, 0mm gap at top.
    qr_inner_y = qr_y + qr_h - qr_size  # QR pinned to top of cream

    qr_bytes = qr_image_bytes or _generate_qr_bytes(business_slug or "demo", bot_username)
    try:
        c.drawImage(ImageReader(BytesIO(qr_bytes)), qr_x, qr_inner_y, qr_size, qr_size, mask="auto")
    except Exception:
        # Fallback rectangle so the layout doesn't collapse
        c.setFillColor(WHITE)
        c.rect(qr_x, qr_inner_y, qr_size, qr_size, fill=1, stroke=0)

    caption_y = qr_inner_y - 5 * mm
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(PAGE_W / 2, caption_y, _ascii_safe("Yozilish uchun QR-kodni skaner qiling"))

    handle = f"t.me/{bot_username}?start={business_slug or ''}"
    c.setFillColor(INK_MUTED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(PAGE_W / 2, caption_y - 4 * mm, _truncate(c, handle, "Helvetica", 7, PAGE_W - 20 * mm))

    # ───────────── 3. SERVICES ─────────────
    c.setFillColor(WHITE)
    c.rect(0, services_y, PAGE_W, services_h, fill=1, stroke=0)

    title_y = services_y + services_h - 7 * mm
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(10 * mm, title_y, "Xizmatlar")

    # Underline accent under the title
    c.setStrokeColor(PRIMARY)
    c.setLineWidth(0.6)
    c.line(10 * mm, title_y - 1.5 * mm, 22 * mm, title_y - 1.5 * mm)

    rows = list(services or [])[:6]
    if not rows:
        c.setFillColor(INK_MUTED)
        c.setFont("Helvetica", 9)
        c.drawCentredString(PAGE_W / 2, services_y + services_h / 2 - 4, "Xizmatlar mavjud emas")
    else:
        col_gap = 4 * mm
        col_w = (PAGE_W - 20 * mm - col_gap) / 2
        col_x = [10 * mm, 10 * mm + col_w + col_gap]
        list_top = title_y - 7 * mm
        line_h = 5.5 * mm

        for i, svc in enumerate(rows):
            col = i % 2
            row = i // 2
            x = col_x[col]
            y = list_top - row * line_h

            name = _ascii_safe(svc.get("name") or "")
            price_text = _format_price(svc.get("price"))
            duration = svc.get("duration_minutes")
            dur_text = f"({duration} daq)" if duration else ""

            # Right side: price (bold ink)
            c.setFillColor(INK)
            c.setFont("Helvetica-Bold", 8)
            price_w = c.stringWidth(price_text, "Helvetica-Bold", 8)
            c.drawString(x + col_w - price_w, y, price_text)

            # Duration sits to the LEFT of the price, in muted gray
            dur_w = 0
            if dur_text:
                c.setFillColor(INK_MUTED)
                c.setFont("Helvetica", 7)
                dur_w = c.stringWidth(dur_text, "Helvetica", 7)
                c.drawString(x + col_w - price_w - 1.5 * mm - dur_w, y, dur_text)

            # Left side: bullet + name, truncated to fit
            bullet = "• "
            c.setFillColor(PRIMARY)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(x, y, bullet)
            bullet_w = c.stringWidth(bullet, "Helvetica-Bold", 8)

            name_max = col_w - bullet_w - price_w - 2.5 * mm - (dur_w + 1.5 * mm if dur_text else 0)
            name = _truncate(c, name, "Helvetica", 8, max(name_max, 6 * mm))
            c.setFillColor(INK)
            c.setFont("Helvetica", 8)
            c.drawString(x + bullet_w, y, name)

    # ───────────── 4. CONTACTS ─────────────
    c.setFillColor(CREAM)
    c.rect(0, contacts_y, PAGE_W, contacts_h, fill=1, stroke=0)

    parts = []
    if address:
        parts.append(("Manzil", _ascii_safe(address)))
    if phone:
        parts.append(("Tel", _ascii_safe(phone)))
    if schedule_text:
        parts.append(("Vaqt", _ascii_safe(schedule_text)))

    if parts:
        # Render in a single line, truncating each part proportionally if needed.
        font = "Helvetica"
        bold = "Helvetica-Bold"
        size = 8
        sep = "   |   "

        # Build segments [(label, value)] and measure
        sep_w = c.stringWidth(sep, font, size)
        avail = PAGE_W - 16 * mm - sep_w * (len(parts) - 1)
        per_part = avail / len(parts)

        # Truncate each value if its segment exceeds its share
        rendered = []
        for label, value in parts:
            label_text = f"{label}: "
            label_w = c.stringWidth(label_text, bold, size)
            value_max = max(per_part - label_w, 8 * mm)
            value = _truncate(c, value, font, size, value_max)
            seg_w = label_w + c.stringWidth(value, font, size)
            rendered.append((label_text, label_w, value, seg_w))

        total_w = sum(r[3] for r in rendered) + sep_w * (len(rendered) - 1)
        x = (PAGE_W - total_w) / 2
        y = contacts_y + contacts_h / 2 - 2

        for idx, (label_text, label_w, value, seg_w) in enumerate(rendered):
            c.setFillColor(PRIMARY)
            c.setFont(bold, size)
            c.drawString(x, y, label_text)
            c.setFillColor(INK)
            c.setFont(font, size)
            c.drawString(x + label_w, y, value)
            x += seg_w
            if idx < len(rendered) - 1:
                c.setFillColor(INK_MUTED)
                c.setFont(font, size)
                c.drawString(x, y, sep)
                x += sep_w

    # ───────────── 5. FOOTER ─────────────
    c.setFillColor(INK)
    c.rect(0, footer_y, PAGE_W, footer_h, fill=1, stroke=0)

    foot_baseline = footer_y + footer_h / 2 - 2.2
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 7)
    c.drawString(8 * mm, foot_baseline, "(c) YOZUV")

    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(PAGE_W / 2, foot_baseline, "yozuv.uz")

    c.setFont("Helvetica", 7)
    c.drawRightString(PAGE_W - 8 * mm, foot_baseline, _ascii_safe("Online yozilish platformasi"))

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
