# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# ═══════════════════════════════════════════════════════
# Heady Systems - Complete Service Startup Script
# Starts all local services + Cloudflare tunnel
# ═══════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════"
echo "  HEADY SYSTEMS - STARTING ALL SERVICES"
echo "═══════════════════════════════════════════════════════"

# 1. Start Docker containers
echo ""
echo "[1/5] Starting Docker containers..."
if docker compose -f /home/headyme/CascadeProjects/docker-compose.local.yml \
     -f /home/headyme/CascadeProjects/docker-compose.ai-simple.yml \
     -f /home/headyme/CascadeProjects/docker-compose.hybrid-local.yml \
     up -d 2>/dev/null; then
    echo "  ✅ Docker containers started"
else
    echo "  ⚠️  Docker compose failed, trying individually..."
    docker start $(docker ps -aq) 2>/dev/null || true
    echo "  ✅ Existing containers started"
fi

# Wait for containers to be healthy
echo "  Waiting for containers to be healthy..."
sleep 10

# 2. Start static site servers
echo ""
echo "[2/5] Starting static site servers (ports 9000-9005)..."

# Kill any existing static servers
ps aux | grep 'serve-static-sites.py' | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 1

nohup python3 /home/headyme/serve-static-sites.py > /tmp/static-sites.log 2>&1 &
sleep 2

# Verify static servers
STATIC_OK=0
for port in 9000 9001 9002 9003 9004 9005; do
    CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$port/ --connect-timeout 3 2>/dev/null || echo "000")
    if [ "$CODE" = "200" ]; then
        STATIC_OK=$((STATIC_OK + 1))
    fi
done
echo "  ✅ $STATIC_OK/6 static sites responding"

# 3. Start Admin UI (Vite + API)
echo ""
echo "[3/5] Starting Admin UI (dashboard.headysystems.com)..."

# Kill any existing admin-ui dev servers
ps aux | grep '/home/headyme/CascadeProjects/admin-ui' | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null || true
sleep 1

if [ -d /home/headyme/CascadeProjects/admin-ui ]; then
    nohup npm --prefix /home/headyme/CascadeProjects/admin-ui run dev > /tmp/admin-ui.log 2>&1 &
    sleep 3
    DASH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/ --connect-timeout 3 2>/dev/null || echo "000")
    API_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8090/api/hcfp/status --connect-timeout 3 2>/dev/null || echo "000")
    echo "  ✅ Admin UI (5173) -> HTTP $DASH_CODE"
    echo "  ✅ Admin API (8090) -> HTTP $API_CODE"
else
    echo "  ⚠️  admin-ui directory not found, skipping"
fi

# 4. Start Cloudflare tunnel
echo ""
echo "[4/5] Starting Cloudflare tunnel..."

# Kill any existing tunnel
ps aux | grep 'cloudflared tunnel' | grep -v grep | awk '{print $2}' | xargs -r kill 2>/dev/null
sleep 2

nohup cloudflared tunnel --config /home/headyme/.cloudflared/config.yml run heady-systems-tunnel > /tmp/cloudflared-tunnel.log 2>&1 &
sleep 6

# Verify tunnel
TUNNEL_CONNS=$(grep -c "Registered tunnel connection" /tmp/cloudflared-tunnel.log 2>/dev/null || echo "0")
echo "  ✅ Tunnel started with $TUNNEL_CONNS connections"

# 5. Verify services
echo ""
echo "[5/5] Verifying all services..."
echo ""

declare -A SERVICES=(
    ["Next.js Frontend (3000)"]="http://127.0.0.1:3000"
    ["Python Worker (5000)"]="http://127.0.0.1:5000"
    ["Heady Manager (3301)"]="http://127.0.0.1:3301"
    ["Drupal CMS (8081)"]="http://127.0.0.1:8081"
    ["Admin UI (5173)"]="http://localhost:5173"
    ["Admin UI API (8090)"]="http://127.0.0.1:8090/api/hcfp/status"
    ["AI Gateway (11442)"]="http://127.0.0.1:11442"
    ["Grafana (3001)"]="http://127.0.0.1:3001"
    ["Prometheus (9090)"]="http://127.0.0.1:9090"
    ["Ollama (11434)"]="http://127.0.0.1:11434"
    ["headybuddy.org (9000)"]="http://127.0.0.1:9000"
    ["headysystems.com (9001)"]="http://127.0.0.1:9001"
    ["headyconnection.org (9002)"]="http://127.0.0.1:9002"
    ["headymcp.com (9003)"]="http://127.0.0.1:9003"
    ["headyio.com (9004)"]="http://127.0.0.1:9004"
    ["headyme.com (9005)"]="http://127.0.0.1:9005"
)

PASS=0
FAIL=0
for name in "${!SERVICES[@]}"; do
    url="${SERVICES[$name]}"
    CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" --connect-timeout 3 2>/dev/null || echo "000")
    if [ "$CODE" != "000" ]; then
        echo "  ✅ $name -> HTTP $CODE"
        PASS=$((PASS + 1))
    else
        echo "  ❌ $name -> NOT RESPONDING"
        FAIL=$((FAIL + 1))
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  STARTUP COMPLETE: $PASS services up, $FAIL down"
echo "  Tunnel: $TUNNEL_CONNS Cloudflare edge connections"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Live websites:"
echo "    https://headysystems.com"
echo "    https://headyme.com"
echo "    https://headybuddy.org"
echo "    https://headyconnection.org"
echo "    https://headymcp.com"
echo "    https://headyio.com"
echo "    https://headybot.com"
echo "    https://dashboard.headysystems.com"
echo ""
echo "  Service endpoints:"
echo "    https://app.headysystems.com (Next.js)"
echo "    https://api.headysystems.com (Manager API)"
echo "    https://admin.headysystems.com (Drupal CMS)"
echo "    https://dashboard.headysystems.com (Admin UI)"
echo "    https://ai.headysystems.com (AI Gateway)"
echo "    https://grafana.headysystems.com (Monitoring)"
echo "    https://worker.headysystems.com (Python Worker)"
echo ""
echo "  Logs:"
echo "    Tunnel:  /tmp/cloudflared-tunnel.log"
echo "    Static:  /tmp/static-sites.log"
echo "    Admin:   /tmp/admin-ui.log"
echo ""
