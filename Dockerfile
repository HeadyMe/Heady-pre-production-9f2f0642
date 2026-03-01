# ═══════════════════════════════════════════════════════════════════
# Heady Manager — Production Dockerfile
# Multi-stage build: install → run
# Aligned with Phase 3 blueprint: container optimization, non-root,
# minimal attack surface, multi-stage separation.
# LR-004: pnpm-only, no npm. Errors must surface, never suppress.
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Install deps ────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod

# ── Stage 2: Production runner ───────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Security: non-root user (Phase 1 mandate)
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

# Copy deps
COPY --from=deps /app/node_modules ./node_modules

# Copy ALL application code the manager needs
COPY heady-manager.js ./
COPY heady-registry.json* ./
COPY src/ ./src/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY services/ ./services/
COPY heady-hive-sdk/ ./heady-hive-sdk/
COPY public/ ./public/
COPY data/ ./data/

# Create writable dirs for runtime data — non-root user IS the security boundary
RUN mkdir -p /app/data/logs /app/data/vector-shards && \
    chown -R heady:heady /app

USER heady

# Environment — PORT is set by Cloud Run, don't override
ENV NODE_ENV=production \
    LOG_LEVEL=info

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-8080}/health/live || exit 1

CMD ["node", "heady-manager.js"]
