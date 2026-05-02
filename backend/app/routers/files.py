from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import get_owned_business
from app.models import Business, Service
from app.services.pdf_service import build_brochure_pdf
from app.services.qr_service import generate_qr

router = APIRouter(prefix="/business/me", tags=["files"])
settings = get_settings()


@router.get("/qr")
def qr_png(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    data = generate_qr(business.slug, settings.next_public_bot_username)
    filename = f"yozuv-{business.slug}-qr.png"
    return Response(
        content=data,
        media_type="image/png",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.get("/brochure")
def brochure_pdf(
    db: Session = Depends(get_db),
    business: Business = Depends(get_owned_business),
):
    services = (
        db.query(Service)
        .filter(Service.business_id == business.id)
        .order_by(Service.order.asc(), Service.name.asc())
        .all()
    )
    bot_username = settings.next_public_bot_username or "YozuvBot"
    qr_bytes = generate_qr(business.slug, bot_username)
    pdf = build_brochure_pdf(business, services, qr_bytes, bot_username=bot_username)

    filename = f"{business.slug}-broshyura.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
