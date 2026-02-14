<# HEADY_BRAND:BEGIN
# Security Remediation Script — Remove hardcoded secrets from tracked files
# Run: .\scripts\security-remediation.ps1 [-DryRun] [-Force]
# HEADY_BRAND:END
#>

param(
    [switch]$DryRun,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "`n╔══════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  HEADY SECURITY REMEDIATION — Hardcoded Secret Removal  ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "[DRY RUN] No files will be modified.`n" -ForegroundColor Yellow
}

# ─── Phase 1: Replace hardcoded passwords and localhost references ───────────

$replacements = @(
    # Docker compose passwords
    @{ File = "docker-compose.full.yml"; Old = "POSTGRES_PASSWORD=heady_secret"; New = 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD}' },
    @{ File = "docker-compose.full.yml"; Old = "PGADMIN_DEFAULT_PASSWORD=heady_admin"; New = 'PGADMIN_DEFAULT_PASSWORD=${PGADMIN_PASSWORD}' },
    @{ File = "docker-compose.full.yml"; Old = "GF_SECURITY_ADMIN_PASSWORD=heady_grafana"; New = 'GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}' },
    @{ File = "distribution/docker/base.yml"; Old = 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-heady_dev}'; New = 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD}' },
    @{ File = "distribution/docker/base.yml"; Old = 'PASSWORD=${HEADY_IDE_PASSWORD:-heady}'; New = 'PASSWORD=${HEADY_IDE_PASSWORD}' },
    @{ File = "distribution/docker/base/docker-compose.base.yml"; Old = 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-heady123}'; New = 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD}' },
    @{ File = "distribution/docker/profiles/dev-tools.yml"; Old = 'PASSWORD=${HEADY_IDE_PASSWORD:-heady}'; New = 'PASSWORD=${HEADY_IDE_PASSWORD}' },
    @{ File = "distribution/docker/profiles/hybrid.yml"; Old = 'DRUPAL_DATABASE_PASSWORD=${POSTGRES_PASSWORD:-heady_dev}'; New = 'DRUPAL_DATABASE_PASSWORD=${POSTGRES_PASSWORD}' },
    @{ File = "distribution/docker/profiles/full-suite.yml"; Old = 'PASSWORD=${HEADY_IDE_PASSWORD:-heady}'; New = 'PASSWORD=${HEADY_IDE_PASSWORD}' },
    
    # Localhost to cloud references (CLOUD_ONLY mode)
    @{ File = "configs/headymcp.json"; Old = "http://localhost:3000"; New = "https://headyio.com" },
    @{ File = "configs/headymcp.json"; Old = "http://127.0.0.1:3000"; New = "https://headyio.com" },
    @{ File = "configs/auto-deploy-config.json"; Old = "http://localhost:3300"; New = "https://headyio.com" },
    @{ File = "configs/auto-deploy-config.json"; Old = "http://127.0.0.1:3300"; New = "https://headyio.com" },
    @{ File = ".windsurf/admin-config.yaml"; Old = "localhost"; New = "headyio.com" },
    @{ File = ".windsurf/model_config.yaml"; Old = "localhost"; New = "headyio.com" },
    @{ File = "heady-manager.js"; Old = "localhost"; New = "headyio.com" },
    @{ File = "heady-manager.js"; Old = "127.0.0.1"; New = "headyio.com" }
)

Write-Host "Phase 1: Replacing hardcoded passwords and localhost references..." -ForegroundColor Green
$fixCount = 0

foreach ($r in $replacements) {
    $filePath = Join-Path $RepoRoot $r.File
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        if ($content -match [regex]::Escape($r.Old)) {
            $fixCount++
            if ($DryRun) {
                Write-Host "  [WOULD FIX] $($r.File): '$($r.Old)' -> '$($r.New)'" -ForegroundColor Yellow
            } else {
                $content = $content -replace [regex]::Escape($r.Old), $r.New
                Set-Content $filePath -Value $content -NoNewline
                Write-Host "  [FIXED] $($r.File)" -ForegroundColor Green
            }
        } else {
            Write-Host "  [OK] $($r.File) — already clean" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [SKIP] $($r.File) — not found" -ForegroundColor DarkGray
    }
}

# ─── Phase 2: Fix .env.example ──────────────────────────────────────────────

Write-Host "`nPhase 2: Cleaning .env.example..." -ForegroundColor Green
$envExample = Join-Path $RepoRoot ".env.example"
if (Test-Path $envExample) {
    $content = Get-Content $envExample -Raw
    if ($content -match "heady_secret") {
        $fixCount++
        if (-not $DryRun) {
            $content = $content -replace 'postgresql://heady:heady_secret@[^\s"]+', 'postgresql://heady:YOUR_PASSWORD@db.headysystems.com:5432/heady'
            Set-Content $envExample -Value $content -NoNewline
            Write-Host "  [FIXED] .env.example — removed example password" -ForegroundColor Green
        } else {
            Write-Host "  [WOULD FIX] .env.example — contains 'heady_secret'" -ForegroundColor Yellow
        }
    }
}

# ─── Phase 3: Remove sensitive files from git tracking ──────────────────────

Write-Host "`nPhase 3: Removing sensitive files from git tracking..." -ForegroundColor Green
$sensitiveFiles = @(
    ".env.hybrid",
    "server.pid",
    "audit_logs.jsonl",
    ".heady_deploy_log.jsonl",
    "heady-manager.js.bak"
)

foreach ($sf in $sensitiveFiles) {
    $sfPath = Join-Path $RepoRoot $sf
    if (Test-Path $sfPath) {
        if (-not $DryRun) {
            & git -C $RepoRoot rm --cached $sf 2>$null
            Write-Host "  [UNTRACKED] $sf" -ForegroundColor Green
        } else {
            Write-Host "  [WOULD UNTRACK] $sf" -ForegroundColor Yellow
        }
        $fixCount++
    }
}

# ─── Phase 4: Update .gitignore ─────────────────────────────────────────────

Write-Host "`nPhase 4: Updating .gitignore with missing entries..." -ForegroundColor Green
$gitignorePath = Join-Path $RepoRoot ".gitignore"
$gitignoreContent = Get-Content $gitignorePath -Raw

$missingEntries = @(
    "",
    "# Security — sensitive files (added by security-remediation)",
    ".env.hybrid",
    "*.pid",
    "*.bak",
    "audit_logs.jsonl",
    ".heady_deploy_log.jsonl",
    "*.jsonl"
)

$needsUpdate = $false
foreach ($entry in $missingEntries) {
    if ($entry -and -not $gitignoreContent.Contains($entry)) {
        $needsUpdate = $true
        break
    }
}

if ($needsUpdate) {
    $fixCount++
    if (-not $DryRun) {
        $appendBlock = $missingEntries -join "`n"
        Add-Content $gitignorePath -Value "`n$appendBlock"
        Write-Host "  [FIXED] .gitignore — added missing security entries" -ForegroundColor Green
    } else {
        Write-Host "  [WOULD FIX] .gitignore — missing security entries" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [OK] .gitignore — already has security entries" -ForegroundColor DarkGray
}

# ─── Summary ────────────────────────────────────────────────────────────────

Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "DRY RUN COMPLETE: $fixCount issues found that would be fixed." -ForegroundColor Yellow
    Write-Host "Run without -DryRun to apply fixes." -ForegroundColor Yellow
} else {
    Write-Host "REMEDIATION COMPLETE: $fixCount fixes applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor White
    Write-Host "  1. Review changes: git diff" -ForegroundColor White
    Write-Host "  2. Commit: git add -A && git commit -m 'security: remove hardcoded secrets'" -ForegroundColor White
    Write-Host "  3. ROTATE all exposed passwords in production environments" -ForegroundColor Red
    Write-Host "  4. If repo is public, consider using git-filter-repo to purge history" -ForegroundColor Red
}
Write-Host ""
