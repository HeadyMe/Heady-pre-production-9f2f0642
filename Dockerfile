FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts 2>/dev/null || true

# Copy source
COPY src/ ./src/

# Create data dirs at runtime
RUN mkdir -p data/vector-shards data/telemetry data/audio

# Environment
ENV NODE_ENV=production
ENV PORT=8080

# Start unified Heady + MCP bridge
EXPOSE 8080
CMD ["node", "src/mcp/colab-mcp-bridge.js"]
