#!/bin/bash
# Heady Systems Auto-Push Monitor
# Monitors for local changes and automatically pushes to repository

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REPO_DIR="/home/headyme/CascadeProjects/Heady"
PUSH_INTERVAL=60  # Check every 60 seconds
AUTO_PUSH_ENABLED=true
COMMIT_MESSAGE_PREFIX="[Auto-Push]"

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

# Check for uncommitted changes
check_for_changes() {
    cd "$REPO_DIR"
    
    # Check if there are uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        log "📝 Uncommitted changes detected"
        return 0
    else
        return 1
    fi
}

# Check if we can push (no conflicts)
check_push_safe() {
    cd "$REPO_DIR"
    
    # Fetch latest changes
    git fetch origin
    
    # Check if our branch is behind
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse origin/main)
    
    if [ "$LOCAL" != "$REMOTE" ]; then
        warn "⚠️ Local branch is behind remote - pulling first..."
        git pull origin main --rebase
        
        # Check if rebase was successful
        if [ $? -ne 0 ]; then
            error "❌ Rebase failed - manual intervention required"
            return 1
        fi
    fi
    
    return 0
}

# Generate commit message
generate_commit_message() {
    local changes=$(git status --porcelain)
    local message="$COMMIT_MESSAGE_PREFIX "
    
    # Analyze changes to generate meaningful commit message
    if echo "$changes" | grep -q "package.json"; then
        message="$message Updated dependencies"
    elif echo "$changes" | grep -q "src/"; then
        message="$message Updated source code"
    elif echo "$changes" | grep -q "admin-ui"; then
        message="$message Enhanced admin interface"
    elif echo "$changes" | grep -q "docker-compose"; then
        message="$message Updated Docker configuration"
    elif echo "$changes" | grep -q ".env"; then
        message="$message Updated environment configuration"
    else
        message="$message General updates"
    fi
    
    # Add timestamp
    message="$message ($(date '+%Y-%m-%d %H:%M:%S'))"
    
    echo "$message"
}

# Stage and commit changes
commit_changes() {
    cd "$REPO_DIR"
    
    log "📝 Staging changes..."
    git add .
    
    # Check if there are staged changes
    if git diff --cached --quiet; then
        warn "⚠️ No changes to commit"
        return 1
    fi
    
    local commit_msg=$(generate_commit_message)
    log "💾 Committing changes: $commit_msg"
    git commit -m "$commit_msg"
    
    success "✅ Changes committed successfully"
}

# Push changes to remote
push_changes() {
    cd "$REPO_DIR"
    
    log "📤 Pushing changes to remote repository..."
    
    if git push origin main; then
        success "✅ Changes pushed successfully"
        return 0
    else
        error "❌ Push failed"
        return 1
    fi
}

# Validate before push
validate_before_push() {
    cd "$REPO_DIR"
    
    log "🔍 Validating changes before push..."
    
    # Check for localhost references
    local localhost_refs=$(git diff --cached --name-only | xargs grep -l "localhost\|127.0.0.1" 2>/dev/null || true)
    
    if [ -n "$localhost_refs" ]; then
        error "❌ Localhost references found in staged files:"
        echo "$localhost_refs"
        error "❌ Remove localhost references before pushing"
        return 1
    fi
    
    # Check for sensitive files
    local sensitive_files=$(git diff --cached --name-only | grep -E "\.key$|\.pem$|secret|password" || true)
    
    if [ -n "$sensitive_files" ]; then
        warn "⚠️ Potentially sensitive files detected:"
        echo "$sensitive_files"
        warn "⚠️ Please review before pushing"
    fi
    
    # Run quick syntax checks
    local js_files=$(git diff --cached --name-only | grep "\.js$" || true)
    if [ -n "$js_files" ]; then
        log "🔍 Checking JavaScript syntax..."
        for file in $js_files; do
            if ! node -c "$file" 2>/dev/null; then
                error "❌ Syntax error in $file"
                return 1
            fi
        done
        success "✅ JavaScript syntax validated"
    fi
    
    success "✅ Pre-push validation passed"
    return 0
}

# Full push process
push_changes_safe() {
    log "🚀 Starting safe push process..."
    
    if ! check_push_safe; then
        error "❌ Push safety check failed"
        return 1
    fi
    
    if ! validate_before_push; then
        error "❌ Pre-push validation failed"
        return 1
    fi
    
    if ! push_changes; then
        error "❌ Push failed"
        return 1
    fi
    
    success "🎉 Push process completed successfully"
    
    # Trigger auto-deployment
    log "🔄 Triggering auto-deployment..."
    if [ -f "./local-auto-deploy.sh" ]; then
        ./local-auto-deploy.sh deploy &
    fi
    
    return 0
}

# Monitor and auto-push
auto_push_monitor() {
    log "🔄 Starting auto-push monitor..."
    log "📡 Monitoring for changes every $PUSH_INTERVAL seconds"
    log "🔧 Auto-push enabled: $AUTO_PUSH_ENABLED"
    
    while true; do
        if check_for_changes; then
            log "📝 Changes detected, starting auto-push..."
            
            if [ "$AUTO_PUSH_ENABLED" = true ]; then
                if commit_changes; then
                    push_changes_safe
                else
                    error "❌ Auto-push failed - manual intervention required"
                fi
            else
                warn "⚠️ Auto-push disabled - changes detected but not pushed"
                warn "⚠️ Run '$0 push' to push manually"
            fi
        fi
        
        sleep $PUSH_INTERVAL
    done
}

# Manual push
manual_push() {
    log "🚀 Starting manual push..."
    
    if ! check_for_changes; then
        warn "⚠️ No changes to push"
        return 0
    fi
    
    if ! commit_changes; then
        error "❌ Commit failed"
        return 1
    fi
    
    push_changes_safe
}

# Show status
show_status() {
    cd "$REPO_DIR"
    
    log "📊 Repository Status"
    log "===================="
    
    # Git status
    echo "📝 Git Status:"
    git status --short
    
    echo ""
    echo "📊 Statistics:"
    echo "   Branch: $(git branch --show-current)"
    echo "   Remote: $(git remote get-url origin)"
    echo "   Last commit: $(git log -1 --format='%h %s' | head -c 50)..."
    
    # Check if we're behind/ahead
    local ahead_behind=$(git rev-list --count --left-right origin/main...HEAD 2>/dev/null || echo "0 0")
    local ahead=$(echo $ahead_behind | cut -f2)
    local behind=$(echo $ahead_behind | cut -f1)
    
    echo "   Ahead: $ahead commits"
    echo "   Behind: $behind commits"
    
    echo ""
    echo "🔧 Configuration:"
    echo "   Auto-push enabled: $AUTO_PUSH_ENABLED"
    echo "   Check interval: ${PUSH_INTERVAL}s"
    echo "   Auto-deploy: $([ -f ./local-auto-deploy.sh ] && echo 'Available' || echo 'Not found')"
}

# Setup auto-push service
setup_service() {
    log "⚙️ Setting up auto-push service..."
    
    # Create systemd service file
    cat > /tmp/heady-auto-push.service << EOF
[Unit]
Description=Heady Systems Auto-Push Monitor
After=network.target

[Service]
Type=simple
User=headyme
WorkingDirectory=$REPO_DIR
ExecStart=$REPO_DIR/auto-push-monitor.sh monitor
Restart=always
RestartSec=10
Environment=AUTO_PUSH_ENABLED=true

[Install]
WantedBy=multi-user.target
EOF
    
    log "📝 Service file created at /tmp/heady-auto-push.service"
    log "🔧 To install: sudo mv /tmp/heady-auto-push.service /etc/systemd/system/"
    log "🔧 To enable: sudo systemctl enable heady-auto-push"
    log "🔧 To start: sudo systemctl start heady-auto-push"
    
    success "✅ Service setup instructions provided"
}

# Show help
show_help() {
    echo "Heady Systems Auto-Push Monitor"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  monitor     - Run auto-push monitor (continuous monitoring)"
    echo "  push        - Manual push of current changes"
    echo "  status      - Show repository status"
    echo "  service     - Setup systemd service for auto-push"
    echo "  help        - Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  AUTO_PUSH_ENABLED=true/false  - Enable/disable auto-push"
    echo "  PUSH_INTERVAL=seconds         - Check interval (default: 60)"
    echo ""
    echo "Examples:"
    echo "  $0 monitor           # Start continuous monitoring"
    echo "  $0 push              # Manual push"
    echo "  $0 status            # Show status"
    echo "  AUTO_PUSH_ENABLED=false $0 monitor  # Monitor without auto-pushing"
}

# Main execution
main() {
    case "${1:-monitor}" in
        "monitor")
            auto_push_monitor
            ;;
        "push")
            manual_push
            ;;
        "status")
            show_status
            ;;
        "service")
            setup_service
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Handle interrupts
trap 'log "🛑 Auto-push monitor interrupted"; exit 1' INT TERM

# Run main function
main "$@"
