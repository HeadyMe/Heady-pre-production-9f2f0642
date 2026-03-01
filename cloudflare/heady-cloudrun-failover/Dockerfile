# ═══════════════════════════════════════════════════════════════
# Heady Cloud Run Failover — Lightweight edge failover service
# ═══════════════════════════════════════════════════════════════
FROM node:22-alpine
WORKDIR /app

# Security: non-root user
RUN addgroup -g 1001 -S heady && \
    adduser -S heady -u 1001 -G heady

COPY package.json .
RUN npm install --omit=dev 2>/dev/null; true
COPY server.js .

RUN chown -R heady:heady /app
USER heady

ENV NODE_ENV=production \
    PORT=8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

EXPOSE 8080
CMD ["node", "server.js"]
