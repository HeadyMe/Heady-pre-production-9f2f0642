# ─── HeadyGuard Dockerfile ────────────────────────────────────────────────────
# Multi-stage build: builder installs deps, runner is lean production image.
# Compatible with Cloud Run (listens on $PORT / HEADY_GUARD_PORT).
# Node.js 20 LTS — matches Heady platform baseline.

# ── Stage 1: dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package manifests only (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev --ignore-scripts \
    && npm cache clean --force


# ── Stage 2: production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -S heady && adduser -S heady -G heady

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps --chown=heady:heady /app/node_modules ./node_modules

# Copy service source
COPY --chown=heady:heady . .

# ── Environment defaults ──────────────────────────────────────────────────────
ENV NODE_ENV=production \
    HEADY_GUARD_PORT=3106 \
    HEADY_GUARD_HOST=0.0.0.0 \
    HEADY_GUARD_LOG_LEVEL=info

# Cloud Run sends traffic to $PORT; honour it if set
ENV PORT=${HEADY_GUARD_PORT}

# Non-root user
USER heady

# Expose service port
EXPOSE 3106

# Health check (Docker / Kubernetes liveness probe)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${HEADY_GUARD_PORT}/health | grep -q '"status"' || exit 1

# Start server
CMD ["node", "server.js"]
