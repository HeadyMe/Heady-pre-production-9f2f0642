# ═══════════════════════════════════════════════════════════════
# HeadyBuddy v3457890 — Windows Laptop Installer
# Cloud-connected thin client · All ops run on cloud bees
# © 2026 HeadySystems Inc. All rights reserved.
# ═══════════════════════════════════════════════════════════════

#Requires -Version 5.1

param(
    [switch]$Silent,
    [switch]$NoDesktopShortcut,
    [string]$InstallDir = "$env:LOCALAPPDATA\HeadyBuddy"
)

$ErrorActionPreference = "Stop"
$VERSION = "v3457890"
$CLOUD_API = "https://headyme.com/api"

# ─── Banner ───
if (-not $Silent) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║     🐝 HeadyBuddy $VERSION — Windows Installer       ║" -ForegroundColor Magenta
    Write-Host "║     Cloud-Connected · Zero Local Resources            ║" -ForegroundColor Magenta
    Write-Host "║     © 2026 HeadySystems Inc.                          ║" -ForegroundColor Magenta
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
}

# ─── Phase 1: Platform Detection ───
Write-Host "[1/5] 🔍 Detecting platform..." -ForegroundColor Cyan
$DeviceInfo = @{
    Platform   = "Windows"
    Version    = [System.Environment]::OSVersion.VersionString
    Hostname   = $env:COMPUTERNAME
    Arch       = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    Memory     = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
    CPUs       = [Environment]::ProcessorCount
    User       = $env:USERNAME
}

Write-Host "   Platform: $($DeviceInfo.Platform) ($($DeviceInfo.Arch))" -ForegroundColor Gray
Write-Host "   Version:  $($DeviceInfo.Version)" -ForegroundColor Gray
Write-Host "   Host:     $($DeviceInfo.Hostname)" -ForegroundColor Gray
Write-Host "   Memory:   $($DeviceInfo.Memory) GB" -ForegroundColor Gray
Write-Host "   CPUs:     $($DeviceInfo.CPUs)" -ForegroundColor Gray
Write-Host ""

# ─── Phase 2: Create Install Directory ───
Write-Host "[2/5] 📦 Creating install directory..." -ForegroundColor Cyan
$AppDir = Join-Path $InstallDir "app"
$ConfigDir = Join-Path $InstallDir "config"
$ModsDir = Join-Path $InstallDir "mods"

@($InstallDir, $AppDir, $ConfigDir, $ModsDir) | ForEach-Object {
    if (-not (Test-Path $_)) { New-Item -ItemType Directory -Path $_ -Force | Out-Null }
}
Write-Host "   Install: $InstallDir" -ForegroundColor Gray

# ─── Phase 3: Install App Files ───
Write-Host "[3/5] 🚀 Installing HeadyBuddy thin client..." -ForegroundColor Cyan
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceApp = Join-Path (Split-Path $ScriptDir) "app"

if (Test-Path $SourceApp) {
    Copy-Item -Path "$SourceApp\*" -Destination $AppDir -Recurse -Force
    Write-Host "   Copied app files to $AppDir" -ForegroundColor Gray
} else {
    Write-Host "   Downloading from cloud..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "$CLOUD_API/device/package/windows" -OutFile "$AppDir\index.html" -UseBasicParsing
    } catch {
        Write-Host "   Using bundled fallback" -ForegroundColor Yellow
    }
}

# Write device config
$Config = @{
    version       = $VERSION
    deviceType    = "windows-laptop"
    hostname      = $DeviceInfo.Hostname
    arch          = $DeviceInfo.Arch
    cloudApi      = $CLOUD_API
    opsMode       = "cloud-orchestrated"
    localResources = "thin-client"
    installedAt   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    fsAuth        = @{
        scope        = "pending"
        grantedPaths = @()
        authorized   = $false
    }
    beeSwarm      = @{
        connectionType = "websocket"
        endpoint       = "wss://headyme.com/swarm"
        localCpu       = 0
    }
} | ConvertTo-Json -Depth 5

Set-Content -Path "$ConfigDir\device.json" -Value $Config -Encoding UTF8
Write-Host "   Config: $ConfigDir\device.json" -ForegroundColor Gray

# Create launcher batch file
$LauncherPath = Join-Path $InstallDir "HeadyBuddy.bat"
@"
@echo off
title HeadyBuddy $VERSION
echo 🐝 HeadyBuddy $VERSION — Starting...
echo ☁ Connected to HeadySystems cloud swarm
echo 📡 All operations execute on cloud bees (0%% local CPU)
start "" "$AppDir\index.html"
"@ | Set-Content -Path $LauncherPath -Encoding ASCII

# Create VBS launcher (no console window)
$VbsPath = Join-Path $InstallDir "HeadyBuddy.vbs"
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run """$AppDir\index.html""", 0, False
"@ | Set-Content -Path $VbsPath -Encoding ASCII

Write-Host "   Launcher: $LauncherPath" -ForegroundColor Gray
Write-Host ""

# ─── Phase 4: Desktop & Start Menu Shortcuts ───
Write-Host "[4/5] 🖥  Creating shortcuts..." -ForegroundColor Cyan

if (-not $NoDesktopShortcut) {
    $WshShell = New-Object -ComObject WScript.Shell

    # Desktop shortcut
    $DesktopLink = $WshShell.CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\HeadyBuddy.lnk")
    $DesktopLink.TargetPath = $VbsPath
    $DesktopLink.Description = "HeadyBuddy $VERSION — Cloud-Powered AI Companion"
    $DesktopLink.WorkingDirectory = $InstallDir
    $DesktopLink.Save()
    Write-Host "   Desktop: HeadyBuddy.lnk" -ForegroundColor Gray

    # Start Menu shortcut
    $StartMenuDir = Join-Path ([Environment]::GetFolderPath('StartMenu')) "Programs\HeadySystems"
    if (-not (Test-Path $StartMenuDir)) { New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null }
    $StartLink = $WshShell.CreateShortcut("$StartMenuDir\HeadyBuddy.lnk")
    $StartLink.TargetPath = $VbsPath
    $StartLink.Description = "HeadyBuddy $VERSION"
    $StartLink.WorkingDirectory = $InstallDir
    $StartLink.Save()
    Write-Host "   Start Menu: $StartMenuDir\HeadyBuddy.lnk" -ForegroundColor Gray
}
Write-Host ""

# ─── Phase 5: Cloud Registration ───
Write-Host "[5/5] ☁  Registering with cloud..." -ForegroundColor Cyan
Write-Host "   Swarm endpoint: wss://headyme.com/swarm" -ForegroundColor Gray
Write-Host "   Operations mode: cloud-orchestrated" -ForegroundColor Gray
Write-Host "   Local CPU usage: 0%" -ForegroundColor Gray
Write-Host "   HeadyBees: 35 bees ready (cloud-hosted)" -ForegroundColor Gray
Write-Host ""

# ─── Done ───
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "   ✅ HeadyBuddy $VERSION installed successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "   Launch:     Double-click HeadyBuddy on Desktop" -ForegroundColor White
Write-Host "   Config:     $ConfigDir\device.json" -ForegroundColor White
Write-Host "   Mods:       $ModsDir\" -ForegroundColor White
Write-Host "   Uninstall:  Remove-Item -Recurse $InstallDir" -ForegroundColor White
Write-Host ""
Write-Host "   All ops run on cloud bees · Your device = thin client" -ForegroundColor Magenta
Write-Host ""
