# ═══════════════════════════════════════════════════════════════════
# Heady Manager — Production Dockerfile
# Multi-stage build: install → prune → run
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Install ─────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy package files for dependency caching
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# ── Stage 2: App ─────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

# Copy deps from build stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY heady-manager.js ./
COPY heady-registry.json ./
COPY src/ ./src/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3301/health/live || exit 1

# Security hardening
RUN chown -R heady:heady /app && \
    chmod -R 555 /app && \
    chmod -R 755 /app/configs /app/data 2>/dev/null || true

USER heady

# Environment
ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info

EXPOSE 8080

CMD ["node", "heady-manager.js"]
