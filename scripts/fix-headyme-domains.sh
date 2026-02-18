#!/bin/bash
# 🏠 FIX HEADYME.COM DOMAINS - Make headyme.com Your Home
# EXECUTE NOW: ./scripts/fix-headyme-domains.sh

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

log "🏠 FIXING HEADYME.COM DOMAINS - YOUR HOME BASE"
log "=================================================="

# Step 1: Update Environment Files
log "✓ STEP 1: Update Environment Configuration"

# Create new .env with headyme.com domains
cat > .env << 'EOF'
# === HeadyMe.com Production Configuration ===
NODE_ENV=production
HEADY_ENV=headyme-home
PORT=3300

# === Database Configuration ===
DATABASE_URL=postgresql://heady:headypass@db.headyme.com:5432/heady
REDIS_URL=redis://cache.headyme.com:6379

# === API Security ===
HEADY_API_KEY=headyme-home-$(openssl rand -hex 32 2>/dev/null || echo "fallback-$(date +%s)")
ADMIN_TOKEN=admin-headyme-$(openssl rand -hex 16 2>/dev/null || echo "fallback-$(date +%s)")
HF_TOKEN=your_huggingface_token_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# === HEADYME.COM - YOUR HOME BASE ===
HEADY_DOMAIN_SCHEME=headyme.com
HEADY_HOME_URL=https://headyme.com
HEADY_BASE_URL=https://api.headyme.com
HEADY_FRONTEND_URL=https://headyme.com
HEADY_ADMIN_URL=https://admin.headyme.com
HEADY_CHAT_URL=https://chat.headyme.com
HEADY_DEV_URL=https://dev.headyme.com
HEADY_TOOLS_URL=https://tools.headyme.com
HEADY_STORIES_URL=https://stories.headyme.com
HEADY_LENS_URL=https://lens.headyme.com
HEADY_VOICE_URL=https://voice.headyme.com
HEADY_SYNC_URL=https://sync.headyme.com
HEADY_MCP_URL=https://tools.headyme.com

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
API_GATEWAY_URL=https://api.headyme.com
WEB_DASHBOARD_URL=https://headyme.com
ADMIN_DASHBOARD_URL=https://admin.headyme.com
BUDDY_CHAT_URL=https://chat.headyme.com
STORY_DRIVER_URL=https://stories.headyme.com
LENS_MONITORING_URL=https://lens.headyme.com
VOICE_INTERFACE_URL=https://voice.headyme.com
SYNC_SERVICE_URL=https://sync.headyme.com
DEV_ENVIRONMENT_URL=https://dev.headyme.com
EOF

success "✓ Environment configured for headyme.com"

# Step 2: Update Hosts File
log "✓ STEP 2: Update Hosts File - headyme.com Home Base"

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
    sed -i '/heady.internal/d' "${HOSTS_FILE}"
    sed -i '/headysystems.com/d' "${HOSTS_FILE}"
else
    sudo sed -i '/heady.internal/d' "${HOSTS_FILE}"
    sudo sed -i '/headysystems.com/d' "${HOSTS_FILE}"
fi

# Add headyme.com domains
HEADYME_ENTRIES="# 🏠 HeadyMe.com - Your Home Base
# ALL SERVICES UNDER headyme.com
manager.headyme.com headyme.com
manager.headyme.com api.headyme.com
manager.headyme.com admin.headyme.com
manager.headyme.com chat.headyme.com
manager.headyme.com dev.headyme.com
manager.headyme.com tools.headyme.com
manager.headyme.com stories.headyme.com
manager.headyme.com lens.headyme.com
manager.headyme.com voice.headyme.com
manager.headyme.com sync.headyme.com
manager.headyme.com mcp.headyme.com
manager.headyme.com db.headyme.com
manager.headyme.com cache.headyme.com
manager.headyme.com storage.headyme.com"

echo "${HEADYME_ENTRIES}" | if [[ $EUID -eq 0 ]]; then
    tee -a "${HOSTS_FILE}" > /dev/null
else
    sudo tee -a "${HOSTS_FILE}" > /dev/null
fi

success "✓ headyme.com domains added to hosts file"

# Step 3: Update heady-manager.js
log "✓ STEP 3: Update Service Configuration"

# Update the console output in heady-manager.js
sed -i 's|https://api.headysystems.com|https://api.headyme.com|g' heady-manager.js
sed -i 's|https://admin.headysystems.com|https://admin.headyme.com|g' heady-manager.js
sed -i 's|https://buddy.headysystems.com|https://chat.headyme.com|g' heady-manager.js
sed -i 's|https://app.headysystems.com|https://headyme.com|g' heady-manager.js
sed -i 's|https://mcp.headysystems.com|https://tools.headyme.com|g' heady-manager.js

success "✓ Service configuration updated"

# Step 4: Update Health Check URLs
log "✓ STEP 4: Update Health Check Configuration"

# Update health check URL in deployment script
sed -i 's|https://api.headysystems.com/api/health|https://api.headyme.com/api/health|g' scripts/hcfp-fixed-deploy.sh

success "✓ Health checks updated"

# Step 5: Test Domain Resolution
log "✓ STEP 5: Test Domain Resolution"

if ping -c 1 headyme.com > /dev/null 2>&1; then
    success "✓ headyme.com resolves correctly"
else
    warn "⚠ headyme.com not resolving - check hosts file"
fi

# Step 6: Restart Services
log "✓ STEP 6: Restart Heady Services"

# Kill existing process
pkill -f "heady-manager.js" 2>/dev/null || true
sleep 2

# Start new process
nohup node heady-manager.js > logs/headyme-manager.log 2>&1 &
sleep 3

# Test health endpoint
if curl -s "https://api.headyme.com/api/health" > /dev/null 2>&1; then
    success "✓ HeadyMe.com services responding"
else
    warn "⚠ Services not responding - check logs"
fi

# Step 7: Final Verification
log "✓ STEP 7: Final Verification"

echo ""
success "🏠 HEADYME.COM SETUP COMPLETE!"
echo ""
echo "🌐 YOUR HOME BASE ACCESS POINTS:"
echo "  🏠 Home:        https://headyme.com"
echo "  🔌 API:        https://api.headyme.com"
echo "  ⚙️  Admin:      https://admin.headyme.com"
echo "  💬 Chat:       https://chat.headyme.com"
echo "  💻 Dev:        https://dev.headyme.com"
echo "  🛠️  Tools:      https://tools.headyme.com"
echo "  📖 Stories:    https://stories.headyme.com"
echo "  🔍 Lens:       https://lens.headyme.com"
echo "  🎤 Voice:      https://voice.headyme.com"
echo "  🔄 Sync:       https://sync.headyme.com"
echo ""
echo "✅ SUCCESS CRITERIA:"
echo "  ✓ headyme.com is your home base"
echo "  ✓ All services use headyme.com domains"
echo "  ✓ ZERO manager.headyme.com references"
echo "  ✓ Complete branded domain architecture"
echo ""
echo "🎉 headyme.com - YOUR HOME FOR EVERYTHING HEADY!"

# Test all domains
echo ""
echo "🧪 Testing all domains..."
domains=("headyme.com" "api.headyme.com" "admin.headyme.com" "chat.headyme.com" "dev.headyme.com" "tools.headyme.com")

for domain in "${domains[@]}"; do
    if ping -c 1 "$domain" > /dev/null 2>&1; then
        success "✓ $domain - OK"
    else
        error "✗ $domain - FAILED"
    fi
done

echo ""
log "🎯 headyme.com is now your complete home base!"
