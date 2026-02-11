# Verify directory structure matches canonical template
$canonicalDirs = @('apps', 'services', 'infra/docker/profiles', 'packages', 'distribution', 'docs', '.github/workflows', 'scripts/maintenance')

foreach ($dir in $canonicalDirs) {
    if (-not (Test-Path "$PSScriptRoot\..\..\$dir")) {
        Write-Error "Missing required directory: $dir"
        exit 1
    }
}

Write-Host "All directories match canonical structure" -ForegroundColor Green
exit 0
