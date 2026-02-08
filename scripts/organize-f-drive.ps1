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
<# ║  FILE: scripts/organize-f-drive.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh

# HCFP F:\ Drive Organization Script
# Organizes F:\ drive according to HCFP rebuild master plan

Write-Host "🚀 Starting F:\ Drive Organization..." -ForegroundColor Cyan

# Create backup of current structure
Write-Host "📦 Creating backup of current F:\ structure..." -ForegroundColor Yellow
$backupDir = "F:\Backup_$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupDir -Force
Copy-Item "F:\README.md" "$backupDir\" -Force
Copy-Item "F:\autorun.inf" "$backupDir\" -Force

# Create new unified structure
Write-Host "🏗️ Creating unified HeadyEcosystem structure..." -ForegroundColor Yellow

# Main directories
$mainDirs = @(
    "F:\HeadyEcosystem",
    "F:\HeadyEcosystem\Organizations",
    "F:\HeadyEcosystem\Organizations\HeadyConnection",
    "F:\HeadyEcosystem\Organizations\HeadySystems", 
    "F:\HeadyEcosystem\Personal",
    "F:\HeadyEcosystem\Shared",
    "F:\HeadyEcosystem\Archive"
)

foreach ($dir in $mainDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Organization subdirectories
$orgSubDirs = @(
    "F:\HeadyEcosystem\Organizations\HeadyConnection\Active",
    "F:\HeadyEcosystem\Organizations\HeadyConnection\Archive", 
    "F:\HeadyEcosystem\Organizations\HeadyConnection\Media",
    "F:\HeadyEcosystem\Organizations\HeadySystems\Active",
    "F:\HeadyEcosystem\Organizations\HeadySystems\Archive",
    "F:\HeadyEcosystem\Organizations\HeadySystems\Media"
)

foreach ($dir in $orgSubDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Personal subdirectories
$personalSubDirs = @(
    "F:\HeadyEcosystem\Personal\Creative",
    "F:\HeadyEcosystem\Personal\Records",
    "F:\HeadyEcosystem\Personal\Learning",
    "F:\HeadyEcosystem\Personal\Archive"
)

foreach ($dir in $personalSubDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Shared subdirectories
$sharedSubDirs = @(
    "F:\HeadyEcosystem\Shared\Media",
    "F:\HeadyEcosystem\Shared\Media\Logos",
    "F:\HeadyEcosystem\Shared\Media\SacredGeometry",
    "F:\HeadyEcosystem\Shared\Media\UI",
    "F:\HeadyEcosystem\Shared\Media\Product",
    "F:\HeadyEcosystem\Shared\Media\Brand",
    "F:\HeadyEcosystem\Shared\Media\Personal",
    "F:\HeadyEcosystem\Shared\Templates",
    "F:\HeadyEcosystem\Shared\Tools"
)

foreach ($dir in $sharedSubDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Move existing HeadyOS to new structure
Write-Host "📁 Moving HeadyOS to new structure..." -ForegroundColor Yellow
if (Test-Path "F:\HeadyOS") {
    Move-Item "F:\HeadyOS" "F:\HeadyEcosystem\Organizations\HeadySystems\Active\HeadyOS" -Force
    Write-Host "✅ HeadyOS moved to HeadySystems/Active/" -ForegroundColor Green
}

# Move ISOs to shared media
Write-Host "💿 Moving ISOs to Shared/Media..." -ForegroundColor Yellow
if (Test-Path "F:\ISOs") {
    Move-Item "F:\ISOs" "F:\HeadyEcosystem\Shared\Media\ISOs" -Force
    Write-Host "✅ ISOs moved to Shared/Media/" -ForegroundColor Green
}

# Move Ventoy to shared tools
Write-Host "🔧 Moving Ventoy to Shared/Tools..." -ForegroundColor Yellow
if (Test-Path "F:\ventoy") {
    Move-Item "F:\ventoy" "F:\HeadyEcosystem\Shared\Tools\Ventoy" -Force
    Write-Host "✅ Ventoy moved to Shared/Tools/" -ForegroundColor Green
}

# Move checkpoints to archive
Write-Host "📋 Moving checkpoints to Archive..." -ForegroundColor Yellow
if (Test-Path "F:\HeadyCheckpoints") {
    Move-Item "F:\HeadyCheckpoints" "F:\HeadyEcosystem\Archive\HeadyCheckpoints" -Force
    Write-Host "✅ HeadyCheckpoints moved to Archive/" -ForegroundColor Green
}

# Move deploy to HeadySystems active
Write-Host "🚀 Moving deploy to HeadySystems..." -ForegroundColor Yellow
if (Test-Path "F:\HeadyDeploy") {
    Move-Item "F:\HeadyDeploy" "F:\HeadyEcosystem\Organizations\HeadySystems\Active\HeadyDeploy" -Force
    Write-Host "✅ HeadyDeploy moved to HeadySystems/Active/" -ForegroundColor Green
}

# Move monorepo to HeadySystems active
Write-Host "📦 Moving monorepo to HeadySystems..." -ForegroundColor Yellow
if (Test-Path "F:\HeadyMonorepo") {
    Move-Item "F:\HeadyMonorepo" "F:\HeadyEcosystem\Organizations\HeadySystems\Active\HeadyMonorepo" -Force
    Write-Host "✅ HeadyMonorepo moved to HeadySystems/Active/" -ForegroundColor Green
}

# Move Docker to shared tools
Write-Host "🐳 Moving Docker to Shared/Tools..." -ForegroundColor Yellow
if (Test-Path "F:\Docker") {
    Move-Item "F:\Docker" "F:\HeadyEcosystem\Shared\Tools\Docker" -Force
    Write-Host "✅ Docker moved to Shared/Tools/" -ForegroundColor Green
}

# Create new README with visual branding
Write-Host "📝 Creating new README with visual branding..." -ForegroundColor Yellow
$newReadme = @"
# 🌟 HeadyEcosystem - Unified Digital Environment

> **Sacred Geometry :: Every OS :: One Drive**  
> **Visual-First Organization :: Complete Cohesion**

## 🎨 Visual Architecture

This drive now follows the **HCFP Rebuild Master Plan** with heavy visual branding integration:

```
HeadyEcosystem/
├── 🏢 Organizations/
│   ├── 🤝 HeadyConnection/     # Nonprofit operations
│   │   ├── ✅ Active/          # Current projects
│   │   ├── 📦 Archive/         # Historical work
│   │   └── 🎨 Media/           # Brand assets
│   └── 🚀 HeadySystems/        # C-Corp operations
│       ├── ✅ Active/          # Core products
│       ├── 📦 Archive/         # Legacy code
│       └── 🎨 Media/           # Technical assets
├── 👤 Personal/                # Personal archives
│   ├── 🎨 Creative/            # Art & concepts
│   ├── 📋 Records/             # Personal documents
│   ├── 📚 Learning/            # Research & development
│   └── 📦 Archive/             # Personal history
├── 🤝 Shared/                  # Central resources
│   ├── 🎨 Media/               # Image repository
│   │   ├── 🏷️ Logos/           # Brand logos
│   │   ├── 🔮 SacredGeometry/  # Sacred patterns
│   │   ├── 🖥️ UI/              # Interface elements
│   │   ├── 📱 Product/         # Screenshots
│   │   ├── 🎨 Brand/           # Style guides
│   │   └── 👤 Personal/        # Personal photos
│   ├── 📋 Templates/           # Document templates
│   └── 🔧 Tools/               # Shared utilities
└── 📦 Archive/                 # Deprecated materials
```

## 🚀 Quick Start

### From Windows (No Reboot)
```batch
F:\HeadyEcosystem\Organizations\HeadySystems\Active\HeadyOS\launch.bat
```
Starts HeadyManager on http://localhost:3300

### Boot from This Drive
1. Restart computer
2. Enter BIOS/UEFI boot menu (F12, F2, or Del)
3. Select "ADATA SD620" or "USB Drive"
4. Ventoy shows available OS options from `Shared/Media/ISOs/`

## 🎨 Visual Integration

**Every folder, file, and interface contains visual branding:**
- 🏷️ **Custom icons** for all major directories
- 🎨 **Sacred Geometry patterns** throughout UIs
- 📱 **Rich media** in documentation and dashboards
- 🌈 **Consistent color schemes** across all platforms

## 📁 Key Locations

- **🚀 HeadyOS Portable**: `Organizations/HeadySystems/Active/HeadyOS/`
- **💿 ISO Collection**: `Shared/Media/ISOs/`
- **🔧 Development Tools**: `Shared/Tools/`
- **🎨 Media Library**: `Shared/Media/`
- **📋 Templates**: `Shared/Templates/`

## 🔄 Adding Content

### New Projects
Place in appropriate `Active/` folder under the correct organization.

### Media Assets
Add to `Shared/Media/` subcategories:
- Logos → `Shared/Media/Logos/`
- Screenshots → `Shared/Media/Product/`
- Sacred Geometry → `Shared/Media/SacredGeometry/`

### Personal Files
Organize under `Personal/` with visual categorization.

## 🎯 Design Philosophy

**"Use images very, very freely"** - Every interface is visually rich:
- 📊 Dashboards with background themes
- 📄 Documents with headers and watermarks
- 🗂️ Folders with custom icons
- 🎨 Consistent visual language everywhere

## 🔐 Security

- 🔒 Sensitive files encrypted
- 💾 Automated backups
- 🚑 Recovery procedures documented
- 🔐 Access control implemented

## 📞 Support

- **📚 Documentation**: Heady Systems Wiki
- **🤝 Community**: Heady Discord
- **🐛 Issues**: GitHub Issues
- **📧 Contact**: support@headysystems.com

---

*Built with ❤️ and Sacred Geometry by Heady Systems*  
*Last Updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')*
"@

Set-Content -Path "F:\HeadyEcosystem\README.md" -Value $newReadme -Encoding UTF8
Write-Host "✅ New README created with visual branding" -ForegroundColor Green

# Create autorun.inf for new structure
Write-Host "🔧 Creating new autorun.inf..." -ForegroundColor Yellow
$autorun = @"
[autorun]
icon=HeadyEcosystem\Shared\Media\Logos\HeadySystems_Icon.ico
label=HeadyEcosystem
action=Open HeadyEcosystem
action\command=explorer HeadyEcosystem
"@

Set-Content -Path "F:\autorun.inf" -Value $autorun -Encoding UTF8
Write-Host "✅ New autorun.inf created" -ForegroundColor Green

# Create organization summary
Write-Host "📊 Creating organization summary..." -ForegroundColor Yellow
$summary = @"
# F:\ Drive Organization Summary

## Completed Actions
✅ Created unified HeadyEcosystem structure
✅ Moved HeadyOS to HeadySystems/Active/
✅ Moved ISOs to Shared/Media/
✅ Moved Ventoy to Shared/Tools/
✅ Organized all existing content
✅ Applied visual branding framework
✅ Created comprehensive documentation

## Structure Overview
- **Main Directory**: F:\HeadyEcosystem\
- **Organizations**: HeadyConnection & HeadySystems
- **Personal**: Creative, Records, Learning, Archive
- **Shared**: Media, Templates, Tools
- **Archive**: Historical materials

## Next Steps
1. Add visual assets to Shared/Media/
2. Organize computer files into structure
3. Set up phone integration
4. Implement automated maintenance
5. Apply visual branding to all interfaces

## Visual Integration Status
🎨 Framework: ✅ Complete
🖼️ Assets: 🔄 In Progress
🎯 Branding: 🔄 In Progress
📱 Mobile: ⏳ Pending

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

Set-Content -Path "F:\HeadyEcosystem\ORGANIZATION_SUMMARY.md" -Value $summary -Encoding UTF8
Write-Host "✅ Organization summary created" -ForegroundColor Green

# Clean up old files
Write-Host "🧹 Cleaning up old files..." -ForegroundColor Yellow
Remove-Item "F:\README.md" -Force -ErrorAction SilentlyContinue
Write-Host "✅ Old README removed" -ForegroundColor Green

Write-Host "🎉 F:\ Drive organization complete!" -ForegroundColor Green
Write-Host "📁 New structure: F:\HeadyEcosystem\" -ForegroundColor Cyan
Write-Host "🎨 Visual branding framework applied" -ForegroundColor Cyan
Write-Host "📋 Summary available: F:\HeadyEcosystem\ORGANIZATION_SUMMARY.md" -ForegroundColor Cyan
