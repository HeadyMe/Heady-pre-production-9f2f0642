#!/bin/bash

# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: start-services.sh                                   ║
# ║  UPDATED: 20260218-211102                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

#!/bin/bash
# 🚀 Start all Heady services on minicomputer

set -euo pipefail

HEADY_BASE="${HOME}/CascadeProjects/Heady"
cd "$HEADY_BASE"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

log "🚀 Starting Heady services on minicomputer..."

# Start Redis (if not running)
if ! pgrep -f redis-server > /dev/null; then
    log "  Starting Redis cache..."
    redis-server --daemonize yes --port 6379 --dir data/redis/
fi

# Start PostgreSQL (if not running)
if ! pgrep -f postgres > /dev/null; then
    log "  Starting PostgreSQL..."
    pg_ctl -D data/postgresql/ start || true
fi

# Start HeadyManager
log "  Starting HeadyManager..."
pkill -f "heady-manager.js" 2>/dev/null || true
nohup node heady-manager.js > logs/services/heady-manager.log 2>&1 &
sleep 2

# Start Python Worker
log "  Starting Python Worker..."
pkill -f "python-worker.py" 2>/dev/null || true
nohup python3 src/workers/python-worker.py > logs/workers/python-worker.log 2>&1 &
sleep 2

# Start Prometheus (if not running)
if ! pgrep -f prometheus > /dev/null; then
    log "  Starting Prometheus..."
    prometheus --config.file=config/prometheus.yml --storage.tsdb.path=data/prometheus/ &
fi

log "✅ All services started"
log "🌐 Access points:"
log "  HeadyManager: http://manager.headyme.com/api/health"
log "  Web Dashboard: https://headyme.com"
log "  Prometheus: https://prometheus.headysystems.com"
