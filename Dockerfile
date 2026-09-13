FROM python:3.11-slim

WORKDIR /app

# Install minimal OS dependencies for compilation and healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code, models, and data
COPY . .

# Expose default port
EXPOSE 8000

ENV PORT=8000
ENV ENVIRONMENT=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Launch production server
CMD uvicorn src.backend.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --limit-concurrency 50

