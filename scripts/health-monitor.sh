#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🚨 Heady Automated Health Monitor - Production Domains Only
# ═══════════════════════════════════════════════════════════════

# Production domains to monitor (NO localhost references)
DOMAINS=(
    "https://headysystems.com"
    "https://api.headysystems.com"
    "https://headyme.com"
    "https://api.headyme.com"
    "https://headybuddy.org"
    "https://api.headybuddy.org"
    "https://headymcp.com"
    "https://api.headymcp.com"
    "https://headyconnection.org"
    "https://api.headyconnection.org"
    "https://headyio.com"
    "https://headybot.com"
)

# Local services for internal monitoring (binds to localhost but uses production domains)
LOCAL_SERVICES=(
    "http://localhost:3000/api/health"
    "http://localhost:3300/api/health"
)

# Health check configuration
TIMEOUT=10
RETRY_COUNT=3
RETRY_DELAY=5
LOG_FILE="./logs/health-monitor.log"
ALERT_LOG="./logs/health-alerts.log"

# Create log directories
mkdir -p ./logs

# Logging function
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [$1] $2" | tee -a "$LOG_FILE"
}

# Alert function
send_alert() {
    local service="$1"
    local status="$2"
    local error="$3"
    
    local alert_message="$(date '+%Y-%m-%d %H:%M:%S') [ALERT] $service: $status - $error"
    echo "$alert_message" | tee -a "$ALERT_LOG"
    
    # Here you can add additional alert methods:
    # - Slack webhook
    # - Email notification
    # - Discord webhook
    # - SMS alert
    
    log_message "ALERT" "$service: $status - $error"
}

# Health check function
check_service() {
    local url="$1"
    local service_name="$2"
    
    for attempt in $(seq 1 $RETRY_COUNT); do
        local response=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$url")
        local curl_exit_code=$?
        
        if [ $curl_exit_code -eq 0 ] && [ "$response" = "200" ]; then
            log_message "OK" "$service_name is healthy (HTTP $response)"
            return 0
        else
            if [ $attempt -lt $RETRY_COUNT ]; then
                log_message "WARN" "$service_name check failed (attempt $attempt/$RETRY_COUNT), retrying in ${RETRY_DELAY}s..."
                sleep $RETRY_DELAY
            fi
        fi
    done
    
    # All retries failed
    local error="HTTP $response (curl exit: $curl_exit_code)"
    send_alert "$service_name" "DOWN" "$error"
    return 1
}

# Detailed health check with response validation
check_service_detailed() {
    local url="$1"
    local service_name="$2"
    
    local response_body=$(curl -s --connect-timeout "$TIMEOUT" "$url")
    local curl_exit_code=$?
    
    if [ $curl_exit_code -eq 0 ]; then
        # Check if response contains expected health indicators
        if echo "$response_body" | grep -q "status.*healthy\|\"status\":\"ok\"\|\"uptime\""; then
            log_message "OK" "$service_name detailed health check passed"
            return 0
        else
            send_alert "$service_name" "UNHEALTHY_RESPONSE" "Response doesn't contain health indicators"
            return 1
        fi
    else
        send_alert "$service_name" "CONNECTION_FAILED" "curl exit code: $curl_exit_code"
        return 1
    fi
}

# Main monitoring loop
main_monitor() {
    log_message "INFO" "Starting Heady Health Monitor - Production Domains Only"
    log_message "INFO" "Monitoring ${#DOMAINS[@]} production domains + ${#LOCAL_SERVICES[@]} local services"
    
    while true; do
        log_message "INFO" "=== Health Check Cycle Started ==="
        
        local failed_services=0
        
        # Check production domains
        for domain in "${DOMAINS[@]}"; do
            if ! check_service "$domain" "$domain"; then
                ((failed_services++))
            fi
        done
        
        # Check local services
        for service in "${LOCAL_SERVICES[@]}"; do
            if ! check_service_detailed "$service" "$service"; then
                ((failed_services++))
            fi
        done
        
        # Summary
        if [ $failed_services -eq 0 ]; then
            log_message "INFO" "✅ All services healthy"
        else
            log_message "ERROR" "❌ $failed_services services failed health check"
        fi
        
        log_message "INFO" "=== Health Check Cycle Completed ==="
        log_message "INFO" "Next check in 30 seconds..."
        
        sleep 30
    done
}

# Status report function
generate_status_report() {
    echo "=== Heady System Status Report ==="
    echo "Generated: $(date)"
    echo ""
    echo "Production Domains:"
    for domain in "${DOMAINS[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$domain")
        if [ "$status" = "200" ]; then
            echo "✅ $domain - HTTP $status"
        else
            echo "❌ $domain - HTTP $status"
        fi
    done
    echo ""
    echo "Local Services:"
    for service in "${LOCAL_SERVICES[@]}"; do
        local status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "$service")
        if [ "$status" = "200" ]; then
            echo "✅ $service - HTTP $status"
        else
            echo "❌ $service - HTTP $status"
        fi
    done
    echo ""
    echo "Recent Alerts:"
    if [ -f "$ALERT_LOG" ]; then
        tail -10 "$ALERT_LOG"
    else
        echo "No alerts logged yet."
    fi
}

# Command line interface
case "${1:-monitor}" in
    "monitor")
        main_monitor
        ;;
    "status")
        generate_status_report
        ;;
    "test")
        echo "Testing health checks..."
        check_service "https://headysystems.com" "headysystems.com"
        check_service "http://localhost:3000/health" "local-web"
        ;;
    *)
        echo "Usage: $0 [monitor|status|test]"
        echo "  monitor  - Run continuous monitoring (default)"
        echo "  status   - Generate status report"
        echo "  test     - Test health checks"
        exit 1
        ;;
esac
