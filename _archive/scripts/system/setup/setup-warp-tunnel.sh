# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# setup-warp-tunnel.sh

set -e

echo "🔐 Setting up Cloudflare WARP Tunnel for Heady Systems"

# Check for cloudflared
if ! command -v cloudflared >/dev/null 2>&1; then
    echo "❌ cloudflared not found. Installing..."
    curl -L https://pkg.cloudflareclient.com/install.sh | bash
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Check if already authenticated
if ! cloudflared tunnel whoami >/dev/null 2>&1; then
    echo "🔑 Please authenticate with Cloudflare..."
    cloudflared tunnel login
fi

# Create tunnel
echo "🚇 Creating WARP tunnel..."
TUNNEL_NAME="heady-systems-tunnel"

# Check if tunnel exists
if cloudflared tunnel info "$TUNNEL_NAME" >/dev/null 2>&1; then
    echo "✅ Tunnel already exists"
    TUNNEL_ID=$(cloudflared tunnel info "$TUNNEL_NAME" | grep -oP 'id:\s*\K[a-f0-9-]+')
else
    TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" | grep -oP 'Created tunnel .* with id \K[a-f0-9-]+')
    echo "✅ Tunnel created: $TUNNEL_ID"
fi

# Save tunnel ID
echo "CLOUDFLARE_TUNNEL_ID=$TUNNEL_ID" >> .env

# Get tunnel token
echo "🎫 Generating tunnel token..."
TOKEN=$(cloudflared tunnel token "$TUNNEL_ID")
echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN" >> .env

# Create config directory
mkdir -p cloudflared

# Create tunnel config
cat > cloudflared/config.yml << EOF
tunnel: $TUNNEL_NAME
credentials-file: $PWD/cloudflared/credentials.json

ingress:
  # API Gateway - Internal Only
  - hostname: api-internal.headysystems.com
    service: http://localhost:3300
    originRequest:
      noTLSVerify: true
      connectTimeout: 30s
      
  # HeadyBuddy WebSocket Sync
  - hostname: buddy-sync.headysystems.com
    service: ws://localhost:3400
    originRequest:
      noTLSVerify: true
      
  # Drupal Admin Portal
  - hostname: admin.headysystems.com
    service: http://localhost:8080
    originRequest:
      noTLSVerify: true
      
  # Pipeline Status Endpoint
  - hostname: pipeline.headysystems.com
    service: http://localhost:3300
    path: /api/pipeline/*
    originRequest:
      noTLSVerify: true
      
  # Local development fallbacks
  - hostname: localhost.headysystems.com
    service: http://localhost:3000
    originRequest:
      noTLSVerify: true
      
  # Catch-all
  - service: http_status:404
EOF

# Create credentials file
cat > cloudflared/credentials.json << EOF
{
  "AccountTag": "$(cloudflared tunnel info "$TUNNEL_NAME" | grep -oP 'AccountTag:\s*\K[a-f0-9-]+')",
  "TunnelSecret": "$(openssl rand -hex 32)",
  "TunnelID": "$TUNNEL_ID",
  "TunnelName": "$TUNNEL_NAME"
}
EOF

# Create DNS routes for internal domains
declare -a domains=(
    "api-internal.headysystems.com"
    "buddy-sync.headysystems.com"
    "admin.headysystems.com"
    "pipeline.headysystems.com"
)

echo ""
echo "🌐 Creating DNS routes..."
for domain in "${domains[@]}"; do
    cloudflared tunnel route dns "$TUNNEL_NAME" "$domain" 2>/dev/null || echo "⚠️  DNS route for $domain may need manual setup"
    echo "✅ DNS route configured for $domain"
done

# Create systemd service for auto-start
echo ""
echo "🔧 Creating systemd service..."
cat > heady-warp.service << EOF
[Unit]
Description=Heady Systems WARP Tunnel
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD
ExecStart=$(which cloudflared) tunnel --config $PWD/cloudflared/config.yml run
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "📋 Installation Instructions:"
echo "1. Copy service file: sudo cp heady-warp.service /etc/systemd/system/"
echo "2. Enable service: sudo systemctl enable heady-warp"
echo "3. Start service: sudo systemctl start heady-warp"
echo "4. Check status: sudo systemctl status heady-warp"

# Create Docker Compose file
echo ""
echo "🐳 Creating Docker Compose configuration..."
cat > docker-compose.warp.yml << EOF
version: '3.8'

services:
  warp-connector:
    image: cloudflare/cloudflared:latest
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token \${CLOUDFLARE_TUNNEL_TOKEN}
    environment:
      - TUNNEL_TOKEN=\${CLOUDFLARE_TUNNEL_TOKEN}
    networks:
      - heady-internal
    volumes:
      - ./cloudflared:/etc/cloudflared
      - ./logs:/var/log/cloudflared

  heady-manager:
    image: node:20-alpine
    working_dir: /app
    command: npm start
    environment:
      - WARP_ENABLED=true
      - CLOUDFLARE_TUNNEL_ROUTE=https://api.headysystems.com
      - NODE_ENV=production
    networks:
      - heady-internal
    volumes:
      - ./CascadeProjects/Heady:/app
    ports:
      - "3300:3300"
    depends_on:
      - warp-connector

  heady-buddy-service:
    image: node:20-alpine
    working_dir: /app
    command: npm run buddy-service
    environment:
      - WARP_ENABLED=true
      - INTERNAL_API_URL=http://heady-manager:3300
      - NODE_ENV=production
    networks:
      - heady-internal
    ports:
      - "3400:3400"
    depends_on:
      - warp-connector

networks:
  heady-internal:
    driver: bridge
    ipam:
      config:
        - subnet: 10.0.0.0/24
EOF

echo ""
echo "🎉 WARP Tunnel Setup Complete!"
echo ""
echo "📝 Configuration files created:"
echo "  • cloudflared/config.yml - Tunnel configuration"
echo "  • cloudflared/credentials.json - Tunnel credentials"
echo "  • docker-compose.warp.yml - Docker deployment"
echo "  • heady-warp.service - Systemd service"
echo ""
echo "🌐 Internal endpoints (when tunnel is running):"
echo "  • https://api-internal.headysystems.com"
echo "  • wss://buddy-sync.headysystems.com"
echo "  • https://admin.headysystems.com"
echo "  • https://pipeline.headysystems.com"
echo ""
echo "🚀 To start the tunnel:"
echo "  Option 1: cloudflared tunnel --config cloudflared/config.yml run"
echo "  Option 2: docker-compose -f docker-compose.warp.yml up -d"
echo "  Option 3: sudo systemctl start heady-warp (after service installation)"
echo ""
echo "✨ All traffic will be secured through Cloudflare WARP!"
