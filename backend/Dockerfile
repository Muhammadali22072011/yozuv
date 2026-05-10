# syntax=docker/dockerfile:1.6
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# System deps for psycopg2, Pillow, reportlab, qrcode, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libjpeg-dev \
        zlib1g-dev \
        libfreetype6-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps as root, then drop privileges before copying app
# code. Running uvicorn / Celery / the bot as root is unnecessary and
# would let any future RCE write anywhere on the filesystem.
COPY requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Create the runtime user and the upload directory it needs to write to.
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /tmp/yozuv_uploads \
    && chown -R app:app /app /tmp/yozuv_uploads

COPY --chown=app:app . .

USER app

# Railway injects $PORT. Default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000

# Start command is driven by railway.toml / Procfile so the same image
# can serve the API, the bot, or a Celery worker on different services.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
