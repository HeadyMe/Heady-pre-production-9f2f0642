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
<# ║  FILE: scripts/ops/node-health-check.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# HEADY_BRAND:BEGIN
# ╔══════════════════════════════════════════════════════════════════╗
# ║  █╗  █╗███████╗ █████╗ ██████╗ █╗   █╗                     ║
# ║  █║  █║█╔════╝█╔══█╗█╔══█╗╚█╗ █╔╝                     ║
# ║  ███████║█████╗  ███████║█║  █║ ╚████╔╝                      ║
# ║  █╔══█║█╔══╝  █╔══█║█║  █║  ╚█╔╝                       ║
# ║  █║  █║███████╗█║  █║██████╔╝   █║                        ║
# ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
# ║                                                                  ║
# ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
# ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
# ║  FILE: scripts/ops/node-health-check.ps1                          ║
# ║  LAYER: root                                                      ║
# ╚══════════════════════════════════════════════════════════════════╝
# HEADY_BRAND:END

#
# NHC-Style Node Health Check Script
# Checks: process alive, HTTP endpoints, disk, memory, git status
# Exit 0 = healthy, Exit 1 = degraded/failed

param(
    [switch]$Verbose,
    [string]$Endpoint = "http://api.headysystems.com:3300"
)

$ErrorActionPreference = "Continue"
$OK = 0
$TS = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"

function Log($msg) {
    Write-Host "[$TS] $msg"
}

function Check-HttpEndpoint($name, $url) {
    try {
        $start = Get-Date
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        $latency = ((Get-Date) - $start).TotalMilliseconds
        if ($response.StatusCode -eq 200) {
            Log "[OK] $name - ${latency}ms"
            return $true
        } else {
            Log "[WARN] $name - Status $($response.StatusCode)"
            return $false
        }
    } catch {
        Log "[FAIL] $name - $($_.Exception.Message)"
        return $false
    }
}

function Check-Process($name, $processName) {
    $proc = Get-Process -Name $processName -ErrorAction SilentlyContinue
    if ($proc) {
        Log "[OK] $name - PID $($proc[0].Id), Memory $([math]::Round($proc[0].WorkingSet64/1MB, 1))MB"
        return $true
    } else {
        Log "[FAIL] $name - not running"
        return $false
    }
}

function Check-Disk {
    $drive = Get-PSDrive C -ErrorAction SilentlyContinue
    if ($drive) {
        $usedPercent = [math]::Round(($drive.Used / ($drive.Used + $drive.Free)) * 100, 1)
        if ($usedPercent -gt 95) {
            Log "[FAIL] Disk - ${usedPercent}% used (critical)"
            return $false
        } elseif ($usedPercent -gt 85) {
            Log "[WARN] Disk - ${usedPercent}% used"
            return $true
        } else {
            Log "[OK] Disk - ${usedPercent}% used, $([math]::Round($drive.Free/1GB, 1))GB free"
            return $true
        }
    }
    Log "[WARN] Disk - unable to check"
    return $true
}

function Check-Memory {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($os) {
        $totalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 0)
        $freeMB = [math]::Round($os.FreePhysicalMemory / 1024, 0)
        $usedPercent = [math]::Round((($totalMB - $freeMB) / $totalMB) * 100, 1)
        if ($usedPercent -gt 95) {
            Log "[FAIL] Memory - ${usedPercent}% used (${freeMB}MB free)"
            return $false
        } else {
            Log "[OK] Memory - ${usedPercent}% used (${freeMB}MB free of ${totalMB}MB)"
            return $true
        }
    }
    Log "[WARN] Memory - unable to check"
    return $true
}

function Check-GitStatus {
    try {
        $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $status = git -C $repoRoot status --porcelain 2>&1
        $dirtyCount = ($status | Where-Object { $_ -match '\S' }).Count
        if ($dirtyCount -eq 0) {
            Log "[OK] Git - working tree clean"
        } else {
            Log "[INFO] Git - $dirtyCount uncommitted changes"
        }
        return $true
    } catch {
        Log "[WARN] Git - unable to check"
        return $true
    }
}

# ─── Run All Checks ───────────────────────────────────────────────────
Log "=== Heady Node Health Check ==="

$checks = @()

# HTTP endpoints
$checks += Check-HttpEndpoint "heady-manager /api/health" "$Endpoint/api/health"
$checks += Check-HttpEndpoint "heady-manager /api/pulse" "$Endpoint/api/pulse"
$checks += Check-HttpEndpoint "subsystems overview" "$Endpoint/api/subsystems"

# Processes
$checks += Check-Process "Node.js" "node"

# System resources
$checks += Check-Disk
$checks += Check-Memory

# Git
$checks += Check-GitStatus

# ─── Summary ──────────────────────────────────────────────────────────
$passed = ($checks | Where-Object { $_ -eq $true }).Count
$failed = ($checks | Where-Object { $_ -eq $false }).Count
$total = $checks.Count

Log "=== Summary: $passed/$total passed, $failed failed ==="

if ($failed -gt 0) {
    Log "Node status: DEGRADED"
    exit 1
} else {
    Log "Node status: HEALTHY"
    exit 0
}
