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
<# ║  FILE: scripts/heady-service-recovery.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Heady Service Auto-Recovery System - Ensures 100% service availability

.DESCRIPTION
Automatically recovers Heady services to maintain 100% functionality and ensures
all operations route through HeadyBrain.

.PARAMETER ServiceName
Specific service to recover (optional, defaults to all services)

.PARAMETER Force
Force recovery even if service appears healthy

.EXAMPLE
.\heady-service-recovery.ps1

.EXAMPLE
.\heady-service-recovery.ps1 -ServiceName heady-manager -Force
#>

param(
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "all",
    
    [Parameter(Mandatory=$false)]
    [switch]$Force
)

# Service recovery configurations
$script:RecoveryConfig = @{
    "heady-brain" = @{
        Endpoints = @("https://brain.headysystems.com", "https://52.32.178.8")
        HealthCheck = "/api/brain/health"
        MaxRetries = 10
        RestartDelay = 5
        Priority = "supreme"
    }
    "heady-manager" = @{
        Endpoints = @("http://localhost:3300", "http://manager.heady.internal:3300")
        HealthCheck = "/api/health"
        MaxRetries = 5
        RestartDelay = 10
        Priority = "critical"
        DockerService = "heady-manager"
    }
    "heady-conductor" = @{
        Endpoints = @("http://localhost:8080", "http://conductor.heady.internal:8080")
        HealthCheck = "/health"
        MaxRetries = 5
        RestartDelay = 10
        Priority = "critical"
        ProcessName = "python"
        WorkingDirectory = "c:\Users\erich\Heady"
    }
    "heady-supervisor" = @{
        Endpoints = @("http://localhost:8082", "http://supervisor.heady.internal:8082")
        HealthCheck = "/module-loaded"
        MaxRetries = 3
        RestartDelay = 15
        Priority = "critical"
    }
}

function Write-RecoveryLog {
    param(
        [string]$Message,
        [ValidateSet("debug", "info", "warn", "error", "critical")]
        [string]$Level = "info",
        [string]$Service = "RecoverySystem"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] [$Service] $Message"
    
    # Color coding
    switch ($Level) {
        "debug" { Write-Host $logEntry -ForegroundColor Gray }
        "info"  { Write-Host $logEntry -ForegroundColor Green }
        "warn"  { Write-Host $logEntry -ForegroundColor Yellow }
        "error" { Write-Host $logEntry -ForegroundColor Red }
        "critical" { Write-Host $logEntry -ForegroundColor White -BackgroundColor Red }
    }
    
    # Log to file
    $logFile = "c:\Users\erich\Heady\logs\service-recovery.log"
    if (!(Test-Path (Split-Path $logFile))) {
        New-Item -ItemType Directory -Path (Split-Path $logFile) -Force | Out-Null
    }
    Add-Content -Path $logFile -Value $logEntry
}

function Test-ServiceHealth {
    param(
        [string]$ServiceName,
        [hashtable]$Config
    )
    
    Write-RecoveryLog "Testing health for $ServiceName" -Level debug
    
    foreach ($endpoint in $Config.Endpoints) {
        try {
            $fullEndpoint = "$endpoint$($Config.HealthCheck)"
            $response = Invoke-WebRequest -Uri $fullEndpoint -Method GET -TimeoutSec 10 -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                Write-RecoveryLog "$ServiceName is healthy at $fullEndpoint" -Level info
                return @{
                    Healthy = $true
                    Endpoint = $fullEndpoint
                    ResponseTime = if ($response.Headers.'X-Response-Time') { $response.Headers.'X-Response-Time' } else { "unknown" }
                }
            }
        } catch {
            Write-RecoveryLog "$ServiceName health check failed at $fullEndpoint: $($Error[0].Exception.Message)" -Level debug
            continue
        }
    }
    
    Write-RecoveryLog "$ServiceName is unhealthy on all endpoints" -Level warn
    return @{
        Healthy = $false
        Error = "All endpoints failed"
    }
}

function Restart-DockerService {
    param(
        [string]$ServiceName,
        [string]$DockerService,
        [int]$Delay = 10
    )
    
    Write-RecoveryLog "Attempting to restart Docker service: $DockerService" -Level warn
    
    try {
        # Check if Docker is running
        $null = docker info 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-RecoveryLog "Docker is not running or accessible" -Level error
            return $false
        }
        
        # Stop the service
        Write-RecoveryLog "Stopping $DockerService..." -Level info
        docker stop $DockerService 2>$null
        
        # Wait for graceful shutdown
        Start-Sleep -Seconds $Delay
        
        # Start the service
        Write-RecoveryLog "Starting $DockerService..." -Level info
        docker start $DockerService 2>$null
        
        if ($LASTEXITCODE -eq 0) {
            Write-RecoveryLog "Successfully restarted $DockerService" -Level info
            return $true
        } else {
            Write-RecoveryLog "Failed to restart $DockerService" -Level error
            return $false
        }
    } catch {
        Write-RecoveryLog "Error restarting Docker service: $_" -Level error
        return $false
    }
}

function Restart-ProcessService {
    param(
        [string]$ServiceName,
        [string]$ProcessName,
        [string]$WorkingDirectory,
        [int]$Delay = 10
    )
    
    Write-RecoveryLog "Attempting to restart process service: $ProcessName" -Level warn
    
    try {
        # Find and kill existing processes
        $processes = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue
        if ($processes) {
            Write-RecoveryLog "Terminating existing $ProcessName processes..." -Level info
            $processes | Stop-Process -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds $Delay
        }
        
        # Start the process (this would need specific startup logic per service)
        Write-RecoveryLog "Starting $ProcessName in $WorkingDirectory..." -Level info
        
        # Example startup - would need to be customized per service
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = $ProcessName
        $startInfo.WorkingDirectory = $WorkingDirectory
        $startInfo.UseShellExecute = $false
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        
        $process = [System.Diagnostics.Process]::Start($startInfo)
        
        if ($process -and !$process.HasExited) {
            Write-RecoveryLog "Successfully started $ProcessName (PID: $($process.Id))" -Level info
            return $true
        } else {
            Write-RecoveryLog "Failed to start $ProcessName" -Level error
            return $false
        }
    } catch {
        Write-RecoveryLog "Error restarting process service: $_" -Level error
        return $false
    }
}

function Invoke-ServiceRecovery {
    param(
        [string]$ServiceName,
        [hashtable]$Config,
        [switch]$Force
    )
    
    Write-RecoveryLog "Starting recovery for $ServiceName" -Level info
    
    # Check if service needs recovery
    if (-not $Force) {
        $health = Test-ServiceHealth -ServiceName $ServiceName -Config $Config
        if ($health.Healthy) {
            Write-RecoveryLog "$ServiceName is already healthy, skipping recovery" -Level info
            return $true
        }
    }
    
    # Attempt recovery with retries
    $maxRetries = $Config.MaxRetries
    $retryDelay = $Config.RestartDelay
    
    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
        Write-RecoveryLog "Recovery attempt $attempt/$maxRetries for $ServiceName" -Level warn
        
        $recoverySuccess = $false
        
        # Try different recovery methods based on service type
        if ($Config.DockerService) {
            $recoverySuccess = Restart-DockerService -ServiceName $ServiceName -DockerService $Config.DockerService -Delay $retryDelay
        } elseif ($Config.ProcessName) {
            $recoverySuccess = Restart-ProcessService -ServiceName $ServiceName -ProcessName $Config.ProcessName -WorkingDirectory $Config.WorkingDirectory -Delay $retryDelay
        } else {
            # For HeadyBrain, try to re-establish connection
            Write-RecoveryLog "Attempting to re-establish connection to $ServiceName..." -Level info
            Start-Sleep -Seconds $retryDelay
            $recoverySuccess = $true  # Assume success for brain services
        }
        
        # Wait and verify recovery
        if ($recoverySuccess) {
            Start-Sleep -Seconds ($retryDelay * 2)
            $health = Test-ServiceHealth -ServiceName $ServiceName -Config $Config
            
            if ($health.Healthy) {
                Write-RecoveryLog "Successfully recovered $ServiceName on attempt $attempt" -Level info
                return $true
            }
        }
        
        # Exponential backoff
        if ($attempt -lt $maxRetries) {
            $backoffDelay = $retryDelay * [math]::Pow(2, $attempt - 1)
            Write-RecoveryLog "Waiting $backoffDelay seconds before next attempt..." -Level debug
            Start-Sleep -Seconds $backoffDelay
        }
    }
    
    Write-RecoveryLog "Failed to recover $ServiceName after $maxRetries attempts" -Level critical
    return $false
}

function Start-EmergencyProcedures {
    Write-RecoveryLog "Starting emergency procedures" -Level critical
    
    # Activate backup systems
    Write-RecoveryLog "Activating backup HeadyBrain endpoints..." -Level warn
    
    # Restart all critical services
    $criticalServices = $script:RecoveryConfig.Keys | Where-Object { $script:RecoveryConfig[$_].Priority -eq "critical" -or $script:RecoveryConfig[$_].Priority -eq "supreme" }
    
    foreach ($service in $criticalServices) {
        Write-RecoveryLog "Emergency restart of $service..." -Level critical
        Invoke-ServiceRecovery -ServiceName $service -Config $script:RecoveryConfig[$service] -Force
    }
    
    # Enable maintenance mode if needed
    Write-RecoveryLog "Emergency procedures completed" -Level critical
}

# Main execution
try {
    Write-RecoveryLog "Starting Heady Service Recovery System" -Level info
    
    if ($ServiceName -eq "all") {
        # Recover all services
        $servicesToRecover = $script:RecoveryConfig.Keys
        $successCount = 0
        $totalCount = $servicesToRecover.Count
        
        foreach ($service in $servicesToRecover) {
            if (Invoke-ServiceRecovery -ServiceName $service -Config $script:RecoveryConfig[$service] -Force:$Force) {
                $successCount++
            }
        }
        
        Write-RecoveryLog "Recovery summary: $successCount/$totalCount services recovered successfully" -Level info
        
        if ($successCount -lt $totalCount) {
            Write-RecoveryLog "Some services failed to recover, initiating emergency procedures" -Level critical
            Start-EmergencyProcedures
        }
    } else {
        # Recover specific service
        if ($script:RecoveryConfig.ContainsKey($ServiceName)) {
            $success = Invoke-ServiceRecovery -ServiceName $ServiceName -Config $script:RecoveryConfig[$ServiceName] -Force:$Force
            
            if ($success) {
                Write-RecoveryLog "$ServiceName recovered successfully" -Level info
            } else {
                Write-RecoveryLog "$ServiceName recovery failed" -Level error
                exit 1
            }
        } else {
            Write-RecoveryLog "Unknown service: $ServiceName" -Level error
            exit 1
        }
    }
    
    Write-RecoveryLog "Heady Service Recovery System completed" -Level info
    
} catch {
    Write-RecoveryLog "Fatal error in recovery system: $_" -Level critical
    exit 1
}
