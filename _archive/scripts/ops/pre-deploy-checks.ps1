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
<# ║  FILE: scripts/ops/pre-deploy-checks.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
HEADY_BRAND:BEGIN
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
# ║  FILE: scripts/ops/pre-deploy-checks.ps1                         ║
# ║  LAYER: automation                                               ║
# ╚══════════════════════════════════════════════════════════════════╝
HEADY_BRAND:END
#>

param()

$ErrorActionPreference = "Stop"

function Show-Header($Message) {
    Write-Host "`n════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor White
    Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Show-Step($Message) {
    Write-Host "`n[HC] $Message" -ForegroundColor Yellow
}

Show-Header "HEADY PRE-DEPLOYMENT CHECKS"

# 1. Verify all services are healthy
Show-Step "Checking service health..."
$services = @(
    "http://api.headysystems.com:3300/api/health",
    "http://api.headysystems.com:3301/api/health"  # Add other services as needed
)

foreach ($service in $services) {
    try {
        $response = Invoke-RestMethod -TimeoutSec 10 -Uri $service -Method Get -ErrorAction Stop
        if ($response.ok -ne $true) {
            throw "Service at $service is not healthy"
        }
        Write-Host "✓ $service is healthy" -ForegroundColor Green
    } catch {
        Write-Error "❌ $service is not healthy: $_"
        exit 1
    }
}

# 2. Check resource availability
Show-Step "Checking system resources..."
$cpuUsage = (Get-Counter -Counter "\Processor(_Total)\% Processor Time" -SampleInterval 1 -MaxSamples 1).CounterSamples.CookedValue
$memUsage = (Get-Counter -Counter "\Memory\% Committed Bytes In Use" -SampleInterval 1 -MaxSamples 1).CounterSamples.CookedValue

if ($cpuUsage -gt 90) {
    Write-Warning "CPU usage is high: $cpuUsage%"
}
if ($memUsage -gt 90) {
    Write-Warning "Memory usage is high: $memUsage%"
}

Write-Host "CPU Usage: $cpuUsage%" -ForegroundColor Gray
Write-Host "Memory Usage: $memUsage%" -ForegroundColor Gray

# 3. Validate configuration
Show-Step "Validating configuration..."
# Example: Validate heady-registry.json
$registryPath = Join-Path $PSScriptRoot "..\..\heady-registry.json"
if (-not (Test-Path $registryPath)) {
    Write-Error "heady-registry.json not found"
    exit 1
}

$registry = Get-Content $registryPath | ConvertFrom-Json
if (-not $registry.registryVersion) {
    Write-Error "Invalid heady-registry.json: missing registryVersion"
    exit 1
}

Write-Host "✓ Configuration validated" -ForegroundColor Green

Write-Host "`n✅ Pre-deployment checks passed!" -ForegroundColor Green
