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
<# ║  FILE: scripts/validate-host-targets.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Validates files for banned host targets (localhost, onrender.com)

.DESCRIPTION
Scans files for banned host patterns and returns structured errors
Implements requirements from docs/ERROR_REPORTING_RULES.md
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$ScanPath,
    
    [string[]]$ExcludePatterns = @('*.md', '*.txt')
)

# Banned patterns with error IDs
$bannedPatterns = @{
    'localhost' = 'ERR-BANNED-HOST-TARGET-LOCALHOST'
    '127.0.0.1' = 'ERR-BANNED-HOST-TARGET-LOCALHOST'
    '0.0.0.0' = 'ERR-BANNED-HOST-TARGET-LOCALHOST'
    'onrender.com' = 'ERR-BANNED-HOST-TARGET-RENDER'
}

$errors = @()

Get-ChildItem -Path $ScanPath -Recurse -File | Where-Object {
    $include = $true
    foreach ($pattern in $ExcludePatterns) {
        if ($_.Name -like $pattern) {
            $include = $false
            break
        }
    }
    $include
} | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    foreach ($pattern in $bannedPatterns.Keys) {
        if ($content -match $pattern) {
            $errors += [PSCustomObject]@{
                File = $_.FullName
                Line = (Select-String -Pattern $pattern -InputObject $content).LineNumber
                Pattern = $pattern
                ErrorID = $bannedPatterns[$pattern]
                Timestamp = [DateTime]::UtcNow.ToString('o')
            }
        }
    }
}

if ($errors) {
    $errorJson = $errors | ConvertTo-Json
    Write-Host "BANNED HOST TARGETS DETECTED!" -ForegroundColor Red
    Write-Host $errorJson
    exit 1
}

Write-Host "No banned host targets detected" -ForegroundColor Green
exit 0
