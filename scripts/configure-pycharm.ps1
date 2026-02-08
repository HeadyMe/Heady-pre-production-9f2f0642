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
<# ║  FILE: scripts/configure-pycharm.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Heady JetBrains Extension Installer
# Simplified version focused on PyCharm configuration

param(
    [switch]$WhatIf
)

Write-Host "`n💜 JetBrains PyCharm Configuration" -ForegroundColor Magenta

# Check for PyCharm installation
$pycharmPaths = @(
    "C:\Users\JetBrains",
    "$env:ProgramFiles\JetBrains\PyCharm",
    "${env:ProgramFiles(x86)}\JetBrains\PyCharm",
    "$env:LOCALAPPDATA\JetBrains\PyCharm"
)

$foundPyCharm = $false
$pycharmPath = $null

foreach ($path in $pycharmPaths) {
    if (Test-Path $path) {
        if (Test-Path "$path\bin\pycharm64.exe") {
            $foundPyCharm = $true
            $pycharmPath = $path
            break
        }
    }
}

if (!$foundPyCharm) {
    Write-Host "⚠️  PyCharm not found. Please install PyCharm first." -ForegroundColor Yellow
    return
}

Write-Host "  📦 Found PyCharm at: $pycharmPath" -ForegroundColor Green

# Get PyCharm version info
$productInfo = "$pycharmPath\product-info.json"
if (Test-Path $productInfo) {
    try {
        $info = Get-Content $productInfo | ConvertFrom-Json
        Write-Host "  📋 Version: $($info.version) (Build: $($info.buildNumber))" -ForegroundColor Cyan
    } catch {
        Write-Host "  ⚠️  Could not read version info" -ForegroundColor Yellow
    }
}

# Essential plugins for PyCharm
$plugins = @(
    @{ Name = ".ignore"; Required = $true; Description = "Gitignore support" },
    @{ Name = "Rainbow Brackets"; Required = $false; Description = "Colorized brackets" },
    @{ Name = "GitToolBox"; Required = $false; Description = "Git enhancements" },
    @{ Name = "Key Promoter X"; Required = $false; Description = "Keyboard shortcuts" },
    @{ Name = "Python Enhanced"; Required = $false; Description = "Python improvements" }
)

Write-Host "`n  🔌 Recommended Plugins:" -ForegroundColor Blue
foreach ($plugin in $plugins) {
    $status = if ($plugin.Required) { "REQUIRED" } else { "optional" }
    $color = if ($plugin.Required) { "Green" } else { "Gray" }
    Write-Host "    ├─ [$status] $($plugin.Name)" -ForegroundColor $color
    Write-Host "    │   └─ $($plugin.Description)" -ForegroundColor DarkGray
}

Write-Host "`n  🛠️  Configuration Steps:" -ForegroundColor Yellow
Write-Host "    1. Open PyCharm" -ForegroundColor White
Write-Host "    2. Go to File → Settings → Plugins" -ForegroundColor White
Write-Host "    3. Install the plugins listed above" -ForegroundColor White
Write-Host "    4. Configure Python interpreter" -ForegroundColor White
Write-Host "    5. Enable Settings Sync for cross-device sync" -ForegroundColor White

Write-Host "`n  🐍 Python Setup:" -ForegroundColor Green
Write-Host "    • Ensure Python 3.8+ is installed" -ForegroundColor White
Write-Host "    • Configure virtual environments" -ForegroundColor White
Write-Host "    • Set up code formatting (Black, isort)" -ForegroundColor White

Write-Host "`n  🔗 Heady Integration:" -ForegroundColor Cyan
Write-Host "    • Install Heady Assistant plugin (when available)" -ForegroundColor White
Write-Host "    • Configure Heady project templates" -ForegroundColor White
Write-Host "    • Enable Heady code completion" -ForegroundColor White

if (!$WhatIf) {
    Write-Host "`n  ✅ PyCharm configuration guide complete!" -ForegroundColor Green
    Write-Host "  🚀 Next: Open PyCharm and follow the steps above" -ForegroundColor Yellow
} else {
    Write-Host "`n  📝 Configuration guide displayed (no changes made)" -ForegroundColor Cyan
}

Write-Host "`n  💡 Tip: Use PyCharm's Settings Sync to maintain configuration across devices" -ForegroundColor Cyan
