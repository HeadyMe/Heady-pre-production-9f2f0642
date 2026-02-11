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
<# ║  FILE: scripts/train-model-simple.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Trains Heady AI models
#>

# Brain endpoint - path-based routing (no subdomain needed)
$brainEndpoint = "https://headysystems.com"
$renderFallback = "https://heady-manager-headysystems.onrender.com"

# Check for auto and non-interactive parameters
$autoMode = $args -contains '-auto'
$nonInteractive = $args -contains '-nonInteractive'

Write-Host "🧠 Starting Heady AI training..." -ForegroundColor Cyan

if ($nonInteractive) {
    Write-Host "Running in non-interactive mode" -ForegroundColor Yellow
}

if ($autoMode) {
    Write-Host "Running in auto mode" -ForegroundColor Yellow
}

# Start training
try {
    # Try primary domain first, fallback to Render
    $testEndpoint = "$brainEndpoint/api/v1/train"
    try {
        $null = Invoke-WebRequest -Uri "$brainEndpoint/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
        $useEndpoint = $testEndpoint
        Write-Host "Using primary endpoint: $brainEndpoint" -ForegroundColor Green
    } catch {
        Write-Host "Primary not reachable, falling back to Render..." -ForegroundColor Yellow
        $useEndpoint = "$renderFallback/api/v1/train"
    }
    
    $params = @{
        Uri = $useEndpoint
        Method = "POST"
        Headers = @{
            "Authorization" = "Bearer $env:HEADY_API_KEY"
        }
        Body = @{
            mode = if ($autoMode) { "auto" } else { "manual" }
            nonInteractive = $nonInteractive
        } | ConvertTo-Json
        ContentType = "application/json"
    }
    
    $response = Invoke-RestMethod @params
    Write-Host "✅ Training started successfully!" -ForegroundColor Green
    Write-Host "Job ID: $($response.jobId)" -ForegroundColor White
    
    if ($response.status) {
        Write-Host "Status: $($response.status)" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "❌ Training failed: $_" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
    
    if (-not $nonInteractive) {
        Write-Host "Check your HEADY_API_KEY environment variable and network connectivity." -ForegroundColor Yellow
    }
}

Write-Host "🎉 Training script completed!" -ForegroundColor Green
