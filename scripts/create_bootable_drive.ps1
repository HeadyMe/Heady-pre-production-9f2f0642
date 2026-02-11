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
<# ║  FILE: scripts/create_bootable_drive.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Ventoy Installation Script
param(
    [string]$driveLetter = "D:"
)

$ventoyUrl = 'https://github.com/ventoy/Ventoy/releases/download/v1.0.96/ventoy-1.0.96-windows.zip'
$isoPath = "${driveLetter}\\ISOs"
$dropzonePath = "${driveLetter}\\Dropzone"
$localIsoPath = "c:\\Users\\erich\\Heady\\distribution\\iso"
$ventoyDir = "c:\\Users\\erich\\Heady\\ventoy"
$downloadPath = "c:\\Users\\erich\\Heady\\ventoy\\ventoy.zip"

# Create local ISO directory if not exists
if (-not (Test-Path $localIsoPath)) {
    Write-Host "Creating local ISO directory at $localIsoPath"
    New-Item -Path $localIsoPath -ItemType Directory -Force
}

# Download and install Ventoy
Invoke-WebRequest $ventoyUrl -OutFile $downloadPath
Expand-Archive $downloadPath -DestinationPath $ventoyDir -Force
if (-not (Test-Path "$ventoyDir\\Ventoy2Disk.exe")) {
    Write-Host "Error: Ventoy2Disk.exe not found at $ventoyDir"
    exit 1
}
Start-Process -FilePath "$ventoyDir\\Ventoy2Disk.exe" -ArgumentList "/I /G ${driveLetter}" -Wait

# Create folder structure on the USB drive
if (-not (Test-Path $isoPath)) {
    Write-Host "Creating ISO directory on USB drive: $isoPath"
    New-Item -Path $isoPath -ItemType Directory -Force
}
if (-not (Test-Path $dropzonePath)) {
    Write-Host "Creating Dropzone directory on USB drive: $dropzonePath"
    New-Item -Path $dropzonePath -ItemType Directory -Force
}

# Download ISOs
$isos = @{
    'Ubuntu' = 'https://releases.ubuntu.com/22.04.3/ubuntu-22.04.3-desktop-amd64.iso'
    'Parrot' = 'https://download.parrot.sh/parrot/iso/5.1/Parrot-security-5.1_amd64.iso'
}

foreach ($os in $isos.Keys) {
    $isoFile = "${localIsoPath}\\${os}.iso"
    if (-not (Test-Path $isoFile)) {
        Write-Host "Downloading $os ISO..."
        Invoke-WebRequest $isos[$os] -OutFile $isoFile
    }
}

# Copy HeadyOS ISO if exists
$headyIso = "c:\\Users\\erich\\Heady\\distribution\\HeadyOS.iso"
if (Test-Path $headyIso) {
    Write-Host "Copying HeadyOS ISO..."
    Copy-Item -Path $headyIso -Destination "${localIsoPath}\\HeadyOS.iso"
}

# Copy ISO files from local distribution directory to USB
Write-Host "Copying ISO files to USB drive..."
Copy-Item -Path "${localIsoPath}\\*" -Destination $isoPath -Recurse

Write-Host 'Bootable drive setup complete! Added Ubuntu, ParrotOS, and HeadyOS.' -ForegroundColor Green
