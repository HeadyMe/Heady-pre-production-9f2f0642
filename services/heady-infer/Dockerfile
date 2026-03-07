# ──────────────────────────────────────────────────────────────────────────────
# HeadyInfer — Multi-Model Inference Gateway
# Node.js 20 LTS, Alpine-based for minimal image size
# ──────────────────────────────────────────────────────────────────────────────

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source
COPY . .

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: create non-root user
RUN addgroup -g 1001 -S heady && \
    adduser  -u 1001 -S heady -G heady

WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=heady:heady /app/node_modules ./node_modules
COPY --from=builder --chown=heady:heady /app .

# Switch to non-root
USER heady

# Expose port
EXPOSE 3102

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3102/health || exit 1

# Labels
LABEL org.opencontainers.image.title="HeadyInfer" \
      org.opencontainers.image.description="Multi-model inference gateway for Heady AI" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.source="https://github.com/heady/heady-native-services"

# Start server
CMD ["node", "server.js"]
