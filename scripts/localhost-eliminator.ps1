<#
HEADY LOCALHOST ELIMINATOR
Version: 1.0.0

PURPOSE:
Permanently remove all localhost/127.0.0.1 references
from code, configs, and documentation
#>

# Configuration
$REPO_ROOT = "$PSScriptRoot\.."
$DOMAIN_MAP = @{
    "localhost" = "app.headysystems.com"
    "127.0.0.1" = "api.headysystems.com"
    "http://" = "https://"
}

# File types to process
$FILE_TYPES = @('*.js', '*.ts', '*.yaml', '*.json', '*.md', '*.ps1', '*.bat', '*.conf', '*.html')

# Elimination process
$TOTAL_REPLACED = 0

Get-ChildItem -Path $REPO_ROOT -Recurse -Include $FILE_TYPES | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $original = $content
    
    # Replace all localhost references
    $DOMAIN_MAP.GetEnumerator() | ForEach-Object {
        $content = $content -replace $_.Key, $_.Value
    }
    
    # Write back if changes made
    if ($content -ne $original) {
        Set-Content -Path $_.FullName -Value $content
        $TOTAL_REPLACED++
        Write-Host "Fixed: $($_.FullName)"
    }
}

# Result
if ($TOTAL_REPLACED -gt 0) {
    Write-Host "SUCCESS: Replaced localhost in $TOTAL_REPLACED files" -ForegroundColor Green
} else {
    Write-Host "SUCCESS: No localhost references found" -ForegroundColor Green
}

exit 0
