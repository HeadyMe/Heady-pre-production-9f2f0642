# ═══════════════════════════════════════════════════════════════
# Heady™ HeadyWeb Production Dockerfile
# Zero-friction dynamic deployment: `gcloud run deploy --source .`
# All 9 domains served from a single Cloud Run container.
# © 2026 Heady Systems LLC. All Rights Reserved.
# ═══════════════════════════════════════════════════════════════

# ── Stage 1: Builder ──────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /build

# Copy package files and install deps
COPY package*.json ./
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Copy everything needed for production
COPY src/ ./src/
COPY configs/ ./configs/
COPY scripts/ ./scripts/
COPY docs/ ./docs/

# Prune devDependencies for production
RUN npm prune --production 2>/dev/null || true

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-slim AS production

# Security: non-root user
RUN groupadd -r heady && useradd -r -g heady -m -s /bin/false heady

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder /build/node_modules ./node_modules/
COPY --from=builder /build/package.json ./

# Copy application code
COPY --from=builder /build/src/ ./src/
COPY --from=builder /build/configs/ ./configs/
COPY --from=builder /build/scripts/ ./scripts/
COPY --from=builder /build/docs/ ./docs/

# Copy root-level files needed at runtime
COPY heady-manager.js ./
COPY heady-hive-sdk/ ./heady-hive-sdk/

# NOTE: .env is NOT copied — use Cloud Run env vars or Secret Manager

# Create data dirs owned by heady user
RUN mkdir -p data/vector-shards data/telemetry data/audio && \
    chown -R heady:heady /app

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Switch to non-root user
USER heady

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:8080/health',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

# Start HeadyWeb — the full Express server with all services
EXPOSE 8080
CMD ["node", "heady-manager.js"]
