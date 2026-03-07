# ─── HeadyVector Dockerfile ───────────────────────────────────────────────────
# Multi-stage build for production.
# Node.js 20 LTS + pgvector client only (PostgreSQL runs separately).
# ────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install build tools for native modules (pg has no native, but for flexibility)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# ── Stage 2: Production image ──────────────────────────────────────────────────
FROM node:20-alpine AS production

LABEL maintainer="Heady AI <engineering@headyconnection.org>"
LABEL service="heady-vector"
LABEL version="1.0.0"

WORKDIR /app

# Create non-root user
RUN addgroup -S headyvector && adduser -S headyvector -G headyvector

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy service source
COPY --chown=headyvector:headyvector . .

# Switch to non-root
USER headyvector

# Expose service port
EXPOSE 3103

# Health check (calls /health/live endpoint)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3103/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Environment defaults
ENV NODE_ENV=production
ENV HEADY_VECTOR_PORT=3103

# Start the service
CMD ["node", "server.js"]
