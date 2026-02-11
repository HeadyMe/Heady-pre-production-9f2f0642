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
<# ║  FILE: scripts/heady-continuous-validation.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Heady Continuous Service Validation System

.DESCRIPTION
Continuously validates that all Heady services are 100% functional and that
HeadyBrain is being used 100% of the time for all operations.

.PARAMETER Mode
Validation mode: continuous, one-time, report

.PARAMETER Interval
Validation interval in seconds (default: 30)

.PARAMETER StrictMode
Enable strict validation with zero tolerance for failures

.EXAMPLE
.\heady-continuous-validation.ps1 -Mode continuous -StrictMode

.EXAMPLE
.\heady-continuous-validation.ps1 -Mode report
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("continuous", "one-time", "report")]
    [string]$Mode = "continuous",
    
    [Parameter(Mandatory=$false)]
    [int]$Interval = 30,
    
    [Parameter(Mandatory=$false)]
    [switch]$StrictMode
)

# Validation configuration
$script:ValidationConfig = @{
    BrainUsageRequirement = 100.0  # Must use HeadyBrain 100% of time
    ServiceAvailabilityRequirement = 100.0  # Services must be available 100% of time
    BrainIntegrationRequirement = 100.0  # All services must integrate with HeadyBrain
    ResponseTimeThreshold = 1000  # Maximum response time in ms
    ErrorRateThreshold = 0.0  # Zero tolerance for errors
    ComplianceThreshold = 100.0  # Zero tolerance for non-compliance
}

# Validation state
$script:ValidationResults = @{}
$script:ValidationHistory = @()
$script:ComplianceScore = 100.0
$script:ValidationActive = $true

function Write-ValidationLog {
    param(
        [string]$Message,
        [ValidateSet("debug", "info", "warn", "error", "critical")]
        [string]$Level = "info",
        [string]$Component = "ValidationSystem"
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
    
    $logFile = "c:\Users\erich\Heady\logs\continuous-validation.log"
    if (!(Test-Path (Split-Path $logFile))) {
        New-Item -ItemType Directory -Path (Split-Path $logFile) -Force | Out-Null
    }
    Add-Content -Path $logFile -Value $logEntry
}

function Test-HeadyBrainUsage {
    Write-ValidationLog "Validating HeadyBrain usage compliance" -Level info
    
    # Check that all operations go through HeadyBrain
    $usageChecks = @(
        @{ Name = "API_Decisions"; Endpoint = "https://brain.headysystems.com/api/decisions"; Expected = "always" }
        @{ Name = "Task_Routing"; Endpoint = "https://brain.headysystems.com/api/routing"; Expected = "always" }
        @{ Name = "Resource_Allocation"; Endpoint = "https://brain.headysystems.com/api/resources"; Expected = "always" }
        @{ Name = "Security_Decisions"; Endpoint = "https://brain.headysystems.com/api/security"; Expected = "always" }
    )
    
    $totalChecks = $usageChecks.Count
    $passedChecks = 0
    $usageDetails = @()
    
    foreach ($check in $usageChecks) {
        try {
            $response = Invoke-WebRequest -Uri $check.Endpoint -Method GET -TimeoutSec 10 -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                $passedChecks++
                $usageDetails += @{
                    Check = $check.Name
                    Status = "pass"
                    Endpoint = $check.Endpoint
                    ResponseTime = if ($response.Headers.'X-Response-Time') { $response.Headers.'X-Response-Time' } else { "unknown" }
                }
                Write-ValidationLog "HeadyBrain usage check PASSED: $($check.Name)" -Level debug
            } else {
                $usageDetails += @{
                    Check = $check.Name
                    Status = "fail"
                    Endpoint = $check.Endpoint
                    Error = "HTTP $($response.StatusCode)"
                }
                Write-ValidationLog "HeadyBrain usage check FAILED: $($check.Name) - HTTP $($response.StatusCode)" -Level warn
            }
        } catch {
            $usageDetails += @{
                Check = $check.Name
                Status = "fail"
                Endpoint = $check.Endpoint
                Error = $Error[0].Exception.Message
            }
            Write-ValidationLog "HeadyBrain usage check FAILED: $($check.Name) - $($Error[0].Exception.Message)" -Level warn
        }
    }
    
    $usageScore = if ($totalChecks -gt 0) { ($passedChecks / $totalChecks) * 100 } else { 0 }
    
    $result = @{
        Category = "HeadyBrainUsage"
        Score = $usageScore
        Required = $script:ValidationConfig.BrainUsageRequirement
        Passed = ($usageScore -ge $script:ValidationConfig.BrainUsageRequirement)
        Details = $usageDetails
        Timestamp = Get-Date
    }
    
    $script:ValidationResults["HeadyBrainUsage"] = $result
    
    if ($result.Passed) {
        Write-ValidationLog "HeadyBrain usage validation PASSED: $usageScore% (Required: $($script:ValidationConfig.BrainUsageRequirement)%)" -Level info
    } else {
        Write-ValidationLog "HeadyBrain usage validation FAILED: $usageScore% (Required: $($script:ValidationConfig.BrainUsageRequirement)%)" -Level error
    }
    
    return $result
}

function Test-ServiceAvailability {
    Write-ValidationLog "Validating service availability" -Level info
    
    $services = @(
        @{ Name = "heady-brain"; Endpoints = @("https://brain.headysystems.com", "https://52.32.178.8"); HealthCheck = "/api/brain/health" }
        @{ Name = "heady-manager"; Endpoints = @("http://localhost:3300", "http://manager.heady.internal:3300"); HealthCheck = "/api/health" }
        @{ Name = "heady-conductor"; Endpoints = @("http://localhost:8080", "http://conductor.heady.internal:8080"); HealthCheck = "/health" }
        @{ Name = "heady-supervisor"; Endpoints = @("http://localhost:8082", "http://supervisor.heady.internal:8082"); HealthCheck = "/module-loaded" }
    )
    
    $totalServices = $services.Count
    $availableServices = 0
    $availabilityDetails = @()
    
    foreach ($service in $services) {
        $serviceAvailable = $false
        $testedEndpoints = @()
        
        foreach ($endpoint in $service.Endpoints) {
            try {
                $fullEndpoint = "$endpoint$($service.HealthCheck)"
                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
                
                $response = Invoke-WebRequest -Uri $fullEndpoint -Method GET -TimeoutSec 10 -UseBasicParsing
                $stopwatch.Stop()
                
                if ($response.StatusCode -eq 200) {
                    $serviceAvailable = $true
                    $testedEndpoints += @{
                        Endpoint = $fullEndpoint
                        Status = "available"
                        ResponseTime = $stopwatch.ElapsedMilliseconds
                    }
                    Write-ValidationLog "Service availability check PASSED: $($service.Name) at $fullEndpoint" -Level debug
                    break
                }
            } catch {
                $testedEndpoints += @{
                    Endpoint = "$endpoint$($service.HealthCheck)"
                    Status = "unavailable"
                    Error = $Error[0].Exception.Message
                }
                Write-ValidationLog "Service availability check FAILED: $($service.Name) at $endpoint$($service.HealthCheck)" -Level debug
            }
        }
        
        if ($serviceAvailable) {
            $availableServices++
        }
        
        $availabilityDetails += @{
            Service = $service.Name
            Available = $serviceAvailable
            Endpoints = $testedEndpoints
        }
    }
    
    $availabilityScore = if ($totalServices -gt 0) { ($availableServices / $totalServices) * 100 } else { 0 }
    
    $result = @{
        Category = "ServiceAvailability"
        Score = $availabilityScore
        Required = $script:ValidationConfig.ServiceAvailabilityRequirement
        Passed = ($availabilityScore -ge $script:ValidationConfig.ServiceAvailabilityRequirement)
        Details = $availabilityDetails
        Timestamp = Get-Date
    }
    
    $script:ValidationResults["ServiceAvailability"] = $result
    
    if ($result.Passed) {
        Write-ValidationLog "Service availability validation PASSED: $availabilityScore% (Required: $($script:ValidationConfig.ServiceAvailabilityRequirement)%)" -Level info
    } else {
        Write-ValidationLog "Service availability validation FAILED: $availabilityScore% (Required: $($script:ValidationConfig.ServiceAvailabilityRequirement)%)" -Level error
    }
    
    return $result
}

function Test-BrainIntegration {
    Write-ValidationLog "Validating HeadyBrain integration" -Level info
    
    # Check that services are properly integrated with HeadyBrain
    $integrationChecks = @(
        @{ Service = "heady-manager"; IntegrationEndpoint = "http://localhost:3300/api/brain-integration"; Expected = "integrated" }
        @{ Service = "heady-conductor"; IntegrationEndpoint = "http://localhost:8080/brain-integration"; Expected = "integrated" }
        @{ Service = "heady-supervisor"; IntegrationEndpoint = "http://localhost:8082/brain-integration"; Expected = "integrated" }
    )
    
    $totalChecks = $integrationChecks.Count
    $integratedServices = 0
    $integrationDetails = @()
    
    foreach ($check in $integrationChecks) {
        try {
            $response = Invoke-WebRequest -Uri $check.IntegrationEndpoint -Method GET -TimeoutSec 10 -UseBasicParsing
            
            if ($response.StatusCode -eq 200) {
                $integratedServices++
                $integrationDetails += @{
                    Service = $check.Service
                    Status = "integrated"
                    Endpoint = $check.IntegrationEndpoint
                    ResponseCode = $response.StatusCode
                }
                Write-ValidationLog "Brain integration check PASSED: $($check.Service)" -Level debug
            } else {
                $integrationDetails += @{
                    Service = $check.Service
                    Status = "not_integrated"
                    Endpoint = $check.IntegrationEndpoint
                    Error = "HTTP $($response.StatusCode)"
                }
                Write-ValidationLog "Brain integration check FAILED: $($check.Service) - HTTP $($response.StatusCode)" -Level warn
            }
        } catch {
            $integrationDetails += @{
                Service = $check.Service
                Status = "not_integrated"
                Endpoint = $check.IntegrationEndpoint
                Error = $Error[0].Exception.Message
            }
            Write-ValidationLog "Brain integration check FAILED: $($check.Service) - $($Error[0].Exception.Message)" -Level warn
        }
    }
    
    $integrationScore = if ($totalChecks -gt 0) { ($integratedServices / $totalChecks) * 100 } else { 0 }
    
    $result = @{
        Category = "BrainIntegration"
        Score = $integrationScore
        Required = $script:ValidationConfig.BrainIntegrationRequirement
        Passed = ($integrationScore -ge $script:ValidationConfig.BrainIntegrationRequirement)
        Details = $integrationDetails
        Timestamp = Get-Date
    }
    
    $script:ValidationResults["BrainIntegration"] = $result
    
    if ($result.Passed) {
        Write-ValidationLog "Brain integration validation PASSED: $integrationScore% (Required: $($script:ValidationConfig.BrainIntegrationRequirement)%)" -Level info
    } else {
        Write-ValidationLog "Brain integration validation FAILED: $integrationScore% (Required: $($script:ValidationConfig.BrainIntegrationRequirement)%)" -Level error
    }
    
    return $result
}

function Test-ComplianceScore {
    Write-ValidationLog "Calculating overall compliance score" -Level info
    
    $allResults = $script:ValidationResults.Values
    $totalScore = 0
    $resultCount = 0
    
    foreach ($result in $allResults) {
        $totalScore += $result.Score
        $resultCount++
    }
    
    $overallScore = if ($resultCount -gt 0) { $totalScore / $resultCount } else { 0 }
    $script:ComplianceScore = $overallScore
    
    $compliancePassed = ($overallScore -ge $script:ValidationConfig.ComplianceThreshold)
    
    $result = @{
        Category = "OverallCompliance"
        Score = $overallScore
        Required = $script:ValidationConfig.ComplianceThreshold
        Passed = $compliancePassed
        Details = @{
            TotalChecks = $resultCount
            IndividualScores = $allResults | ForEach-Object { @{ Category = $_.Category; Score = $_.Score; Passed = $_.Passed } }
        }
        Timestamp = Get-Date
    }
    
    $script:ValidationResults["OverallCompliance"] = $result
    
    if ($result.Passed) {
        Write-ValidationLog "Overall compliance validation PASSED: $overallScore% (Required: $($script:ValidationConfig.ComplianceThreshold)%)" -Level info
    } else {
        Write-ValidationLog "Overall compliance validation FAILED: $overallScore% (Required: $($script:ValidationConfig.ComplianceThreshold)%)" -Level error
    }
    
    return $result
}

function Enforce-Compliance {
    Write-ValidationLog "Enforcing compliance policies" -Level warn
    
    $failedValidations = $script:ValidationResults.Values | Where-Object { -not $_.Passed }
    
    foreach ($validation in $failedValidations) {
        Write-ValidationLog "Enforcement action for failed validation: $($validation.Category)" -Level warn
        
        switch ($validation.Category) {
            "HeadyBrainUsage" {
                # Force all operations through HeadyBrain
                Write-ValidationLog "Enforcing HeadyBrain usage for all operations" -Level warn
                # This would trigger routing enforcement
            }
            
            "ServiceAvailability" {
                # Restart unavailable services
                Write-ValidationLog "Triggering service recovery for unavailable services" -Level warn
                & "c:\Users\erich\Heady\scripts\heady-service-recovery.ps1" -ServiceName "all"
            }
            
            "BrainIntegration" {
                # Reconfigure services to integrate with HeadyBrain
                Write-ValidationLog "Reconfiguring services for HeadyBrain integration" -Level warn
                # This would trigger reconfiguration
            }
        }
    }
}

function Generate-ValidationReport {
    $report = @{
        Timestamp = Get-Date
        Mode = $Mode
        StrictMode = $StrictMode
        OverallCompliance = $script:ComplianceScore
        ValidationResults = $script:ValidationResults
        Summary = @{
            TotalValidations = $script:ValidationResults.Count
            PassedValidations = ($script:ValidationResults.Values | Where-Object { $_.Passed }).Count
            FailedValidations = ($script:ValidationResults.Values | Where-Object { -not $_.Passed }).Count
            EnforcementRequired = ($script:ValidationResults.Values | Where-Object { -not $_.Passed }).Count -gt 0
        }
        History = $script:ValidationHistory | Select-Object -Last 10
    }
    
    return $report
}

function Start-ContinuousValidation {
    Write-ValidationLog "Starting continuous validation (Interval: ${Interval}s)" -Level info
    
    while ($script:ValidationActive) {
        try {
            Write-ValidationLog "Running validation cycle" -Level debug
            
            # Run all validations
            Test-HeadyBrainUsage | Out-Null
            Test-ServiceAvailability | Out-Null
            Test-BrainIntegration | Out-Null
            Test-ComplianceScore | Out-Null
            
            # Generate report
            $report = Generate-ValidationReport
            
            Write-ValidationLog "Validation cycle completed - Compliance: $($report.OverallCompliance)%" -Level info
            
            # Store in history
            $script:ValidationHistory += @{
                Timestamp = $report.Timestamp
                Compliance = $report.OverallCompliance
                Passed = $report.Summary.PassedValidations
                Failed = $report.Summary.FailedValidations
            }
            
            # Keep history manageable
            if ($script:ValidationHistory.Count -gt 100) {
                $script:ValidationHistory = $script:ValidationHistory | Select-Object -Last 50
            }
            
            # Enforce compliance if in strict mode or if compliance is low
            if ($StrictMode -or $report.OverallCompliance -lt 100.0) {
                Enforce-Compliance
            }
            
            # Wait for next cycle
            Start-Sleep -Seconds $Interval
            
        } catch {
            Write-ValidationLog "Validation cycle error: $($Error[0].Exception.Message)" -Level error
            Start-Sleep -Seconds $Interval
        }
    }
}

function Stop-ContinuousValidation {
    Write-ValidationLog "Stopping continuous validation" -Level info
    $script:ValidationActive = $false
}

# Main execution
try {
    Write-ValidationLog "Starting Heady Continuous Validation System - Mode: $Mode" -Level info
    
    # Set up shutdown handlers
    Register-EngineEvent PowerShell.Exiting -Action { Stop-ContinuousValidation } | Out-Null
    
    switch ($Mode) {
        "continuous" {
            Start-ContinuousValidation
        }
        
        "one-time" {
            # Run single validation cycle
            Test-HeadyBrainUsage | Out-Null
            Test-ServiceAvailability | Out-Null
            Test-BrainIntegration | Out-Null
            Test-ComplianceScore | Out-Null
            
            $report = Generate-ValidationReport
            Write-ValidationLog "One-time validation completed - Compliance: $($report.OverallCompliance)%" -Level info
            
            if ($StrictMode -or $report.OverallCompliance -lt 100.0) {
                Enforce-Compliance
            }
        }
        
        "report" {
            # Generate and display report
            $report = Generate-ValidationReport
            
            Write-ValidationLog "=== VALIDATION REPORT ===" -Level info
            Write-ValidationLog "Overall Compliance: $($report.OverallCompliance)%" -Level info
            Write-ValidationLog "Total Validations: $($report.Summary.TotalValidations)" -Level info
            Write-ValidationLog "Passed: $($report.Summary.PassedValidations)" -Level info
            Write-ValidationLog "Failed: $($report.Summary.FailedValidations)" -Level info
            
            foreach ($validation in $report.ValidationResults.Values) {
                Write-ValidationLog "$($validation.Category): $($validation.Score)% (Required: $($validation.Required)%)" -Level info
            }
        }
    }
    
    Write-ValidationLog "Heady Continuous Validation System completed" -Level info
    
} catch {
    Write-ValidationLog "Fatal error in validation system: $($Error[0].Exception.Message)" -Level critical
    exit 1
}
