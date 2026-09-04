FROM python:3.12-slim

WORKDIR /app

# libpq for psycopg2; gcc/libffi for the occasional source build.
# cairo/pango/gdk-pixbuf/shared-mime-info left together with weasyprint (R-18).
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc libpq-dev libffi-dev \
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
