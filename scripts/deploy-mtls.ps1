<#
.SYNOPSIS
Complete mTLS deployment with validation
#>

# 1. Start services with correct paths
$nginxPath = "$PSScriptRoot\..\nginx\nginx.exe"
$cloudflaredPath = "$PSScriptRoot\..\cloudflared.exe"

if (-not (Test-Path $nginxPath)) { throw "Nginx not found at $nginxPath" }
if (-not (Test-Path $cloudflaredPath)) { throw "Cloudflared not found at $cloudflaredPath" }

$nginx = Start-Process -FilePath $nginxPath -ArgumentList "-c `"$PSScriptRoot\..\configs\nginx\nginx-mtls.conf`"" -PassThru -NoNewWindow
$cloudflared = Start-Process -FilePath $cloudflaredPath -ArgumentList "--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`"" -PassThru -NoNewWindow

if (-not $nginx -or -not $cloudflared) { throw "Failed to start services" }

# 2. Verify
Start-Sleep -Seconds 5  # Allow services to initialize

$nginxRunning = Get-Process -Id $nginx.Id -ErrorAction SilentlyContinue
$cloudflaredRunning = Get-Process -Id $cloudflared.Id -ErrorAction SilentlyContinue

if (-not $nginxRunning -or -not $cloudflaredRunning) {
    Write-Error "Services failed to stay running"
    exit 1
}

# 3. Test
$testResult = Test-NetConnection -ComputerName 127.0.0.1 -Port 8443 -WarningAction SilentlyContinue

if ($testResult.TcpTestSucceeded) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    exit 0
} else {
    Write-Error "Connectivity test failed"
    exit 1
}
