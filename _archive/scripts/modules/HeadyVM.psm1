# HeadyVM PowerShell Module
# Provides utilities for HeadyVM migration and management

module HeadyVM {
    # Exported functions
    Export-ModuleMember -Function @(
        'Test-HeadyVMReadiness',
        'Start-HeadyVMMigration',
        'Invoke-HeadyVMRollback',
        'Get-HeadyVMStatus',
        'Clear-HeadyVMMarkers'
    )
    
    # Test HeadyVM readiness
    function Test-HeadyVMReadiness {
        [CmdletBinding()]
        param(
            [switch]$Force,
            [switch]$AutoDeployIfReady
        )
        
        $scriptPath = Join-Path $PSScriptRoot '..\headyvm-readiness-checker.ps1'
        $params = @{}
        if ($Force) { $params.Force = $true }
        if ($AutoDeployIfReady) { $params.AutoDeployIfReady = $true }
        
        & $scriptPath @params
    }
    
    # Start HeadyVM migration
    function Start-HeadyVMMigration {
        [CmdletBinding()]
        param(
            [switch]$SkipReadinessCheck,
            [switch]$Force,
            [string]$TargetVM = 'headyvm.headysystems.com'
        )
        
        $scriptPath = Join-Path $PSScriptRoot '..\headyvm-migrate.ps1'
        $params = @{
            TargetVM = $TargetVM
        }
        if ($SkipReadinessCheck) { $params.SkipReadinessCheck = $true }
        if ($Force) { $params.Force = $true }
        
        & $scriptPath @params
    }
    
    # Invoke HeadyVM rollback
    function Invoke-HeadyVMRollback {
        [CmdletBinding()]
        param(
            [switch]$Emergency,
            [string]$BackupPath
        )
        
        $scriptPath = Join-Path $PSScriptRoot '..\headyvm-rollback.ps1'
        $params = @{}
        if ($Emergency) { $params.Emergency = $true }
        if ($BackupPath) { $params.BackupPath = $BackupPath }
        
        & $scriptPath @params
    }
    
    # Get HeadyVM status
    function Get-HeadyVMStatus {
        [CmdletBinding()]
        param()
        
        Write-Host 'HeadyVM Status Report' -ForegroundColor Cyan
        Write-Host '====================' -ForegroundColor Cyan
        Write-Host ''
        
        # Check markers
        $markers = @(
            @{ Name = 'Readiness'; Path = '.headyvm-ready' },
            @{ Name = 'Migration'; Path = '.headyvm-migrated' },
            @{ Name = 'Rollback'; Path = '.headyvm-rollback' }
        )
        
        foreach ($marker in $markers) {
            if (Test-Path $marker.Path) {
                try {
                    $content = Get-Content $marker.Path | ConvertFrom-Json
                    Write-Host "[$($marker.Name) Marker]" -ForegroundColor Yellow
                    Write-Host "  Status: Present" -ForegroundColor Green
                    Write-Host "  Timestamp: $($content.timestamp)" -ForegroundColor White
                    if ($content.score) { Write-Host "  Score: $($content.score)/$($content.maxScore)" -ForegroundColor White }
                    if ($content.targetVM) { Write-Host "  Target VM: $($content.targetVM)" -ForegroundColor White }
                    Write-Host ''
                } catch {
                    Write-Host "[$($marker.Name) Marker]" -ForegroundColor Yellow
                    Write-Host "  Status: Present (invalid format)" -ForegroundColor Red
                    Write-Host ''
                }
            } else {
                Write-Host "[$($marker.Name) Marker]" -ForegroundColor Gray
                Write-Host "  Status: Not present" -ForegroundColor Gray
                Write-Host ''
            }
        }
        
        # Check system-self-awareness.yaml
        try {
            $selfAwareness = Get-Content 'configs\system-self-awareness.yaml' -Raw | ConvertFrom-Yaml
            $headyVMSwitch = $selfAwareness.headyVMSwitch
            
            if ($headyVMSwitch) {
                Write-Host '[System Self-Awareness]' -ForegroundColor Yellow
                Write-Host "  Status: $($headyVMSwitch.status)" -ForegroundColor $(if($headyVMSwitch.status -eq 'completed') {'Green'} else {'Yellow'})
                Write-Host "  Auto-deploy trigger: $($headyVMSwitch.autoDeployTrigger)" -ForegroundColor White
                Write-Host "  Windsurf integration: $($headyVMSwitch.windsurfIntegration)" -ForegroundColor White
                
                if ($headyVMSwitch.productionVM) {
                    Write-Host "  Production VM: $($headyVMSwitch.productionVM)" -ForegroundColor Green
                }
                
                Write-Host ''
                Write-Host '  Readiness Checklist:' -ForegroundColor White
                foreach ($item in $headyVMSwitch.readiness_checklist) {
                    $color = switch ($item.status) {
                        'complete' { 'Green' }
                        'in_progress' { 'Yellow' }
                        default { 'Red' }
                    }
                    Write-Host "    $($item.item): $($item.status)" -ForegroundColor $color
                }
            }
        } catch {
            Write-Host '[System Self-Awareness]' -ForegroundColor Red
            Write-Host '  Error reading configuration' -ForegroundColor Red
        }
        
        Write-Host ''
    }
    
    # Clear HeadyVM markers
    function Clear-HeadyVMMarkers {
        [CmdletBinding()]
        param(
            [switch]$All,
            [switch]$Readiness,
            [switch]$Migration,
            [switch]$Rollback
        )
        
        $toRemove = @()
        
        if ($All -or $Readiness) { $toRemove += '.headyvm-ready' }
        if ($All -or $Migration) { $toRemove += '.headyvm-migrated' }
        if ($All -or $Rollback) { $toRemove += '.headyvm-rollback' }
        
        foreach ($marker in $toRemove) {
            if (Test-Path $marker) {
                Remove-Item $marker -Force
                Write-Host "Removed marker: $marker" -ForegroundColor Green
            } else {
                Write-Host "Marker not found: $marker" -ForegroundColor Gray
            }
        }
        
        Write-Host ''
        Write-Host 'Markers cleared. Run Get-HeadyVMStatus to verify.' -ForegroundColor Cyan
    }
}

# Module aliases
New-Alias -Name hv-status -Value Get-HeadyVMStatus
New-Alias -Name hv-ready -Value Test-HeadyVMReadiness
New-Alias -Name hv-migrate -Value Start-HeadyVMMigration
New-Alias -Name hv-rollback -Value Invoke-HeadyVMRollback
New-Alias -Name hv-clear -Value Clear-HeadyVMMarkers

Export-ModuleMember -Alias *
