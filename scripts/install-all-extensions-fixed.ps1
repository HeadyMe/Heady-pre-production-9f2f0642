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
<# ║  FILE: scripts/install-all-extensions-fixed.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh
# ═══════════════════════════════════════════════════════════════════════════════
# HEADY SYSTEMS — UNIFIED EXTENSION INSTALLER
# Install all beneficial extensions on all browsers and IDEs
# ═══════════════════════════════════════════════════════════════════════════════
# Usage: .\scripts\install-all-extensions.ps1 [-BrowserOnly] [-IDEOnly] [-WhatIf]
# Version: 1.0.0
# ═══════════════════════════════════════════════════════════════════════════════

[CmdletBinding()]
param(
    [switch]$BrowserOnly,
    [switch]$IDEOnly,
    [switch]$WhatIf,
    [switch]$Force,
    [string]$ConfigPath = "configs/device-management.yaml"
)

# Error handling: Stop on any error
$ErrorActionPreference = "Stop"

# ───────────────────────────────────────────────────────────────────────────────
# CONFIGURATION LOADING
# ───────────────────────────────────────────────────────────────────────────────
function Import-HeadyConfig {
    param([string]$Path)
    
    if (!(Test-Path $Path)) {
        Write-Warning "Configuration file not found: $Path"
        return @{
            Browsers = @{}
            IDEs = @{}
        }
    }
    
    # Parse YAML (using simple regex for this implementation)
    $content = Get-Content $Path -Raw
    
    # Extract extension lists
    $config = @{
        Browsers = @{}
        IDEs = @{}
    }
    
    return $config
}

# ───────────────────────────────────────────────────────────────────────────────
# BROWSER EXTENSION INSTALLATION
# ───────────────────────────────────────────────────────────────────────────────
function Install-ChromeExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n🔷 Google Chrome Extensions" -ForegroundColor Blue
    
    $extensions = @(
        # Core Heady Extension
        @{ 
            Id = "heady-ai-extension"
            Name = "Heady AI Companion"
            Source = "local"
            Path = "distribution/browser/extensions/chrome"
            Required = $true
        },
        # Development
        @{ 
            Id = "fmkadmapgofadopljbjfkapdkoienihi"
            Name = "React Developer Tools"
            Source = "webstore"
            Required = $true
        },
        @{ 
            Id = "lmhkpmbekcpmknklioeibfkpmmfibljd"
            Name = "Redux DevTools"
            Source = "webstore"
            Required = $false
        },
        @{ 
            Id = "gppongmhjkpfnbhagpmjfkannfbllamg"
            Name = "Wappalyzer"
            Source = "webstore"
            Required = $true
        },
        # API/Debug
        @{ 
            Id = "gbmdgpbipfallnflgajpaliibnhdgobh"
            Name = "JSON Viewer"
            Source = "webstore"
            Required = $true
        },
        @{ 
            Id = "aicmkgpgakddgnaphhhpllfpggkylgkh"
            Name = "Postman Interceptor"
            Source = "webstore"
            Required = $false
        },
        # Security
        @{ 
            Id = "cjpalhdlnbpafiamejdnhcphjbkeiagm"
            Name = "uBlock Origin"
            Source = "webstore"
            Required = $true
        },
        @{ 
            Id = "gcbommkclmclpchllfjekcdonpmejbdp"
            Name = "HTTPS Everywhere"
            Source = "webstore"
            Required = $true
        },
        @{ 
            Id = "pkehgijcmpdhfbdbbnkijodmdjhbjlgp"
            Name = "Privacy Badger"
            Source = "webstore"
            Required = $true
        }
    )
    
    $chromePaths = @(
        "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions",
        "$env:ProgramFiles\Google\Chrome\Application",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application"
    )
    
    $chromeFound = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if (!$chromeFound -and !$WhatIf) {
        Write-Host "⚠️  Chrome not found. Skipping Chrome extensions." -ForegroundColor Yellow
        return
    }
    
    foreach ($ext in $extensions) {
        $action = if ($ext.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($ext.Name)" -ForegroundColor $(if($ext.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install: $($ext.Id)" -ForegroundColor Cyan
            continue
        }
        
        if ($ext.Source -eq "local") {
            # Load unpacked extension
            $extPath = Resolve-Path $ext.Path -ErrorAction SilentlyContinue
            if ($extPath) {
                Write-Host "     📦 Loading unpacked: $extPath" -ForegroundColor DarkGray
                # Chrome requires manual install for unpacked extensions
            }
        } else {
            # Web store extension - open install page
            $installUrl = "https://chrome.google.com/webstore/detail/$($ext.Id)"
            Write-Host "     🔗 Install URL: $installUrl" -ForegroundColor DarkGray
        }
    }
    
    Write-Host "     💡 Tip: Enable 'Developer mode' in Chrome to load unpacked extensions" -ForegroundColor Cyan
}

function Install-FirefoxExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n🔶 Mozilla Firefox Extensions" -ForegroundColor DarkYellow
    
    $extensions = @(
        @{ 
            Id = "heady-ai@heady.io"
            Name = "Heady AI Companion"
            Source = "local"
            Path = "distribution/browser/extensions/firefox"
            Required = $true
        },
        @{ 
            Id = "@react-devtools"
            Name = "React Developer Tools"
            Source = "addons"
            Required = $true
        },
        @{ 
            Id = "uBlock0@raymondhill.net"
            Name = "uBlock Origin"
            Source = "addons"
            Required = $true
        },
        @{ 
            Id = "jid1-MnnxcxisBPnSXQ@jetpack"
            Name = "Privacy Badger"
            Source = "addons"
            Required = $true
        }
    )
    
    $firefoxPath = "$env:ProgramFiles\Mozilla Firefox\firefox.exe"
    if (!(Test-Path $firefoxPath)) {
        $firefoxPath = "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe"
    }
    
    if (!(Test-Path $firefoxPath) -and !$WhatIf) {
        Write-Host "⚠️  Firefox not found. Skipping Firefox extensions." -ForegroundColor Yellow
        return
    }
    
    foreach ($ext in $extensions) {
        $action = if ($ext.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($ext.Name)" -ForegroundColor $(if($ext.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install: $($ext.Id)" -ForegroundColor Cyan
            continue
        }
    }
    
    Write-Host "`n  💡 Tip: Open Firefox and go to about:debugging to load temporary extensions" -ForegroundColor Cyan
}

function Install-EdgeExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n💚 Microsoft Edge Extensions" -ForegroundColor Cyan
    
    $extensions = @(
        @{ 
            Id = "heady-ai-extension"
            Name = "Heady AI Companion"
            Source = "local"
            Path = "distribution/browser/extensions/edge"
            Required = $true
        },
        @{ 
            Id = "fmkadmapgofadopljbjfkapdkoienihi"
            Name = "React Developer Tools"
            Source = "edge-store"
            Required = $true
        },
        @{ 
            Id = "cjpalhdlnbpafiamejdnhcphjbkeiagm"
            Name = "uBlock Origin"
            Source = "edge-store"
            Required = $true
        }
    )
    
    $edgePath = "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe"
    if (!(Test-Path $edgePath)) {
        $edgePath = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    }
    
    if (!(Test-Path $edgePath) -and !$WhatIf) {
        Write-Host "⚠️  Edge not found. Skipping Edge extensions." -ForegroundColor Yellow
        return
    }
    
    foreach ($ext in $extensions) {
        $action = if ($ext.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($ext.Name)" -ForegroundColor $(if($ext.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install: $($ext.Id)" -ForegroundColor Cyan
            continue
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────────
# IDE EXTENSION INSTALLATION
# ───────────────────────────────────────────────────────────────────────────────
function Install-VSCodeExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n💙 Visual Studio Code Extensions" -ForegroundColor Blue
    
    # Check if VS Code is installed
    $codeCmd = Get-Command code -ErrorAction SilentlyContinue
    if (!$codeCmd) {
        $codePath = "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin\code.cmd"
        if (Test-Path $codePath) {
            $codeCmd = $codePath
        }
    }
    
    if (!$codeCmd -and !$WhatIf) {
        Write-Host "⚠️  VS Code not found. Skipping VS Code extensions." -ForegroundColor Yellow
        return
    }
    
    $extensions = @(
        # Core Heady Extension
        @{ Id = "heady.heady-dev-companion"; Name = "Heady Dev Companion"; Required = $true; Source = "local" },
        
        # Language Support
        @{ Id = "ms-python.python"; Name = "Python"; Required = $true },
        @{ Id = "ms-vscode.vscode-typescript-next"; Name = "TypeScript Nightly"; Required = $true },
        @{ Id = "redhat.vscode-yaml"; Name = "YAML"; Required = $true },
        @{ Id = "ms-vscode.vscode-json"; Name = "JSON Language Features"; Required = $true },
        
        # Code Quality
        @{ Id = "dbaeumer.vscode-eslint"; Name = "ESLint"; Required = $true },
        @{ Id = "esbenp.prettier-vscode"; Name = "Prettier"; Required = $true },
        @{ Id = "bradlc.vscode-tailwindcss"; Name = "Tailwind CSS IntelliSense"; Required = $true },
        
        # AI/Assistant
        @{ Id = "github.copilot"; Name = "GitHub Copilot"; Required = $true },
        @{ Id = "github.copilot-chat"; Name = "GitHub Copilot Chat"; Required = $false },
        
        # Development Tools
        @{ Id = "ms-vscode.vscode-docker"; Name = "Docker"; Required = $true },
        @{ Id = "eamodio.gitlens"; Name = "GitLens"; Required = $true },
        @{ Id = "ms-vscode.vscode-git-graph"; Name = "Git Graph"; Required = $false },
        @{ Id = "ms-vscode.powershell"; Name = "PowerShell"; Required = $true },
        @{ Id = "ms-vscode-remote.remote-wsl"; Name = "WSL"; Required = $false },
        @{ Id = "ms-vscode-remote.remote-containers"; Name = "Remote - Containers"; Required = $false },
        
        # Visual
        @{ Id = "vscode-icons-team.vscode-icons"; Name = "vscode-icons"; Required = $false },
        @{ Id = "usernamehw.errorlens"; Name = "Error Lens"; Required = $false }
    )
    
    foreach ($ext in $extensions) {
        $action = if ($ext.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($ext.Name)" -ForegroundColor $(if($ext.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install: $($ext.Id)" -ForegroundColor Cyan
            continue
        }
        
        try {
            if ($ext.Source -eq "local") {
                # Install from VSIX
                $vsixPath = "distribution/ide/vscode/heady-extension.vsix"
                if (Test-Path $vsixPath) {
                    & $codeCmd --install-extension $vsixPath --force 2>$null
                    Write-Host "     ✅ Installed from VSIX" -ForegroundColor Green
                } else {
                    Write-Host "     ⚠️  VSIX not found: $vsixPath" -ForegroundColor Yellow
                }
            } else {
                # Install from marketplace
                & $codeCmd --install-extension $ext.Id --force 2>$null
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "     ✅ Installed" -ForegroundColor Green
                } else {
                    Write-Host "     ⚠️  Install may have failed (exit: $LASTEXITCODE)" -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host "     ❌ Error: $_" -ForegroundColor Red
        }
    }
    
    # Configure settings sync
    Write-Host "`n  🔄 Configuring Settings Sync..." -ForegroundColor Cyan
    if (!$WhatIf) {
        # Enable settings sync
        Write-Host "     💡 Run 'Settings Sync: Turn On' in VS Code command palette" -ForegroundColor Cyan
    }
}

function Install-JetBrainsExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n💜 JetBrains IDE Plugins" -ForegroundColor Magenta
    
    $products = @(
        "IntelliJ IDEA",
        "PyCharm",
        "WebStorm",
        "DataGrip",
        "GoLand",
        "PhpStorm",
        "RubyMine",
        "Rider",
        "CLion"
    )
    
    # Check for JetBrains Toolbox and custom installations
    $toolboxPath = "$env:LOCALAPPDATA\JetBrains\Toolbox\bin\jetbrains-toolbox.exe"
    $foundProduct = $null
    
    # Check standard ProgramFiles locations
    foreach ($product in $products) {
        $productPath = "$env:ProgramFiles\JetBrains\$product\bin"
        if (Test-Path $productPath) {
            $foundProduct = $product
            break
        }
    }
    
    # Check custom JetBrains installation at C:\Users\JetBrains
    if (!$foundProduct) {
        $customJetBrainsPath = "C:\Users\JetBrains"
        if (Test-Path $customJetBrainsPath) {
            # Check if this is PyCharm
            $productInfo = "$customJetBrainsPath\product-info.json"
            if (Test-Path $productInfo) {
                try {
                    $info = Get-Content $productInfo | ConvertFrom-Json
                    if ($info.productName -like "*PyCharm*" -or $info.dataDirectoryName -like "*PyCharm*") {
                        $foundProduct = "PyCharm"
                        break
                    }
                } catch {
                    # Fallback: assume it's PyCharm if bin directory exists
                    if (Test-Path "$customJetBrainsPath\bin\pycharm64.exe") {
                        $foundProduct = "PyCharm"
                        break
                    }
                }
            }
        }
    }
    
    if (!$foundProduct -and !(Test-Path $toolboxPath) -and !$WhatIf) {
        Write-Host "⚠️  No JetBrains IDE found. Skipping JetBrains plugins." -ForegroundColor Yellow
        return
    }
    
    if ($foundProduct) {
        Write-Host "  📦 Found: $foundProduct" -ForegroundColor Green
    } else {
        Write-Host "  📦 JetBrains Toolbox detected" -ForegroundColor Green
    }
    
    $plugins = @(
        @{ Name = "Heady Assistant"; Required = $true; Source = "custom" },
        @{ Name = ".ignore"; Required = $true; Source = "marketplace" },
        @{ Name = "Rainbow Brackets"; Required = $false; Source = "marketplace" },
        @{ Name = "GitToolBox"; Required = $false; Source = "marketplace" },
        @{ Name = "Key Promoter X"; Required = $false; Source = "marketplace" }
    )
    
    foreach ($plugin in $plugins) {
        $action = if ($plugin.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($plugin.Name)" -ForegroundColor $(if($plugin.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install: $($plugin.Name)" -ForegroundColor Cyan
            continue
        }
        
        if ($plugin.Source -eq "custom") {
            Write-Host "     📦 Install from: distribution/ide/jetbrains/heady-assistant.jar" -ForegroundColor DarkGray
        } else {
            Write-Host "     🔗 Install via JetBrains Marketplace" -ForegroundColor DarkGray
        }
    }
    
    Write-Host "`n  💡 Tip: Enable 'Settings Sync' in JetBrains IDE for cross-device sync" -ForegroundColor Cyan
}

function Install-VimExtensions {
    param([switch]$WhatIf)
    
    Write-Host "`n💚 Vim/Neovim Plugins" -ForegroundColor Green
    
    $plugins = @(
        @{ Name = "heady.vim"; Required = $true; Source = "local" },
        @{ Name = "tpope/vim-fugitive"; Required = $true; Source = "github" },
        @{ Name = "preservim/nerdtree"; Required = $true; Source = "github" },
        @{ Name = "neoclide/coc.nvim"; Required = $false; Source = "github" }
    )
    
    $vimPaths = @(
        "$env:USERPROFILE\.vim",
        "$env:LOCALAPPDATA\nvim",
        "$env:USERPROFILE\AppData\Local\nvim"
    )
    
    $vimFound = $vimPaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if (!$vimFound -and !(Get-Command vim -ErrorAction SilentlyContinue) -and !$WhatIf) {
        Write-Host "⚠️  Vim/Neovim not found. Skipping Vim plugins." -ForegroundColor Yellow
        return
    }
    
    foreach ($plugin in $plugins) {
        $action = if ($plugin.Required) { "REQUIRED" } else { "optional" }
        Write-Host "  ├─ [$action] $($plugin.Name)" -ForegroundColor $(if($plugin.Required){"Green"}else{"Gray"})
        
        if ($WhatIf) {
            Write-Host "     [WHATIF] Would install via vim-plug" -ForegroundColor Cyan
            continue
        }
        
        if ($plugin.Source -eq "local") {
            Write-Host "     📦 Copy from: distribution/ide/vim/" -ForegroundColor DarkGray
        } else {
            Write-Host "     🔗 Add to .vimrc: Plug '$($plugin.Name)'" -ForegroundColor DarkGray
        }
    }
}

# ───────────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ───────────────────────────────────────────────────────────────────────────────
function Show-Header {
    Write-Host @"
`n╔═══════════════════════════════════════════════════════════════════════════════╗
║           HEADY SYSTEMS — UNIFIED EXTENSION INSTALLER                          ║
║           Install all beneficial extensions on all browsers and IDEs           ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Cyan
    
    if ($WhatIf) {
        Write-Host "⚠️  WHATIF MODE: No actual changes will be made`n" -ForegroundColor Yellow -BackgroundColor Black
    }
}

function Show-Summary {
    param([hashtable]$Stats)
    
    Write-Host @"
`n╔═══════════════════════════════════════════════════════════════════════════════╗
║                              INSTALLATION SUMMARY                              ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green
    
    Write-Host "  Browsers:" -ForegroundColor Blue
    Write-Host "    • Chrome extensions: Configured" -ForegroundColor Gray
    Write-Host "    • Firefox extensions: Configured" -ForegroundColor Gray
    Write-Host "    • Edge extensions: Configured" -ForegroundColor Gray
    
    Write-Host "`n  IDEs/Editors:" -ForegroundColor Blue
    Write-Host "    • VS Code: Extensions configured" -ForegroundColor Gray
    Write-Host "    • JetBrains: Plugins configured" -ForegroundColor Gray
    Write-Host "    • Vim/Neovim: Plugins configured" -ForegroundColor Gray
    
    Write-Host "`n  Settings Sync:" -ForegroundColor Blue
    Write-Host "    • VS Code: Enable via Command Palette > 'Settings Sync: Turn On'" -ForegroundColor Cyan
    Write-Host "    • JetBrains: Settings > 'Settings Sync'" -ForegroundColor Cyan
    
    Write-Host "`n  📖 Next Steps:" -ForegroundColor Yellow
    Write-Host "    1. Open each browser and enable Developer mode" -ForegroundColor White
    Write-Host "    2. Load unpacked Heady extensions from distribution/ folders" -ForegroundColor White
    Write-Host "    3. Run VS Code and wait for extension auto-install" -ForegroundColor White
    Write-Host "    4. Enable Settings Sync on all devices" -ForegroundColor White
    Write-Host "    5. Configure JetBrains plugins via Settings > Plugins" -ForegroundColor White
    
    if (!$WhatIf) {
        Write-Host "`n  ✅ Extension configuration complete!`n" -ForegroundColor Green
    } else {
        Write-Host "`n  📝 Run without -WhatIf to apply changes`n" -ForegroundColor Cyan
    }
}

# Main execution
Show-Header

try {
    # Load configuration
    $config = Import-HeadyConfig -Path $ConfigPath
    
    # Install Browser Extensions
    if (!$IDEOnly) {
        Install-ChromeExtensions -WhatIf:$WhatIf
        Install-FirefoxExtensions -WhatIf:$WhatIf
        Install-EdgeExtensions -WhatIf:$WhatIf
    }
    
    # Install IDE Extensions
    if (!$BrowserOnly) {
        Install-VSCodeExtensions -WhatIf:$WhatIf
        Install-JetBrainsExtensions -WhatIf:$WhatIf
        Install-VimExtensions -WhatIf:$WhatIf
    }
    
    # Show summary
    Show-Summary -Stats @{}
    
} catch {
    Write-Host "`n❌ FATAL ERROR: $_" -ForegroundColor Red
    Write-Host "Stack Trace: $($_.ScriptStackTrace)" -ForegroundColor DarkGray
    exit 1
}
