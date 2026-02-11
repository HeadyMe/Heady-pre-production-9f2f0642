<#
.SYNOPSIS
Installs Cloudflared for Windows
#>

$cloudflaredUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
$installPath = "$PSScriptRoot\..\cloudflared.exe"

if (-not (Test-Path $installPath)) {
    Invoke-WebRequest -Uri $cloudflaredUrl -OutFile $installPath
}

Write-Host "Cloudflared installed to $installPath"
