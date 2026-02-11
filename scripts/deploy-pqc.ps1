# Heady PQC Deployment Script
# Automates deployment of post-quantum cryptography components

param (
    [string]$Mode = 'full',
    [string]$Env = 'development'
)

# Import Heady utilities
. $PSScriptRoot\Heady-Utils.ps1

function Invoke-PQCDeployment {
    try {
        # Build custom OpenSSL with PQ support
        if ($Mode -in @('full', 'build')) {
            Write-HeadyLog "Building custom OpenSSL with PQ support"
            & $PSScriptRoot\build-pq-openssl.ps1
            Test-ExitCode "OpenSSL build failed"
        }
        
        # Deploy liboqs middleware
        if ($Mode -in @('full', 'middleware')) {
            Write-HeadyLog "Deploying liboqs middleware"
            npm install liboqs
            Copy-Item -Path "$PSScriptRoot\..\src\pqc" -Destination "$PSScriptRoot\..\dist\pqc" -Recurse -Force
            Test-ExitCode "liboqs deployment failed"
        }
        
        # Update HCFullPipeline
        if ($Mode -in @('full', 'config')) {
            Write-HeadyLog "Updating HCFullPipeline configuration"
            & $PSScriptRoot\Update-HCFPConfig.ps1 -PqcEnabled $true
            Test-ExitCode "HCFullPipeline update failed"
        }
        
        Write-HeadyLog "PQC deployment completed successfully" -Color Green
    } catch {
        Write-HeadyLog "PQC deployment failed: $_" -Color Red
        exit 1
    }
}

# Main execution
Invoke-PQCDeployment
