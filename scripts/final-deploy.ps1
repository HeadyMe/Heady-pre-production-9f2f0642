<#
.SYNOPSIS
Complete deployment with validation
#>

# 1. Start services
.\scripts\manage-services.ps1

# 2. Verify
$nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

if (-not $nginx -or -not $cloudflared) {
    Write-Error "Service startup failed"
    exit 1
}

# 3. Test connectivity
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8443/health" \
        -Certificate (Get-PfxCertificate -FilePath "configs\nginx\ssl\client.pfx") \
        -ErrorAction Stop
    
    if ($response.StatusCode -eq 200) {
        Write-Host "Deployment successful! Service is responding" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Error "Connectivity test failed: $_"
    exit 1
}
