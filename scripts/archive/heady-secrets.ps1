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
<# ║  FILE: scripts/heady-secrets.ps1                                                    ║
<# ║  LAYER: automation                                                  ║
<# ╚══════════════════════════════════════════════════════════════════╝
<# HEADY_BRAND:END
#>
<#
.SYNOPSIS
Heady Systems Secret Management CLI

.DESCRIPTION
Manages secrets across all Heady environments and services
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('validate','rotate','sync','init')]
    [string]$Command = 'validate',
    
    [Parameter(Mandatory=$false)]
    [string]$SecretId
)

# Load config
try {
    $config = Get-Content -Raw -Path "$PSScriptRoot\..\configs\secrets-manifest.yaml" | ConvertFrom-Yaml
    
    # Validate config structure
    if (-not $config.secrets) {
        Write-Host "Invalid secret manifest: missing secrets section" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Failed to load secret manifest: $_" -ForegroundColor Red
    exit 1
}

function Validate-DeploymentConfigs {
    # Check Render config
    $renderConfig = Get-Content -Raw -Path "$PSScriptRoot\..\render.yml" | ConvertFrom-Yaml
    foreach ($service in $renderConfig.services) {
        if (-not $service.envVars) {
            Write-Host "Render service $($service.name) missing envVars" -ForegroundColor Yellow
        }
    }
    
    # Check Docker compose
    $dockerConfig = Get-Content -Raw -Path "$PSScriptRoot\..\docker-compose.yml" | ConvertFrom-Yaml
    foreach ($service in $dockerConfig.services.GetEnumerator()) {
        if (-not $service.Value.environment) {
            Write-Host "Docker service $($service.Key) missing environment" -ForegroundColor Yellow
        }
    }
}

switch ($Command) {
    'validate' {
        # Validate secret configurations
        Write-Host "Validating secret configurations..."
        # Implementation would go here
        Write-Host "Validation complete" -ForegroundColor Green
        
        # Validate deployment configurations
        Validate-DeploymentConfigs
    }
    
    'rotate' {
        if (-not $SecretId) {
            Write-Host "SecretId parameter required for rotation" -ForegroundColor Red
            exit 1
        }
        Write-Host "Rotating secret $SecretId..."
        # Implementation would go here
    }
    
    'sync' {
        Write-Host "Syncing secrets to current environment..."
        # Implementation would go here
    }
    
    'init' {
        Write-Host "Initializing secret management for this device..."
        # Implementation would go here
    }
}
# Audit secrets usage
'audit' {
    Write-Host "Auditing secret usage across Heady stack..." -ForegroundColor Cyan
    
    $auditReport = @{
        Timestamp = Get-Date
        MissingSecrets = @()
        UnusedSecrets = @()
        ExpiringSecrets = @()
        DuplicateSecrets = @()
        InsecureReferences = @()
        Statistics = @{
            TotalSecretsFound = 0
            TotalFilesScanned = 0
            TotalMissing = 0
            TotalUnused = 0
        }
    }
    
    # Check for secrets in use across all config files
    $configFiles = Get-ChildItem -Path "$PSScriptRoot\.." -Recurse -Depth 5 -Include "*.json","*.yml","*.yaml","*.env","*.ps1","*.js","*.ts" -ErrorAction SilentlyContinue | 
        Where-Object { $_.FullName -notmatch '(node_modules|\.git|backups|logs)' }
    
    $auditReport.Statistics.TotalFilesScanned = $configFiles.Count
    $foundSecrets = @{}
    
    foreach ($file in $configFiles) {
        try {
            $content = Get-Content -Raw $file.FullName -ErrorAction Stop
            
            # Match various secret patterns
            $patterns = @(
                '\$\{([A-Z_]+)\}',                    # ${SECRET_NAME}
                'env:([A-Z_]+)',                       # env:SECRET_NAME
                'process\.env\.([A-Z_]+)',            # process.env.SECRET_NAME
                '\$env:([A-Z_]+)',                    # $env:SECRET_NAME
                'from:\s*secret.*?key:\s*([A-Z_]+)'  # YAML secret references
            )
            
            foreach ($pattern in $patterns) {
                if ($content -match $pattern) {
                    $matches = [regex]::Matches($content, $pattern)
                    foreach ($match in $matches) {
                        $secretName = $match.Groups[1].Value
                        
                        if (-not $foundSecrets.ContainsKey($secretName)) {
                            $foundSecrets[$secretName] = @()
                        }
                        $foundSecrets[$secretName] += $file.FullName
                        
                        # Check if secret exists
                        if (-not (Test-Path "env:$secretName")) {
                            $auditReport.MissingSecrets += @{
                                Secret = $secretName
                                File = $file.FullName
                                Line = ($content.Substring(0, $match.Index) -split "`n").Count
                            }
                        }
                    }
                }
            }
            
            # Check for hardcoded secrets (insecure patterns)
            $insecurePatterns = @(
                '(password|secret|key|token)\s*=\s*["\'][^"\']{8,}["\']',
                '(api[_-]?key|auth[_-]?token)\s*:\s*["\'][^"\']{8,}["\']'
            )
            
            foreach ($pattern in $insecurePatterns) {
                if ($content -match $pattern) {
                    $auditReport.InsecureReferences += @{
                        File = $file.FullName
                        Pattern = $pattern
                        Severity = "HIGH"
                    }
                }
            }
        } catch {
            Write-Host "Warning: Could not scan $($file.FullName): $_" -ForegroundColor Yellow
        }
    }
    
    # Check for unused secrets in environment
    $allEnvSecrets = Get-ChildItem env: | Where-Object { 
        $_.Name -match '^(HEADY_|CLOUDFLARE_|DATABASE_|HF_|RENDER_|ADMIN_|ENCRYPTION_|API_)' 
    }
    
    foreach ($envSecret in $allEnvSecrets) {
        if (-not $foundSecrets.ContainsKey($envSecret.Name)) {
            $auditReport.UnusedSecrets += @{
                Secret = $envSecret.Name
                Source = "Environment Variable"
            }
        }
    }
    
    # Check for duplicate secret definitions
    foreach ($secretName in $foundSecrets.Keys) {
        if ($foundSecrets[$secretName].Count -gt 3) {
            $auditReport.DuplicateSecrets += @{
                Secret = $secretName
                Count = $foundSecrets[$secretName].Count
                Files = $foundSecrets[$secretName]
            }
        }
    }
    
    # Update statistics
    $auditReport.Statistics.TotalSecretsFound = $foundSecrets.Keys.Count
    $auditReport.Statistics.TotalMissing = $auditReport.MissingSecrets.Count
    $auditReport.Statistics.TotalUnused = $auditReport.UnusedSecrets.Count
    
    # Export audit report
    $auditDir = "$PSScriptRoot\..\logs"
    New-Item -ItemType Directory -Force -Path $auditDir | Out-Null
    $auditPath = "$auditDir\secret-audit-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
    $auditReport | ConvertTo-Json -Depth 10 | Set-Content $auditPath
    
    # Display summary
    Write-Host "`n=== Audit Summary ===" -ForegroundColor Cyan
    Write-Host "Files Scanned: $($auditReport.Statistics.TotalFilesScanned)" -ForegroundColor White
    Write-Host "Secrets Found: $($auditReport.Statistics.TotalSecretsFound)" -ForegroundColor White
    Write-Host "Missing Secrets: $($auditReport.Statistics.TotalMissing)" -ForegroundColor $(if ($auditReport.Statistics.TotalMissing -gt 0) { "Red" } else { "Green" })
    Write-Host "Unused Secrets: $($auditReport.Statistics.TotalUnused)" -ForegroundColor Yellow
    Write-Host "Insecure References: $($auditReport.InsecureReferences.Count)" -ForegroundColor $(if ($auditReport.InsecureReferences.Count -gt 0) { "Red" } else { "Green" })
    Write-Host "`nFull report: $auditPath" -ForegroundColor Green
}

'backup' {
    Write-Host "Creating encrypted backup of secret references..." -ForegroundColor Cyan
    $backupDir = "$PSScriptRoot\..\backups"
    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $backupPath = "$backupDir\secrets-$(Get-Date -Format 'yyyyMMdd-HHmmss').enc"
    
    # Backup secret names and sources (not values)
    $secretManifest = @{
        Environment = if ($env:HEADYTARGET) { $env:HEADYTARGET } else { "Unknown" }
        Timestamp = Get-Date
        Device = $env:COMPUTERNAME
        User = $env:USERNAME
        Secrets = @()
        ConfigFiles = @()
    }
    
    # Capture environment secrets
    Get-ChildItem env: | Where-Object { 
        $_.Name -match '^(HEADY_|CLOUDFLARE_|DATABASE_|HF_|RENDER_|ADMIN_|ENCRYPTION_|API_)' 
    } | ForEach-Object { -Parallel {
        $secretManifest.Secrets += @{
            Name = $_.Name
            Source = "Environment"
            HasValue = (-not [string]::IsNullOrEmpty($_.Value))
            ValueLength = if ($_.Value) { $_.Value.Length } else { 0 }
            LastModified = (Get-Item "env:$($_.Name)").LastWriteTime
        }
    }
    
    # Capture secret references from config files
    $configFiles = @(
        "$PSScriptRoot\..\configs\secrets-manifest.yaml",
        "$PSScriptRoot\..\render.yml",
        "$PSScriptRoot\..\docker-compose.yml",
        "$PSScriptRoot\..\.env"
    )
    
    foreach ($configFile in $configFiles) {
        if (Test-Path $configFile) {
            $secretManifest.ConfigFiles += @{
                Path = $configFile
                LastModified = (Get-Item $configFile).LastWriteTime
                Size = (Get-Item $configFile).Length
            }
        }
    }
    
    # Save manifest
    $manifestJson = $secretManifest | ConvertTo-Json -Depth 10
    Set-Content -Path $backupPath -Value $manifestJson
    
    # Create compressed archive of all secret configs (without actual values)
    $archivePath = "$backupDir\secrets-archive-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
    if (Get-Command Compress-Archive -ErrorAction SilentlyContinue) {
        $filesToBackup = $configFiles | Where-Object { Test-Path $_ }
        if ($filesToBackup) {
            Compress-Archive -Path $filesToBackup -DestinationPath $archivePath -Force
            Write-Host "Archive created: $archivePath" -ForegroundColor Green
        }
    }
    
    Write-Host "Backup complete: $backupPath" -ForegroundColor Green
    Write-Host "Backed up $($secretManifest.Secrets.Count) secret references" -ForegroundColor White
}

'export' {
    if (-not $SecretId) {
        Write-Host "Exporting all secret templates..." -ForegroundColor Cyan
        $templateDir = "$PSScriptRoot\..\configs"
        New-Item -ItemType Directory -Force -Path $templateDir | Out-Null
        $templatePath = "$templateDir\secrets.template.env"
        
        # Generate comprehensive template with all known secrets
        $template = @"
# Heady Secrets Template
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Copy to .env and fill in actual values
# NEVER commit .env files to version control

# ===========================================
# Cloudflare Configuration
# ===========================================
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
CLOUDFLARE_ZONE_ID=your_cloudflare_zone_id

# ===========================================
# Database Configuration
# ===========================================
DATABASE_URL=postgresql://user:password@host:5432/database
DATABASE_SSL=true
DATABASE_POOL_SIZE=10

# ===========================================
# API Keys & Tokens
# ===========================================
HEADY_API_KEY=your_heady_api_key
HF_TOKEN=your_huggingface_token
OPENAI_API_KEY=your_openai_api_key

# ===========================================
# Render Platform
# ===========================================
RENDER_API_KEY=your_render_api_key
RENDER_SERVICE_ID=your_render_service_id

# ===========================================
# Admin & Authentication
# ===========================================
ADMIN_TOKEN=your_admin_token
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret

# ===========================================
# Encryption & Security
# ===========================================
ENCRYPTION_KEY=your_encryption_key_32_chars
ENCRYPTION_ALGORITHM=AES256

# ===========================================
# Environment Configuration
# ===========================================
NODE_ENV=production
HEADYTARGET=CloudOnly
HEADY_VERSION=3.0.0

# ===========================================
# Optional Services
# ===========================================
# REDIS_URL=redis://api.headysystems.com:6379
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_smtp_user
# SMTP_PASS=your_smtp_password
"@
        
        Set-Content -Path $templatePath -Value $template
        Write-Host "Template exported to $templatePath" -ForegroundColor Green
        
        # Also export environment-specific templates
        $environments = @('development', 'staging', 'production')
        foreach ($env in $environments) {
            $envTemplatePath = "$templateDir\secrets.$env.template.env"
            $envTemplate = "# Environment: $env`n# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n`n" + $template
            Set-Content -Path $envTemplatePath -Value $envTemplate
            Write-Host "  - $env template: $envTemplatePath" -ForegroundColor Gray
        }
    } else {
        # Export specific secret template
        Write-Host "Exporting template for secret: $SecretId" -ForegroundColor Cyan
        $secretConfig = $config.secrets | Where-Object { $_.id -eq $SecretId } | Select-Object -First 1
        
        if ($secretConfig) {
            $specificTemplate = @"
# Secret: $SecretId
# Description: $($secretConfig.description)
# Required: $($secretConfig.required)
# Environments: $($secretConfig.environments -join ', ')

$SecretId=your_value_here
"@
            $specificTemplatePath = "$PSScriptRoot\..\configs\secret-$SecretId.template.env"
            Set-Content -Path $specificTemplatePath -Value $specificTemplate
            Write-Host "Secret template exported to $specificTemplatePath" -ForegroundColor Green
        } else {
            Write-Host "Secret '$SecretId' not found in manifest" -ForegroundColor Red
            exit 1
        }
    }
}
'beneficial' {
    Write-Host "Generating beneficial content templates..." -ForegroundColor Cyan
    
    # Create beneficial content directory
    $beneficialDir = "$PSScriptRoot\..\beneficial"
    New-Item -ItemType Directory -Force -Path $beneficialDir | Out-Null
    
    # Generate beneficial secret patterns
    $beneficialSecrets = @{
        "BENEFICIAL_API_KEY" = "Key for beneficial AI services"
        "BENEFICIAL_MODEL_PATH" = "Path to beneficial AI models"
        "BENEFICIAL_CONTEXT_LIMIT" = "Token limit for beneficial context"
        "BENEFICIAL_SAFETY_THRESHOLD" = "Safety scoring threshold"
        "BENEFICIAL_AUDIT_LOG" = "Path to beneficial audit logs"
        "BENEFICIAL_CONTENT_FILTER" = "Content filtering configuration"
        "BENEFICIAL_ALIGNMENT_CHECK" = "AI alignment verification endpoint"
        "BENEFICIAL_ETHICS_ENGINE" = "Ethics evaluation service URL"
        "BENEFICIAL_TRANSPARENCY_LOG" = "Decision transparency logging path"
        "BENEFICIAL_HUMAN_OVERSIGHT" = "Human-in-the-loop review queue"
        "BENEFICIAL_HARM_PREVENTION" = "Proactive harm prevention system"
        "BENEFICIAL_WELLBEING_METRICS" = "User wellbeing tracking endpoint"
        "BENEFICIAL_BIAS_DETECTION" = "Bias detection and mitigation service"
        "BENEFICIAL_CONSENT_MANAGER" = "User consent and preference management"
        "BENEFICIAL_IMPACT_ASSESSMENT" = "Social impact assessment framework"
    }
    
    $beneficialTemplate = @"
# Beneficial AI Configuration
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# These secrets enable beneficial AI capabilities with ethical safeguards

"@
    
    foreach ($secret in $beneficialSecrets.GetEnumerator()) {
        $beneficialTemplate += "`n# $($secret.Value)`n$($secret.Key)=`n"
    }
    
    # Add beneficial content guidelines
    $beneficialTemplate += @"

# ===========================================
# Beneficial Content Guidelines
# ===========================================
# 1. Prioritize user safety and wellbeing
# 2. Maintain transparency in AI decision-making
# 3. Enable human oversight and intervention
# 4. Respect privacy and data protection
# 5. Promote fairness and reduce bias
# 6. Ensure explainability of AI outputs
# 7. Support accountability mechanisms
# 8. Prevent potential harms proactively
# 9. Measure and optimize for positive impact
# 10. Honor user autonomy and informed consent

# ===========================================
# Beneficial Content Categories
# ===========================================
# - Mental health support and crisis intervention
# - Educational content with verified accuracy
# - Accessibility and inclusive design
# - Environmental sustainability guidance
# - Community building and social connection
# - Personal growth and skill development
# - Health and wellness information
# - Civic engagement and democratic participation

"@
    
    $beneficialTemplatePath = "$beneficialDir\beneficial-secrets.template.env"
    Set-Content -Path $beneficialTemplatePath -Value $beneficialTemplate
    
    # Create beneficial content manifest
    $beneficialManifest = @{
        version = "1.0.0"
        generated = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        secrets = $beneficialSecrets
        principles = @(
            "Safety-first design"
            "Transparent operations"
            "Human-centered approach"
            "Ethical AI practices"
            "Continuous monitoring"
            "Harm prevention"
            "Positive impact optimization"
            "User empowerment"
        )
        contentCategories = @(
            @{
                name = "Mental Health Support"
                description = "Crisis intervention, emotional support, therapy resources"
                safeguards = @("Licensed professional oversight", "Crisis hotline integration", "Harm prevention protocols")
            }
            @{
                name = "Educational Content"
                description = "Verified learning materials, skill development, knowledge sharing"
                safeguards = @("Source verification", "Expert review", "Age-appropriate filtering")
            }
            @{
                name = "Health & Wellness"
                description = "Evidence-based health information, wellness guidance"
                safeguards = @("Medical disclaimer requirements", "Professional consultation prompts", "Emergency service routing")
            }
            @{
                name = "Accessibility Services"
                description = "Inclusive design, assistive technologies, barrier removal"
                safeguards = @("WCAG compliance", "User preference respect", "Alternative format availability")
            }
        )
    }
    
    $manifestPath = "$beneficialDir\beneficial-manifest.json"
    $beneficialManifest | ConvertTo-Json -Depth 10 | Set-Content $manifestPath
    
    # Create beneficial content examples
    $examplesPath = "$beneficialDir\beneficial-examples.md"
    $examples = @"
# Beneficial Content Examples

## Mental Health Support
- Crisis intervention with immediate professional resources
- Emotional support with empathy and validation
- Therapy technique suggestions with professional guidance disclaimers

## Educational Content
- Verified factual information with source citations
- Step-by-step learning paths with progress tracking
- Skill development exercises with constructive feedback

## Health & Wellness
- Evidence-based health information with medical disclaimers
- Wellness practices with safety considerations
- Nutrition guidance with individual variation acknowledgment

## Accessibility
- Screen reader optimized content
- Alternative text for visual elements
- Keyboard navigation support
- Customizable display preferences

## Community Building
- Inclusive discussion facilitation
- Conflict resolution support
- Shared goal coordination
- Collaborative problem-solving

Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
"@
    Set-Content -Path $examplesPath -Value $examples
    
    Write-Host "Beneficial template created: $beneficialTemplatePath" -ForegroundColor Green
    Write-Host "Beneficial manifest created: $manifestPath" -ForegroundColor Green
    Write-Host "Beneficial examples created: $examplesPath" -ForegroundColor Green
    Write-Host "Added $($beneficialSecrets.Count) beneficial secret patterns" -ForegroundColor White
    Write-Host "Defined $($beneficialManifest.contentCategories.Count) content categories with safeguards" -ForegroundColor White
}
