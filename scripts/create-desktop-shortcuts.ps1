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
<# ║  FILE: scripts/create-desktop-shortcuts.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Create necessary directories
$eKitPath = "C:\Users\erich\CrossDevice\E's OnePlus Open\HeadyStack\E-kit"
$giftPath = "C:\Users\erich\CrossDevice\E's OnePlus Open\HeadyStack\gift"
$distributionPath = "C:\Users\erich\CrossDevice\E's OnePlus Open\HeadyStack\distribution"

# Create directories if they don't exist
New-Item -ItemType Directory -Force -Path $eKitPath
New-Item -ItemType Directory -Force -Path $giftPath
New-Item -ItemType Directory -Force -Path $distributionPath

# Copy personal profile to E-kit
Copy-Item -Path "configs\user-profiles\eric.yaml" -Destination "$eKitPath\" -Force

# Create shortcuts
$WshShell = New-Object -comObject WScript.Shell

# Distribution shortcut
$shortcut = $WshShell.CreateShortcut("$Env:USERPROFILE\Desktop\Heady Distribution Pack.lnk")
$shortcut.TargetPath = $distributionPath
$shortcut.Save()

# Gift Kits shortcut
$shortcut = $WshShell.CreateShortcut("$Env:USERPROFILE\Desktop\Heady Gift Kits.lnk")
$shortcut.TargetPath = $giftPath
$shortcut.Save()

# E-kit shortcut
$shortcut = $WshShell.CreateShortcut("$Env:USERPROFILE\Desktop\Heady E Kit (Personal).lnk")
$shortcut.TargetPath = $eKitPath
$shortcut.Save()

Write-Output "Shortcuts created successfully"
