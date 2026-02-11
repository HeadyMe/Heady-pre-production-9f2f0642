<#
.SYNOPSIS
Installs Nginx for Windows
#>

$nginxUrl = "https://nginx.org/download/nginx-1.25.3.zip"
$installDir = "$PSScriptRoot\..\nginx"

# Download and extract
if (-not (Test-Path "$installDir\nginx.exe")) {
    Invoke-WebRequest -Uri $nginxUrl -OutFile "$env:TEMP\nginx.zip"
    Expand-Archive -Path "$env:TEMP\nginx.zip" -DestinationPath $installDir
    Move-Item "$installDir\nginx-1.25.3\*" "$installDir"
}

Write-Host "Nginx installed to $installDir"
