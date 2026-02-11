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
<# ║  FILE: scripts/distribute-designs.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Heady Design Distribution Script
# Distributes designs from phone dropzone to all repositories and websites

# Source directory - contains design assets
$sourceDir = "c:\Users\erich\CrossDevice\E's OnePlus Open\HeadyStack\dropzone"

# Target directories - expanded based on system scan
$targets = @(
    # Web targets
    "c:\Users\erich\Heady\public",
    "c:\Users\erich\Heady\frontend\src",
    "c:\Users\erich\Heady\headybuddy\src",
    "c:\Users\erich\Heady\headybrowser-desktop\src",
    
    # Distribution targets
    "c:\Users\erich\Heady\distribution",
    "c:\Users\erich\Heady\E\HeadyStack\distribution",
    
    # Extension targets
    "c:\Users\erich\Heady\extensions\chrome"
)

# Creative distribution function
function Distribute-Creatively {
    param($source, $target)
    
    # Get all design files
    $designFiles = Get-ChildItem -Path $source -File
    
    # Create a 'designs' subfolder if it doesn't exist
    $designFolder = Join-Path -Path $target -ChildPath "designs"
    if (-not (Test-Path -Path $designFolder)) {
        New-Item -ItemType Directory -Path $designFolder | Out-Null
    }
    
    # Distribute files creatively
    foreach ($file in $designFiles) {
        # Random placement within target
        $randomSubfolder = Get-Random -Minimum 1 -Maximum 5
        $targetPath = Join-Path -Path $designFolder -ChildPath "v$randomSubfolder"
        
        if (-not (Test-Path -Path $targetPath)) {
            New-Item -ItemType Directory -Path $targetPath | Out-Null
        }
        
        # Copy with randomized naming for creative effect
        $newName = "design_$(Get-Random -Minimum 1000 -Maximum 9999)$($file.Extension)"
        Copy-Item -Path $file.FullName -Destination (Join-Path -Path $targetPath -ChildPath $newName)
    }
}

# Main execution
foreach ($target in $targets) {
    Distribute-Creatively -source $sourceDir -target $target
}
