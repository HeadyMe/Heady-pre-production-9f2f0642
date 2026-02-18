#!/bin/bash
# Heady Systems Real-Time Monitoring Startup Script

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

# Kill existing processes
cleanup() {
    log "🧹 Cleaning up existing processes..."
    pkill -f "node heady-manager.js" 2>/dev/null || true
    pkill -f "python3 -m http.server" 2>/dev/null || true
    fuser -k 3300/tcp 2>/dev/null || true
    fuser -k 8080/tcp 2>/dev/null || true
    fuser -k 3301/tcp 2>/dev/null || true
    sleep 2
}

# Start HeadyManager with Real-Time Monitoring
start_heady_manager() {
    log "🚀 Starting HeadyManager with Real-Time Monitoring..."
    NODE_ENV=production SOCRATIC_MODE_ENABLED=true PORT=3300 node heady-manager.js > heady-manager.log 2>&1 &
    MANAGER_PID=$!
    echo $MANAGER_PID > heady-manager.pid
    
    # Wait for startup
    sleep 5
    
    if curl -s http://localhost:3300/api/health > /dev/null; then
        success "✅ HeadyManager started successfully (PID: $MANAGER_PID)"
        
        # Check if real-time monitor is running
        if curl -s http://localhost:3300/api/monitoring/status > /dev/null; then
            success "✅ Real-Time Monitor is active"
        else
            warn "⚠️ Real-Time Monitor may not be fully initialized"
        fi
    else
        error "❌ HeadyManager failed to start"
        cat heady-manager.log
        return 1
    fi
}

# Start Static File Server
start_static_server() {
    log "🌐 Starting static file server..."
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

# Verify WebSocket connectivity
verify_websocket() {
    log "🔍 Verifying WebSocket connectivity..."
    
    # Check if WebSocket port is listening
    if netstat -ln | grep :3301 > /dev/null; then
        success "✅ WebSocket server listening on port 3301"
    else
        warn "⚠️ WebSocket server may not be ready yet (this is normal)"
    fi
}

# Display system information
display_system_info() {
    log "📊 System Information"
    log "===================="
    
    # Node.js version
    NODE_VERSION=$(node --version)
    log "🟢 Node.js: $NODE_VERSION"
    
    # Available memory
    MEMORY_INFO=$(free -h | grep "Mem:" | awk '{print $3 "/" $2}')
    log "💾 Memory Usage: $MEMORY_INFO"
    
    # CPU info
    CPU_INFO=$(nproc)
    log "🔧 CPU Cores: $CPU_INFO"
    
    # Disk space
    DISK_INFO=$(df -h . | tail -1 | awk '{print $3 "/" $2 " (" $5 ")"}')
    log "💿 Disk Space: $DISK_INFO"
    
    # Network interfaces
    log "🌐 Network Interfaces:"
    ip addr show | grep "inet " | grep -v "127.0.0.1" | awk '{print "   " $2}' | head -3
}

# Main execution
main() {
    log "🎯 Starting Heady Systems Real-Time Monitoring"
    log "==================================================="
    
    # Cleanup
    cleanup
    
    # Display system info
    display_system_info
    
    # Start services
    start_heady_manager || exit 1
    start_static_server || exit 1
    
    # Verify WebSocket
    verify_websocket
    
    # Display access URLs
    success "🎉 Real-Time Monitoring System is ready!"
    echo ""
    echo "📍 Real-Time Dashboard: http://localhost:8080/realtime-dashboard.html"
    echo "📍 Enhanced Admin UI: http://localhost:8080/admin-ui-enhanced.html"
    echo "📍 Original Admin UI: http://localhost:8080/admin-ui.html"
    echo "📍 API Health: http://localhost:3300/api/health"
    echo "📍 Monitoring Status: http://localhost:3300/api/monitoring/status"
    echo "📍 Real-Time Metrics: http://localhost:3300/api/monitoring/metrics"
    echo "📍 WebSocket Server: ws://localhost:3301/realtime"
    echo ""
    echo "📊 Real-Time Features:"
    echo "   ✅ 100ms update intervals"
    echo "   ✅ WebSocket-based live updates"
    echo "   ✅ System performance monitoring"
    echo "   ✅ Service health tracking"
    echo "   ✅ Domain status monitoring"
    echo "   ✅ Socratic compliance tracking"
    echo "   ✅ Real-time alerts"
    echo "   ✅ Historical data visualization"
    echo ""
    echo "🔧 Management Commands:"
    echo "   View logs: tail -f heady-manager.log"
    echo "   Stop all: ./stop-command-center.sh"
    echo "   Restart: ./start-realtime-system.sh"
    echo ""
    echo "📈 Performance Metrics:"
    echo "   Update Rate: 100ms (10 updates/second)"
    echo "   WebSocket Port: 3301"
    echo "   History Size: 1000 data points"
    echo "   Alert Thresholds: CPU 80%, Memory 85%, Response 1000ms"
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
