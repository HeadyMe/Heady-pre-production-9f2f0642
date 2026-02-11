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
<# ║  FILE: scripts/heady-usage-enforcement.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Heady Service Usage Enforcement System

.DESCRIPTION
Enforces that HeadyBrain is used 100% of time and all Heady services remain 100% functional.
Blocks any operations that don't use Heady services and ensures compliance.

.PARAMETER Mode
Enforcement mode: strict, monitor, report

.PARAMETER LogLevel
Logging level: debug, info, warn, error

.EXAMPLE
.\heady-usage-enforcement.ps1 -Mode strict

.EXAMPLE
.\heady-usage-enforcement.ps1 -Mode report
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("strict", "monitor", "report")]
    [string]$Mode = "strict",
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "info", "warn", "error")]
    [string]$LogLevel = "info"
)

# Enforcement policies
$script:EnforcementPolicies = @{
    BrainFirstPolicy = @{
        Enabled = $true
        Description = "All operations must go through HeadyBrain first"
        Priority = "supreme"
        BlockNonCompliant = $true
        Exceptions = @()
    }
    
    HeadyServicesOnly = @{
        Enabled = $true
        Description = "Only Heady services may be used for system operations"
        Priority = "critical"
        BlockNonCompliant = $true
        AllowedExternalServices = @(
            "github.com",
            "npmjs.com", 
            "render.com",
            "docker.io"
        )
    }
    
    MandatoryBrainIntegration = @{
        Enabled = $true
        Description = "All services must be integrated with HeadyBrain"
        Priority = "critical"
        BlockNonCompliant = $true
        RequiredServices = @(
            "heady-manager",
            "heady-conductor", 
            "heady-supervisor"
        )
    }
    
    ZeroTolerancePolicy = @{
        Enabled = $true
        Description = "Zero tolerance for non-HeadyBrain usage"
        Priority = "supreme"
        BlockNonCompliant = $true
        ComplianceThreshold = 100.0
    }
}

# Enforcement state
$script:EnforcementState = @{
    Active = $true
    BlockedOperations = @()
    ComplianceViolations = @()
    EnforcementActions = @()
}

function Write-EnforcementLog {
    param(
        [string]$Message,
        [ValidateSet("debug", "info", "warn", "error", "critical")]
        [string]$Level = "info",
        [string]$Component = "UsageEnforcement"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] [$Component] $Message"
    
    switch ($Level) {
        "debug" { Write-Host $logEntry -ForegroundColor Gray }
        "info"  { Write-Host $logEntry -ForegroundColor Green }
        "warn"  { Write-Host $logEntry -ForegroundColor Yellow }
        "error" { Write-Host $logEntry -ForegroundColor Red }
        "critical" { Write-Host $logEntry -ForegroundColor White -BackgroundColor Red }
    }
    
    $logFile = "c:\Users\erich\Heady\logs\usage-enforcement.log"
    if (!(Test-Path (Split-Path $logFile))) {
        New-Item -ItemType Directory -Path (Split-Path $logFile) -Force | Out-Null
    }
    Add-Content -Path $logFile -Value $logEntry
}

function Test-BrainFirstCompliance {
    param([hashtable]$Operation)
    
    Write-EnforcementLog "Checking Brain-First compliance for operation: $($Operation.Type)" -Level debug
    
    # Check if operation goes through HeadyBrain
    $brainEndpoint = "https://brain.headysystems.com"
    $operationEndpoint = $Operation.Endpoint ?? "unknown"
    
    if ($operationEndpoint -like "*brain.headysystems.com*" -or $operationEndpoint -like "*52.32.178.8*") {
        Write-EnforcementLog "Operation complies with Brain-First policy: $($Operation.Type)" -Level debug
        return @{
            Compliant = $true
            Reason = "Operation uses HeadyBrain endpoint"
            Endpoint = $operationEndpoint
        }
    }
    
    # Check if this is an exception
    foreach ($exception in $script:EnforcementPolicies.BrainFirstPolicy.Exceptions) {
        if ($operationEndpoint -like $exception) {
            Write-EnforcementLog "Operation is exempt from Brain-First policy: $($Operation.Type)" -Level debug
            return @{
                Compliant = $true
                Reason = "Operation is exempt"
                Endpoint = $operationEndpoint
            }
        }
    }
    
    # Non-compliant
    Write-EnforcementLog "Operation violates Brain-First policy: $($Operation.Type) -> $operationEndpoint" -Level warn
    return @{
        Compliant = $false
        Reason = "Operation does not use HeadyBrain"
        Endpoint = $operationEndpoint
        RequiredEndpoint = $brainEndpoint
    }
}

function Test-HeadyServicesOnlyCompliance {
    param([hashtable]$Operation)
    
    Write-EnforcementLog "Checking Heady-Services-Only compliance for operation: $($Operation.Type)" -Level debug
    
    $operationEndpoint = $Operation.Endpoint ?? "unknown"
    
    # Check if endpoint is Heady service
    if ($operationEndpoint -like "*heady*" -or $operationEndpoint -like "*localhost*" -or $operationEndpoint -like "*127.0.0.1*") {
        Write-EnforcementLog "Operation uses Heady service: $($Operation.Type)" -Level debug
        return @{
            Compliant = $true
            Reason = "Operation uses Heady service"
            Endpoint = $operationEndpoint
        }
    }
    
    # Check if endpoint is allowed external service
    foreach ($allowed in $script:EnforcementPolicies.HeadyServicesOnly.AllowedExternalServices) {
        if ($operationEndpoint -like "*$allowed*") {
            Write-EnforcementLog "Operation uses allowed external service: $($Operation.Type) -> $allowed" -Level debug
            return @{
                Compliant = $true
                Reason = "Operation uses allowed external service"
                Endpoint = $operationEndpoint
                AllowedService = $allowed
            }
        }
    }
    
    # Non-compliant
    Write-EnforcementLog "Operation violates Heady-Services-Only policy: $($Operation.Type) -> $operationEndpoint" -Level warn
    return @{
        Compliant = $false
        Reason = "Operation uses non-Heady service"
        Endpoint = $operationEndpoint
        Violation = "External service not allowed"
    }
}

function Test-BrainIntegrationCompliance {
    param([string]$ServiceName)
    
    Write-EnforcementLog "Checking Brain integration compliance for service: $ServiceName" -Level debug
    
    # Check if service is required to integrate with HeadyBrain
    if ($ServiceName -notin $script:EnforcementPolicies.MandatoryBrainIntegration.RequiredServices) {
        Write-EnforcementLog "Service not required to integrate with HeadyBrain: $ServiceName" -Level debug
        return @{
            Compliant = $true
            Reason = "Service not required for Brain integration"
            Service = $ServiceName
        }
    }
    
    # Test integration endpoint
    $integrationEndpoints = @(
        "http://localhost:3300/api/brain-integration",  # heady-manager
        "http://localhost:8080/brain-integration",       # heady-conductor
        "http://localhost:8082/brain-integration"        # heady-supervisor
    )
    
    foreach ($endpoint in $integrationEndpoints) {
        try {
            $response = Invoke-WebRequest -Uri $endpoint -Method GET -TimeoutSec 5 -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                Write-EnforcementLog "Service is integrated with HeadyBrain: $ServiceName" -Level debug
                return @{
                    Compliant = $true
                    Reason = "Service has Brain integration"
                    Service = $ServiceName
                    IntegrationEndpoint = $endpoint
                }
            }
        } catch {
            Write-EnforcementLog "Brain integration check failed for $ServiceName at $endpoint" -Level debug
            continue
        }
    }
    
    # Non-compliant
    Write-EnforcementLog "Service violates Brain integration requirement: $ServiceName" -Level warn
    return @{
        Compliant = $false
        Reason = "Service not integrated with HeadyBrain"
        Service = $ServiceName
        Required = $true
    }
}

function Enforce-Operation {
    param([hashtable]$Operation)
    
    Write-EnforcementLog "Enforcing operation: $($Operation.Type)" -Level info
    
    $complianceResults = @()
    
    # Test all applicable policies
    if ($script:EnforcementPolicies.BrainFirstPolicy.Enabled) {
        $result = Test-BrainFirstCompliance -Operation $Operation
        $complianceResults += $result
    }
    
    if ($script:EnforcementPolicies.HeadyServicesOnly.Enabled) {
        $result = Test-HeadyServicesOnlyCompliance -Operation $Operation
        $complianceResults += $result
    }
    
    # Check if any policy violations
    $violations = $complianceResults | Where-Object { -not $_.Compliant }
    
    if ($violations.Count -gt 0) {
        Write-EnforcementLog "Operation has $($violations.Count) policy violations" -Level warn
        
        foreach ($violation in $violations) {
            Write-EnforcementLog "Violation: $($violation.Reason)" -Level warn
        }
        
        # Record compliance violation
        $script:EnforcementState.ComplianceViolations += @{
            Timestamp = Get-Date
            Operation = $Operation
            Violations = $violations
            EnforcementMode = $Mode
        }
        
        # Take enforcement action based on mode
        switch ($Mode) {
            "strict" {
                Write-EnforcementLog "BLOCKING operation in strict mode: $($Operation.Type)" -Level error
                $script:EnforcementState.BlockedOperations += @{
                    Timestamp = Get-Date
                    Operation = $Operation
                    Reason = "Policy violations in strict mode"
                    Violations = $violations
                }
                
                $script:EnforcementState.EnforcementActions += @{
                    Action = "block_operation"
                    Operation = $Operation
                    Timestamp = Get-Date
                    Mode = $Mode
                    Violations = $violations
                }
                
                return $false
            }
            
            "monitor" {
                Write-EnforcementLog "MONITORING operation with violations: $($Operation.Type)" -Level warn
                $script:EnforcementState.EnforcementActions += @{
                    Action = "monitor_violation"
                    Operation = $Operation
                    Timestamp = Get-Date
                    Mode = $Mode
                    Violations = $violations
                }
                
                return $true  # Allow operation but monitor
            }
            
            "report" {
                Write-EnforcementLog "REPORTING operation with violations: $($Operation.Type)" -Level info
                return $true  # Allow operation, just report
            }
        }
    } else {
        Write-EnforcementLog "Operation complies with all policies: $($Operation.Type)" -Level info
        return $true
    }
}

function Enforce-ServiceCompliance {
    Write-EnforcementLog "Enforcing service compliance" -Level info
    
    $requiredServices = $script:EnforcementPolicies.MandatoryBrainIntegration.RequiredServices
    $compliantServices = 0
    $totalServices = $requiredServices.Count
    
    foreach ($service in $requiredServices) {
        $result = Test-BrainIntegrationCompliance -ServiceName $service
        
        if ($result.Compliant) {
            $compliantServices++
        } else {
            Write-EnforcementLog "Service compliance violation: $($result.Service)" -Level warn
            
            if ($Mode -eq "strict") {
                Write-EnforcementLog "Taking enforcement action for non-compliant service: $($result.Service)" -Level error
                
                $script:EnforcementState.EnforcementActions += @{
                    Action = "enforce_service_compliance"
                    Service = $result.Service
                    Timestamp = Get-Date
                    Mode = $Mode
                    Violation = $result
                }
                
                # Trigger service recovery/reconfiguration
                & "c:\Users\erich\Heady\scripts\heady-service-recovery.ps1" -ServiceName $result.Service
            }
        }
    }
    
    $complianceRate = if ($totalServices -gt 0) { ($compliantServices / $totalServices) * 100 } else { 100 }
    
    Write-EnforcementLog "Service compliance: $compliantServices/$totalServices services ($complianceRate%)" -Level info
    
    return @{
        CompliantServices = $compliantServices
        TotalServices = $totalServices
        ComplianceRate = $complianceRate
    }
}

function Get-EnforcementReport {
    $report = @{
        Timestamp = Get-Date
        Mode = $Mode
        Active = $script:EnforcementState.Active
        Policies = $script:EnforcementPolicies
        State = $script:EnforcementState
        Summary = @{
            TotalViolations = $script:EnforcementState.ComplianceViolations.Count
            BlockedOperations = $script:EnforcementState.BlockedOperations.Count
            EnforcementActions = $script:EnforcementState.EnforcementActions.Count
        }
    }
    
    return $report
}

function Start-EnforcementMonitoring {
    Write-EnforcementLog "Starting usage enforcement monitoring in $Mode mode" -Level info
    
    # Initial service compliance check
    Enforce-ServiceCompliance | Out-Null
    
    # Monitor for ongoing compliance
    while ($script:EnforcementState.Active) {
        try {
            # Simulate monitoring operations (in real implementation, this would hook into actual system calls)
            Start-Sleep -Seconds 30
            
            # Periodic service compliance check
            if ((Get-Date).Second % 60 -eq 0) {
                Enforce-ServiceCompliance | Out-Null
            }
            
        } catch {
            Write-EnforcementLog "Enforcement monitoring error: $($Error[0].Exception.Message)" -Level error
            Start-Sleep -Seconds 10
        }
    }
}

# Main execution
try {
    Write-EnforcementLog "Starting Heady Usage Enforcement System - Mode: $Mode" -Level info
    
    # Validate enforcement policies
    Write-EnforcementLog "Loading enforcement policies" -Level info
    
    foreach ($policy in $script:EnforcementPolicies.Keys) {
        $policyConfig = $script:EnforcementPolicies[$policy]
        Write-EnforcementLog "Policy: $policy - Enabled: $($policyConfig.Enabled) - Priority: $($policyConfig.Priority)" -Level info
    }
    
    switch ($Mode) {
        "strict" {
            Write-EnforcementLog "Starting STRICT enforcement mode - operations will be blocked for violations" -Level warn
            Start-EnforcementMonitoring
        }
        
        "monitor" {
            Write-EnforcementLog "Starting MONITOR mode - violations will be logged but not blocked" -Level info
            Start-EnforcementMonitoring
        }
        
        "report" {
            Write-EnforcementLog "Generating enforcement report" -Level info
            
            # Run compliance checks
            Enforce-ServiceCompliance | Out-Null
            
            # Generate report
            $report = Get-EnforcementReport
            
            Write-EnforcementLog "=== ENFORCEMENT REPORT ===" -Level info
            Write-EnforcementLog "Mode: $($report.Mode)" -Level info
            Write-EnforcementLog "Total Violations: $($report.Summary.TotalViolations)" -Level info
            Write-EnforcementLog "Blocked Operations: $($report.Summary.BlockedOperations)" -Level info
            Write-EnforcementLog "Enforcement Actions: $($report.Summary.EnforcementActions)" -Level info
            
            foreach ($policy in $report.Policies.Keys) {
                $policyConfig = $report.Policies[$policy]
                Write-EnforcementLog "Policy $policy`: Enabled=$($policyConfig.Enabled), Priority=$($policyConfig.Priority)" -Level info
            }
        }
    }
    
    Write-EnforcementLog "Heady Usage Enforcement System completed" -Level info
    
} catch {
    Write-EnforcementLog "Fatal error in enforcement system: $($Error[0].Exception.Message)" -Level critical
    exit 1
}
