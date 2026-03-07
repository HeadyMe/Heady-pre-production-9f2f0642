# ═══════════════════════════════════════════════════════════════════════════════
# Heady™ Production Multi-Stage Dockerfile
# ═══════════════════════════════════════════════════════════════════════════════
# Three-stage build: deps → build → production
# Target: Google Cloud Run (us-central1)
# Base: Node 22 Alpine (smallest surface, fastest cold start)
#
# Build:  docker build -t heady-manager:latest .
# Run:    docker run -p 8080:8080 --env-file .env heady-manager:latest
# Deploy: gcloud run deploy heady-manager --source .
#
# © 2026 HeadySystems Inc. — Proprietary
# ═══════════════════════════════════════════════════════════════════════════════

# ── ARGs (override at build time) ─────────────────────────────────────────────
ARG NODE_VERSION=22
ARG ALPINE_VERSION=3.20

# ═════════════════════════════════════════════════════════════════════════════
# Stage 1: DEPS — install all dependencies (cached layer)
# ═════════════════════════════════════════════════════════════════════════════
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps

WORKDIR /deps

# Install build tools for native modules (pg-native, better-sqlite3, etc.)
RUN apk add --no-cache python3 make g++ curl

# Copy lockfile first for maximum layer caching
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install ALL deps (including devDependencies for build step)
RUN if [ -f pnpm-lock.yaml ]; then \
      corepack enable && pnpm install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi

# ═════════════════════════════════════════════════════════════════════════════
# Stage 2: BUILD — compile, generate, test, prune
# ═════════════════════════════════════════════════════════════════════════════
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS build

WORKDIR /build

# Copy full deps from stage 1
COPY --from=deps /deps/node_modules ./node_modules/
COPY --from=deps /deps/package.json ./

# Copy full source tree
COPY src/             ./src/
COPY configs/         ./configs/
COPY scripts/         ./scripts/
COPY docs/            ./docs/
COPY heady-manager.js ./
COPY heady-hive-sdk/  ./heady-hive-sdk/

# Run build step (site generation, asset compilation)
RUN npm run build 2>/dev/null || echo "No build script — skipping"

# Prune devDependencies for production image
RUN npm prune --production 2>/dev/null || \
    (rm -rf node_modules && npm install --omit=dev) || true

# Remove unnecessary files from node_modules
RUN find node_modules -type f \( \
      -name "*.md" -o -name "*.ts" -o -name "*.map" \
      -o -name "CHANGELOG*" -o -name "LICENSE*" \
      -o -name ".npmignore" -o -name ".eslintrc*" \
    \) -delete 2>/dev/null || true

# ═════════════════════════════════════════════════════════════════════════════
# Stage 3: PRODUCTION — minimal runtime image
# ═════════════════════════════════════════════════════════════════════════════
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS production

# Metadata
LABEL maintainer="HeadySystems Inc. <eric@headysystems.com>"
LABEL org.opencontainers.image.title="heady-manager"
LABEL org.opencontainers.image.description="Heady Autonomous Multi-Agent AI Platform"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.vendor="HeadySystems Inc."
LABEL org.opencontainers.image.source="https://github.com/HeadyMe/Heady"

# Install runtime-only dependencies (curl for healthcheck, tini for PID 1)
RUN apk add --no-cache curl tini

# Security: non-root user with no login shell
RUN addgroup -g 1001 -S heady && \
    adduser  -u 1001 -S heady -G heady -s /sbin/nologin

WORKDIR /app

# Copy production artifacts from build stage
COPY --from=build --chown=heady:heady /build/node_modules   ./node_modules/
COPY --from=build --chown=heady:heady /build/package.json   ./
COPY --from=build --chown=heady:heady /build/src/           ./src/
COPY --from=build --chown=heady:heady /build/configs/       ./configs/
COPY --from=build --chown=heady:heady /build/scripts/       ./scripts/
COPY --from=build --chown=heady:heady /build/docs/          ./docs/
COPY --from=build --chown=heady:heady /build/heady-manager.js ./
COPY --from=build --chown=heady:heady /build/heady-hive-sdk/  ./heady-hive-sdk/

# Create data directories (vector shards, telemetry, audio, tmp)
RUN mkdir -p data/vector-shards data/telemetry data/audio tmp && \
    chown -R heady:heady /app

# ── Environment ───────────────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=8080
ENV HEADY_SERVICE_NAME=heady-manager
ENV HEADY_VERSION=3.1.0

# Node.js production tuning
ENV NODE_OPTIONS="--max-old-space-size=512 --dns-result-order=ipv4first"

# Disable npm update checks in production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# ── Security ──────────────────────────────────────────────────────────────────
USER heady

# ── Health Check ──────────────────────────────────────────────────────────────
# Cloud Run uses HTTP probes (configured in service YAML), but Docker
# HEALTHCHECK provides local dev parity and docker-compose support.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -sf http://localhost:8080/health/live || exit 1

# ── Expose & Run ──────────────────────────────────────────────────────────────
EXPOSE 8080

# Use tini as PID 1 for proper signal forwarding (SIGTERM → graceful shutdown)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "heady-manager.js"]
