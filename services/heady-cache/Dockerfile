# HeadyCache — Production Dockerfile
# Multi-stage build for minimal image size

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S heady && \
    adduser -u 1001 -S heady -G heady

WORKDIR /app

# Copy from builder
COPY --from=builder --chown=heady:heady /app/node_modules ./node_modules
COPY --from=builder --chown=heady:heady /app .

# Create data directory for file store
RUN mkdir -p /data && chown heady:heady /data

USER heady

# Environment defaults
ENV NODE_ENV=production \
    HEADY_CACHE_PORT=3105 \
    HEADY_CACHE_BACKEND=memory \
    HEADY_CACHE_MAX_SIZE=50000 \
    HEADY_CACHE_TTL=3600000 \
    HEADY_CACHE_SIMILARITY_THRESHOLD=0.95 \
    HEADY_CACHE_FILE_PATH=/data/heady-cache.jsonl \
    HEADY_CACHE_WAL_PATH=/data/heady-cache.wal

EXPOSE 3105

# Docker health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3105/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
