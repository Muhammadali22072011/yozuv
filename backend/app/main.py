from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    admin,
    analytics,
    auth,
    bookings,
    business,
    clients,
    files,
    payments,
    promo,
    reviews,
    schedule,
    services,
    subscription,
)

settings = get_settings()

app = FastAPI(title="Yozuv API", version="0.1.0")

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
if not origins:
    raise RuntimeError(
        "CORS_ORIGINS must be set. Example: CORS_ORIGINS=https://yourdomain.com"
    )
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
# Specific /business/me/* routers must be registered BEFORE business.router,
# otherwise /business/{slug}/services catches /business/me/services with slug="me".
app.include_router(services.router, prefix="/api")
app.include_router(schedule.router, prefix="/api")
app.include_router(bookings.me_router, prefix="/api")
app.include_router(clients.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(subscription.router, prefix="/api")
app.include_router(promo.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(business.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(bookings.public_router, prefix="/api")


@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok"}
