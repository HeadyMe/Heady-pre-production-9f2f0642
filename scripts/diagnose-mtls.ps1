<#
.SYNOPSIS
Diagnoses mTLS connectivity issues
#>

# 1. Verify processes
$nginx = Get-Process -Name "nginx" -ErrorAction SilentlyContinue
$cloudflared = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue

if (-not $nginx) { Write-Warning "Nginx not running" }
if (-not $cloudflared) { Write-Warning "Cloudflared not running" }

# 2. Check ports
$ports = @(8443, 443)
foreach ($port in $ports) {
    $result = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    Write-Host "Port $port : $($result.TcpTestSucceeded)"
}

# 3. Verify configs
if (Test-Path "$PSScriptRoot\..\configs\nginx\nginx-mtls.conf") {
    Write-Host "Nginx config exists" -ForegroundColor Green
} else {
    Write-Warning "Missing Nginx config"
}

if (Test-Path "$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml") {
    Write-Host "Cloudflared config exists" -ForegroundColor Green
} else {
    Write-Warning "Missing Cloudflared config"
}
