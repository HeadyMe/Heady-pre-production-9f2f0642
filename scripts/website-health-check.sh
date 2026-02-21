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
# ║  FILE: website-health-check.sh                                   ║
// ║  UPDATED: 20260219-154500                                            ║
# ╚══════════════════════════════════════════════════════════════════╝

# Website Health Check Script
# Monitors critical website endpoints and reports status

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
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

# Configuration
TIMEOUT=10
FAILURE_THRESHOLD=3
RECOVERY_THRESHOLD=2
LOG_FILE="/var/log/heady/website-health.log"
RESULTS_FILE="/tmp/website-health-results.json"

# Critical endpoints to monitor
declare -A ENDPOINTS=(
    ["headyme_public"]="https://headyme.com/health"
    ["headyme_api"]="https://api.headyme.com/health"
    ["headyme_admin"]="https://admin.headyme.com/health"
    ["headysystems_app"]="https://app.headysystems.com/health"
    ["headysystems_api"]="https://api.headysystems.com/health"
    ["headyconnection_app"]="https://app.headyconnection.org/health"
    ["headyconnection_api"]="https://api.headyconnection.org/health"
)

# Expected responses
declare -A EXPECTED_RESPONSES=(
    ["headyme_public"]="ok"
    ["headyme_api"]="healthy"
    ["headyme_admin"]="admin_ok"
    ["headysystems_app"]="systems_ok"
    ["headysystems_api"]="api_healthy"
    ["headyconnection_app"]="connection_ok"
    ["headyconnection_api"]="connection_api_healthy"
)

# Status tracking
declare -A CONSECUTIVE_FAILURES
declare -A CONSECUTIVE_SUCCESSES
declare -A LAST_STATUS
declare -A LAST_CHECK_TIME
declare -A RESPONSE_TIMES

# Initialize counters
for endpoint in "${!ENDPOINTS[@]}"; do
    CONSECUTIVE_FAILURES[$endpoint]=0
    CONSECUTIVE_SUCCESSES[$endpoint]=0
    LAST_STATUS[$endpoint]="unknown"
    LAST_CHECK_TIME[$endpoint]=""
    RESPONSE_TIMES[$endpoint]=0
done

# Function to check a single endpoint
check_endpoint() {
    local endpoint_id="$1"
    local url="${ENDPOINTS[$endpoint_id]}"
    local expected="${EXPECTED_RESPONSES[$endpoint_id]}"
    local start_time=$(date +%s%3N)
    
    log "🔍 Checking $endpoint_id: $url"
    
    # Make HTTP request
    local response
    local status_code
    local response_time
    
    if response=$(curl -s -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null); then
        status_code="${response: -3}"
        response_body="${response%???}"
        response_time=$(( $(date +%s%3N) - start_time ))
        
        # Check if response is successful
        if [[ "$status_code" == "200" && "$response_body" == *"$expected"* ]]; then
            handle_success "$endpoint_id" "$status_code" "$response_time" "$response_body"
        else
            handle_failure "$endpoint_id" "$status_code" "$response_time" "$response_body"
        fi
    else
        handle_failure "$endpoint_id" "000" "$(( $(date +%s%3N) - start_time )) "Request failed"
    fi
}

# Function to handle successful check
handle_success() {
    local endpoint_id="$1"
    local status_code="$2"
    local response_time="$3"
    local response_body="$4"
    
    CONSECUTIVE_FAILURES[$endpoint_id]=0
    ((CONSECUTIVE_SUCCESSES[$endpoint_id]++))
    LAST_STATUS[$endpoint_id]="healthy"
    LAST_CHECK_TIME[$endpoint_id]=$(date -Iseconds)
    
    # Update response time (moving average)
    local current_avg=${RESPONSE_TIMES[$endpoint_id]}
    RESPONSE_TIMES[$endpoint_id]=$(((current_avg * (CONSECUTIVE_SUCCESSES[$endpoint_id] - 1) + response_time) / CONSECUTIVE_SUCCESSES[$endpoint_id]))
    
    success "✅ $endpoint_id: $status_code (${response_time}ms)"
    
    # Log success
    echo "$(date -Iseconds) | SUCCESS | $endpoint_id | $status_code | ${response_time}ms | $response_body" >> "$LOG_FILE"
    
    # Reset ORS impact if this was a failure before
    if [[ ${CONSECUTIVE_SUCCESSES[$endpoint_id]} -eq 1 ]]; then
        log "📈 $endpoint_id recovered - ORS impact reset"
    fi
}

# Function to handle failed check
handle_failure() {
    local endpoint_id="$1"
    local status_code="$2"
    local response_time="$3"
    local response_body="$4"
    
    ((CONSECUTIVE_FAILURES[$endpoint_id]++))
    CONSECUTIVE_SUCCESSES[$endpoint_id]=0
    LAST_STATUS[$endpoint_id]="unhealthy"
    LAST_CHECK_TIME[$endpoint_id]=$(date -Iseconds)
    
    error "❌ $endpoint_id: $status_code (${response_time}ms) - ${response_body:-No response}"
    
    # Log failure
    echo "$(date -Iseconds) | FAILURE | $endpoint_id | $status_code | ${response_time}ms | ${response_body:-No response}" >> "$LOG_FILE"
    
    # Check if this is a critical failure
    if [[ ${CONSECUTIVE_FAILURES[$endpoint_id]} -ge $FAILURE_THRESHOLD ]]; then
        error "🚨 CRITICAL: $endpoint_id has ${CONSECUTIVE_FAILURES[$endpoint_id]} consecutive failures"
        
        # Trigger alert (in a real implementation, this would send notifications)
        trigger_alert "$endpoint_id" "critical_failure"
    fi
}

# Function to trigger alerts
trigger_alert() {
    local endpoint_id="$1"
    local alert_type="$2"
    
    case "$alert_type" in
        "critical_failure")
            error "🚨 ALERT: Critical failure detected for $endpoint_id"
            # In a real implementation, send to monitoring system
            # curl -X POST "https://api.headyme.com/alerts" -d "endpoint=$endpoint_id&type=critical_failure"
            ;;
        "recovery")
            success "🎉 ALERT: Recovery detected for $endpoint_id"
            # In a real implementation, send recovery notification
            # curl -X POST "https://api.headyme.com/alerts" -d "endpoint=$endpoint_id&type=recovery"
            ;;
    esac
}

# Function to calculate overall health
calculate_overall_health() {
    local total_endpoints=${#ENDPOINTS[@]}
    local healthy_endpoints=0
    local critical_endpoints=0
    local healthy_critical=0
    
    for endpoint_id in "${!ENDPOINTS[@]}"; do
        if [[ "${LAST_STATUS[$endpoint_id]}" == "healthy" ]]; then
            ((healthy_endpoints++))
            
            # Check if this is a critical endpoint (all are critical in this setup)
            ((critical_endpoints++))
            ((healthy_critical++))
        else
            ((critical_endpoints++))
        fi
    done
    
    local overall_status
    if [[ $healthy_endpoints -eq $total_endpoints ]]; then
        overall_status="healthy"
    elif [[ $healthy_critical -eq $critical_endpoints ]]; then
        overall_status="degraded"
    else
        overall_status="critical"
    fi
    
    echo "{\"status\":\"$overall_status\",\"total_endpoints\":$total_endpoints,\"healthy_endpoints\":$healthy_endpoints,\"critical_endpoints\":$critical_endpoints,\"healthy_critical\":$healthy_critical,\"timestamp\":\"$(date -Iseconds)\"}"
}

# Function to generate JSON results
generate_results() {
    local results="{\"timestamp\":\"$(date -Iseconds)\",\"overall_health\":$(calculate_overall_health),\"endpoints\":["
    
    local first=true
    for endpoint_id in "${!ENDPOINTS[@]}"; do
        if [[ "$first" == "true" ]]; then
            first=false
        else
            results+=","
        fi
        
        results+="{"
        results+="\"id\":\"$endpoint_id\","
        results+="\"name\":\"${endpoint_id//_/_}\","
        results+="\"url\":\"${ENDPOINTS[$endpoint_id]}\","
        results+="\"status\":\"${LAST_STATUS[$endpoint_id]}\","
        results+="\"consecutive_failures\":${CONSECUTIVE_FAILURES[$endpoint_id]},"
        results+="\"consecutive_successes\":${CONSECUTIVE_SUCCESSES[$endpoint_id]},"
        results+="\"avg_response_time\":${RESPONSE_TIMES[$endpoint_id]},"
        results+="\"last_check\":\"${LAST_CHECK_TIME[$endpoint_id]}\""
        results+="}"
    done
    
    results+="]}"
    
    echo "$results" > "$RESULTS_FILE"
}

# Function to display status summary
display_summary() {
    echo ""
    echo "📊 Website Health Summary"
    echo "========================"
    
    local overall_health=$(calculate_overall_health)
    local status=$(echo "$overall_health" | jq -r '.status')
    local total=$(echo "$overall_health" | jq -r '.total_endpoints')
    local healthy=$(echo "$overall_health" | jq -r '.healthy_endpoints')
    
    case "$status" in
        "healthy")
            success "🎉 Overall Status: HEALTHY ($healthy/$total endpoints healthy)"
            ;;
        "degraded")
            warn "⚠️  Overall Status: DEGRADED ($healthy/$total endpoints healthy)"
            ;;
        "critical")
            error "🚨 Overall Status: CRITICAL ($healthy/$total endpoints healthy)"
            ;;
    esac
    
    echo ""
    echo "📋 Endpoint Details:"
    printf "%-20s | %-10s | %-8s | %-8s | %-12s | %-12s\n" "Endpoint" "Status" "Failures" "Successes" "Avg RT (ms)" "Last Check"
    printf "%-20s-+-%-10s-+-%-8s-+-%-8s-+-%-12s-+-%-12s\n" "--------------------" "----------" "--------" "--------" "------------" "------------"
    
    for endpoint_id in "${!ENDPOINTS[@]}"; do
        local status="${LAST_STATUS[$endpoint_id]}"
        local status_color=""
        case "$status" in
            "healthy") status_color="$GREEN" ;;
            "unhealthy") status_color="$RED" ;;
            *) status_color="$YELLOW" ;;
        esac
        
        printf "%-20s | ${status_color}%-10s${NC} | %-8s | %-8s | %-12s | %-12s\n" \
            "${endpoint_id//_/_}" \
            "$status" \
            "${CONSECUTIVE_FAILURES[$endpoint_id]}" \
            "${CONSECUTIVE_SUCCESSES[$endpoint_id]}" \
            "${RESPONSE_TIMES[$endpoint_id]}" \
            "${LAST_CHECK_TIME[$endpoint_id]:-Never}"
    done
    
    echo ""
    echo "📁 Detailed results saved to: $RESULTS_FILE"
    echo "📝 Log file: $LOG_FILE"
}

# Function to run continuous monitoring
run_continuous() {
    log "🚀 Starting continuous website health monitoring..."
    
    while true; do
        echo ""
        log "🔄 Running health checks at $(date)"
        
        # Check all endpoints
        for endpoint_id in "${!ENDPOINTS[@]}"; do
            check_endpoint "$endpoint_id"
        done
        
        # Generate results
        generate_results
        
        # Display summary
        display_summary
        
        # Wait before next check
        log "⏳ Next check in 60 seconds..."
        sleep 60
    done
}

# Function to run single check
run_single_check() {
    log "🔍 Running single website health check..."
    
    # Check all endpoints
    for endpoint_id in "${!ENDPOINTS[@]}"; do
        check_endpoint "$endpoint_id"
    done
    
    # Generate results
    generate_results
    
    # Display summary
    display_summary
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --continuous     Run continuous monitoring (default)"
    echo "  --single         Run single check and exit"
    echo "  --endpoint ID    Check specific endpoint only"
    echo "  --timeout N      Set timeout in seconds (default: 10)"
    echo "  --help           Show this help message"
    echo ""
    echo "Available endpoints:"
    for endpoint_id in "${!ENDPOINTS[@]}"; do
        echo "  - $endpoint_id (${ENDPOINTS[$endpoint_id]})"
    done
}

# Main execution
main() {
    local mode="continuous"
    local specific_endpoint=""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --continuous)
                mode="continuous"
                shift
                ;;
            --single)
                mode="single"
                shift
                ;;
            --endpoint)
                specific_endpoint="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Show header
    echo ""
    echo "🔍 HeadyMe Website Health Monitor"
    echo "================================="
    echo "Mode: $mode"
    echo "Timeout: ${TIMEOUT}s"
    echo "Monitoring ${#ENDPOINTS[@]} endpoints"
    echo ""
    
    # Run based on mode
    if [[ -n "$specific_endpoint" ]]; then
        if [[ -z "${ENDPOINTS[$specific_endpoint]}" ]]; then
            error "Unknown endpoint: $specific_endpoint"
            echo "Available endpoints:"
            for endpoint_id in "${!ENDPOINTS[@]}"; do
                echo "  - $endpoint_id"
            done
            exit 1
        fi
        
        log "🔍 Checking specific endpoint: $specific_endpoint"
        check_endpoint "$specific_endpoint"
        generate_results
        display_summary
    elif [[ "$mode" == "single" ]]; then
        run_single_check
    else
        run_continuous
    fi
}

# Handle signals for graceful shutdown
trap 'log "🛑 Received signal, shutting down..."; exit 0' SIGINT SIGTERM

# Run main function
main "$@"
