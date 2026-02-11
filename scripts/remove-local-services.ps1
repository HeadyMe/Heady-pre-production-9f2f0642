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
<# ║  FILE: scripts/remove-local-services.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Removes local Heady service containers and volumes

.DESCRIPTION
Uninstalls local services as requested, verifies removal, and tests cloud connectivity
#>

# Remove containers
Write-Host "Removing local service containers..." -ForegroundColor Yellow
docker-compose down --rmi all --volumes --remove-orphans

# Verify removal
$containers = docker ps -a --format '{{.Names}}' | Select-String "heady"
if ($containers) {
    Write-Error "Local containers still exist: $($containers -join ', ')"
    exit 1
}

# Test cloud connectivity
Write-Host "Testing cloud connectivity..." -ForegroundColor Yellow
$cloudEndpoint = "https://cloud.headysystems.com/health"
try {
    $response = Invoke-RestMethod -Uri $cloudEndpoint -Method Get
    if ($response.status -eq "ok") {
        Write-Host "Cloud connection successful!" -ForegroundColor Green
        exit 0
    }
}
catch {
    Write-Error "Failed to connect to cloud: $_"
    exit 1
}

Write-Error "Unexpected cloud response"
exit 1
