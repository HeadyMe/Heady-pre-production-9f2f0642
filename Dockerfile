# ═══════════════════════════════════════════════════════════════
# 🐳 HEADY PRODUCTION DOCKERFILE
# ═══════════════════════════════════════════════════════════════
# Optimized for Ryzen 9 + 32GB RAM production deployment

FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    curl \
    git \
    python3 \
    make \
    g++ \
    linux-headers \
    sqlite \
    postgresql-client

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with optimizations
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p .heady-memory logs public

# Set permissions
RUN chown -R node:node /app
USER node

# Expose port
EXPOSE 3310

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3310/api/health/basic || exit 1

# Start command
CMD ["node", "heady-manager.js"]
