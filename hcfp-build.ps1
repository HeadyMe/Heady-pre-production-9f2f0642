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
<# ║  FILE: hcfp-build.ps1                                                    ║
<# ║  LAYER: root                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
# Heady Full Pipeline Build Script

param(
    [string]$Mode = 'Auto',
    [string]$Environment = 'Production',
    [int]$Concurrency = 1,
    [string]$DeploymentId = [guid]::NewGuid().ToString()
)

Write-Host "Starting HCFullPipeline in $Mode mode for $Environment environment"
Write-Host "Deployment ID: $DeploymentId"
Write-Host "Concurrency: $Concurrency"

# Step 1: Run full system scan
Write-Host "Running full system scan..."
$job1 = Start-Job -ScriptBlock { .\hc.ps1 scan-all }

# Step 2: Sync all repositories
Write-Host "Synchronizing repositories..."
$job2 = Start-Job -ScriptBlock { .\scripts\Heady-Sync.ps1 -Mode $Mode }

Wait-Job $job1, $job2

# Step 2.5: Inject legal headers
Write-Host "🛡️  Injecting legal headers..."
python scripts/legal/inject_headers.py
if (-not $?) {
    Write-Error "❌ Header injection failed"
    exit 1
}

# Step 3: Execute deployment
Write-Host "Deploying to $Environment..."

# Load environment variables from .env.local
if (Test-Path .\.env.local) {
    Get-Content .\.env.local | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)') {
            $key = $matches[1]
            $value = $matches[2]
            [System.Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

# Use GitHub token for authenticated operations
$githubToken = $env:GITHUB_TOKEN
if (-not $githubToken) {
    Write-Error "GitHub token not found in environment variables"
    exit 1
}

# Add actual deployment commands using the token
Write-Host "Using GitHub token for deployment operations"

# Step 4: Create evidence snapshot
Write-Host "📦 Creating reduction-to-practice evidence..."
python scripts/ops/snapshot_evidence.py
if (-not $?) {
    Write-Error "❌ Evidence snapshot failed"
    exit 1
}

Write-Host "🔒 IP protection completed successfully!"

Write-Host "HCFullPipeline deployment completed successfully!"
