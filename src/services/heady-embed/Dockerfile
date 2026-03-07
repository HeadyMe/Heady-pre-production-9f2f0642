# ============================================================================
# HeadyEmbed — Multi-stage Dockerfile
# Stage 1: Build dependencies
# Stage 2: Slim runtime with pre-cached ONNX models
# ============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build
# Installs all dependencies (including native build tools for ONNX).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

# Install build essentials for native addons
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifests first (layer-cache friendly)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build tooling)
RUN npm ci --omit=dev && npm cache clean --force

# Copy application source
COPY . .

# Pre-download the default ONNX model weights into the image.
# This bakes the model into the image so cold starts are instant.
# Set HF cache dirs so Xenova stores models here.
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_HOME=/app/models
ENV HEADY_EMBED_MODEL=Xenova/all-MiniLM-L6-v2
ENV HEADY_EMBED_WARMUP=false
ENV HEADY_EMBED_CACHE_WARM=false

RUN node -e "\
const { ModelManager } = require('./models.js'); \
const mgr = new ModelManager({ cacheDir: '/app/models' }); \
mgr.loadModel('Xenova/all-MiniLM-L6-v2') \
   .then(() => { console.log('[Dockerfile] Model cached successfully'); process.exit(0); }) \
   .catch(err => { console.error('[Dockerfile] Model cache failed (non-fatal):', err.message); process.exit(0); }); \
" || true

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime
# Slim image with only production dependencies.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# Install only runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1001 heady && \
    useradd --uid 1001 --gid heady --shell /bin/bash --create-home heady

WORKDIR /app

# Copy production node_modules from builder
COPY --from=builder --chown=heady:heady /app/node_modules ./node_modules

# Copy pre-cached model weights
COPY --from=builder --chown=heady:heady /app/models ./models

# Copy application source
COPY --chown=heady:heady . .

# Create directories for runtime data
RUN mkdir -p /tmp/heady-embed-cache /tmp/heady-models && \
    chown -R heady:heady /tmp/heady-embed-cache /tmp/heady-models

# ─────────────────────────────────────────────────────────────────────────────
# Environment configuration
# ─────────────────────────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    HEADY_EMBED_PORT=3101 \
    HEADY_EMBED_HOST=0.0.0.0 \
    HEADY_EMBED_MODEL=Xenova/all-MiniLM-L6-v2 \
    HEADY_EMBED_BATCH_SIZE=32 \
    HEADY_EMBED_CACHE_SIZE=10000 \
    HEADY_EMBED_CACHE_TTL=86400000 \
    HEADY_EMBED_DIMENSIONS=384 \
    HEADY_EMBED_MODEL_CACHE_DIR=/app/models \
    TRANSFORMERS_CACHE=/app/models \
    HF_HOME=/app/models \
    # Node.js performance tuning
    NODE_OPTIONS="--max-old-space-size=1536"

# ─────────────────────────────────────────────────────────────────────────────
# Runtime settings
# ─────────────────────────────────────────────────────────────────────────────
USER heady

EXPOSE 3101

# Health check: ping /health/live (fast liveness probe)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "\
const http = require('http'); \
const req = http.get('http://localhost:3101/health/live', (res) => { \
  process.exit(res.statusCode === 200 ? 0 : 1); \
}); \
req.on('error', () => process.exit(1)); \
req.setTimeout(5000, () => process.exit(1)); \
"

# Use dumb-init for proper signal forwarding and zombie reaping
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
