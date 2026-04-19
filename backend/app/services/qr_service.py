from io import BytesIO

import qrcode


def generate_qr(business_slug: str, bot_username: str | None = None) -> bytes:
    username = bot_username or "YozuvBot"
    url = f"https://t.me/{username}?start={business_slug}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
