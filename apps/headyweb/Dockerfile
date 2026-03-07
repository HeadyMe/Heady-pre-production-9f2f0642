# HeadyWeb Universal Shell — Docker Image
# Multi-stage build: node:20-alpine builder + nginx:alpine runtime
#
# © 2026 HeadySystems Inc. PROPRIETARY AND CONFIDENTIAL.

# ── Stage 1: Builder ──────────────────────────────────────────────────────────

FROM node:20-alpine AS builder

LABEL org.opencontainers.image.title="HeadyWeb Universal Shell"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.vendor="HeadySystems Inc."
LABEL org.opencontainers.image.description="Webpack Module Federation shell for the Heady AI platform"

WORKDIR /app

# Install dependencies first (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Copy source
COPY . .

# Build shell + all remotes
RUN npm run build:all

# ── Stage 2: Runtime (nginx) ──────────────────────────────────────────────────

FROM nginx:1.25-alpine AS runtime

LABEL org.opencontainers.image.title="HeadyWeb Universal Shell"
LABEL org.opencontainers.image.version="3.1.0"
LABEL org.opencontainers.image.vendor="HeadySystems Inc."

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Ensure remotes directory structure exists
RUN mkdir -p /usr/share/nginx/html/remotes

# nginx runs as www-data for security
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
