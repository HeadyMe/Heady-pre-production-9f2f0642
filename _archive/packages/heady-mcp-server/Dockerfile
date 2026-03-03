FROM node:20-alpine
LABEL maintainer="HeadyAI" description="Heady MCP Server — 60+ AI tools via Model Context Protocol"
WORKDIR /app
COPY package.json server.js tools.js ./
RUN npm install --omit=dev 2>/dev/null; true
ENV HEADY_TRANSPORT=sse HEADY_MCP_PORT=3302 HEADY_URL=http://host.docker.internal:3301
EXPOSE 3302
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3302/health || exit 1
CMD ["node", "server.js"]
