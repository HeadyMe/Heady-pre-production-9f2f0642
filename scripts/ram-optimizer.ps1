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
<# ║  FILE: scripts/ram-optimizer.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY SYSTEMS RAM OPTIMIZER
# Version 1.0 - Auto-enforced resource limits
# OS: Windows

# Configuration
$MAX_RAM_GB = 16  # Set your threshold (e.g., 16GB)
$MAX_WORKTREES = 3
$MAX_PROJECTS = 4

function Optimize-RAM {
    # Real-time RAM monitoring
    $ramUsage = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue / 1024
    $overThreshold = $ramUsage -lt $MAX_RAM_GB

    if (-not $overThreshold) { return "✅ RAM within limits ($($ramUsage.ToString('0.0'))GB/$MAX_RAM_GB`GB)" }

    # Enforcement procedures
    Write-Host "⚠️ RAM CRITICAL ($($ramUsage.ToString('0.0'))GB/$MAX_RAM_GB`GB) - Initiating optimization" -ForegroundColor Red
    
    # 1. Worktree reduction
    $worktrees = git worktree list | Measure-Object
    if ($worktrees.Count -gt $MAX_WORKTREES) {
        Write-Host "Closing worktrees (current: $($worktrees.Count), max allowed: $MAX_WORKTREES)"
        git worktree list | Select-Object -Skip $MAX_WORKTREES | ForEach-Object {
            $path = ($_ -split ' ')[0]
            git worktree remove $path --force
        }
    }

    # 2. Project cleanup
    $projects = Get-Process | Where-Object { $_.ProcessName -match 'Windsurf|Code' } 
    if ($projects.Count -gt $MAX_PROJECTS) {
        Write-Host "Closing projects (current: $($projects.Count), max allowed: $MAX_PROJECTS)"
        $projects | Select-Object -First ($projects.Count - $MAX_PROJECTS) | Stop-Process -Force
    }

    # 3. Process management
    $highRamProcesses = Get-Process | 
        Where-Object { $_.WS -gt 500MB } | 
        Sort-Object WS -Descending |
        Select-Object -First 5
        
    $highRamProcesses | ForEach-Object {
        Write-Host "Stopping high-RAM process: $($_.Name) ($($_.WS / 1MB)MB)"
        Stop-Process $_.Id -Force
    }

    # 4. Service restart
    Restart-Service -Name "WindsurfResourceMonitor" -Force
    git gc --prune=now --aggressive

    # Post-optimization report
    $newRam = (Get-Counter '\Memory\Available MBytes').CounterSamples.CookedValue / 1024
    return "✅ Optimization complete - Freed $(($ramUsage - $newRam).ToString('0.0'))GB RAM"
}

# Run optimization
Optimize-RAM
