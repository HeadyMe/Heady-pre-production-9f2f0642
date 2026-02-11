<#
.SYNOPSIS
Complete mTLS deployment with validation
#>

# Verify paths
$nginxPath = "$PSScriptRoot\..\nginx\nginx.exe"
$cloudflaredPath = "$PSScriptRoot\..\cloudflared.exe"

if (-not (Test-Path $nginxPath)) { throw "Nginx not found at $nginxPath" }
if (-not (Test-Path $cloudflaredPath)) { throw "Cloudflared not found at $cloudflaredPath" }

# Start services
$nginx = Start-Process -FilePath $nginxPath -ArgumentList "-p `"$PSScriptRoot\..\nginx`" -c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`"" -PassThru
$cloudflared = Start-Process -FilePath $cloudflaredPath -ArgumentList "--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`"" -PassThru

if (-not $nginx -or -not $cloudflared) { throw "Failed to start services" }

# Verify
Start-Sleep -Seconds 5

$testResult = Test-NetConnection -ComputerName 127.0.0.1 -Port 8443 -WarningAction SilentlyContinue

if ($testResult.TcpTestSucceeded) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    exit 0
} else {
    throw "Connectivity test failed"
}
