function Invoke-GlobalDeployment {
    param(
        [Parameter(Mandatory=$true)]
        [ValidateSet('Full','Partial','Rolling')]
        [string]$Mode,
        
        [Parameter(Mandatory=$true)]
        [ValidateRange(1,10)]
        [int]$Concurrency
    )
    
    # Generate unique deployment ID
    $deploymentId = [guid]::NewGuid().ToString()
    
    # Start deployment process
    $job = Start-Job -ScriptBlock {
        param($Mode, $Concurrency, $deploymentId)
        .\hcfp-build.ps1 -Mode $Mode -Concurrency $Concurrency -DeploymentId $deploymentId
    } -ArgumentList $Mode, $Concurrency, $deploymentId
    
    # Return deployment information
    return @{
        DeploymentId = $deploymentId
        JobId = $job.Id
        StartTime = (Get-Date)
    }
}

function Get-GlobalDeploymentStatus {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Id
    )
    
    # Check deployment status
    $status = .\scripts\verify-deployment.ps1 -DeploymentId $Id
    
    # Return status object
    return @{
        DeploymentId = $Id
        Status = $status
        Timestamp = (Get-Date)
    }
}

export-modulemember -function Invoke-GlobalDeployment, Get-GlobalDeploymentStatus
