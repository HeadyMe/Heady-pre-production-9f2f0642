<#
.SYNOPSIS
Starts mTLS services with proper configuration
#>

# Verify paths
$nginxPath = "$PSScriptRoot\..\nginx\nginx.exe"
$cloudflaredPath = "$PSScriptRoot\..\cloudflared.exe"

if (-not (Test-Path $nginxPath)) { throw "Nginx not found at $nginxPath" }
if (-not (Test-Path $cloudflaredPath)) { throw "Cloudflared not found at $cloudflaredPath" }

# Start Nginx
Start-Process -FilePath $nginxPath -ArgumentList "-p `"$PSScriptRoot\..\nginx`" -c `"$PSScriptRoot\..\nginx\conf\nginx-mtls.conf`"" -NoNewWindow

# Start Cloudflared
Start-Process -FilePath $cloudflaredPath -ArgumentList "--config `"$PSScriptRoot\..\configs\cloudflared\ingress-rules.yaml`"" -NoNewWindow

Write-Host "Services started successfully" -ForegroundColor Green
