#!/bin/bash
# Heady Systems Command Center Stop Script

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%H:%M:%S')]${NC} $1"
}

# Stop all services
cleanup() {
    log "🧹 Stopping Heady Systems Command Center..."
    
    # Kill by PID files
    if [ -f heady-manager.pid ]; then
        PID=$(cat heady-manager.pid)
        if kill -0 $PID 2>/dev/null; then
            log "🛑 Stopping HeadyManager (PID: $PID)..."
            kill $PID
            sleep 2
            kill -9 $PID 2>/dev/null || true
        fi
        rm -f heady-manager.pid
    fi
    
    if [ -f static-server.pid ]; then
        PID=$(cat static-server.pid)
        if kill -0 $PID 2>/dev/null; then
            log "🛑 Stopping static server (PID: $PID)..."
            kill $PID
            sleep 2
            kill -9 $PID 2>/dev/null || true
        fi
        rm -f static-server.pid
    fi
    
    # Kill by process name
    pkill -f "node heady-manager.js" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
    
    # Kill by port
    fuser -k 3300/tcp 2>/dev/null || true
    fuser -k 8080/tcp 2>/dev/null || true
    
    # Clean up log files
    > heady-manager.log
    > static-server.log
    
    log "✅ Command Center stopped successfully"
}

# Run cleanup
cleanup

echo ""
echo "🎯 Heady Systems Command Center stopped"
echo "📍 To restart: ./start-command-center.sh"
