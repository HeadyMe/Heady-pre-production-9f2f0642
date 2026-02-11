# Heady Auto-Rollback System
# Sacred Geometry v3.0

param (
    [Parameter(Mandatory=$true)]
    [string]$DeploymentId,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('me','sys','conn')]
    [string]$Environment = 'me',
    
    [Parameter(Mandatory=$false)]
    [int]$TimeoutMinutes = 10
)

# Import monitoring and pattern modules
try {
    Import-Module $PSScriptRoot\..\src\hc_pattern_engine.psm1
    Import-Module $PSScriptRoot\..\src\hc_monitoring.psm1
} catch {
    Write-Error "Failed to load required modules: $_"
    exit 1
}

# Get deployment details
$deployment = Get-Deployment -Id $DeploymentId
if (-not $deployment) {
    Write-Error "Deployment $DeploymentId not found"
    exit 1
}

# Execute rollback based on deployment type
switch ($deployment.Type) {
    'full' {
        Invoke-FullRollback -Deployment $deployment -Environment $Environment
    }
    'incremental' {
        Invoke-IncrementalRollback -Deployment $deployment -Environment $Environment
    }
    'hotfix' {
        Invoke-HotfixRollback -Deployment $deployment -Environment $Environment
    }
}

# Update monitoring system
Update-Monitoring -Event "rollback_completed" -Details @{
    DeploymentId = $DeploymentId
    Environment = $Environment
    PreviousVersion = $deployment.PreviousVersion
    RollbackDuration = (Get-Date) - $deployment.StartTime
}

# Record in pattern engine
Register-PatternEvent -PatternId 'deployment_rollback' -Context @{
    Deployment = $deployment
    Environment = $Environment
}
