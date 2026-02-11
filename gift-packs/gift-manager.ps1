<#
.SYNOPSIS
Manages and updates Gift packages automatically
#>

# Gift package definitions
$giftPackages = @(
    @{
        name = "starter-pack"
        description = "Basic Heady tools and configurations"
        contents = @(
            "configs/automation-policy.yaml"
            "scripts/setup-quick-start.ps1"
            "docs/quick-start.md"
        )
        version = "1.0.0"
    },
    @{
        name = "developer-pack"
        description = "Full development environment"
        contents = @(
            "configs/nginx/mtls.conf"
            "workers/service-worker/src/index.ts"
            "scripts/deploy-cloudflare-workers-final.ps1"
        )
        version = "1.0.0"
    },
    @{
        name = "enterprise-pack"
        description = "Complete enterprise solution"
        contents = @(
            "configs/access-points.yaml"
            "workers/gateway-worker/src/index.ts"
            "scripts/final-deploy-all.ps1"
            "docs/enterprise-guide.md"
        )
        version = "1.0.0"
    }
)

function Update-GiftPackages {
    param($userId = "gift")
    
    foreach ($package in $giftPackages) {
        $packageDir = "$PSScriptRoot\..\gift-packs\$($package.name)"
        
        # Ensure package directory exists
        if (-not (Test-Path $packageDir)) {
            New-Item -ItemType Directory -Path $packageDir | Out-Null
        }
        
        # Update package contents
        foreach ($file in $package.contents) {
            $source = "$PSScriptRoot\..\$file"
            $dest = "$packageDir\$(Split-Path $file -Leaf)"
            
            if (Test-Path $source) {
                Copy-Item -Path $source -Destination $dest -Force
            }
        }
        
        # Create package manifest
        $manifest = @{
            name = $package.name
            description = $package.description
            version = $package.version
            updated = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ssZ")
            files = $package.contents
        }
        
        $manifest | ConvertTo-Json -Depth 10 | Out-File "$packageDir\manifest.json"
    }
    
    Write-Host "Gift packages updated for user: $userId" -ForegroundColor Green
}

# Auto-update gift packages
while ($true) {
    Update-GiftPackages
    Start-Sleep -Seconds 3600  # Update every hour
}
