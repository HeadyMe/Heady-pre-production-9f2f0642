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
<# ║  FILE: scripts/hc-infrastructure-setup.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Heady Complete Infrastructure Setup (HCIS) - Domain migration and device provisioning
.DESCRIPTION
    Systematically replaces localhost with service domains and provisions all devices
    with consistent configuration. Clean build on every change with error alerting.
.PARAMETER Mode
    Operation mode: inventory, migrate, provision, full-setup
.PARAMETER Environment
    Target environment: local, staging, production
.EXAMPLE
    .\hc-infrastructure-setup.ps1 -Mode full-setup -Environment local
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("inventory", "migrate", "provision", "full-setup", "clean-build")]
    [string]$Mode,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("local", "staging", "production")]
    [string]$Environment = "local",
    
    [switch]$Force,
    [switch]$WhatIf
)

# Error handling - DON'T auto-rebuild, alert instead
$ErrorActionPreference = "Stop"
$ErrorAlertWebhook = $env:HEADY_ALERT_WEBHOOK  # Set this to get alerts

function Send-ErrorAlert {
    param([string]$ErrorMessage, [string]$Context)
    
    if ($ErrorAlertWebhook) {
        $payload = @{
            text = "🚨 Heady Infrastructure Setup Error"
            blocks = @(
                @{
                    type = "section"
                    text = @{ type = "mrkdwn"; text = "*Error in:* $Context" }
                },
                @{
                    type = "section"
                    text = @{ type = "mrkdwn"; text = "````$ErrorMessage````" }
                },
                @{
                    type = "section"
                    text = @{ type = "mrkdwn"; text = "*Action Required:* Manual intervention needed. Check logs and fix issue before retry." }
                }
            )
        } | ConvertTo-Json -Depth 10
        
        try {
            Invoke-RestMethod -Uri $ErrorAlertWebhook -Method Post -Body $payload -ContentType "application/json"
        } catch {
            Write-Host "Failed to send alert: $_" -ForegroundColor Yellow
        }
    }
    
    # Also show local notification
    if ($IsWindows) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show(
            "Infrastructure setup error: $ErrorMessage`n`nContext: $Context",
            "Heady Setup Alert",
            "OK",
            "Error"
        )
    }
}

try {
    Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║     Heady Complete Infrastructure Setup (HCIS)               ║" -ForegroundColor Cyan
    Write-Host "║     Mode: $Mode | Environment: $Environment                     ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""

    # ============================================================================
    # MODE 1: INVENTORY - Find all localhost references
    # ============================================================================
    if ($Mode -eq "inventory") {
        Write-Host "📋 INVENTORY MODE: Scanning for localhost references..." -ForegroundColor Yellow
        
        $patterns = @(
            "localhost",
            "127\.0\.0\.1",
            "0\.0\.0\.0",
            "::1"
        )
        
        $fileTypes = @("*.js", "*.json", "*.yaml", "*.yml", "*.md", "*.ps1", "*.sh", "*.env*")
        $inventory = @()
        
        foreach ($type in $fileTypes) {
            $files = Get-ChildItem -Path . -Filter $type -Recurse -ErrorAction SilentlyContinue | 
                     Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*.git*" }
            
            foreach ($file in $files) {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                if ($content) {
                    foreach ($pattern in $patterns) {
                        $matches = [regex]::Matches($content, $pattern)
                        if ($matches.Count -gt 0) {
                            $context = @()
                            $lines = $content -split "`n"
                            for ($i = 0; $i -lt $lines.Count; $i++) {
                                if ($lines[$i] -match $pattern) {
                                    $start = [Math]::Max(0, $i - 1)
                                    $end = [Math]::Min($lines.Count - 1, $i + 1)
                                    $context += "Lines $($start+1)-$($end+1):`n" + ($lines[$start..$end] -join "`n")
                                }
                            }
                            
                            $inventory += [PSCustomObject]@{
                                File = $file.FullName
                                Pattern = $pattern
                                Matches = $matches.Count
                                Context = ($context -join "`n---`n").Substring(0, [Math]::Min(200, ($context -join "`n---`n").Length))
                                Service = "Unknown"
                                Port = "Unknown"
                            }
                        }
                    }
                }
            }
        }
        
        # Display inventory
        Write-Host "`nFound $($inventory.Count) localhost references:`" -ForegroundColor Green
        $inventory | Format-Table File, Pattern, Matches -AutoSize
        
        # Export to CSV
        $csvPath = "localhost-inventory-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
        $inventory | Export-Csv $csvPath -NoTypeInformation
        Write-Host "`n📁 Inventory exported to: $csvPath" -ForegroundColor Green
        
        # Suggest replacements
        Write-Host "`n🔄 Suggested domain replacements:" -ForegroundColor Cyan
        Write-Host "  localhost:3300  →  manager.heady.local" -ForegroundColor Gray
        Write-Host "  localhost:5000  →  worker.heady.local" -ForegroundColor Gray
        Write-Host "  localhost:3000  →  dashboard.heady.local" -ForegroundColor Gray
        Write-Host "  localhost:8080  →  www.heady.local" -ForegroundColor Gray
        Write-Host "  localhost:6379  →  cache.heady.local" -ForegroundColor Gray
        Write-Host "  localhost:5432  →  db.heady.local" -ForegroundColor Gray
    }

    # ============================================================================
    # MODE 2: MIGRATE - Replace localhost with domains
    # ============================================================================
    elseif ($Mode -eq "migrate") {
        Write-Host "🔄 MIGRATE MODE: Replacing localhost with service domains..." -ForegroundColor Yellow
        
        if (-not $Force) {
            $confirm = Read-Host "This will modify files. Are you sure? (yes/no)"
            if ($confirm -ne "yes") { exit }
        }
        
        # Load domain mappings from config
        $mappings = @{
            "http://localhost:3300" = "http://manager.heady.local:3300"
            "https://localhost:3300" = "https://manager.heady.local:3300"
            "http://127.0.0.1:3300" = "http://manager.heady.local:3300"
            "http://localhost:5000" = "http://worker.heady.local:5000"
            "http://localhost:3000" = "http://dashboard.heady.local:3000"
            "http://localhost:8080" = "http://www.heady.local:8080"
            "redis://localhost:6379" = "redis://cache.heady.local:6379"
            "postgresql://localhost:5432" = "postgresql://db.heady.local:5432"
            "ws://localhost:3300" = "ws://manager.heady.local:3300"
            "wss://localhost:3300" = "wss://manager.heady.local:3300"
            "localhost:3300" = "manager.heady.local:3300"
            "localhost:5000" = "worker.heady.local:5000"
            "localhost:3000" = "dashboard.heady.local:3000"
            "localhost:8080" = "www.heady.local:8080"
            "localhost:6379" = "cache.heady.local:6379"
            "localhost:5432" = "db.heady.local:5432"
        }
        
        $modified = 0
        $fileTypes = @("*.js", "*.json", "*.yaml", "*.yml", "*.md", "*.ps1", "*.sh", "*.env*")
        
        foreach ($type in $fileTypes) {
            $files = Get-ChildItem -Path . -Filter $type -Recurse -ErrorAction SilentlyContinue |
                     Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*.git*" }
            
            foreach ($file in $files) {
                $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
                $original = $content
                
                if ($content) {
                    foreach ($old in $mappings.Keys) {
                        $content = $content -replace [regex]::Escape($old), $mappings[$old]
                    }
                    
                    if ($content -ne $original) {
                        if (-not $WhatIf) {
                            Set-Content -Path $file.FullName -Value $content -NoNewline
                        }
                        Write-Host "  ✓ Modified: $($file.FullName)" -ForegroundColor Green
                        $modified++
                    }
                }
            }
        }
        
        Write-Host "`n📊 Modified $modified files" -ForegroundColor Green
        
        # Update hosts file
        Write-Host "`n📝 Updating hosts file..." -ForegroundColor Yellow
        $hostsEntries = @"
# Heady Service Domains - Auto-generated
127.0.0.1 manager.heady.local
127.0.0.1 worker.heady.local
127.0.0.1 dashboard.heady.local
127.0.0.1 www.heady.local
127.0.0.1 api.heady.local
127.0.0.1 cache.heady.local
127.0.0.1 db.heady.local
127.0.0.1 metrics.heady.local
127.0.0.1 grafana.heady.local
127.0.0.1 imagination.heady.local
127.0.0.1 traces.heady.local
127.0.0.1 alerts.heady.local
::1 manager.heady.local
::1 worker.heady.local
"@
        
        if ($IsWindows) {
            $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
        } else {
            $hostsPath = "/etc/hosts"
        }
        
        if (-not $WhatIf) {
            # Backup original
            Copy-Item $hostsPath "$hostsPath.backup.$(Get-Date -Format 'yyyyMMdd')" -ErrorAction SilentlyContinue
            
            # Remove old entries
            $currentHosts = Get-Content $hostsPath | Where-Object { $_ -notmatch "# Heady Service Domains" -and $_ -notmatch "\.heady\.local" }
            
            # Add new entries
            $newHosts = $currentHosts -join "`n"
            $newHosts += "`n`n$hostsEntries"
            Set-Content -Path $hostsPath -Value $newHosts
        }
        
        Write-Host "  ✓ Hosts file updated: $hostsPath" -ForegroundColor Green
        Write-Host "`n⚠️  You may need to flush DNS: ipconfig /flushdns (Windows) or sudo killall -HUP mDNSResponder (macOS)" -ForegroundColor Yellow
    }

    # ============================================================================
    # MODE 3: PROVISION - Set up device with all extensions/configs
    # ============================================================================
    elseif ($Mode -eq "provision") {
        Write-Host "🔧 PROVISION MODE: Setting up device..." -ForegroundColor Yellow
        
        # Install package managers
        if ($IsWindows) {
            Write-Host "Installing Chocolatey..." -ForegroundColor Cyan
            if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
                Set-ExecutionPolicy Bypass -Scope Process -Force
                [System.Net.ServicePointManager]::SecurityProtocol = 3072
                Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
            }
            
            # Install base packages
            $packages = @("git", "nodejs", "python", "docker-desktop", "vscode", "1password", "slack", "discord", "firefox", "googlechrome")
            foreach ($pkg in $packages) {
                Write-Host "Installing $pkg..." -ForegroundColor Gray
                choco install $pkg -y --no-progress
            }
        }
        elseif ($IsMacOS) {
            Write-Host "Installing Homebrew..." -ForegroundColor Cyan
            if (-not (Get-Command brew -ErrorAction SilentlyContinue)) {
                /bin/bash -c "`$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            }
            
            $packages = @("git", "node", "python@3.12", "docker", "visual-studio-code", "1password", "slack", "discord", "firefox", "google-chrome")
            foreach ($pkg in $packages) {
                Write-Host "Installing $pkg..." -ForegroundColor Gray
                brew install $pkg 2>$null || brew install --cask $pkg
            }
        }
        else {
            Write-Host "Linux detected - using apt..." -ForegroundColor Cyan
            sudo apt-get update
            sudo apt-get install -y git nodejs npm python3 python3-pip docker.io
        }
        
        # Install VS Code extensions
        Write-Host "`nInstalling VS Code extensions..." -ForegroundColor Cyan
        $vscodeExts = @(
            "ms-vscode.vscode-typescript-next",
            "ms-python.python",
            "dbaeumer.vscode-eslint",
            "esbenp.prettier-vscode",
            "ms-vscode.vscode-yaml",
            "github.copilot",
            "github.copilot-chat",
            "ms-azuretools.vscode-docker",
            "eamodio.gitlens"
        )
        
        foreach ($ext in $vscodeExts) {
            Write-Host "  Installing $ext..." -ForegroundColor Gray
            code --install-extension $ext --force 2>$null
        }
        
        # Install Chrome extensions (requires manual step)
        Write-Host "`n🌐 Chrome Extensions to manually install:" -ForegroundColor Yellow
        Write-Host "  1. React Developer Tools: chrome.google.com/webstore/detail/fmkadmapgofadopljbjfkapdkoienihi"
        Write-Host "  2. Redux DevTools: chrome.google.com/webstore/detail/lmhkpmbekcpmknklioeibfkpmmfibljd"
        Write-Host "  3. Wappalyzer: chrome.google.com/webstore/detail/cjbacpjgakmemgfjfhgnhifnidbeole"
        Write-Host "  4. Heady Companion: Load unpacked from distribution/browser/extensions/chrome/"
        
        # Configure hosts file
        Write-Host "`n📝 Configuring hosts file..." -ForegroundColor Cyan
        & $MyInvocation.MyCommand.Path -Mode migrate -WhatIf:$WhatIf -Force
        
        # Configure Git
        Write-Host "`n🔧 Configuring Git..." -ForegroundColor Cyan
        git config --global init.defaultBranch main
        git config --global pull.rebase true
        git config --global core.editor "code --wait"
        
        # Setup complete
        Write-Host "`n✅ Device provisioning complete!" -ForegroundColor Green
        Write-Host "`nNext steps:" -ForegroundColor Yellow
        Write-Host "  1. Sign into 1Password and set up 2FA"
        Write-Host "  2. Join Tailscale network: tailscale up"
        Write-Host "  3. Clone Heady repository"
        Write-Host "  4. Run: npm install && npm run dev"
    }

    # ============================================================================
    # MODE 4: CLEAN-BUILD - Full clean build with error alerting
    # ============================================================================
    elseif ($Mode -eq "clean-build") {
        Write-Host "🏗️ CLEAN-BUILD MODE: Building from scratch..." -ForegroundColor Yellow
        
        $buildSteps = @(
            @{ Name = "Clean Environment"; Command = { 
                Remove-Item -Path "node_modules", "dist", ".heady_cache" -Recurse -Force -ErrorAction SilentlyContinue
                npm cache clean --force 2>$null
            }},
            @{ Name = "Install Dependencies"; Command = { npm ci }},
            @{ Name = "Lint Code"; Command = { npm run lint }},
            @{ Name = "Run Tests"; Command = { npm test }},
            @{ Name = "Build Application"; Command = { npm run build }},
            @{ Name = "Verify Artifacts"; Command = { 
                if (-not (Test-Path "dist")) { throw "Build artifacts not found" }
            }}
        )
        
        $stepNum = 0
        foreach ($step in $buildSteps) {
            $stepNum++
            Write-Host "`n[$stepNum/$($buildSteps.Count)] $($step.Name)..." -ForegroundColor Cyan
            
            try {
                & $step.Command
                Write-Host "  ✓ $($step.Name) completed" -ForegroundColor Green
            }
            catch {
                $errorMsg = $_.Exception.Message
                Write-Host "  ❌ $($step.Name) failed: $errorMsg" -ForegroundColor Red
                
                # DON'T auto-rebuild - ALERT instead
                Send-ErrorAlert -ErrorMessage $errorMsg -Context "$($step.Name) in clean build"
                
                Write-Host "`n⚠️ Build failed. Manual intervention required." -ForegroundColor Red
                Write-Host "Review the error above, fix the issue, then re-run:" -ForegroundColor Yellow
                Write-Host "  .\hc-infrastructure-setup.ps1 -Mode clean-build" -ForegroundColor Cyan
                exit 1
            }
        }
        
        Write-Host "`n✅ Clean build completed successfully!" -ForegroundColor Green
        Write-Host "Build artifacts are in ./dist/" -ForegroundColor Gray
    }

    # ============================================================================
    # MODE 5: FULL-SETUP - Everything
    # ============================================================================
    elseif ($Mode -eq "full-setup") {
        Write-Host "🚀 FULL-SETUP MODE: Running complete infrastructure setup..." -ForegroundColor Yellow
        
        & $MyInvocation.MyCommand.Path -Mode inventory
        & $MyInvocation.MyCommand.Path -Mode migrate -Force:$Force
        & $MyInvocation.MyCommand.Path -Mode provision -Force:$Force
        & $MyInvocation.MyCommand.Path -Mode clean-build
        
        Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Green
        Write-Host "║     ✅ FULL SETUP COMPLETE                                  ║" -ForegroundColor Green
        Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Green
        Write-Host "`nYour device is now configured with:" -ForegroundColor White
        Write-Host "  • Service domains (manager.heady.local, etc.)" -ForegroundColor Gray
        Write-Host "  • All required applications" -ForegroundColor Gray
        Write-Host "  • VS Code + extensions" -ForegroundColor Gray
        Write-Host "  • Clean build verified" -ForegroundColor Gray
        Write-Host "`nServices accessible at:" -ForegroundColor Yellow
        Write-Host "  • Manager: http://manager.heady.local:3300" -ForegroundColor Cyan
        Write-Host "  • Dashboard: http://dashboard.heady.local:3000" -ForegroundColor Cyan
        Write-Host "  • API: http://api.heady.local" -ForegroundColor Cyan
    }

    # ============================================================================
    # MODE 6: PQC-DEPLOY - Post-Quantum Cryptography Deployment
    # ============================================================================
    elseif ($Mode -eq "pqc-deploy") {
        Write-Host "Starting Post-Quantum Cryptography Deployment" -ForegroundColor Cyan
        
        # Initialize PKI
        if (-not (Test-Path "$PSScriptRoot/../configs/pki/scripts/init-ca.sh")) {
            throw "PQC initialization script not found"
        }
        
        # Generate certificates
        $services = @("api", "manager", "nginx", "worker", "db")
        foreach ($service in $services) {
            $domain = "$service.headysystems.com"
            Write-Host "Generating certificate for $domain"
            & "$PSScriptRoot/../configs/pki/scripts/issue-cert.sh" server $domain
        }
        
        # Deploy configurations
        Write-Host "Updating Nginx configurations"
        Copy-Item "$PSScriptRoot/../configs/nginx/mtls.conf" "/etc/nginx/conf.d/" -Force
        nginx -t
        systemctl reload nginx
        
        Write-Host "PQC deployment complete" -ForegroundColor Green
    }

    Write-Host "`nDone!" -ForegroundColor Green
}
catch {
    $errorMsg = $_.Exception.Message
    $context = "HCIS-$Mode"
    
    Write-Host "`n❌ FATAL ERROR: $errorMsg" -ForegroundColor Red
    
    # Send alert - don't auto-rebuild
    Send-ErrorAlert -ErrorMessage $errorMsg -Context $context
    
    exit 1
}
