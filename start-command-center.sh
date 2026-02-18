#!/bin/bash
# Heady Systems Command Center Startup Script

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
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

success() {
    echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $1"
}

# Kill existing processes
cleanup() {
    log "🧹 Cleaning up existing processes..."
    pkill -f "node heady-manager.js" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
    fuser -k 3300/tcp 2>/dev/null || true
    fuser -k 8080/tcp 2>/dev/null || true
    sleep 2
}

# Start HeadyManager
start_heady_manager() {
    log "🚀 Starting HeadyManager on port 3300..."
    NODE_ENV=production SOCRATIC_MODE_ENABLED=true PORT=3300 node heady-manager.js > heady-manager.log 2>&1 &
    MANAGER_PID=$!
    echo $MANAGER_PID > heady-manager.pid
    
    # Wait for startup
    sleep 3
    
    if curl -s http://localhost:3300/api/health > /dev/null; then
        success "✅ HeadyManager started successfully (PID: $MANAGER_PID)"
    else
        error "❌ HeadyManager failed to start"
        cat heady-manager.log
        return 1
    fi
}

# Start Static File Server
start_static_server() {
    log "🌐 Starting static file server on port 8080..."
    python3 -m http.server 8080 > static-server.log 2>&1 &
    STATIC_PID=$!
    echo $STATIC_PID > static-server.pid
    
    # Wait for startup
    sleep 2
    
    if curl -s http://localhost:8080 > /dev/null; then
        success "✅ Static server started successfully (PID: $STATIC_PID)"
    else
        error "❌ Static server failed to start"
        cat static-server.log
        return 1
    fi
}

# Main execution
main() {
    log "🎯 Starting Heady Systems Command Center"
    log "==================================================="
    
    # Cleanup
    cleanup
    
    # Start services
    start_heady_manager || exit 1
    start_static_server || exit 1
    
    # Display URLs
    success "🎉 Command Center is ready!"
    echo ""
    echo "📍 Admin UI (Enhanced): http://localhost:8080/admin-ui-enhanced.html"
    echo "📍 Admin UI (Original): http://localhost:8080/admin-ui.html"
    echo "📍 API Health: http://localhost:3300/api/health"
    echo "📍 Socratic Compliance: http://localhost:3300/api/socratic-compliance"
    echo ""
    echo "📊 System Features:"
    echo "   ✅ Multi-domain monitoring (7 domains)"
    echo "   ✅ Real-time error detection"
    echo "   ✅ Socratic method enforcement"
    echo "   ✅ Automated validation"
    echo "   ✅ System control panel"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View logs: tail -f heady-manager.log"
    echo "   Stop all: ./stop-command-center.sh"
    echo "   Restart: ./start-command-center.sh"
    echo ""
    
    # Monitor processes
    log "📡 Monitoring services..."
    while true; do
        if ! kill -0 $(cat heady-manager.pid 2>/dev/null) 2>/dev/null; then
            error "❌ HeadyManager crashed! Restarting..."
            start_heady_manager
        fi
        
        if ! kill -0 $(cat static-server.pid 2>/dev/null) 2>/dev/null; then
            error "❌ Static server crashed! Restarting..."
            start_static_server
        fi
        
        sleep 10
    done
}

# Handle shutdown
trap cleanup EXIT

# Run main function
main "$@"
