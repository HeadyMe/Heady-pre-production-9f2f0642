<#
.SYNOPSIS
Installs OpenSSL for Windows
#>

# Download OpenSSL
$opensslUrl = "https://slproweb.com/download/Win64OpenSSL-3_1_4.exe"
$installerPath = "$env:TEMP\openssl-installer.exe"

if (-not (Test-Path "C:\Program Files\OpenSSL-Win64\bin\openssl.exe")) {
    Invoke-WebRequest -Uri $opensslUrl -OutFile $installerPath
    Start-Process -FilePath $installerPath -ArgumentList "/silent" -Wait
}

# Add to PATH
$env:Path += ";C:\Program Files\OpenSSL-Win64\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [EnvironmentVariableTarget]::Machine)

Write-Host "OpenSSL installed" -ForegroundColor Green
