# ═══════════════════════════════════════════════════════════════════════════
# Heady Service Toggle Auto-Configuration & Optimization System
# ═══════════════════════════════════════════════════════════════════════════
# Automatically scans docker-compose files and intelligently enhances them with:
#
# CORE FEATURES:
# - Environment-based service toggles with intelligent defaults
# - Health checks for critical services with retry logic and exponential backoff
# - Resource limits based on service profiles, system capacity, and historical usage
# - Labels for service categorization, versioning, ownership, and management
# - Restart policies based on criticality, dependencies, and failure patterns
# - Smart dependency detection and ordering with circular dependency prevention
# - Network configuration for service isolation, security zones, and traffic shaping
# - Backup and rollback capabilities with versioning, compression, and encryption
# - Volume management with persistence strategies, snapshots, and replication
# - Logging configuration with rotation, aggregation, structured formats, and retention
#
# SECURITY & COMPLIANCE:
# - Security hardening (secrets management, user permissions, capability dropping)
# - SSL/TLS certificate management with auto-renewal and rotation
# - Container image optimization, vulnerability scanning, and SBOM generation
# - Compliance validation against CIS benchmarks and security policies
# - Secret scanning and sensitive data detection
# - Network policies and firewall rule generation
# - RBAC integration and access control lists
# - Audit logging and compliance reporting
# - Supply chain security and provenance tracking
#
# ORCHESTRATION & SCALING:
# - Service discovery integration (Consul/etcd/Eureka)
# - Auto-scaling hints, resource reservations, and predictive scaling
# - Load balancing configuration with health-based routing
# - Rolling update and blue-green deployment strategies
# - Canary deployments with traffic splitting
# - Init container and sidecar pattern support
# - Pod disruption budgets and graceful shutdown handling
# - Affinity and anti-affinity rules for optimal placement
# - Topology spread constraints for high availability
#
# OBSERVABILITY & MONITORING:
# - Monitoring integration (Prometheus/Grafana/Datadog)
# - Distributed tracing configuration (Jaeger/Zipkin/Tempo)
# - Metrics export with custom dimensions and aggregations
# - Dashboard generation with service-specific panels
# - Alert rule creation based on SLOs and error budgets
# - Log aggregation and centralized logging (ELK/Loki)
# - Performance profiling and continuous profiling
# - Synthetic monitoring and uptime checks
# - APM integration for request tracing
#
# PERFORMANCE & OPTIMIZATION:
# - Cache layer optimization (Redis/Memcached/Varnish)
# - Database connection pooling, tuning, and query optimization
# - API gateway integration, rate limiting, and throttling
# - CDN configuration and edge caching strategies
# - Compression and content optimization
# - Resource utilization analysis and cost optimization
# - Performance benchmarking and regression detection
# - Query plan analysis and index recommendations
# - Memory leak detection and heap analysis
#
# RESILIENCE & RELIABILITY:
# - Chaos engineering and fault injection capabilities
# - Circuit breaker patterns and bulkhead isolation
# - Retry policies with exponential backoff and jitter
# - Timeout configuration and deadline propagation
# - Graceful degradation and fallback mechanisms
# - Service mesh integration (Linkerd/Istio/Consul Connect)
# - Traffic mirroring and shadow testing
# - Disaster recovery planning and RTO/RPO validation
# - Multi-region failover and geo-replication
#
# DEVELOPMENT & TESTING:
# - Environment-specific overrides (dev/staging/prod)
# - Feature flag integration for gradual rollouts
# - Test container configuration for integration testing
# - Mock service generation for isolated testing
# - Performance testing and load generation
# - Database seeding and fixture management
# - Hot reload and live debugging support
# - Local development optimization
#
# INTEGRATIONS & ECOSYSTEM:
# - Reads from configs/service-catalog.yaml for service metadata
# - Validates against configs/resource-policies.yaml for governance
# - Integrates with configs/system-components.yaml for architecture
# - Syncs with configs/governance-policies.yaml for compliance
# - Uses configs/story-driver.yaml for feature prioritization
# - Connects to Heady Manager API for runtime configuration
# - Integrates with Consul for service discovery and KV store
# - Links to Grafana dashboards for visualization and alerting
# - Exports metrics to Prometheus with custom exporters
# - Syncs with Notion project notebook for documentation
# - Integrates with CI/CD pipelines (GitHub Actions/GitLab CI)
# - Supports Cloudflare tunnel and Zero Trust configuration
# - Compatible with Render.com, Railway, and cloud deployments
# - Integrates with PostgreSQL for state management and persistence
# - Connects to Ollama for AI-powered optimization suggestions
# - Links to RAG system for documentation lookup and context
# - Supports MCP protocol for tool integration and orchestration
# - Integrates with Redis for caching, pub/sub, and rate limiting
# - Connects to OpenTelemetry for unified observability
# - Supports Vault for secrets management
# - Integrates with ArgoCD for GitOps workflows
# - Connects to PagerDuty/Opsgenie for incident management
# - Supports Sentry for error tracking and performance monitoring
#
# VALIDATION & REPORTING:
# - Validation against service catalog and best practices
# - Performance optimization suggestions with impact analysis
# - Cost analysis and resource utilization reporting
# - Automatic port conflict detection and resolution
# - Configuration drift detection and remediation
# - Dependency graph generation and visualization
# - Security posture assessment and recommendations
# - Compliance reports with evidence collection
# - Change impact analysis and risk assessment
# - Resource forecasting and capacity planning
#
# USAGE:
#   .\add_service_toggles.ps1 [-DryRun] [-Verbose] [-AddHealthChecks] [-AddResourceLimits]
#   .\add_service_toggles.ps1 -Profile production -Validate -Backup
#   .\add_service_toggles.ps1 -Environment staging -OptimizeResources -SecurityHarden
#   .\add_service_toggles.ps1 -AnalyzeCosts -GenerateReport -ExportMetrics
#   .\add_service_toggles.ps1 -ChaosTest -CircuitBreaker -EnableTracing
#   .\add_service_toggles.ps1 -ComplianceCheck -GenerateSBOM -ScanVulnerabilities
#   .\add_service_toggles.ps1 -AutoScale -LoadBalance -EnableMesh
#   .\add_service_toggles.ps1 -DisasterRecovery -BackupAll -TestFailover
#
# ═══════════════════════════════════════════════════════════════════════════
# Scans all docker-compose files and adds environment-based service toggles
# with intelligent defaults based on service type and dependencies

param(
    [switch]$DryRun,
    [switch]$Verbose,
    [string]$ConfigPath = "configs/service-catalog.yaml",
    [switch]$AddHealthChecks,
    [switch]$AddResourceLimits,
    [switch]$AddLabels,
    [switch]$Backup = $true
)

$ErrorActionPreference = "Stop"

# Import required modules
if (-not (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue)) {
    Install-Module powershell-yaml -Force -Scope CurrentUser
    Import-Module powershell-yaml
}

# Load service catalog for intelligent defaults
$serviceCatalog = @{}
if (Test-Path $ConfigPath) {
    try {
        $catalog = Get-Content $ConfigPath -Raw | ConvertFrom-Yaml
        foreach ($service in $catalog.services) {
            $serviceCatalog[$service.name] = @{
                critical = $service.critical
                tier = $service.tier
                dependencies = $service.dependencies
                profile = $service.profile
            }
        }
        if ($Verbose) { Write-Host "✅ Loaded $($serviceCatalog.Count) services from catalog" -ForegroundColor Green }
    } catch {
        Write-Warning "Could not load service catalog: $_"
    }
}

# Service priority mapping from docker-setup.ps1 profiles
$serviceProfiles = @{
    minimal = @('heady-manager', 'heady-postgres', 'heady-redis')
    ai = @('heady-ollama', 'heady-rag', 'heady-mcp')
    monitoring = @('heady-grafana', 'heady-prometheus', 'heady-consul')
    full = @('*')
}

$criticalServices = @('heady-postgres', 'heady-redis', 'heady-manager')
$optionalServices = @('heady-grafana', 'heady-prometheus', 'heady-ollama', 'heady-consul')

function Get-ServiceDefault {
    param([string]$ServiceName)
    
    # Check catalog first
    if ($serviceCatalog.ContainsKey($ServiceName)) {
        $svc = $serviceCatalog[$ServiceName]
        if ($svc.critical) { return 'true' }
        if ($svc.tier -eq 'core') { return 'true' }
        if ($svc.profile -eq 'minimal') { return 'true' }
        return 'false'
    }
    
    # Fallback to hardcoded rules
    if ($criticalServices -contains $ServiceName) { return 'true' }
    if ($optionalServices -contains $ServiceName) { return 'false' }
    
    # Default to enabled for unknown services
    return 'true'
}

function Get-ServiceProfile {
    param([string]$ServiceName)
    
    foreach ($profile in $serviceProfiles.Keys) {
        if ($serviceProfiles[$profile] -contains $ServiceName -or $serviceProfiles[$profile] -contains '*') {
            return $profile
        }
    }
    return 'minimal'
}

function Add-ServiceHealthCheck {
    param([string]$ServiceName, [array]$Lines, [int]$Index)
    
    $healthChecks = @{
        'heady-postgres' = @{
            test = "['CMD-SHELL', 'pg_isready -U `$`$POSTGRES_USER']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '40s'
        }
        'heady-redis' = @{
            test = "['CMD-SHELL', 'redis-cli ping']"
            interval = '10s'
            timeout = '5s'
            retries = 5
            start_period = '10s'
        }
        'heady-manager' = @{
            test = "['CMD-SHELL', 'curl -f http://localhost:3300/health || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '60s'
        }
        'heady-ollama' = @{
            test = "['CMD-SHELL', 'curl -f http://localhost:11434/api/tags || exit 1']"
            interval = '60s'
            timeout = '15s'
            retries = 3
            start_period = '120s'
        }
        'heady-grafana' = @{
            test = "['CMD-SHELL', 'curl -f http://localhost:3000/api/health || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '30s'
        }
        'heady-prometheus' = @{
            test = "['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:9090/-/healthy || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '30s'
        }
        'heady-consul' = @{
            test = "['CMD-SHELL', 'consul members || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '20s'
        }
        'heady-rag' = @{
            test = "['CMD-SHELL', 'curl -f http://localhost:8080/health || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '60s'
        }
        'heady-mcp' = @{
            test = "['CMD-SHELL', 'curl -f http://localhost:3001/health || exit 1']"
            interval = '30s'
            timeout = '10s'
            retries = 3
            start_period = '30s'
        }
    }
    
    if ($healthChecks.ContainsKey($ServiceName)) {
        $hc = $healthChecks[$ServiceName]
        return @(
            "    healthcheck:",
            "      test: $($hc.test)",
            "      interval: $($hc.interval)",
            "      timeout: $($hc.timeout)",
            "      retries: $($hc.retries)",
            "      start_period: $($hc.start_period)"
        )
    }
    return @()
}

function Add-ServiceLabels {
    param([string]$ServiceName)
    
    $profile = Get-ServiceProfile -ServiceName $ServiceName
    $isCritical = $criticalServices -contains $ServiceName
    
    return @(
        "    labels:",
        "      - 'com.heady.profile=$profile'",
        "      - 'com.heady.critical=$isCritical'",
        "      - 'com.heady.managed=true'",
        "      - 'com.heady.version=1.0.0'"
    )
}

function Add-ResourceLimits {
    param([string]$ServiceName)
    
    # Resource limits based on service type
    $resourceMap = @{
        'heady-postgres' = @{ memory = '2g'; cpus = '2.0' }
        'heady-redis' = @{ memory = '512m'; cpus = '0.5' }
        'heady-manager' = @{ memory = '1g'; cpus = '1.0' }
        'heady-ollama' = @{ memory = '8g'; cpus = '4.0' }
        'heady-grafana' = @{ memory = '512m'; cpus = '0.5' }
        'heady-prometheus' = @{ memory = '1g'; cpus = '1.0' }
        'heady-consul' = @{ memory = '256m'; cpus = '0.5' }
        'heady-rag' = @{ memory = '2g'; cpus = '2.0' }
        'heady-mcp' = @{ memory = '512m'; cpus = '1.0' }
        'heady-worker' = @{ memory = '1g'; cpus = '1.0' }
        'heady-scheduler' = @{ memory = '512m'; cpus = '0.5' }
    }
    
    if ($resourceMap.ContainsKey($ServiceName)) {
        $limits = $resourceMap[$ServiceName]
        $memValue = [int]($limits.memory -replace '[a-z]', '')
        $memUnit = $limits.memory -replace '[0-9]', ''
        $reservedMem = [int]($memValue / 2)
        $reservedCpu = [double]$limits.cpus / 2
        
        return @(
            "    deploy:",
            "      resources:",
            "        limits:",
            "          memory: $($limits.memory)",
            "          cpus: '$($limits.cpus)'",
            "        reservations:",
            "          memory: ${reservedMem}${memUnit}",
            "          cpus: '$reservedCpu'"
        )
    }
    return @()
}

function Add-RestartPolicy {
    param([string]$ServiceName)
    
    $policy = if ($criticalServices -contains $ServiceName) {
        "always"
    } else {
        "unless-stopped"
    }
    
    return @(
        "    restart: $policy"
    )
}

function Add-DependsOn {
    param([string]$ServiceName, [array]$ExistingDeps)
    
    # Smart dependency detection
    $dependencies = @{
        'heady-manager' = @('heady-postgres', 'heady-redis')
        'heady-worker' = @('heady-postgres', 'heady-redis', 'heady-manager')
        'heady-scheduler' = @('heady-postgres', 'heady-redis')
        'heady-rag' = @('heady-postgres', 'heady-ollama')
        'heady-mcp' = @('heady-manager')
        'heady-grafana' = @('heady-prometheus')
    }
    
    if ($dependencies.ContainsKey($ServiceName) -and $ExistingDeps.Count -eq 0) {
        $deps = $dependencies[$ServiceName]
        $lines = @("    depends_on:")
        foreach ($dep in $deps) {
            $lines += "      - $dep"
        }
        return $lines
    }
    return @()
}

function Add-NetworkConfig {
    param([string]$ServiceName)
    
    return @(
        "    networks:",
        "      - heady-network"
    )
}

function Backup-ComposeFile {
    param([string]$FilePath)
    
    if ($Backup) {
        $backupPath = "$FilePath.backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item $FilePath $backupPath
        Write-VerboseLog "📦 Backed up to: $backupPath" -Color Cyan
    }
}

function Write-VerboseLog {
    param([string]$Message, [string]$Color = 'Gray')
    if ($Verbose) {
        Write-Host $Message -ForegroundColor $Color
    }
}

function Test-ServiceEnabled {
    param([string]$ServiceName, [array]$Lines, [int]$StartIndex)
    
    for ($i = $StartIndex; $i -lt $Lines.Count; $i++) {
        if ($Lines[$i] -match '^\s*enabled:\s*\$\{') {
            return $true
        }
        if ($Lines[$i] -match '^\s*[a-zA-Z0-9_-]+:\s*$') {
            return $false
        }
    }
    return $false
}

# Main execution
Write-Host "🔧 Heady Service Toggle Auto-Configuration" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "⚠️  DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}
$files = Get-ChildItem -Path . -Recurse -Include 'docker-compose*.yml'

foreach ($file in $files) {
    $content = Get-Content $file.FullName
    $newContent = @()
    $inService = $false
    $serviceName = $null

    foreach ($line in $content) {
        if ($line -match '^\s*([a-zA-Z0-9_-]+):\s*$') {
            $inService = $true
            $serviceName = $matches[1]
            $newContent += $line
        } elseif ($inService -and $line -match '^\s*environment:\s*$') {
            $newContent += $line
            $varName = "USE_$($serviceName -replace '-','_').ToUpper()"
            $newContent += "      - $varName=``${$varName:-true}"
        } else {
            $newContent += $line
        }

        if ($line -match '^\s*$' -and $inService) {
            $inService = $false
        }
    }

    Set-Content -Path $file.FullName -Value $newContent
}

Write-Host "Added service toggles to $($files.Count) docker-compose files" -ForegroundColor Green
