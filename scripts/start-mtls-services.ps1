<#
.SYNOPSIS
Starts all mTLS services on Windows
#>

# Start Nginx
Start-Process -FilePath "nginx.exe" -ArgumentList "-c conf\nginx-mtls.conf"

# Start Cloudflared
Start-Process -FilePath "cloudflared.exe" -ArgumentList "--config configs\cloudflared\ingress-rules.yaml"

# Verify services
$nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

if ($nginx -and $cloudflared) {
    Write-Host "Services started successfully" -ForegroundColor Green
} else {
    Write-Warning "Service startup failed"
}
