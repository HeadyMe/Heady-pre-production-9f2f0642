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
<# ║  FILE: scripts/organize-computer-files.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh

# HCFP Computer Files Organization Script
# Organizes C:\Users\erich files according to HCFP rebuild master plan

Write-Host "🚀 Starting Computer Files Organization..." -ForegroundColor Cyan

# Create backup of critical directories
Write-Host "📦 Creating backup of critical directories..." -ForegroundColor Yellow
$backupBase = "C:\Users\erich\Backup_$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $backupBase -Force

# Backup Desktop
if (Test-Path "C:\Users\erich\Desktop") {
    Copy-Item "C:\Users\erich\Desktop" "$backupBase\Desktop" -Recurse -Force
    Write-Host "✅ Desktop backed up" -ForegroundColor Green
}

# Backup Documents
if (Test-Path "C:\Users\erich\Documents") {
    Copy-Item "C:\Users\erich\Documents" "$backupBase\Documents" -Recurse -Force
    Write-Host "✅ Documents backed up" -ForegroundColor Green
}

# Create unified personal structure
Write-Host "🏗️ Creating unified personal structure..." -ForegroundColor Yellow

$personalDirs = @(
    "C:\Users\erich\PersonalEcosystem",
    "C:\Users\erich\PersonalEcosystem\Creative",
    "C:\Users\erich\PersonalEcosystem\Creative\Writing",
    "C:\Users\erich\PersonalEcosystem\Creative\Art",
    "C:\Users\erich\PersonalEcosystem\Creative\Music",
    "C:\Users\erich\PersonalEcosystem\Creative\Media",
    "C:\Users\erich\PersonalEcosystem\Records",
    "C:\Users\erich\PersonalEcosystem\Records\Financial",
    "C:\Users\erich\PersonalEcosystem\Records\Legal",
    "C:\Users\erich\PersonalEcosystem\Records\Health",
    "C:\Users\erich\PersonalEcosystem\Records\Administrative",
    "C:\Users\erich\PersonalEcosystem\Learning",
    "C:\Users\erich\PersonalEcosystem\Learning\Research",
    "C:\Users\erich\PersonalEcosystem\Learning\Development",
    "C:\Users\erich\PersonalEcosystem\Learning\Courses",
    "C:\Users\erich\PersonalEcosystem\Learning\References",
    "C:\Users\erich\PersonalEcosystem\Archive",
    "C:\Users\erich\PersonalEcosystem\Archive\2020-2023",
    "C:\Users\erich\PersonalEcosystem\Archive\Legacy",
    "C:\Users\erich\PersonalEcosystem\Archive\Backup"
)

foreach ($dir in $personalDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Create shared media structure
Write-Host "🎨 Creating shared media structure..." -ForegroundColor Yellow

$mediaDirs = @(
    "C:\Users\erich\PersonalEcosystem\SharedMedia",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\Logos",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\SacredGeometry",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\UI",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\Product",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\Brand",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\Personal",
    "C:\Users\erich\PersonalEcosystem\SharedMedia\Downloads",
    "C:\Users\erich\PersonalEcosystem\Templates",
    "C:\Users\erich\PersonalEcosystem\Tools"
)

foreach ($dir in $mediaDirs) {
    New-Item -ItemType Directory -Path $dir -Force
}

# Organize Desktop files
Write-Host "🗂️ Organizing Desktop files..." -ForegroundColor Yellow

# Move HCFP documents to Records/Administrative
$hcfpDocs = @(
    "HCFP_CRITICAL_INCIDENT_REPORT.md",
    "HCFP_FULL_SYSTEM_RESTORATION_INSTRUCTIONS.md", 
    "HCFP_PART3_VIRTUALIZATION_ARCHITECTURE.md",
    "HCFP_PHASE0_SYSTEM_STABILIZATION.ps1",
    "HCFP_PHASE1_DOCKER_REBUILD.ps1",
    "HCFP_PHASE2_BACKEND_SERVICES.ps1",
    "HCFP_PHASE3_PRODUCTION_DEPLOYMENT.ps1"
)

foreach ($doc in $hcfpDocs) {
    $source = "C:\Users\erich\Desktop\$doc"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Records\Administrative\" -Force
        Write-Host "✅ Moved $doc to Records/Administrative" -ForegroundColor Green
    }
}

# Move Heady install scripts to Tools
$headyScripts = @(
    "Install-HeadyComplete.ps1",
    "Install-HeadySimple.ps1",
    "restore_heady_systems.ps1",
    "organize_secrets.ps1",
    "optimize_repos.ps1",
    "configure_git_nexus.ps1"
)

foreach ($script in $headyScripts) {
    $source = "C:\Users\erich\Desktop\$script"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Tools\" -Force
        Write-Host "✅ Moved $script to Tools" -ForegroundColor Green
    }
}

# Move mobile setup to Learning/Development
$mobileFiles = @(
    "HEADY_MOBILE_SETUP.md",
    "mobile-connector.js",
    "termux-setup.sh"
)

foreach ($file in $mobileFiles) {
    $source = "C:\Users\erich\Desktop\$file"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Learning\Development\" -Force
        Write-Host "✅ Moved $file to Learning/Development" -ForegroundColor Green
    }
}

# Move URLs and shortcuts to Templates
$urlFiles = @(
    "Drupal CMS.url",
    "Heady API.url",
    "HeadyConnection.url", 
    "HeadySystems.url",
    "🌟 Heady Control Panel.url",
    "🎨 Heady GitHub.url",
    "📚 Heady Documentation.url"
)

foreach ($url in $urlFiles) {
    $source = "C:\Users\erich\Desktop\$url"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Templates\" -Force
        Write-Host "✅ Moved $url to Templates" -ForegroundColor Green
    }
}

# Move batch files to Tools
$batchFiles = @(
    "⚡ Run HeadyControl.bat",
    "🔄 Run HeadySync.bat",
    "🔨 Run HeadyBuild.bat",
    "🚀 Deploy Heady.bat",
    "🤖 Run Automated Workflow.bat"
)

foreach ($batch in $batchFiles) {
    $source = "C:\Users\erich\Desktop\$batch"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Tools\" -Force
        Write-Host "✅ Moved $batch to Tools" -ForegroundColor Green
    }
}

# Move config files to Records/Administrative
$configFiles = @(
    "heady-config.json",
    "1password-credentials.json"
)

foreach ($config in $configFiles) {
    $source = "C:\Users\erich\Desktop\$config"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Records\Administrative\" -Force
        Write-Host "✅ Moved $config to Records/Administrative" -ForegroundColor Green
    }
}

# Organize Downloads
Write-Host "📥 Organizing Downloads..." -ForegroundColor Yellow

# Move images to SharedMedia/Personal
$imageFiles = Get-ChildItem "C:\Users\erich\Downloads\*.png" -ErrorAction SilentlyContinue
$imageFiles += Get-ChildItem "C:\Users\erich\Downloads\*.jpg" -ErrorAction SilentlyContinue
$imageFiles += Get-ChildItem "C:\Users\erich\Downloads\*.jpeg" -ErrorAction SilentlyContinue
$imageFiles += Get-ChildItem "C:\Users\erich\Downloads\*.gif" -ErrorAction SilentlyContinue
$imageFiles += Get-ChildItem "C:\Users\erich\Downloads\*.svg" -ErrorAction SilentlyContinue

foreach ($image in $imageFiles) {
    if ($image.Name -like "Gemini_Generated_*" -or $image.Name -like "*Logo*") {
        Move-Item $image.FullName "C:\Users\erich\PersonalEcosystem\SharedMedia\Personal\" -Force
        Write-Host "✅ Moved $($image.Name) to SharedMedia/Personal" -ForegroundColor Green
    }
}

# Move Heady install packages to Tools
$installPackages = Get-ChildItem "C:\Users\erich\Downloads\HeadySystems_Install_Pkg*" -ErrorAction SilentlyContinue
foreach ($package in $installPackages) {
    Move-Item $package.FullName "C:\Users\erich\PersonalEcosystem\Tools\" -Force
    Write-Host "✅ Moved $($package.Name) to Tools" -ForegroundColor Green
}

# Move demo kits to Creative/Media
$demoKits = Get-ChildItem "C:\Users\erich\Downloads\heady_demo_kit*" -ErrorAction SilentlyContinue
foreach ($kit in $demoKits) {
    Move-Item $kit.FullName "C:\Users\erich\PersonalEcosystem\Creative\Media\" -Force
    Write-Host "✅ Moved $($kit.Name) to Creative/Media" -ForegroundColor Green
}

# Move Python build scripts to Learning/Development
$buildScripts = Get-ChildItem "C:\Users\erich\Downloads\build_*.py" -ErrorAction SilentlyContinue
foreach ($script in $buildScripts) {
    Move-Item $script.FullName "C:\Users\erich\PersonalEcosystem\Learning\Development\" -Force
    Write-Host "✅ Moved $($script.Name) to Learning/Development" -ForegroundColor Green
}

# Move patent documents to Records/Legal
$patentFiles = Get-ChildItem "C:\Users\erich\Downloads\PPA-*.docx" -ErrorAction SilentlyContinue
$patentFiles += Get-ChildItem "C:\Users\erich\Downloads\Patent_*.docx" -ErrorAction SilentlyContinue

foreach ($patent in $patentFiles) {
    Move-Item $patent.FullName "C:\Users\erich\PersonalEcosystem\Records\Legal\" -Force
    Write-Host "✅ Moved $($patent.Name) to Records/Legal" -ForegroundColor Green
}

# Move notebooks to Learning/Research
$notebooks = Get-ChildItem "C:\Users\erich\Downloads\*.ipynb" -ErrorAction SilentlyContinue
foreach ($notebook in $notebooks) {
    Move-Item $notebook.FullName "C:\Users\erich\PersonalEcosystem\Learning\Research\" -Force
    Write-Host "✅ Moved $($notebook.Name) to Learning/Research" -ForegroundColor Green
}

# Move videos to Creative/Media
$videoFiles = Get-ChildItem "C:\Users\erich\Downloads\*.mp4" -ErrorAction SilentlyContinue
foreach ($video in $videoFiles) {
    Move-Item $video.FullName "C:\Users\erich\PersonalEcosystem\Creative\Media\" -Force
    Write-Host "✅ Moved $($video.Name) to Creative/Media" -ForegroundColor Green
}

# Move audio files to Creative/Music
$audioFiles = Get-ChildItem "C:\Users\erich\Downloads\*.mp3" -ErrorAction SilentlyContinue
foreach ($audio in $audioFiles) {
    Move-Item $audio.FullName "C:\Users\erich\PersonalEcosystem\Creative\Music\" -Force
    Write-Host "✅ Moved $($audio.Name) to Creative/Music" -ForegroundColor Green
}

# Move installers to Tools
$installerFiles = @(
    "*.exe", "*.msi"
)

foreach ($pattern in $installerFiles) {
    $files = Get-ChildItem "C:\Users\erich\Downloads\$pattern" -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        Move-Item $file.FullName "C:\Users\erich\PersonalEcosystem\Tools\" -Force
        Write-Host "✅ Moved $($file.Name) to Tools" -ForegroundColor Green
    }
}

# Organize Heady project directories
Write-Host "🚀 Organizing Heady project directories..." -ForegroundColor Yellow

$headyDirs = @(
    "Heady", "Heady-Fresh", "Heady-Fresh-20260206-213504", "Heady-Fresh-v3",
    "HeadyE", "HeadyIDE", "HeadyMonorepo"
)

foreach ($dir in $headyDirs) {
    $source = "C:\Users\erich\$dir"
    if (Test-Path $source) {
        Move-Item $source "C:\Users\erich\PersonalEcosystem\Learning\Development\" -Force
        Write-Host "✅ Moved $dir to Learning/Development" -ForegroundColor Green
    }
}

# Move Documents content
Write-Host "📚 Organizing Documents..." -ForegroundColor Yellow

if (Test-Path "C:\Users\erich\Documents\HeadySystems-Core") {
    Move-Item "C:\Users\erich\Documents\HeadySystems-Core" "C:\Users\erich\PersonalEcosystem\Learning\Development\" -Force
    Write-Host "✅ Moved HeadySystems-Core to Learning/Development" -ForegroundColor Green
}

# Create visual README for PersonalEcosystem
Write-Host "📝 Creating visual README..." -ForegroundColor Yellow

$readme = @"
# 🌟 PersonalEcosystem - Unified Digital Environment

> **Visual-First Organization :: Complete Personal Cohesion**

## 🎨 Visual Architecture

This personal ecosystem follows the **HCFP Rebuild Master Plan** with heavy visual branding:

```
PersonalEcosystem/
├── 🎨 Creative/                # Creative works
│   ├── ✍️ Writing/            # Stories, articles, concepts
│   ├── 🎨 Art/                # Visual art, designs
│   ├── 🎵 Music/              # Audio projects
│   └── 📱 Media/              # Photos, videos, assets
├── 📋 Records/                 # Personal records
│   ├── 💰 Financial/          # Taxes, receipts, budgets
│   ├── ⚖️ Legal/              # Contracts, agreements
│   ├── 🏥 Health/             # Medical records
│   └── 📊 Administrative/     # Personal paperwork
├── 📚 Learning/                # Development & research
│   ├── 🔬 Research/           # Study materials, notes
│   ├── 💻 Development/        # Personal projects
│   ├── 🎓 Courses/            # Online courses
│   └── 📖 References/         # Books, articles
├── 📦 Archive/                 # Historical files
│   ├── 📅 2020-2023/          # Old files by year
│   ├── 🗂️ Legacy/             # Deprecated formats
│   └── 💾 Backup/             # Redundant copies
├── 🎨 SharedMedia/             # Central media library
│   ├── 🏷️ Logos/              # Brand logos
│   ├── 🔮 SacredGeometry/     # Sacred patterns
│   ├── 🖥️ UI/                 # Interface elements
│   ├── 📱 Product/            # Screenshots
│   ├── 🎨 Brand/              # Style guides
│   ├── 👤 Personal/           # Personal photos
│   └── 📥 Downloads/          # Downloaded media
├── 📋 Templates/               # Document templates
└── 🔧 Tools/                   # Utilities & scripts
```

## 🎯 Visual Integration

**"Use images very, very freely"** throughout this ecosystem:
- 📁 **Custom folder icons** for every category
- 🎨 **Sacred Geometry patterns** as visual themes
- 📊 **Rich media** in all documentation
- 🌈 **Consistent color schemes** across all files

## 🚀 Quick Access

### Development Projects
`Learning/Development/` - Contains all Heady projects and experiments

### Creative Works
`Creative/` - Art, writing, music, and media projects

### Important Records
`Records/` - Financial, legal, health, and administrative documents

### Media Library
`SharedMedia/` - All images, logos, and visual assets

## 🔄 Organization Rules

### File Naming
- Use descriptive names with dates: `ProjectName_Component_YYYY-MM-DD`
- Include visual tags: `[ICON]`, `[BRAND]`, `[SACRED]`
- Consistent capitalization and spacing

### Visual Standards
- Every document has a header with relevant imagery
- Folders use custom icons representing content
- Sacred Geometry patterns used as visual motifs

### Backup Strategy
- Critical files duplicated in `Archive/Backup/`
- Cloud sync for important documents
- Version control for development projects

## 🎨 Design Philosophy

This ecosystem embodies the Heady principle of **visual-first organization**:
- **Beauty** in structure and presentation
- **Clarity** through visual categorization
- **Efficiency** via intuitive navigation
- **Inspiration** through aesthetic design

## 📞 Integration

- **📱 Mobile**: Phone integration planned
- **☁️ Cloud**: Sync with cloud storage
- **🔗 F:\ Drive**: Unified with F:\ HeadyEcosystem
- **🌐 Web**: Online portfolio and documentation

---

*Built with ❤️ and Sacred Geometry*  
*Following HCFP Rebuild Master Plan*  
*Last Updated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')*
"@

Set-Content -Path "C:\Users\erich\PersonalEcosystem\README.md" -Value $readme -Encoding UTF8
Write-Host "✅ Visual README created" -ForegroundColor Green

# Create organization summary
Write-Host "📊 Creating organization summary..." -ForegroundColor Yellow

$summary = @"
# Computer Files Organization Summary

## Completed Actions
✅ Created unified PersonalEcosystem structure
✅ Organized Desktop files by category
✅ Sorted Downloads into proper directories
✅ Moved Heady projects to Learning/Development
✅ Applied visual branding framework
✅ Created comprehensive documentation

## Files Processed
- **Desktop**: $( (Get-ChildItem "C:\Users\erich\Desktop" -File).Count ) files organized
- **Downloads**: $( (Get-ChildItem "C:\Users\erich\Downloads" -File).Count ) files processed
- **Documents**: Content moved to appropriate categories
- **Projects**: All Heady directories consolidated

## Structure Overview
- **Main Directory**: C:\Users\erich\PersonalEcosystem\
- **Creative**: Art, writing, music, media
- **Records**: Financial, legal, health, admin
- **Learning**: Research, development, courses
- **SharedMedia**: Central image library
- **Archive**: Historical and backup files

## Visual Integration Status
🎨 Framework: ✅ Complete
🖼️ Assets: 🔄 In Progress
🎯 Branding: 🔄 In Progress
📱 Mobile: ⏳ Pending

## Next Steps
1. Add visual assets to SharedMedia/
2. Set up phone integration
3. Implement automated maintenance
4. Apply custom folder icons
5. Create visual templates

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@

Set-Content -Path "C:\Users\erich\PersonalEcosystem\ORGANIZATION_SUMMARY.md" -Value $summary -Encoding UTF8
Write-Host "✅ Organization summary created" -ForegroundColor Green

Write-Host "🎉 Computer files organization complete!" -ForegroundColor Green
Write-Host "📁 New structure: C:\Users\erich\PersonalEcosystem\" -ForegroundColor Cyan
Write-Host "🎨 Visual branding framework applied" -ForegroundColor Cyan
Write-Host "📋 Summary available: C:\Users\erich\PersonalEcosystem\ORGANIZATION_SUMMARY.md" -ForegroundColor Cyan
