#!/bin/bash
# 🖥️ HEADCLOUDS MINICOMPUTER INFRASTRUCTURE SETUP
# Optimized configuration for local render services

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

# Configuration
HEADY_BASE="${HOME}/CascadeProjects/Heady"
MODE="${1:-inventory}"
CORES=$(nproc)
MEMORY=$(free -g | awk '/^Mem:/{print $2}')
STORAGE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')

# Service Configuration
declare -A SERVICES=(
    ["heady-manager"]="3300:High:Core orchestration"
    ["python-worker"]="5000:High:Computational tasks"
    ["web-dashboard"]="3000:Medium:Development UI"
    ["redis-cache"]="6379:High:Fast data access"
    ["postgresql"]="5432:Critical:Persistent storage"
    ["prometheus"]="9090:Medium:Metrics collection"
    ["grafana"]="3001:Medium:Visualization"
)

# Worker Pool Configuration
WORKER_POOLS="{
    \"hot\": {
        \"workers\": $((CORES / 2)),
        \"priority\": 0,
        \"description\": \"Critical AI node operations\"
    },
    \"warm\": {
        \"workers\": $((CORES / 4)),
        \"priority\": 1,
        \"description\": \"Normal pipeline tasks\"
    },
    \"cold\": {
        \"workers\": 1,
        \"priority\": 2,
        \"description\": \"Background processing\"
    }
}"

inventory() {
    log "🔍 MINICOMPUTER INFRASTRUCTURE INVENTORY"
    log "=========================================="
    
    echo ""
    success "🖥️ HARDWARE RESOURCES:"
    echo "  CPU Cores: $CORES"
    echo "  Memory: ${MEMORY}GB"
    echo "  Storage: ${STORAGE}GB available"
    
    echo ""
    success "🚀 RECOMMENDED CONFIGURATION:"
    
    # Calculate optimal allocation
    if [[ $CORES -ge 8 ]]; then
        HOT_WORKERS=4
        WARM_WORKERS=2
        COLD_WORKERS=1
    elif [[ $CORES -ge 4 ]]; then
        HOT_WORKERS=2
        WARM_WORKERS=1
        COLD_WORKERS=1
    else
        HOT_WORKERS=1
        WARM_WORKERS=1
        COLD_WORKERS=0
    fi
    
    echo "  Worker Pool Allocation:"
    echo "    Hot Pool: $HOT_WORKERS workers (critical tasks)"
    echo "    Warm Pool: $WARM_WORKERS workers (normal tasks)"
    echo "    Cold Pool: $COLD_WORKERS workers (background)"
    
    echo ""
    success "📊 SERVICE ALLOCATION:"
    for service in "${!SERVICES[@]}"; do
        IFS=':' read -r port priority desc <<< "${SERVICES[$service]}"
        echo "  $service: Port $port [$priority] - $desc"
    done
    
    echo ""
    success "🎯 PERFORMANCE RECOMMENDATIONS:"
    
    if [[ $MEMORY -ge 16 ]]; then
        echo "  ✅ Sufficient memory for full stack"
    elif [[ $MEMORY -ge 8 ]]; then
        echo "  ⚠️  Moderate memory - consider selective services"
    else
        echo "  ❌ Limited memory - run core services only"
    fi
    
    if [[ $STORAGE -ge 50 ]]; then
        echo "  ✅ Ample storage for logs and data"
    elif [[ $STORAGE -ge 20 ]]; then
        echo "  ⚠️  Moderate storage - monitor usage"
    else
        echo "  ❌ Limited storage - use external storage"
    fi
}

provision() {
    log "🚀 PROVISIONING MINICOMPUTER INFRASTRUCTURE"
    log "=========================================="
    
    cd "$HEADY_BASE"
    
    # Step 1: Create directories
    log "✓ STEP 1: Creating directory structure"
    mkdir -p logs/{services,workers,observability}
    mkdir -p data/{postgresql,redis,prometheus}
    mkdir -p config/{workers,pools,hybrid}
    mkdir -p scripts/{minicomputer,hybrid}
    
    # Step 2: Generate worker pool configuration
    log "✓ STEP 2: Configuring worker pools"
    
    if [[ $CORES -ge 8 ]]; then
        HOT_WORKERS=4
        WARM_WORKERS=2
        COLD_WORKERS=1
    elif [[ $CORES -ge 4 ]]; then
        HOT_WORKERS=2
        WARM_WORKERS=1
        COLD_WORKERS=1
    else
        HOT_WORKERS=1
        WARM_WORKERS=1
        COLD_WORKERS=0
    fi
    
    cat > config/workers/pool-config.json << EOF
{
    "pools": {
        "hot": {
            "workers": $HOT_WORKERS,
            "priority": 0,
            "max_tasks": 100,
            "timeout_ms": 30000,
            "description": "Critical AI node operations (PYTHIA, JULES, OBSERVER)"
        },
        "warm": {
            "workers": $WARM_WORKERS,
            "priority": 1,
            "max_tasks": 50,
            "timeout_ms": 60000,
            "description": "Normal pipeline tasks (BUILDER, ATLAS, CONDUCTOR)"
        },
        "cold": {
            "workers": $COLD_WORKERS,
            "priority": 2,
            "max_tasks": 25,
            "timeout_ms": 120000,
            "description": "Background processing (MEMORY, CLEANUP)"
        }
    },
    "total_workers": $((HOT_WORKERS + WARM_WORKERS + COLD_WORKERS)),
    "cores_available": $CORES,
    "memory_gb": $MEMORY,
    "optimized_for": "minicomputer"
}
EOF
    
    success "✓ Worker pool configuration created"
    
    # Step 3: Create hybrid deployment config
    log "✓ STEP 3: Setting up hybrid deployment"
    
    cat > config/hybrid/deployment-strategy.json << EOF
{
    "strategy": "hybrid_optimized",
    "local_services": [
        "heady-manager",
        "python-worker", 
        "redis-cache",
        "postgresql",
        "prometheus"
    ],
    "cloud_services": [
        "production-api",
        "customer-dashboard",
        "cdn-static-assets"
    ],
    "auto_failover": true,
    "circuit_breaker": {
        "failure_threshold": 3,
        "timeout_ms": 5000,
        "half_open_max_calls": 5
    },
    "resource_limits": {
        "max_memory_percent": 80,
        "max_cpu_percent": 90,
        "disk_alert_threshold_gb": 10
    }
}
EOF
    
    success "✓ Hybrid deployment configuration created"
    
    # Step 4: Create service startup scripts
    log "✓ STEP 4: Creating service startup scripts"
    
    cat > scripts/minicomputer/start-services.sh << 'EOF'
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
log "  Web Dashboard: http://localhost:3000"
log "  Prometheus: http://localhost:9090"
EOF
    
    chmod +x scripts/minicomputer/start-services.sh
    
    # Step 5: Create observability config
    log "✓ STEP 5: Configuring observability"
    
    cat > config/prometheus.yml << EOF
global:
  scrape_interval: 5s
  evaluation_interval: 5s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'heady-manager'
    static_configs:
      - targets: ['manager.headyme.com']
    metrics_path: '/api/metrics'
    
  - job_name: 'python-worker'
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
    
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:6379']
      
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['localhost:9100']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - localhost:9093
EOF
    
    success "✓ Observability configuration created"
    
    # Step 6: Create HCAutoFlow integration
    log "✓ STEP 6: Setting up HCAutoFlow integration"
    
    cat > config/hc-autoflow.json << EOF
{
    "autoflow_enabled": true,
    "pipeline_mode": "minicomputer_optimized",
    "monte_carlo_config": {
        "exploration_factor": 0.3,
        "ucb1_confidence": 2.0,
        "speed_priority": 0.8,
        "quality_threshold": 0.9
    },
    "worker_optimization": {
        "auto_scale": true,
        "load_balance": "dynamic",
        "resource_allocation": "intelligent"
    },
    "monitoring": {
        "real_time_metrics": true,
        "performance_tracking": true,
        "bottleneck_detection": true
    },
    "integration": {
        "headysoul": true,
        "socratic_method": true,
        "communication_chain": "optimal"
    }
}
EOF
    
    success "✓ HCAutoFlow integration configured"
    
    echo ""
    success "🎉 MINICOMPUTER INFRASTRUCTURE PROVISIONED!"
    echo ""
    echo "📋 Generated Configurations:"
    echo "  Worker Pools: config/workers/pool-config.json"
    echo "  Hybrid Deployment: config/hybrid/deployment-strategy.json"
    echo "  Observability: config/prometheus.yml"
    echo "  HCAutoFlow: config/hc-autoflow.json"
    echo ""
    echo "🚀 Next Steps:"
    echo "  1. Run: ./scripts/minicomputer/start-services.sh"
    echo "  2. Execute: ./scripts/hcfp-fixed-deploy.sh --auto-deploy"
    echo "  3. Initialize: node src/hc-autoflow-init.js"
}

clean-build() {
    log "🧹 CLEAN BUILD - MINICOMPUTER OPTIMIZATION"
    log "=========================================="
    
    cd "$HEADY_BASE"
    
    # Stop existing services
    log "  Stopping existing services..."
    pkill -f "heady-manager.js" 2>/dev/null || true
    pkill -f "python-worker.py" 2>/dev/null || true
    pkill -f redis-server 2>/dev/null || true
    pg_ctl -D data/postgresql/ stop 2>/dev/null || true
    pkill -f prometheus 2>/dev/null || true
    
    # Clean logs and data
    log "  Cleaning logs and temporary data..."
    rm -rf logs/*/*
    rm -f nohup.out
    
    # Run naming enforcement
    log "  Enforcing naming standards..."
    node enforce-naming.js
    
    # Install dependencies
    log "  Installing dependencies..."
    npm install
    
    # Start services
    log "  Starting optimized services..."
    ./scripts/minicomputer/start-services.sh
    
    success "✅ Clean build completed"
}

# Main execution
case "$MODE" in
    "inventory")
        inventory
        ;;
    "provision")
        provision
        ;;
    "clean-build")
        clean-build
        ;;
    *)
        echo "Usage: $0 {inventory|provision|clean-build}"
        echo ""
        echo "Commands:"
        echo "  inventory   - Show system resources and recommendations"
        echo "  provision   - Provision minicomputer infrastructure"
        echo "  clean-build - Clean build and start services"
        exit 1
        ;;
esac
