FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "heady_client.py"]
# Add health check with proper Python script validation and service readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import sys; import os; import importlib.util; \
    spec = importlib.util.spec_from_file_location('heady_client', '/app/heady_client.py'); \
    sys.exit(0 if spec and os.path.exists('/app/heady_client.py') else 1)"

# Add comprehensive labels for better container management and service discovery
LABEL maintainer="Heady Team <team@heady.io>" \
      version="1.0.0" \
      description="Heady Python Service - AI/ML Worker" \
      com.heady.service="python-worker" \
      com.heady.layer="services" \
      com.heady.monitoring.enabled="true" \
      com.heady.health.endpoint="http://localhost:8000/health" \
      com.heady.backup.enabled="true" \
      com.heady.restart.policy="unless-stopped" \
      org.opencontainers.image.source="https://github.com/heady/heady" \
      org.opencontainers.image.vendor="Heady.io"

# Run as non-root user for security with proper permissions
RUN useradd -m -u 1000 -s /bin/bash heady && \
    chown -R heady:heady /app && \
    chmod -R 755 /app

# Set working directory ownership and create necessary directories with proper structure
RUN mkdir -p /app/data /app/logs /app/temp /app/cache /app/models && \
    chmod -R 755 /app/data /app/logs /app/temp /app/cache /app/models && \
    touch /app/logs/service.log && \
    chown -R heady:heady /app/data /app/logs /app/temp /app/cache /app/models

USER heady

# Set environment variables for Python optimization and logging
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    LOG_LEVEL=INFO \
    SERVICE_NAME=heady-python-worker \
    PYTHONPATH=/app \
    HOME=/home/heady

# Expose default service port
EXPOSE 8000

# Add volume mount points for persistent data
VOLUME ["/app/data", "/app/logs", "/app/cache", "/app/models"]
