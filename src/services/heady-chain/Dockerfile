# ──────────────────────────────────────────────────────────────────
# HeadyChain Service — Multi-stage Docker Build
# Node.js 20 LTS + Alpine for minimal image size
# ──────────────────────────────────────────────────────────────────

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install system deps needed for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Test runner (dev deps included)
FROM node:20-alpine AS test
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm test

# Stage 3: Production image
FROM node:20-alpine AS production
LABEL maintainer="Heady AI Platform <platform@heady.ai>"
LABEL service="heady-chain"
LABEL version="1.0.0"

# Sacred Geometry constant in label
LABEL heady.phi="1.618033988749895"

WORKDIR /app

# Security: create non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -u 1001 -S heady -G heady && \
    mkdir -p /tmp/heady-chain/checkpoints && \
    chown -R heady:heady /tmp/heady-chain

# Copy production deps from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=heady:heady . .

# Remove test files from production image
RUN rm -rf __tests__ *.test.js

USER heady

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.HEADY_CHAIN_PORT || 3007) + '/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

EXPOSE 3007

# Environment defaults
ENV NODE_ENV=production \
    HEADY_CHAIN_PORT=3007 \
    LOG_LEVEL=info \
    CHECKPOINT_ENABLED=true \
    CHECKPOINT_DIR=/tmp/heady-chain/checkpoints \
    HEADY_INFER_URL=http://heady-infer:3003 \
    HEADY_VECTOR_URL=http://heady-vector:3006 \
    MAX_PARALLEL_NODES=10 \
    DEFAULT_WORKFLOW_TIMEOUT_MS=300000

CMD ["node", "server.js"]
