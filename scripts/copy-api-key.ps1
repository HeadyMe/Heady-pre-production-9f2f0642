<# HEADY_BRAND:BEGIN
<# ╔══════════════════════════════════════════════════════════════════╗
<# ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<# ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<# ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<# ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<# ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<# ║                                                                  ║
<# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<# ║  FILE: scripts/copy-api-key.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Securely copies API keys between secure storage locations

.DESCRIPTION
Manages API keys using Windows Credential Manager for secure storage
Avoids hardcoding secrets in scripts/config files
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$KeyName,
    
    [Parameter(Mandatory=$true)]
    [ValidateSet('HeadyVault','EnvVar','Clipboard')]
    [string]$Destination
)

# Retrieve key from secure storage
$apiKey = Get-HeadyApiKey -Name $KeyName

if (-not $apiKey) {
    Write-Error "API key '$KeyName' not found in HeadyVault"
    exit 1
}

# Handle different destination types
switch ($Destination) {
    'HeadyVault' {
        # Already retrieved from vault
        Write-Host "API key '$KeyName' retrieved from HeadyVault" -ForegroundColor Green
    }
    'EnvVar' {
        $env:HEADY_API_KEY = $apiKey
        Write-Host "API key '$KeyName' set in environment variable" -ForegroundColor Green
    }
    'Clipboard' {
        Set-Clipboard -Value $apiKey
        Write-Host "API key '$KeyName' copied to clipboard" -ForegroundColor Green
    }
}
