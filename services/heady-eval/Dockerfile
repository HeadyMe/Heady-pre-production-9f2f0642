# ─── HeadyEval Dockerfile ─────────────────────────────────────────────────────
# Multi-stage build for production.
# Node.js 20 Alpine for minimal image size.
# Sacred Geometry scaling: PHI = 1.618

# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native modules
RUN apk add --no-cache python3 make g++

# Copy package manifests
COPY package.json package-lock.json* ./

# Install production deps only
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ─── Stage 2: Production image ────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S -u 1001 -G heady heady

# Copy deps from stage 1
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# Create storage directories (mounted as volumes in prod)
RUN mkdir -p /tmp/heady-eval/datasets \
             /tmp/heady-eval/runs \
             /tmp/heady-eval/checkpoints && \
    chown -R heady:heady /tmp/heady-eval /app

# Switch to non-root user
USER heady

# Service port
EXPOSE 3107

# Health check — call /health every 30s
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3107/health || exit 1

# Environment defaults
ENV NODE_ENV=production \
    HEADY_EVAL_PORT=3107 \
    HEADY_EVAL_JUDGE_MODEL=claude-3.5-sonnet \
    HEADY_EVAL_CONCURRENCY=5 \
    HEADY_EVAL_DEFAULT_SCORERS=relevance,faithfulness,safety,coherence,helpfulness \
    HEADY_INFER_URL=http://heady-infer:3101 \
    HEADY_EMBED_URL=http://heady-embed:3102 \
    HEADY_GUARD_URL=http://heady-guard:3103

# Start service
CMD ["node", "index.js"]
