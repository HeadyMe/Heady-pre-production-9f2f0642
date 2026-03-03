# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  HeadySync MIDI Bridge - Physical System Administration           ║
# ║  "Turn deployment into a performance"                              ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

FROM python:3.11-slim

# Install system dependencies for MIDI and Docker
RUN apt-get update && apt-get install -y \
    alsa-utils \
    docker.io \
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
RUN useradd -m -u 1000 heady && \
    usermod -aG docker heady && \
    chown -R heady:heady /app
USER heady

# Start the MIDI bridge service
CMD ["python", "-m", "src.midi_bridge"]
