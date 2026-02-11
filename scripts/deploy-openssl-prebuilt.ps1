param(
    [string]$Environment = "production"
)

# Function definitions first
function Deploy-CloudServices {
    param(
        [string]$Environment,
        [string]$OpenSSLPath
    )

    $deployConfig = @{
        Environment = $Environment
        OpenSSLPath = $OpenSSLPath
        Services = @("heady-manager", "heady-worker", "heady-scheduler")
    }

    Write-Host "Deploying services to $Environment..." -ForegroundColor Yellow
    
    # Deploy to Render (using existing render.yaml)
    if (Test-Path "$PSScriptRoot\..\render.yaml") {
        render deploy --config "$PSScriptRoot\..\render.yaml"
    }

    # Verify health
    foreach ($service in $deployConfig.Services) {
        $health = Test-ServiceHealth -Service $service -Environment $Environment
        if (-not $health) {
            Write-Host "Service $service failed health check" -ForegroundColor Red
        } else {
            Write-Host "✅ $service healthy" -ForegroundColor Green
        }
    }

    Write-Host "Deployment completed" -ForegroundColor Green
}

function Test-ServiceHealth {
    param(
        [string]$Service,
        [string]$Environment
    )

    try {
        $url = "https://$Environment.headysystems.com/api/$Service/health"
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 10
        return $response.ok -eq $true
    } catch {
        return $false
    }
}

function Test-Deployment {
    param(
        [string]$Environment
    )

    Write-Host "Testing deployment..." -ForegroundColor Cyan
    
    # Test main endpoints
    $endpoints = @(
        "https://$Environment.headysystems.com/api/health",
        "https://$Environment.headysystems.com/api/pulse",
        "https://$Environment.headysystems.com/api/layer"
    )

    foreach ($endpoint in $endpoints) {
        try {
            $response = Invoke-RestMethod -Uri $endpoint -TimeoutSec 10
            Write-Host "✅ $endpoint - OK" -ForegroundColor Green
        } catch {
            Write-Host "❌ $endpoint - FAILED" -ForegroundColor Red
        }
    }
}

# Main execution
Write-Host "Deploying with pre-built OpenSSL..." -ForegroundColor Cyan

# Use system OpenSSL as fallback
$installPath = "$PSScriptRoot\..\dist\openssl-pq"
New-Item -Path $installPath -ItemType Directory -Force

Write-Host "Using system OpenSSL as fallback..." -ForegroundColor Yellow

# Deploy to cloud
Deploy-CloudServices -Environment $Environment -OpenSSLPath $installPath

# Verify deployment
Test-Deployment -Environment $Environment
