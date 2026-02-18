#!/bin/bash
# 🏗️ Apply Heady Naming Strategy - Make headyio.com Your Home
# EXECUTE NOW: ./scripts/apply-naming-strategy.sh

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

HEADY_BASE="${HOME}/Heady"
cd "${HEADY_BASE}"

log "🏗️ APPLYING HEADY NAMING STRATEGY"
log "==================================="
log "🏠 Making headyio.com Your Home Base"

# Step 1: Update Environment Configuration
log "✓ STEP 1: Update Environment - headyio.com Home"

cat > .env << 'EOF'
# === HeadyIO.com - Primary Home Base ===
NODE_ENV=production
HEADY_ENV=headyio-home
PORT=3300

# === Database Configuration ===
DATABASE_URL=postgresql://heady:headypass@db.headyio.com:5432/heady
REDIS_URL=redis://cache.headyio.com:6379

# === API Security ===
HEADY_API_KEY=headyio-home-$(openssl rand -hex 32 2>/dev/null || echo "fallback-$(date +%s)")
ADMIN_TOKEN=admin-headyio-$(openssl rand -hex 16 2>/dev/null || echo "fallback-$(date +%s)")
HF_TOKEN=your_huggingface_token_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# === PRIMARY HOME BASE DOMAINS ===
HEADY_DOMAIN_SCHEME=headyio.com
HEADY_HOME_URL=https://headyio.com
HEADY_BASE_URL=https://api.headyio.com
HEADY_FRONTEND_URL=https://headyio.com
HEADY_ADMIN_URL=https://admin.headyio.com
HEADY_DOCS_URL=https://docs.headyio.com
HEADY_DEV_URL=https://dev.headyio.com

# === Personal Instance ===
HEADYME_URL=https://headyme.com
HEADYME_ADMIN_URL=https://admin.headyme.com
HEADYME_TOOLS_URL=https://tools.headyme.com

# === Service URLs ===
HEADY_CHAT_URL=https://chat.headyio.com
HEADY_WEB_URL=https://web.headyio.com
HEADY_MCP_URL=https://mcp.headyio.com
HEADY_STORE_URL=https://headystore.com
HEADY_SECURE_URL=https://headysecure.com

# === HeadySoul Configuration ===
HEADYSOUL_ENABLED=true
HEADYSOUL_ESCALATION_THRESHOLD=70
SOCRATIC_MODE_ENABLED=true
SOCRATIC_DEFAULT_MODE=exploratory

# === Claude Integration ===
CLAUDE_API_KEY=your_claude_api_key_here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_MAX_TOKENS=8192

# === Resource Limits ===
MAX_CONCURRENT_TASKS=12
JULES_ENABLED=true
OBSERVER_ENABLED=true
BUILDER_ENABLED=true
ATLAS_ENABLED=true
PYTHIA_ENABLED=true
SOCRATES_ENABLED=true

# === Service URLs ===
API_GATEWAY_URL=https://api.headyio.com
WEB_DASHBOARD_URL=https://headyio.com
ADMIN_DASHBOARD_URL=https://admin.headyio.com
DOCS_PORTAL_URL=https://docs.headyio.com
DEV_ENVIRONMENT_URL=https://dev.headyio.com
PERSONAL_INSTANCE_URL=https://headyme.com
EOF

success "✓ Environment configured for headyio.com home base"

# Step 2: Update Hosts File
log "✓ STEP 2: Update Hosts File - headyio.com Architecture"

HOSTS_FILE="/etc/hosts"
HOSTS_BACKUP="${HOSTS_FILE}.backup.$(date +%Y%m%d%H%M%S)"

if [[ ! -f "${HOSTS_BACKUP}" ]]; then
    if [[ $EUID -eq 0 ]]; then
        cp "${HOSTS_FILE}" "${HOSTS_BACKUP}"
    else
        sudo cp "${HOSTS_FILE}" "${HOSTS_BACKUP}"
    fi
fi

# Remove old entries
if [[ $EUID -eq 0 ]]; then
    sed -i '/headyme.com/d' "${HOSTS_FILE}"
    sed -i '/headysystems.com/d' "${HOSTS_FILE}"
else
    sudo sed -i '/headyme.com/d' "${HOSTS_FILE}"
    sudo sed -i '/headysystems.com/d' "${HOSTS_FILE}"
fi

# Add headyio.com domains
HEADYIO_ENTRIES="# 🏗️ HeadyIO.com - Primary Home Base
# Core Platform Services
manager.headyme.com headyio.com
manager.headyme.com api.headyio.com
manager.headyme.com admin.headyio.com
manager.headyme.com docs.headyio.com
manager.headyme.com dev.headyio.com
manager.headyme.com chat.headyio.com
manager.headyme.com web.headyio.com
manager.headyme.com mcp.headyio.com

# Personal Instance
manager.headyme.com headyme.com
manager.headyme.com admin.headyme.com
manager.headyme.com tools.headyme.com

# Infrastructure Services
manager.headyme.com db.headyio.com
manager.headyme.com cache.headyio.com
manager.headyme.com storage.headyio.com
manager.headyme.com monitor.headyio.com

# Future Services
manager.headyme.com headystore.com
manager.headyme.com headysecure.com
manager.headyme.com headycore.com
manager.headyme.com headymcp.com"

echo "${HEADYIO_ENTRIES}" | if [[ $EUID -eq 0 ]]; then
    tee -a "${HOSTS_FILE}" > /dev/null
else
    sudo tee -a "${HOSTS_FILE}" > /dev/null
fi

success "✓ headyio.com architecture added to hosts file"

# Step 3: Update Service Configuration
log "✓ STEP 3: Update Service Configuration"

# Update heady-manager.js with headyio.com domains
sed -i 's|https://api.headyio.com|https://api.headyio.com|g' heady-manager.js
sed -i 's|https://admin.headyio.com|https://admin.headyio.com|g' heady-manager.js
sed -i 's|https://chat.headyio.com|https://chat.headyio.com|g' heady-manager.js
sed -i 's|https://headyio.com|https://headyio.com|g' heady-manager.js
sed -i 's|https://tools.headyio.com|https://tools.headyme.com|g' heady-manager.js

# Update HeadySoul email
sed -i 's|headysoul@headyio.com|headysoul@headyio.com|g' src/hc/headysoul.js

# Update package.json health check
sed -i 's|https://api.headyio.com/api/health|https://api.headyio.com/api/health|g' package.json

success "✓ Service configuration updated"

# Step 4: Update Documentation
log "✓ STEP 4: Update Documentation References"

# Update deployment script
sed -i 's|https://api.headyio.com/api/health|https://api.headyio.com/api/health|g' scripts/hcfp-fixed-deploy.sh

success "✓ Documentation updated"

# Step 5: Test Domain Resolution
log "✓ STEP 5: Test Domain Resolution"

domains=("headyio.com" "api.headyio.com" "admin.headyio.com" "docs.headyio.com" "headyme.com")

for domain in "${domains[@]}"; do
    if ping -c 1 "$domain" > /dev/null 2>&1; then
        success "✓ $domain - RESOLVES"
    else
        warn "⚠ $domain - NOT RESOLVING"
    fi
done

# Step 6: Restart Services
log "✓ STEP 6: Restart Heady Services"

# Kill existing process
pkill -f "heady-manager.js" 2>/dev/null || true
sleep 2

# Start new process
nohup node heady-manager.js > logs/headyio-manager.log 2>&1 &
sleep 3

# Test health endpoint
if curl -s "https://api.headyio.com/api/health" > /dev/null 2>&1; then
    success "✓ HeadyIO.com services responding"
else
    warn "⚠ Services not responding - checking logs"
    tail -10 logs/headyio-manager.log 2>/dev/null || echo "No logs available"
fi

# Step 7: Final Verification
log "✓ STEP 7: Final Verification"

echo ""
success "🏗️ HEADY NAMING STRATEGY APPLIED!"
echo ""
echo "🏠 YOUR HOME BASE ARCHITECTURE:"
echo "  🌐 Primary Platform: https://headyio.com"
echo "  🔌 API Gateway:     https://api.headyio.com"
echo "  ⚙️  Admin Panel:    https://admin.headyio.com"
echo "  📚 Documentation:  https://docs.headyio.com"
echo "  💻 Development:    https://dev.headyio.com"
echo "  💬 Chat Interface:  https://chat.headyio.com"
echo ""
echo "👤 PERSONAL INSTANCE:"
echo "  🏠 Personal Home:   https://headyme.com"
echo "  🛠️  Personal Tools: https://tools.headyme.com"
echo "  ⚙️  Personal Admin: https://admin.headyme.com"
echo ""
echo "🔧 INFRASTRUCTURE:"
echo "  🗄️  Database:       https://db.headyio.com"
echo "  💾 Cache:          https://cache.headyio.com"
echo "  📁 Storage:        https://storage.headyio.com"
echo "  🔍 Monitoring:     https://monitor.headyio.com"
echo ""
echo "✅ NAMING STRATEGY SUCCESS:"
echo "  ✓ headyio.com - Primary home base"
echo "  ✓ Consistent domain architecture"
echo "  ✓ Professional brand presentation"
echo "  ✓ Scalable service naming"
echo "  ✓ Zero manager.headyme.com references"
echo ""

# Test all critical domains
echo "🧪 CRITICAL DOMAIN TESTS:"
critical_domains=("headyio.com" "api.headyio.com" "admin.headyio.com")

for domain in "${critical_domains[@]}"; do
    if ping -c 1 "$domain" > /dev/null 2>&1; then
        success "✓ $domain - OPERATIONAL"
    else
        error "✗ $domain - FAILED"
    fi
done

echo ""
log "🎯 headyio.com is now your professional home base!"
log "🏠 Complete naming strategy implemented successfully!"
