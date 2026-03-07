# ╔══════════════════════════════════════════════════════════════════════╗
# ║  Heady™ AI Platform — Production Dockerfile                         ║
# ║  Multi-stage build: Node.js 20 + Alpine                             ║
# ║  © 2026 HeadySystems Inc.                                           ║
# ╚══════════════════════════════════════════════════════════════════════╝

# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install system dependencies needed by native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc6-compat \
    openssl \
    openssl-dev \
    ca-certificates

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null || \
    npm install --omit=dev --legacy-peer-deps

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache python3 make g++ gcc libc6-compat openssl openssl-dev

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev)
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# Copy source
COPY . .

# Build step (if applicable — generates sites, etc.)
RUN node -e "try { require('./scripts/generate-sites.js') } catch(e) { console.log('Build step skipped:', e.message) }" 2>/dev/null || true

# ─── Stage 3: Production Runtime ─────────────────────────────────────────────
FROM node:20-alpine AS runner

# Add tini for proper signal handling
RUN apk add --no-cache tini curl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 heady && \
    adduser --system --uid 1001 --ingroup heady heady

# Set environment
ENV NODE_ENV=production
ENV PORT=3301
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Copy production node_modules from deps stage
COPY --from=deps --chown=heady:heady /app/node_modules ./node_modules

# Copy application source from builder
COPY --chown=heady:heady --from=builder /app/heady-manager.js ./
COPY --chown=heady:heady --from=builder /app/package.json ./
COPY --chown=heady:heady --from=builder /app/src ./src
COPY --chown=heady:heady --from=builder /app/db ./db

# Optional directories (don't fail if they don't exist)
RUN mkdir -p /app/data /app/logs /app/certs /app/configs /app/public && \
    chown -R heady:heady /app/data /app/logs /app/certs /app/configs /app/public

# Copy configs if present
COPY --chown=heady:heady --from=builder /app/configs ./configs 2>/dev/null || true
COPY --chown=heady:heady --from=builder /app/public ./public 2>/dev/null || true

# Switch to non-root user
USER heady

# Expose port
EXPOSE 3301

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:3301/healthz || exit 1

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "heady-manager.js"]

# ─── Labels ──────────────────────────────────────────────────────────────────
LABEL org.opencontainers.image.title="Heady AI Platform"
LABEL org.opencontainers.image.description="Heady™ AI Platform v3.1.0 — Autonomous multi-agent AI OS"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.vendor="HeadySystems Inc."
LABEL org.opencontainers.image.url="https://headysystems.com"
LABEL org.opencontainers.image.source="https://github.com/HeadyMe/Heady-pre-production"
LABEL org.opencontainers.image.licenses="UNLICENSED"
