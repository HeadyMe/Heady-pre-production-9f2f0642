# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# 🚀 Heady Local Installation Script
# Install fully functional Heady ecosystem on local devices

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"; }
error() { echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"; }

# Installation paths
HEADY_INSTALL_DIR="${HOME}/HeadyLocal"
SERVICE_DIR="/etc/systemd/system"
NGINX_DIR="/etc/nginx/sites-available"

log "🚀 Starting Heady Local Installation"
log "===================================="

# Step 1: System Preparation
log "✓ STEP 1: System Preparation"

# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y \
    nodejs \
    npm \
    postgresql \
    redis-server \
    nginx \
    git \
    curl \
    wget \
    build-essential \
    python3 \
    python3-pip \
    sqlite3

success "✅ System dependencies installed"

# Step 2: Create Heady Directory Structure
log "✓ STEP 2: Creating Heady Directory Structure"

mkdir -p "${HEADY_INSTALL_DIR}"
mkdir -p "${HEADY_INSTALL_DIR}/apps"
mkdir -p "${HEADY_INSTALL_DIR}/services"
mkdir -p "${HEADY_INSTALL_DIR}/data"
mkdir -p "${HEADY_INSTALL_DIR}/logs"
mkdir -p "${HEADY_INSTALL_DIR}/config"

success "✅ Directory structure created"

# Step 3: Install HeadyManager Service
log "✓ STEP 3: Installing HeadyManager"

# Copy HeadyManager files
cp -r /home/headyme/CascadeProjects/Heady "${HEADY_INSTALL_DIR}/services/"
cd "${HEADY_INSTALL_DIR}/services/Heady"

# Install dependencies
npm install

# Create production environment
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3300
HEADY_ENV=local-production
DATABASE_URL=postgresql://heady:headypass@localhost:5432/heady
REDIS_URL=redis://localhost:6379
HEADY_BASE_URL=http://localhost:3300
EOF

# Create systemd service
sudo tee "${SERVICE_DIR}/heady-manager.service" > /dev/null << EOF
[Unit]
Description=HeadyManager Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=headyme
WorkingDirectory=${HEADY_INSTALL_DIR}/services/Heady
ExecStart=/usr/bin/node heady-manager.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable heady-manager

success "✅ HeadyManager service installed"

# Step 4: Install HeadyWeb
log "✓ STEP 4: Installing HeadyWeb"

# Copy HeadyWeb files
cp -r /home/headyme/CascadeProjects/Heady/headyconnection-web "${HEADY_INSTALL_DIR}/apps/"
cd "${HEADY_INSTALL_DIR}/apps/headyconnection-web"

# Install dependencies
npm install
npm run build

# Create systemd service
sudo tee "${SERVICE_DIR}/heady-web.service" > /dev/null << EOF
[Unit]
Description=HeadyWeb Service
After=network.target heady-manager.service

[Service]
Type=simple
User=headyme
WorkingDirectory=${HEADY_INSTALL_DIR}/apps/headyconnection-web
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable heady-web

success "✅ HeadyWeb service installed"

# Step 5: Database Setup
log "✓ STEP 5: Database Configuration"

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "CREATE DATABASE heady;"
sudo -u postgres psql -c "CREATE USER heady WITH PASSWORD 'headypass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE heady TO heady;"

# Setup tables
sudo -u postgres psql -d heady -c "
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";

CREATE TABLE IF NOT EXISTS socratic_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,
    hypothesis TEXT,
    questions_asked JSONB DEFAULT '[]',
    insights_gained JSONB DEFAULT '{}',
    context VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    timeline JSONB DEFAULT '{}',
    summary TEXT,
    is_completed BOOLEAN DEFAULT FALSE,
    impact_score INTEGER DEFAULT 0,
    refs JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);
"

success "✅ Database configured"

# Step 6: Redis Setup
log "✓ STEP 6: Redis Configuration"

# Start Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Configure Redis
sudo tee -a /etc/redis/redis.conf > /dev/null << 'EOF'

# Heady Configuration
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
EOF

sudo systemctl restart redis-server

success "✅ Redis configured"

# Step 7: Nginx Configuration
log "✓ STEP 7: Nginx Reverse Proxy"

# Create Nginx config
sudo tee "${NGINX_DIR}/heady-local" > /dev/null << 'EOF'
server {
    listen 80;
    server_name localhost;

    # HeadyWeb
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # HeadyManager API
    location /api/ {
        proxy_pass http://localhost:3300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health endpoints
    location /health {
        proxy_pass http://localhost:3300/api/health;
        proxy_set_header Host $host;
    }
}
EOF

# Enable site
sudo ln -sf "${NGINX_DIR}/heady-local" "/etc/nginx/sites-enabled/"
sudo rm -f "/etc/nginx/sites-enabled/default"

# Test and restart Nginx
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

success "✅ Nginx configured"

# Step 8: Start All Services
log "✓ STEP 8: Starting Heady Services"

sudo systemctl start heady-manager
sudo systemctl start heady-web

# Wait for services to start
sleep 5

success "✅ All Heady services started"

# Step 9: Health Verification
log "✓ STEP 9: Health Verification"

# Check service status
if systemctl is-active --quiet heady-manager; then
    success "✅ HeadyManager: RUNNING"
else
    error "❌ HeadyManager: FAILED"
fi

if systemctl is-active --quiet heady-web; then
    success "✅ HeadyWeb: RUNNING"
else
    error "❌ HeadyWeb: FAILED"
fi

# Test endpoints
if curl -s http://localhost/api/health > /dev/null; then
    success "✅ API Health: PASS"
else
    error "❌ API Health: FAIL"
fi

if curl -s http://localhost/health > /dev/null; then
    success "✅ Web Health: PASS"
else
    error "❌ Web Health: FAIL"
fi

# Step 10: Final Setup
log "✓ STEP 10: Final Configuration"

# Create desktop shortcuts
mkdir -p "${HOME}/Desktop"

cat > "${HOME}/Desktop/HeadyWeb.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=HeadyWeb
Comment=HeadyWeb Local Interface
Exec=xdg-open http://localhost
Icon=applications-internet
Terminal=false
Categories=Development;
EOF

cat > "${HOME}/Desktop/HeadyManager.desktop" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=HeadyManager
Comment=HeadyManager API Interface
Exec=xdg-open http://localhost/api/health
Icon=applications-system
Terminal=false
Categories=Development;
EOF

chmod +x "${HOME}/Desktop"/*.desktop

# Create startup script
cat > "${HOME}/start-heady.sh" << 'EOF'
#!/bin/bash
echo "🚀 Starting Heady Local Services..."
sudo systemctl start heady-manager
sudo systemctl start heady-web
echo "✅ Services started!"
echo "🌐 HeadyWeb: http://localhost"
echo "🎛️ HeadyManager: http://localhost/api/health"
sleep 2
xdg-open http://localhost
EOF

chmod +x "${HOME}/start-heady.sh"

success "✅ Desktop shortcuts and startup script created"

# Final Report
echo ""
success "==================================================="
success "🎉 HEADING LOCAL INSTALLATION COMPLETE!"
echo ""
success "📍 Installation Directory: ${HEADY_INSTALL_DIR}"
success "🌐 HeadyWeb: http://localhost"
success "🎛️ HeadyManager API: http://localhost/api/health"
success "📊 System Status: http://localhost/api/health"
success "🧠 Memory Stats: http://localhost/api/memory/stats"
echo ""
success "🔧 Service Management:"
echo "  Start: sudo systemctl start heady-manager heady-web"
echo "  Stop: sudo systemctl stop heady-manager heady-web"
echo "  Status: sudo systemctl status heady-manager heady-web"
echo "  Logs: sudo journalctl -u heady-manager -f"
echo ""
success "🚀 Quick Start:"
echo "  Run: ${HOME}/start-heady.sh"
echo "  Or click desktop shortcuts"
echo ""
success "📱 Mobile Access:"
echo "  Connect to same WiFi network"
echo "  Use your IP address: http://$(hostname -I | awk '{print $1}')"
echo ""
success "✅ FULLY FUNCTIONAL LOCAL HEADING READY!"
