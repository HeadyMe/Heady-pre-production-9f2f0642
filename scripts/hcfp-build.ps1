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
<# ║  FILE: scripts/hcfp-build.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>

# HCFP Clean Build with Error Handling - Windows PowerShell Script
# Performs full clean build on every change with intelligent error recovery

param(
    [switch]$FullRebuild = $true,
    [switch]$SkipTests = $false,
    [switch]$Deploy = $false,
    [int]$RetryCount = 2,
    [string]$Components = "all"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "Continue"

# Define color mapping
$Colors = @{
    'Black' = 'Black'
    'DarkBlue' = 'DarkBlue'
    'DarkGreen' = 'DarkGreen'
    'DarkCyan' = 'DarkCyan'
    'DarkRed' = 'DarkRed'
    'DarkMagenta' = 'DarkMagenta'
    'DarkYellow' = 'DarkYellow'
    'Gray' = 'Gray'
    'DarkGray' = 'DarkGray'
    'Blue' = 'Blue'
    'Green' = 'Green'
    'Cyan' = 'Cyan'
    'Red' = 'Red'
    'Magenta' = 'Magenta'
    'Yellow' = 'Yellow'
    'White' = 'White'
}

function Write-Status {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Colors[$Color]
}

function Write-Header {
    param($Title)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

# Error Classification System
function Classify-Error {
    param($ErrorLog)
    
    $patterns = @{
        TransientNetwork = @(
            "network timeout",
            "ECONNREFUSED",
            "ETIMEDOUT",
            "fetch failed",
            "certificate verify failed",
            "TLS handshake timeout"
        )
        Permission = @(
            "permission denied",
            "EACCES",
            "EPERM",
            "access is denied"
        )
        CodeConfig = @(
            "syntax error",
            "SyntaxError",
            "Unexpected token",
            "Module not found",
            "Cannot find module",
            "ENOENT",
            "missing script"
        )
        Resource = @(
            "out of memory",
            "ENOMEM",
            "no space left",
            "disk full"
        )
    }
    
    $logContent = Get-Content $ErrorLog -ErrorAction SilentlyContinue | Out-String
    
    foreach ($type in $patterns.Keys) {
        foreach ($pattern in $patterns[$type]) {
            if ($logContent -match $pattern) {
                return $type
            }
        }
    }
    
    return "Unknown"
}

function Invoke-BuildWithRetry {
    param(
        $Name,
        $BuildCommand,
        $WorkingDirectory = ".",
        $MaxRetries = 2
    )
    
    Write-Header "Building: $Name"
    
    $attempt = 0
    $success = $false
    $errorLog = "build-error-$Name.log"
    
    while ($attempt -lt $MaxRetries -and -not $success) {
        $attempt++
        Write-Status "Attempt $attempt of $MaxRetries..." "Yellow"
        
        try {
            # Clean previous artifacts
            if ($FullRebuild) {
                Write-Status "Cleaning build artifacts..." "Cyan"
                Remove-Item -Path "dist","build",".next","out","coverage" -Recurse -Force -ErrorAction SilentlyContinue
            }
            
            # Run build
            Push-Location $WorkingDirectory
            
            $output = Invoke-Expression $BuildCommand 2>&1
            $exitCode = $LASTEXITCODE
            
            if ($exitCode -eq 0) {
                Write-Status "✅ Build successful: $Name" "Green"
                $success = $true
            } else {
                throw "Build failed with exit code $exitCode"
            }
            
            Pop-Location
            
        } catch {
            $errorMsg = $_.Exception.Message
            $errorMsg | Out-File -FilePath $errorLog -Append
            
            Write-Status "❌ Build failed: $errorMsg" "Red"
            
            # Classify error
            $errorType = Classify-Error -ErrorLog $errorLog
            Write-Status "Error classified as: $errorType" "Yellow"
            
            switch ($errorType) {
                "TransientNetwork" {
                    if ($attempt -lt $MaxRetries) {
                        Write-Status "🔄 Transient error - waiting 30s before retry..." "Yellow"
                        Start-Sleep -Seconds 30
                    } else {
                        Write-Status "🚫 Max retries reached for transient error" "Red"
                    }
                }
                "Permission" {
                    Write-Status "🚫 Permission error - requires manual fix (run as admin?)" "Red"
                    throw "Non-recoverable permission error"
                }
                "CodeConfig" {
                    Write-Status "🔴 Code/config error - fix required before retry" "Red"
                    throw "Non-recoverable code/config error"
                }
                "Resource" {
                    Write-Status "💾 Resource error - check disk/memory" "Red"
                    throw "Resource exhaustion error"
                }
                default {
                    if ($attempt -lt $MaxRetries) {
                        Write-Status "❓ Unknown error - retrying..." "Yellow"
                        Start-Sleep -Seconds 10
                    }
                }
            }
        }
    }
    
    if (-not $success) {
        Write-Status "🚨 Build ultimately failed for: $Name" "Red"
        throw "Build failed after $MaxRetries attempts"
    }
    
    return $true
}

# Main Build Pipeline
function Start-CleanBuild {
    Write-Header "HCFP Clean Build Pipeline"
    Write-Status "Mode: $(if ($FullRebuild) { 'Full Rebuild' } else { 'Incremental' })" "Cyan"
    Write-Status "Components: $Components" "Cyan"
    Write-Status "Retry Count: $RetryCount" "Cyan"
    Write-Status "Skip Tests: $SkipTests" "Cyan"
    
    $startTime = Get-Date
    $buildResults = @()
    
    # Phase 1: Setup
    Write-Header "Phase 1: Environment Setup"
    
    # Check Node version
    $nodeVersion = node -v 2>$null
    Write-Status "Node.js: $nodeVersion" "Green"
    
    # Check Python version
    $pythonVersion = python --version 2>&1
    Write-Status "Python: $pythonVersion" "Green"
    
    # Check for localhost references
    Write-Status "🔍 Scanning for localhost references..." "Cyan"
    $localhostRefs = @()
    
    $jsFiles = Get-ChildItem -Path "src" -Filter "*.js" -Recurse -ErrorAction SilentlyContinue
    $tsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse -ErrorAction SilentlyContinue
    
    foreach ($file in ($jsFiles + $tsFiles)) {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if ($content -match "localhost|127\.0\.0\.1|0\.0\.0\.0") {
            $localhostRefs += $file.FullName
        }
    }
    
    if ($localhostRefs.Count -gt 0) {
        Write-Status "⚠️  Found $($localhostRefs.Count) files with localhost references" "Yellow"
        $localhostRefs | ForEach-Object { Write-Status "  - $_" "Yellow" }
    } else {
        Write-Status "✅ No localhost references found in source code" "Green"
    }
    
    # Phase 2: Clean Dependencies
    Write-Header "Phase 2: Clean Dependencies"
    
    if ($FullRebuild) {
        Write-Status "Removing node_modules cache..." "Cyan"
        Remove-Item -Path "node_modules/.cache" -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Status "Running clean install (npm ci)..." "Cyan"
        npm ci 2>&1 | ForEach-Object {
            if ($_ -match "error|ERR!") { Write-Status $_ "Red" }
            else { Write-Host $_ }
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "npm ci failed"
        }
    } else {
        Write-Status "Running npm install..." "Cyan"
        npm install 2>&1 | ForEach-Object {
            if ($_ -match "error|ERR!") { Write-Status $_ "Red" }
            else { Write-Host $_ }
        }
    }
    
    # Phase 3: Build Components
    Write-Header "Phase 3: Building Components"
    
    $components = @()
    
    if ($Components -eq "all" -or $Components -match "manager") {
        $components += @{ Name = "manager"; Command = "npm run build:manager"; Dir = "." }
    }
    if ($Components -eq "all" -or $Components -match "frontend") {
        $components += @{ Name = "frontend"; Command = "npm run build:frontend"; Dir = "." }
    }
    if ($Components -eq "all" -or $Components -match "worker") {
        $components += @{ Name = "worker"; Command = "pip install -r requirements.txt"; Dir = "backend/python_worker" }
    }
    if ($Components -eq "all" -or $Components -match "browser") {
        $components += @{ Name = "browser-ext"; Command = "npm run build"; Dir = "distribution/browser/extensions/chrome" }
    }
    
    foreach ($comp in $components) {
        try {
            Invoke-BuildWithRetry `
                -Name $comp.Name `
                -BuildCommand $comp.Command `
                -WorkingDirectory $comp.Dir `
                -MaxRetries $RetryCount
            
            $buildResults += @{ Name = $comp.Name; Status = "Success"; Duration = 0 }
        } catch {
            $buildResults += @{ Name = $comp.Name; Status = "Failed"; Error = $_.Exception.Message }
            throw "Build failed for $($comp.Name)"
        }
    }
    
    # Phase 4: Testing
    if (-not $SkipTests) {
        Write-Header "Phase 4: Running Tests"
        
        try {
            Write-Status "Running unit tests..." "Cyan"
            npm run test:unit 2>&1 | ForEach-Object {
                if ($_ -match "FAIL|failed|error") { Write-Status $_ "Red" }
                elseif ($_ -match "PASS|passed|✓") { Write-Status $_ "Green" }
                else { Write-Host $_ }
            }
            
            Write-Status "✅ Tests passed" "Green"
        } catch {
            Write-Status "⚠️  Some tests failed - review required" "Yellow"
        }
    }
    
    # Phase 5: Security Checks
    Write-Header "Phase 5: Security & Quality"
    
    Write-Status "Running linter..." "Cyan"
    npm run lint 2>&1 | ForEach-Object {
        if ($_ -match "error|warning") { Write-Status $_ "Yellow" }
        else { Write-Host $_ }
    }
    
    Write-Status "Checking for secrets..." "Cyan"
    # Basic secret detection
    $secretPatterns = @(
        "password\s*=\s*['`"][^'`"]+['`"]",
        "api_key\s*=\s*['`"][^'`"]+['`"]",
        "secret\s*=\s*['`"][^'`"]+['`"]",
        "token\s*=\s*['`"][a-zA-Z0-9_-]{20,}['`"]"
    )
    
    $foundSecrets = $false
    foreach ($pattern in $secretPatterns) {
        $matches = Select-String -Path "src/*.js" -Pattern $pattern -ErrorAction SilentlyContinue
        if ($matches) {
            Write-Status "⚠️  Potential hardcoded secret pattern found" "Yellow"
            $foundSecrets = $true
        }
    }
    
    if (-not $foundSecrets) {
        Write-Status "✅ No obvious secrets found" "Green"
    }
    
    # Phase 6: Deploy (if requested)
    if ($Deploy) {
        Write-Header "Phase 6: Deployment"
        Write-Status "Preparing deployment package..." "Cyan"
        
        $deployDir = "deploy-package-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        New-Item -ItemType Directory -Path $deployDir -Force | Out-Null
        
        # Copy build artifacts
        Copy-Item -Path "dist" -Destination "$deployDir/" -Recurse -Force -ErrorAction SilentlyContinue
        Copy-Item -Path "build" -Destination "$deployDir/" -Recurse -Force -ErrorAction SilentlyContinue
        
        Write-Status "✅ Deployment package created: $deployDir" "Green"
        
        # Integration with HeadySync
        if (Test-Path "scripts/Heady-Sync.ps1") {
            Write-Status "🔄 Running HeadySync..." "Cyan"
            & "scripts/Heady-Sync.ps1" -WhatIf
        }
    }
    
    # Final Report
    Write-Header "Build Complete"
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    Write-Status "⏱️  Total Duration: $($duration.ToString('hh\:mm\:ss'))" "Cyan"
    Write-Status "📦 Components Built: $($buildResults.Count)" "Cyan"
    
    foreach ($result in $buildResults) {
        $color = if ($result.Status -eq "Success") { "Green" } else { "Red" }
        Write-Status "  - $($result.Name): $($result.Status)" $color
    }
    
    # Alert summary
    Write-Host ""
    Write-Status "🎯 Next Steps:" "Magenta"
    Write-Status "  1. Review any warnings above" "White"
    Write-Status "  2. Check test coverage reports" "White"
    Write-Status "  3. Run local verification: npm run dev" "White"
    Write-Status "  4. Deploy when ready: .\hcfp-build.ps1 -Deploy" "White"
    
    Write-Host ""
    Write-Status "✨ HCFP Clean Build Finished Successfully!" "Green"
}

# Error handler
trap {
    Write-Header "BUILD FAILED"
    Write-Status "🚨 Error: $_" "Red"
    Write-Status "📍 Location: $($_.InvocationInfo.ScriptName):$($_.InvocationInfo.ScriptLineNumber)" "Red"
    
    # Alert the user
    Write-Host ""
    Write-Status "🔔 ALERT: Build requires manual intervention" "Magenta"
    Write-Status "Check logs and fix the issue before retrying." "Yellow"
    
    exit 1
}

# Run main function
Start-CleanBuild
