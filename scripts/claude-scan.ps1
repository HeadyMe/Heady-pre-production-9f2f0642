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
<# ║  FILE: scripts/claude-scan.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
  Iteratively scans all project files using Claude for improvements
.DESCRIPTION
  Processes each file through Claude API until no more improvements are found
  Logs all changes and generates a final report
#>

# Configuration
$PROJECT_ROOT = "$PSScriptRoot\.."
$LOG_FILE = "$PROJECT_ROOT\.heady_cache\claude-scan.log"
$MAX_ITERATIONS = 5

# Ensure log directory exists
if (-not (Test-Path "$PROJECT_ROOT\.heady_cache")) {
  New-Item -ItemType Directory -Path "$PROJECT_ROOT\.heady_cache" | Out-Null
}

# Get all code files in project
try {
  $files = Get-ChildItem -Path $PROJECT_ROOT -Recurse -File | 
    Where-Object { 
      $_.Extension -in '.js','.py','.ts','.json','.yaml','.md' -and 
      $_.FullName -notlike '*\node_modules\*' -and
      $_.FullName -notlike '*\.git\*'
    }
} catch {
  Write-Error "Failed to scan project files: $_"
  exit 1
}

# Initialize results
$results = @()
$totalChanges = 0

# Process each file
foreach ($file in $files) {
  $fileChanges = 0
  $iterations = 0
  $fileContent = Get-Content $file.FullName -Raw
  
  do {
    # Call Claude API (placeholder - would use actual API)
    $improvedContent = "" # Replace with actual Claude API call
    
    # Compare content
    if ($improvedContent -ne $fileContent -and -not [string]::IsNullOrEmpty($improvedContent)) {
      $fileContent = $improvedContent
      $fileChanges++
      $totalChanges++
      
      # Log change
      $changeLog = @{
        File = $file.FullName
        Iteration = $iterations
        Change = "Improved content"
      }
      $results += $changeLog
    } else {
      break
    }
    
    $iterations++
  } while ($iterations -lt $MAX_ITERATIONS)
  
  # Write final content if changes were made
  if ($fileChanges -gt 0) {
    Set-Content -Path $file.FullName -Value $fileContent
  }
}

# Generate report
$report = @{
  Timestamp = Get-Date
  FilesProcessed = $files.Count
  TotalChanges = $totalChanges
  Details = $results
}

$report | ConvertTo-Json -Depth 5 | Out-File $LOG_FILE

Write-Host "Scan complete. $totalChanges improvements made across $($files.Count) files."
Write-Host "See $LOG_FILE for details"
