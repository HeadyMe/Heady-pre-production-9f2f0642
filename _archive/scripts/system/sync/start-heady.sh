# © 2026 Heady Systems LLC.
# PROPRIETARY AND CONFIDENTIAL.
# Unauthorized copying, modification, or distribution is strictly prohibited.
#!/bin/bash
# start-heady.sh - Reliable startup for the complete Heady ecosystem
set -e

HEADY_HOME="/home/headyme"
HEADY_PROJECT="$HEADY_HOME/CascadeProjects/Heady"
ADMIN_UI="$HEADY_HOME/CascadeProjects/admin-ui"

echo "============================================================"
echo "  HEADY SYSTEMS - FULL ECOSYSTEM STARTUP"
echo "============================================================"

# ── Kill stale processes ─────────────────────────────────────────
echo "[1/6] Cleaning up stale processes..."
fuser -k 9000/tcp 9001/tcp 9002/tcp 9003/tcp 9004/tcp 9005/tcp 8090/tcp 2>/dev/null || true
pkill -f "python3 -m http.server" 2>/dev/null || true
pkill -f "admin-ui/server/index.js" 2>/dev/null || true
sleep 1

# ── Domain servers (ports 9000–9005) ────────────────────────────
echo "[2/6] Starting 6 domain servers..."
python3 -m http.server 9000 --directory "$HEADY_HOME/headybuddy/dist" &
python3 -m http.server 9001 --directory "$HEADY_HOME/headysystems/dist" &
python3 -m http.server 9002 --directory "$HEADY_HOME/headyconnection/dist" &
python3 -m http.server 9003 --directory "$HEADY_HOME/headymcp/dist" &
python3 -m http.server 9004 --directory "$HEADY_HOME/headyio/dist" &
python3 -m http.server 9005 --directory "$HEADY_HOME/headyme/dist" &
sleep 2

# Verify domain servers
FAILED=0
for PORT in 9000 9001 9002 9003 9004 9005; do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT" 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "  ✅ Port $PORT: OK"
  else
    echo "  ❌ Port $PORT: FAILED (HTTP $CODE)"
    FAILED=$((FAILED + 1))
  fi
done
if [ "$FAILED" -gt 0 ]; then
  echo "  ⚠️  $FAILED domain server(s) failed to start"
fi

# ── Admin UI backend (port 8090) ─────────────────────────────────
echo "[3/6] Starting Admin UI server (port 8090)..."
cd "$ADMIN_UI"
node server/index.js &
sleep 2
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/api/dashboard 2>/dev/null || echo "000")
if [ "$CODE" = "200" ]; then
  echo "  ✅ Admin UI: OK (http://localhost:8090)"
else
  echo "  ❌ Admin UI: FAILED (HTTP $CODE)"
fi

# ── Nginx ────────────────────────────────────────────────────────
echo "[4/6] Ensuring Nginx is running..."
if sudo systemctl is-active --quiet nginx 2>/dev/null; then
  echo "  ✅ Nginx: Active"
elif command -v nginx >/dev/null 2>&1; then
  sudo systemctl start nginx 2>/dev/null && echo "  ✅ Nginx: Started" || echo "  ⚠️  Nginx: Could not start"
else
  echo "  ℹ️  Nginx: Not installed (skipping)"
fi

# ── HCFP Auto-Success ────────────────────────────────────────────
echo "[5/6] Starting HCFP Auto-Success..."
cd "$HEADY_PROJECT"
node bin/hcfp auto-success &
HCFP_PID=$!
echo "  ✅ HCFP: Started (PID $HCFP_PID)"

# ── Status check ─────────────────────────────────────────────────
echo "[6/6] Running system health check..."
sleep 3
HCFP_STATUS=$(curl -s http://localhost:8090/api/hcfp/status 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"ORS: {d['ors']}%, Mode: {d['mode']}, Domains: {sum(1 for x in d['domains'] if x['status']=='online')}/6 online\")" 2>/dev/null || echo "Status check pending")

echo ""
echo "============================================================"
echo "  HEADY SYSTEMS - ALL SERVICES STARTED"
echo "============================================================"
echo ""
echo "  📡 Domain Servers:"
echo "     HeadyBuddy.org     → http://localhost:9000"
echo "     HeadySystems.com   → http://localhost:9001"
echo "     HeadyConnection.org→ http://localhost:9002"
echo "     HeadyMCP.com       → http://localhost:9003"
echo "     HeadyIO.com        → http://localhost:9004"
echo "     HeadyMe.com        → http://localhost:9005"
echo ""
echo "  🖥️  Admin UI            → http://localhost:8090"
echo "  📊 HCFP Dashboard      → http://localhost:8090/api/hcfp/status"
echo "  🤖 HCFP Auto-Success   → Running (PID $HCFP_PID)"
echo ""
echo "  🏥 System Health: $HCFP_STATUS"
echo ""
echo "  To stop all services: ./stop-heady.sh"
echo "============================================================"

# Keep script running to manage background processes
wait
