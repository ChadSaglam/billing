FROM python:3.14-slim

WORKDIR /app

# libpq for psycopg2; cairo/pango/gdk-pixbuf for weasyprint.
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc libpq-dev libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
      libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x docker-entrypoint.sh

# Run as a non-root user; uploads/ must stay writable.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/uploads/logos \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["./docker-entrypoint.sh"]
