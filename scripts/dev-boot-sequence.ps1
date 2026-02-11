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
<# ║  FILE: scripts/dev-boot-sequence.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Developer Boot Sequence for Heady-Dev-VM

# Start Cloudflared tunnel
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --hostname *.vm.heady.internal" -NoNewWindow

# Read Soul-Token
$soulToken = Get-Content -Path "C:\Heady\soul-token.txt" -ErrorAction Stop

# Validate token with heartbeat endpoint
$heartbeatResponse = Invoke-RestMethod -Uri "https://heartbeat.heady.systems/validate" -Method POST -Body (@{ token = $soulToken } | ConvertTo-Json) -ContentType "application/json"

if (-not $heartbeatResponse.status -eq "active") {
    Write-Host "FATAL: Invalid or revoked Soul-Token"
    Exit 1
}

# Get GitHub token from Heady Manager
$tokenResponse = Invoke-RestMethod -Uri "https://manager.heady.systems/api/vm/token" -Method POST -Body (@{ soulToken = $soulToken } | ConvertTo-Json) -ContentType "application/json"

# Configure git with temporary token
git config --global url."https://x-access-token:$($tokenResponse.token)@github.com/".insteadOf "https://github.com/"

# Open knowledge base
Start-Process "https://docs.heady.internal"
