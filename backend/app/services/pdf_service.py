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


# ───────── Design system (matches the in-app 3D brochure) ─────────
WHITE = HexColor("#FFFFFF")
PRIMARY = HexColor("#4853F5")        # indigo brand
INK = HexColor("#0B0F1F")            # body text
INK_MUTED = HexColor("#6B6B6B")      # secondary text
LIGHT = HexColor("#F8F9FC")          # neutral panel
CREAM = HexColor("#F4F2EC")          # warm panel
LEMON = HexColor("#FFC94A")

# A4 landscape, folded into three 99mm panels (a real trifold).
PAGE_W, PAGE_H = 297 * mm, 210 * mm
PANEL_W = 99 * mm
PM = 9 * mm  # inner panel margin

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


def _truncate(c: canvas.Canvas, text: str, font: str, size: float, max_width: float) -> str:
    text = _ascii_safe(text)
    if c.stringWidth(text, font, size) <= max_width:
        return text
    out = text
    while out and c.stringWidth(out + "...", font, size) > max_width:
        out = out[:-1]
    return (out.rstrip() + "...") if out else "..."


def _fit_size(c: canvas.Canvas, text: str, font: str, desired: int, min_size: int, max_width: float) -> int:
    size = desired
    while size > min_size and c.stringWidth(_ascii_safe(text), font, size) > max_width:
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


# ───────── small drawing helpers ─────────

def _panel_bg(c: canvas.Canvas, x0: float, color) -> None:
    c.setFillColor(color)
    c.rect(x0, 0, PANEL_W, PAGE_H, fill=1, stroke=0)


def _section_header(c: canvas.Canvas, x0: float, eyebrow: str, title: str, on_dark: bool = False) -> float:
    """Eyebrow + title + underline at the top of a panel. Returns the y below it."""
    cx = x0 + PM
    top = PAGE_H - 17 * mm
    c.setFillColor(WHITE if on_dark else PRIMARY)
    if on_dark:
        c.saveState()
        c.setFillAlpha(0.7)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(cx, top, _ascii_safe(eyebrow))
    if on_dark:
        c.restoreState()
    c.setFillColor(WHITE if on_dark else INK)
    c.setFont("Helvetica-Bold", 19)
    c.drawString(cx, top - 8 * mm, _ascii_safe(title))
    c.setStrokeColor(WHITE if on_dark else PRIMARY)
    c.setLineWidth(1.5)
    c.line(cx, top - 11 * mm, cx + 18 * mm, top - 11 * mm)
    return top - 11 * mm


# ───────── FRONT panels (the business) ─────────

def _panel_services(c: canvas.Canvas, x0: float, services: list[dict]) -> None:
    _panel_bg(c, x0, LIGHT)
    _section_header(c, x0, "Narxlar", "Xizmatlar")
    cx = x0 + PM
    right = x0 + PANEL_W - PM
    rows = list(services or [])[:8]
    if not rows:
        c.setFillColor(INK_MUTED)
        c.setFont("Helvetica", 10)
        c.drawCentredString(x0 + PANEL_W / 2, PAGE_H / 2, _ascii_safe("Xizmatlar tez orada"))
        return
    y = PAGE_H - 17 * mm - 22 * mm
    for svc in rows:
        price = _format_price(svc.get("price"))
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        pw = c.stringWidth(price, "Helvetica-Bold", 10)
        c.drawString(right - pw, y, price)
        dur = svc.get("duration_minutes")
        dw = 0
        if dur:
            dt = f"{dur} daq"
            c.setFillColor(INK_MUTED)
            c.setFont("Helvetica", 7.5)
            dw = c.stringWidth(dt, "Helvetica", 7.5)
            c.drawString(right - pw - 2 * mm - dw, y, dt)
        c.setFillColor(PRIMARY)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(cx, y, "•")
        nmx = cx + 4 * mm
        name_max = (right - pw - dw - (3 * mm if dur else 0)) - nmx - 3 * mm
        name = _truncate(c, svc.get("name") or "", "Helvetica", 10, max(name_max, 12 * mm))
        c.setFillColor(INK)
        c.setFont("Helvetica", 10)
        c.drawString(nmx, y, name)
        y -= 11 * mm


def _panel_cover(c: canvas.Canvas, x0: float, name: str, category, qr_bytes: bytes, handle: str) -> None:
    _panel_bg(c, x0, PRIMARY)
    cxm = x0 + PANEL_W / 2

    logo = _logo_reader()
    lsz = 22 * mm
    ly = PAGE_H - 16 * mm - lsz
    if logo is not None:
        try:
            c.drawImage(logo, cxm - lsz / 2, ly, lsz, lsz, mask="auto", preserveAspectRatio=True)
        except Exception:
            logo = None
    if logo is None:
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 22)
        c.drawCentredString(cxm, ly + 6 * mm, "YOZUV")

    nm = _ascii_safe(name or "Yozuv")
    ns = _fit_size(c, nm, "Helvetica-Bold", 19, 12, PANEL_W - 2 * PM)
    nm = _truncate(c, nm, "Helvetica-Bold", ns, PANEL_W - 2 * PM)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", ns)
    c.drawCentredString(cxm, ly - 9 * mm, nm)

    c.saveState()
    c.setFillAlpha(0.82)
    c.setFillColor(WHITE)
    c.setFont("Helvetica", 9.5)
    c.drawCentredString(cxm, ly - 15 * mm, _truncate(c, _category_label(category), "Helvetica", 9.5, PANEL_W - 2 * PM))
    c.restoreState()

    # QR card
    card_w = PANEL_W - 2 * PM
    card_x = x0 + PM
    card_h = 72 * mm
    card_y = 30 * mm
    c.setFillColor(WHITE)
    c.roundRect(card_x, card_y, card_w, card_h, 5 * mm, fill=1, stroke=0)

    qsz = 48 * mm
    qx = cxm - qsz / 2
    qy = card_y + card_h - 8 * mm - qsz
    try:
        c.drawImage(ImageReader(BytesIO(qr_bytes)), qx, qy, qsz, qsz, mask="auto")
    except Exception:
        pass
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 9.5)
    c.drawCentredString(cxm, qy - 8 * mm, _ascii_safe("Skaner qiling va yoziling"))
    c.setFillColor(INK_MUTED)
    c.setFont("Helvetica", 7)
    c.drawCentredString(cxm, qy - 12 * mm, _truncate(c, handle, "Helvetica", 7, card_w - 6 * mm))


def _panel_contacts(c: canvas.Canvas, x0: float, address: str, phone: str, schedule_text: str) -> None:
    _panel_bg(c, x0, CREAM)
    _section_header(c, x0, "Bog'lanish", "Kontakt")
    cx = x0 + PM

    items = []
    if address:
        items.append(("MANZIL", _ascii_safe(address)))
    if phone:
        items.append(("TELEFON", _ascii_safe(phone)))
    if schedule_text:
        items.append(("ISH VAQTI", _ascii_safe(schedule_text)))

    y = PAGE_H - 17 * mm - 24 * mm
    for lab, val in items:
        c.setFillColor(PRIMARY)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(cx, y, lab)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10.5)
        c.drawString(cx, y - 5.5 * mm, _truncate(c, val, "Helvetica-Bold", 10.5, PANEL_W - 2 * PM))
        y -= 15 * mm

    # footer
    c.setStrokeColor(HexColor("#D8D4C8"))
    c.setLineWidth(0.6)
    c.line(cx, 20 * mm, x0 + PANEL_W - PM, 20 * mm)
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(cx, 13 * mm, "yozuv.uz")
    c.setFillColor(INK_MUTED)
    c.setFont("Helvetica", 7.5)
    c.drawString(cx, 8 * mm, _ascii_safe("Online yozilish platformasi"))


# ───────── BACK panels (Yozuv marketing) ─────────

def _panel_features(c: canvas.Canvas, x0: float) -> None:
    _panel_bg(c, x0, LIGHT)
    _section_header(c, x0, "Imkoniyatlar", "Barcha vositalar")
    cx = x0 + PM
    feats = [
        ("Aqlli yozilish", "Mijoz xizmat va vaqt tanlaydi"),
        ("Tasdiqlash / Rad etish", "Bir tugma bilan boshqarish"),
        ("Payme / Click to'lov", "To'g'ridan-to'g'ri Telegramda"),
        ("Analitika", "Daromad va statistika"),
        ("QR-broshyura", "Avtomatik PDF va QR-kod"),
        ("Katalog", "Mijozlar sizni topadi"),
    ]
    y = PAGE_H - 17 * mm - 22 * mm
    for nm, ds in feats:
        c.setFillColor(PRIMARY)
        c.circle(cx + 1.4 * mm, y + 1 * mm, 1.4 * mm, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(cx + 6 * mm, y, _ascii_safe(nm))
        c.setFillColor(INK_MUTED)
        c.setFont("Helvetica", 8.5)
        c.drawString(cx + 6 * mm, y - 4.2 * mm, _ascii_safe(ds))
        y -= 11 * mm


def _panel_pricing(c: canvas.Canvas, x0: float) -> None:
    _panel_bg(c, x0, PRIMARY)
    _section_header(c, x0, "Tarif", "Oylik reja", on_dark=True)
    cx = x0 + PM

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 40)
    c.drawString(cx, PAGE_H - 17 * mm - 30 * mm, "$15")
    pw = c.stringWidth("$15", "Helvetica-Bold", 40)
    c.saveState()
    c.setFillAlpha(0.75)
    c.setFont("Helvetica", 14)
    c.drawString(cx + pw + 2 * mm, PAGE_H - 17 * mm - 30 * mm, "/ oy")
    c.setFont("Helvetica", 9.5)
    c.drawString(cx, PAGE_H - 17 * mm - 37 * mm, _ascii_safe("187 500 so'm · barcha imkoniyatlar cheksiz"))
    c.restoreState()

    perks = [
        "Cheksiz yozilishlar",
        "Payme / Click to'lov",
        "Analitika va eslatmalar",
        "QR va PDF broshyura",
        "Mijozlar bazasi",
        "Premium qo'llab-quvvatlash",
    ]
    y = PAGE_H - 17 * mm - 50 * mm
    for p in perks:
        c.setFillColor(LEMON)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(cx, y, "+")
        c.setFillColor(WHITE)
        c.saveState()
        c.setFillAlpha(0.92)
        c.setFont("Helvetica", 9.5)
        c.drawString(cx + 5 * mm, y, _ascii_safe(p))
        c.restoreState()
        y -= 6 * mm

    # CTA at the bottom
    c.setFillColor(WHITE)
    c.roundRect(cx, 16 * mm, PANEL_W - 2 * PM, 16 * mm, 4 * mm, fill=1, stroke=0)
    c.setFillColor(PRIMARY)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(x0 + PANEL_W / 2, 27 * mm, _ascii_safe("14 KUN BEPUL SINAB KO'RING"))
    c.setFillColor(INK)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(x0 + PANEL_W / 2, 20 * mm, "yozuv.uz")


def _panel_categories(c: canvas.Canvas, x0: float) -> None:
    _panel_bg(c, x0, LIGHT)
    _section_header(c, x0, "Kategoriyalar", "Qaysi bizneslar?")
    cx = x0 + PM
    cats = [
        "Sartarosh", "Massaj / Spa",
        "Stomatolog", "Repetitor",
        "Fotograf", "Fitnes",
        "Shifokor", "Boshqalar",
    ]
    col_w = (PANEL_W - 2 * PM - 4 * mm) / 2
    cell_h = 12 * mm
    top = PAGE_H - 17 * mm - 20 * mm
    for i, cat in enumerate(cats):
        col = i % 2
        row = i // 2
        bx = cx + col * (col_w + 4 * mm)
        by = top - row * (cell_h + 3 * mm) - cell_h
        c.setFillColor(WHITE)
        c.roundRect(bx, by, col_w, cell_h, 3 * mm, fill=1, stroke=0)
        c.setFillColor(PRIMARY)
        c.circle(bx + 6 * mm, by + cell_h / 2, 1.6 * mm, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(bx + 11 * mm, by + cell_h / 2 - 3, _truncate(c, cat, "Helvetica-Bold", 9, col_w - 14 * mm))

    # quote
    qy = top - 4 * (cell_h + 3 * mm) - 6 * mm
    qh = 34 * mm
    c.setFillColor(WHITE)
    c.roundRect(cx, qy - qh, PANEL_W - 2 * PM, qh, 4 * mm, fill=1, stroke=0)
    c.setFillColor(PRIMARY)
    c.rect(cx, qy - qh, 1.2 * mm, qh, fill=1, stroke=0)
    c.setFillColor(LEMON)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(cx + 6 * mm, qy - 8 * mm, "* * * * *")
    c.setFillColor(INK)
    c.setFont("Helvetica", 9)
    line = _ascii_safe("\"Har kuni 5-10 ta yozilish")
    c.drawString(cx + 6 * mm, qy - 15 * mm, line)
    c.drawString(cx + 6 * mm, qy - 20 * mm, _ascii_safe("avtomatik keladi.\""))
    c.setFillColor(INK_MUTED)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(cx + 6 * mm, qy - 28 * mm, _ascii_safe("Akbar · Barber Akbar"))


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
    """Render the trifold brochure (A4 landscape, fold into thirds). Returns PDF bytes.

    Page 1 (front): Xizmatlar | Cover (logo + name + QR) | Kontakt.
    Page 2 (back):  Imkoniyatlar | Tarif | Kategoriyalar.
    Mirrors the in-app 3D brochure. Print double-sided, fold into three.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=(PAGE_W, PAGE_H))

    qr_bytes = qr_image_bytes or _generate_qr_bytes(business_slug or "demo", bot_username)
    handle = f"t.me/{bot_username}?start={business_slug or ''}"

    # ── PAGE 1 — front (the business) ──
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    _panel_services(c, 0, services)
    _panel_cover(c, PANEL_W, business_name, business_category, qr_bytes, handle)
    _panel_contacts(c, 2 * PANEL_W, address, phone, schedule_text)
    c.showPage()

    # ── PAGE 2 — back (Yozuv marketing) ──
    c.setFillColor(WHITE)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    _panel_features(c, 0)
    _panel_pricing(c, PANEL_W)
    _panel_categories(c, 2 * PANEL_W)
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
