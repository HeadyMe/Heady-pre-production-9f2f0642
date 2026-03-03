# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HeadyField Oracle Service - Cryptographic Truth Verification       ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY config/ ./config/

# Create non-root user for security
RUN useradd -m -u 1000 heady && chown -R heady:heady /app
USER heady

# Health check endpoint
EXPOSE 8080

# Fibonacci backoff configuration
ENV FIBONACCI_MAX_RETRIES=13
ENV FIBONACCI_BASE_DELAY=1000

# Start the oracle service
CMD ["python", "-m", "src.oracle_server"]
