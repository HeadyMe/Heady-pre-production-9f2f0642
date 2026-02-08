<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/docker-setup.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/docker-setup.ps1                                        ║
# ║  LAYER: scripts                                                  ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

# Heady Docker Container Setup Script
# Installs and launches all Heady ecosystem containers

param(
    [ValidateSet("minimal", "full", "ai", "monitoring")]
    [string]$Profile = "full",
    
    [switch]$Force = $false,
    [switch]$Stop = $false,
    [switch]$Clean = $false,
    [switch]$Status = $false,
    [switch]$Logs = $false,
    [switch]$Help = $false
)

# Help information
if ($Help) {
    Write-Host "🐳 Heady Docker Setup Script" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Profiles:" -ForegroundColor Yellow
    Write-Host "  minimal    - Core services (manager, postgres, redis)" -ForegroundColor White
    Write-Host "  full       - All services (default)" -ForegroundColor White
    Write-Host "  ai         - AI/ML focused services" -ForegroundColor White
    Write-Host "  monitoring - Observability and monitoring" -ForegroundColor White
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Force     - Force rebuild containers" -ForegroundColor White
    Write-Host "  -Stop      - Stop all containers" -ForegroundColor White
    Write-Host "  -Clean     - Remove containers and volumes" -ForegroundColor White
    Write-Host "  -Status    - Show container status" -ForegroundColor White
    Write-Host "  -Logs      - Show container logs" -ForegroundColor White
    Write-Host "  -Help      - Show this help" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\docker-setup.ps1" -ForegroundColor Gray
    Write-Host "  .\docker-setup.ps1 -Profile minimal" -ForegroundColor Gray
    Write-Host "  .\docker-setup.ps1 -Profile ai -Force" -ForegroundColor Gray
    Write-Host "  .\docker-setup.ps1 -Stop" -ForegroundColor Gray
    Write-Host "  .\docker-setup.ps1 -Clean" -ForegroundColor Gray
    exit 0
}

# Check Docker Desktop
function Test-DockerDesktop {
    try {
        $dockerVersion = docker --version
        if ($LASTEXITCODE -ne 0) {
            throw "Docker not found"
        }
        Write-Host "✅ Docker Desktop detected: $dockerVersion" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ Docker Desktop not found or not running" -ForegroundColor Red
        Write-Host "Please install and start Docker Desktop first" -ForegroundColor Yellow
        return $false
    }
}

# Stop all containers
function Stop-HeadyContainers {
    Write-Host "🛑 Stopping Heady containers..." -ForegroundColor Yellow
    
    $composeFiles = @("docker-compose.yml", "docker-compose.full.yml")
    foreach ($file in $composeFiles) {
        if (Test-Path $file) {
            Write-Host "Stopping containers from $file..." -ForegroundColor Blue
            docker-compose -f $file down --remove-orphans
        }
    }
    
    Write-Host "✅ All Heady containers stopped" -ForegroundColor Green
}

# Clean containers and volumes
function Clear-HeadyEnvironment {
    Write-Host "🧹 Cleaning Heady Docker environment..." -ForegroundColor Yellow
    
    # Stop containers first
    Stop-HeadyContainers
    
    # Remove volumes
    Write-Host "Removing Heady volumes..." -ForegroundColor Blue
    $volumes = docker volume ls --filter "name=heady" -q
    if ($volumes) {
        $volumes | ForEach-Object {
            docker volume rm $_
        }
    }
    
    # Remove networks
    Write-Host "Removing Heady networks..." -ForegroundColor Blue
    $networks = docker network ls --filter "name=heady" -q
    if ($networks) {
        $networks | ForEach-Object {
            docker network rm $_
        }
    }
    
    # Remove images (optional)
    if ($Force) {
        Write-Host "Removing Heady images..." -ForegroundColor Blue
        $images = docker images --filter "reference=heady*" -q
        if ($images) {
            $images | ForEach-Object {
                docker rmi $_
            }
        }
    }
    
    Write-Host "✅ Heady Docker environment cleaned" -ForegroundColor Green
}

# Show container status
function Show-ContainerStatus {
    Write-Host "📊 Heady Container Status" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    
    $containers = docker ps --filter "name=heady" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    if ($containers) {
        Write-Host $containers -ForegroundColor White
    } else {
        Write-Host "No Heady containers running" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Resource Usage:" -ForegroundColor Yellow
    $stats = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    if ($stats) {
        Write-Host $stats -ForegroundColor White
    }
}

# Show container logs
function Show-ContainerLogs {
    Write-Host "📋 Heady Container Logs" -ForegroundColor Cyan
    Write-Host "======================" -ForegroundColor Cyan
    
    $containers = docker ps --filter "name=heady" --format "{{.Names}}"
    
    foreach ($container in $containers) {
        Write-Host ""
        Write-Host "=== $container ===" -ForegroundColor Yellow
        docker logs --tail 20 $container
    }
}

# Launch containers based on profile
function Start-HeadyContainers {
    param([string]$Profile)
    
    Write-Host "🚀 Starting Heady containers with profile: $Profile" -ForegroundColor Cyan
    
    switch ($Profile) {
        "minimal" {
            Write-Host "Starting minimal stack (manager, postgres, redis)..." -ForegroundColor Blue
            docker-compose up -d heady-manager heady-postgres heady-redis
        }
        
        "full" {
            Write-Host "Starting full Heady ecosystem..." -ForegroundColor Blue
            if ($Force) {
                docker-compose -f docker-compose.full.yml build --no-cache
            }
            docker-compose -f docker-compose.full.yml up -d
        }
        
        "ai" {
            Write-Host "Starting AI/ML services..." -ForegroundColor Blue
            docker-compose -f docker-compose.full.yml up -d heady-manager heady-postgres heady-redis heady-ollama heady-rag heady-mcp
        }
        
        "monitoring" {
            Write-Host "Starting monitoring stack..." -ForegroundColor Blue
            docker-compose -f docker-compose.full.yml up -d heady-grafana heady-prometheus heady-consul
        }
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start containers" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Containers started successfully" -ForegroundColor Green
}

# Wait for services to be healthy
function Wait-ForServices {
    Write-Host "⏳ Waiting for services to be healthy..." -ForegroundColor Yellow
    
    $services = @(
        @{name="heady-manager"; url="http://localhost:3300/api/health"},
        @{name="heady-postgres"; command="docker exec heady-postgres pg_isready -U heady"},
        @{name="heady-redis"; command="docker exec heady-redis redis-cli ping"}
    )
    
    foreach ($service in $services) {
        Write-Host "Checking $($service.name)..." -ForegroundColor Blue
        $attempts = 0
        $maxAttempts = 30
        
        while ($attempts -lt $maxAttempts) {
            try {
                if ($service.url) {
                    $response = Invoke-WebRequest -Uri $service.url -TimeoutSec 5
                    if ($response.StatusCode -eq 200) {
                        Write-Host "✅ $($service.name) is healthy" -ForegroundColor Green
                        break
                    }
                } elseif ($service.command) {
                    $result = Invoke-Expression $service.command
                    if ($result -match "accepting connections|PONG") {
                        Write-Host "✅ $($service.name) is healthy" -ForegroundColor Green
                        break
                    }
                }
            } catch {
                # Service not ready yet
            }
            
            $attempts++
            Start-Sleep 2
        }
        
        if ($attempts -ge $maxAttempts) {
            Write-Host "⚠️  $($service.name) not ready after 60 seconds" -ForegroundColor Yellow
        }
    }
}

# Show access information
function Show-AccessInfo {
    Write-Host ""
    Write-Host "🌐 Heady Services Access" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Core Services:" -ForegroundColor Yellow
    Write-Host "  • Heady Manager:     http://localhost:3300" -ForegroundColor White
    Write-Host "  • Web Dashboard:     http://localhost:3000" -ForegroundColor White
    Write-Host "  • MCP Gateway:       http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "AI Services:" -ForegroundColor Yellow
    Write-Host "  • Ollama LLM:        http://localhost:11434" -ForegroundColor White
    Write-Host "  • RAG Service:       http://localhost:8080" -ForegroundColor White
    Write-Host ""
    Write-Host "Admin Interfaces:" -ForegroundColor Yellow
    Write-Host "  • PostgreSQL Admin:  http://localhost:8080" -ForegroundColor White
    Write-Host "  • Redis Commander:   http://localhost:8081" -ForegroundColor White
    Write-Host "  • Grafana:           http://localhost:3002" -ForegroundColor White
    Write-Host "  • Prometheus:        http://localhost:9090" -ForegroundColor White
    Write-Host "  • Consul UI:         http://localhost:8500" -ForegroundColor White
    Write-Host ""
    Write-Host "Database Connections:" -ForegroundColor Yellow
    Write-Host "  • PostgreSQL:        localhost:5432 (heady/heady_secret)" -ForegroundColor White
    Write-Host "  • Redis:             localhost:6379" -ForegroundColor White
    Write-Host ""
    Write-Host "✨ Heady ecosystem is ready!" -ForegroundColor Magenta
}

# Main execution
try {
    if ($Status) {
        Show-ContainerStatus
        exit 0
    }
    
    if ($Logs) {
        Show-ContainerLogs
        exit 0
    }
    
    if ($Stop) {
        if (Test-DockerDesktop) {
            Stop-HeadyContainers
        }
        exit 0
    }
    
    if ($Clean) {
        if (Test-DockerDesktop) {
            Clear-HeadyEnvironment
        }
        exit 0
    }
    
    # Normal startup
    if (Test-DockerDesktop) {
        Start-HeadyContainers -Profile $Profile
        Wait-ForServices
        Show-ContainerStatus
        Show-AccessInfo
    } else {
        exit 1
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}
