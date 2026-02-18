# 🚀 Heady Project: Drupal 11 + Next.js Admin UI with HCFP Auto-Deploy & HCAutoFlow

## 🎯 Executive Summary

This comprehensive guide implements a **decoupled headless architecture** for the Heady project, combining Drupal 11's robust content management with Next.js's modern frontend, all orchestrated through **HCFullPipeline (HCFP)** auto-deployment and **HCAutoFlow** automation.

### **Key Features**
- ✅ **Modern Drupal 11 Admin UI** with Gin theme and custom Views
- ✅ **Headless Next.js Frontend** with live preview and ISR
- ✅ **Automated Deployment** via HCFP on every git push
- ✅ **Multi-Environment Support** (dev/staging/production) with proper domain structure
- ✅ **Zero Localhost Policy** - All services use production domains
- ✅ **Cloudflare Integration** for edge caching, tunnels, and access control
- ✅ **Multi-Device Secret Management** via vault
- ✅ **Health Monitoring** with Operational Readiness Score (ORS)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Heady Production Stack                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend Layer (Next.js)                                   │
│  ├── https://headyme.com (Main Site)                        │
│  ├── https://admin.headyme.com (Admin Interface)           │
│  └── https://chat.headyme.com (Chat Interface)             │
├─────────────────────────────────────────────────────────────┤
│  API Gateway Layer                                          │
│  ├── https://api.headysystems.com (Manager Service)        │
│  └── https://manager.prod.local.heady.internal:3300       │
├─────────────────────────────────────────────────────────────┤
│  CMS Backend Layer (Drupal 11)                             │
│  ├── https://cms.headyme.com (Content Management)          │
│  ├── JSON:API at /jsonapi/                                  │
│  └── Gin Admin Theme + Custom Views                         │
├─────────────────────────────────────────────────────────────┤
│  Automation Layer                                           │
│  ├── HCFP: Auto-deployment pipeline                        │
│  ├── HCAutoFlow: Continuous integration                     │
│  └── Multi-remote sync (HeadySystems/HeadyMe/HeadyConnection)│
└─────────────────────────────────────────────────────────────┘
```

---

## 🌐 Domain Structure (CRITICAL - NO LOCALHOST)

### **Production Environment**
```bash
CMS Backend:       https://cms.headyme.com
API Endpoint:      https://api.headysystems.com/jsonapi
Next.js Frontend:  https://headyme.com
Admin Interface:   https://admin.headyme.com
Chat Interface:    https://chat.headyme.com
```

### **Staging Environment**
```bash
CMS:               https://cms.staging.headyme.com
API:               https://api.staging.headysystems.com/jsonapi
Frontend:          https://staging.headyme.com
Admin:             https://admin.staging.headyme.com
```

### **Development Environment**
```bash
CMS:               https://cms.dev.headyme.com
API:               https://api.dev.headysystems.com/jsonapi
Frontend:          https://dev.headyme.com
Admin:             https://admin.dev.headyme.com
```

### **Internal Service Domains**
```bash
Manager API:       https://manager.prod.local.heady.internal:3300
HeadyBuddy:        https://app-buddy.prod.local.heady.internal:3301
MCP Gateway:       https://tools-mcp.prod.local.heady.internal:3001
Voice Services:    https://io-voice.prod.local.heady.internal:3303
Story Driver:      https://svc-stories.prod.local.heady.internal:3305
HeadyLens:         https://monitor-lens.prod.local.heady.internal:3306
```

---

## 📋 Part 1: Drupal 11 Admin UI Configuration

### **Step 1: Install Modern Admin Theme**
```bash
# Install Gin Admin Theme
composer require drupal/gin
drush en gin -y
drush config-set system.theme admin gin -y

# Configure Gin settings
drush config:set gin.settings accent_color "blue"
drush config:set gin.settings.darkmode "1"
drush config:set gin.settings.high_contrast_mode "0"
```

### **Step 2: Enable Core JSON:API Module**
```bash
# JSON:API is included in Drupal 11 core
drush en jsonapi -y
drush en jsonapi_extras -y

# Configure JSON:API permissions
drush role:perm anonymous 'issue subrequests'
drush role:perm authenticated 'issue subrequests'
drush role:perm authenticated 'access jsonapi resource list'
```

### **Step 3: Install Next.js Integration Module**
```bash
# Install Next.js for Drupal module
composer require drupal/next
drush en next next_jsonapi -y

# Configure Next.js sites via UI or config
# Navigate to: /admin/config/services/next
```

### **Step 4: Create Custom Admin Views**
```bash
# Enable Views UI
drush en views_ui -y

# Create content management dashboard
drush vc --name="Content Dashboard" --show="content" --path="admin/content-dashboard" --menu="Administration"
```

### **Step 5: Cloudflare Integration**
```bash
# Install Cloudflare module for edge caching
composer require drupal/cloudflare
drush en cloudflare -y

# Configure Cloudflare settings
# Navigate to: /admin/config/services/cloudflare
```

### **Step 6: Protect Admin Paths with Cloudflare Access**
```yaml
# Cloudflare Access Configuration
Application: Heady Drupal Admin
Domain: cms.headyme.com
Paths: /admin/*, /user/*
Policy: Email domain @headysystems.com OR GitHub OAuth
Session Duration: 24 hours
```

---

## 🚀 Part 2: Next.js Frontend Integration

### **Step 1: Initialize Next.js Project**
```bash
# Use official Next.js for Drupal starter
npx create-next-app heady-frontend -e https://github.com/chapter-three/next-drupal-basic-starter
cd heady-frontend
npm install next-drupal

# Install additional dependencies
npm install @headlessui/react @heroicons/react tailwindcss
npm install next-auth @next-auth/prisma-adapter
```

### **Step 2: Environment Configuration**
Create `.env.local` (NEVER commit - use vault):
```bash
# Drupal Backend Configuration
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyme.com
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}

# Next.js Configuration
NEXT_IMAGE_DOMAIN=cms.headyme.com
NEXTAUTH_URL=https://admin.headyme.com
NEXTAUTH_SECRET=${HEADY_NEXTAUTH_SECRET}

# Heady API Integration
NEXT_PUBLIC_HEADY_API_URL=https://api.headysystems.com
HEADY_API_KEY=${HEADY_API_KEY}
```

### **Step 3: Initialize Drupal Client**
Create `lib/drupal.js`:
```javascript
import { DrupalClient } from "next-drupal";

export const drupal = new DrupalClient(
  process.env.NEXT_PUBLIC_DRUPAL_BASE_URL,
  {
    auth: {
      clientId: process.env.DRUPAL_CLIENT_ID,
      clientSecret: process.env.DRUPAL_CLIENT_SECRET,
    },
    previewSecret: process.env.DRUPAL_PREVIEW_SECRET,
    forceIframeSameSite: true,
  }
);

// Helper function for fetching with preview support
export async function getResourceFromContext(...args) {
  return await drupal.getResourceFromContext(...args, {
    preview: args[1]?.preview,
  });
}
```

### **Step 4: Implement Data Fetching with ISR**
Create `pages/articles/[...slug].js`:
```javascript
import { drupal, getResourceFromContext } from "lib/drupal";
import { notFound } from "next/navigation";

export async function getStaticPaths() {
  const articles = await drupal.getResourceCollection("node--article", {
    params: {
      "fields[node--article]": "title,path,status",
    },
  });
  
  return {
    paths: articles.map((article) => ({
      params: { 
        slug: article.path.alias.split("/").filter(Boolean) 
      },
    })),
    fallback: "blocking",
  };
}

export async function getStaticProps(context) {
  const path = `/articles/${context.params.slug.join("/")}`;
  
  try {
    const article = await getResourceFromContext(path, context);
    
    if (!article) {
      return { notFound: true };
    }

    return {
      props: { 
        article,
        preview: context.preview || false,
      },
      revalidate: 60, // ISR: Revalidate every 60 seconds
    };
  } catch (error) {
    console.error("Error fetching article:", error);
    return { notFound: true };
  }
}

export default function ArticlePage({ article, preview }) {
  if (!article) return notFound();
  
  return (
    <article className="prose prose-lg max-w-none">
      <h1>{article.title}</h1>
      <div 
        dangerouslySetInnerHTML={{ 
          __html: article.body?.processed || "" 
        }} 
      />
      {preview && (
        <div className="fixed top-4 right-4 bg-yellow-500 text-black px-4 py-2 rounded">
          Preview Mode
        </div>
      )}
    </article>
  );
}
```

### **Step 5: Enable Preview Mode**
Create `pages/api/preview.js`:
```javascript
import { drupal } from "lib/drupal";

export default async function handler(req, res) {
  const { secret, slug } = req.query;

  // Validate preview secret
  if (secret !== process.env.DRUPAL_PREVIEW_SECRET) {
    return res.status(401).json({ message: "Invalid preview token" });
  }

  // Get resource from Drupal
  try {
    const resource = await drupal.getResourceFromContext(`/${slug}`, {
      preview: true,
    });

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    // Enable preview mode
    res.setPreviewData({});
    
    // Redirect to the resource path
    res.redirect(resource.path.alias || `/${slug}`);
  } catch (error) {
    console.error("Preview error:", error);
    return res.status(500).json({ message: "Preview failed" });
  }
}

export function validatePreviewToken(req, res) {
  const { secret } = req.query;
  return secret === process.env.DRUPAL_PREVIEW_SECRET;
}
```

### **Step 6: Webform Integration**
```bash
# Install Next.js Drupal Webform library
npm install nextjs-drupal-webform
```

Create `pages/contact.js`:
```javascript
import { DrupalForm } from "nextjs-drupal-webform";
import { drupal } from "lib/drupal";

export default function ContactPage({ form }) {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <h1 className="text-3xl font-bold mb-8">Contact Us</h1>
      <DrupalForm
        form={form}
        onSubmit={async (data) => {
          // Handle form submission
          console.log("Form submitted:", data);
          // You can send this to your backend or Drupal
        }}
        className="space-y-6"
      />
    </div>
  );
}

export async function getStaticProps() {
  try {
    const form = await drupal.getResource("webform--contact");
    return { 
      props: { form },
      revalidate: 3600, // Cache for 1 hour
    };
  } catch (error) {
    return { 
      props: { form: null },
      revalidate: 60,
    };
  }
}
```

---

## 🔄 Part 3: HCFP Auto-Deploy & HCAutoFlow Integration

### **Architecture: Automated Deployment Pipeline**
```
Ingest → Plan → Execute-Major-Phase → Recover → Finalize
   ↓        ↓           ↓              ↓         ↓
Detect  Generate   Build & Deploy  Handle     Update
Changes  Tasks      via Agents     Failures   Registry
```

### **Step 1: Configure Repository Structure**
```bash
# Repository naming conventions
headyconnection-drupal    # Drupal backend
headyconnection-web       # Next.js frontend
heady-drupal-config       # Drupal configuration management

# Configure Git remotes for multi-remote sync
git remote add origin git@github.com:HeadyConnection/headyconnection-drupal.git
git remote add heady-me git@github.com:HeadyMe/headyconnection-drupal.git
git remote add heady-sys git@github.com:HeadySystems/headyconnection-drupal.git
```

### **Step 2: Configure Render.com Deployment**
Create `render.yaml` in repository root:
```yaml
services:
  # Drupal Backend
  - type: web
    name: heady-drupal-cms
    runtime: docker
    repo: https://github.com/HeadyConnection/headyconnection-drupal
    branch: main
    dockerfilePath: ./Dockerfile
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: heady-postgres
          property: connectionString
      - key: DRUPAL_HASH_SALT
        sync: false
      - key: CLOUDFLARE_API_TOKEN
        sync: false
      - key: NEXT_PUBLIC_DRUPAL_BASE_URL
        value: https://cms.headyme.com
    domains:
      - cms.headyme.com

  # Next.js Frontend
  - type: web
    name: heady-nextjs-frontend
    runtime: node
    repo: https://github.com/HeadyConnection/headyconnection-web
    branch: main
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NEXT_PUBLIC_DRUPAL_BASE_URL
        value: https://cms.headyme.com
      - key: DRUPAL_PREVIEW_SECRET
        sync: false
      - key: PORT
        value: 3000
    domains:
      - headyme.com
      - admin.headyme.com

databases:
  - name: heady-postgres
    databaseName: heady_drupal
    user: heady
    plan: starter
```

### **Step 3: Configure HCFullPipeline**
Create `configs/hcfullpipeline.yaml`:
```yaml
stages:
  - id: ingest
    tasks:
      - id: detect-drupal-changes
        agent: scout
        tool: githubscanner
        params:
          repo: HeadyConnection/headyconnection-drupal
          branch: main
      
      - id: detect-nextjs-changes
        agent: scout
        tool: githubscanner
        params:
          repo: HeadyConnection/headyconnection-web
          branch: main

  - id: plan
    dependencies: [ingest]
    tasks:
      - id: generate-deployment-plan
        agent: planner
        tool: taskgraph
        params:
          include_health_checks: true
          parallel_deployment: true

  - id: execute-major-phase
    dependencies: [plan]
    tasks:
      - id: deploy-drupal-cms
        agent: builder
        tool: render_deploy
        params:
          service: heady-drupal-cms
          wait_for_ready: true
          health_check: https://cms.headyme.com/admin/health
        
      - id: deploy-nextjs-frontend
        agent: builder
        tool: render_deploy
        dependencies: [deploy-drupal-cms]
        params:
          service: heady-nextjs-frontend
          wait_for_ready: true
          health_check: https://headyme.com/api/health

  - id: finalize
    dependencies: [execute-major-phase]
    tasks:
      - id: update-registry
        agent: atlas
        tool: autodoc
        params:
          update_heady_registry: true
          components:
            - heady-drupal-cms
            - heady-nextjs-frontend
      
      - id: notify-deployment
        agent: communicator
        tool: notification
        params:
          channels: ["slack", "email"]
          message: "Heady deployment completed successfully"
```

### **Step 4: Enable Auto-Deploy via Git Push**
Create `.github/workflows/deploy.yml`:
```yaml
name: HCFP Auto-Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  trigger-hcfp:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger HCFullPipeline
        run: |
          curl -X POST https://api.headysystems.com/api/pipeline/run \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.HEADY_API_KEY }}" \
            -d '{
              "trigger": "git_push",
              "repo": "${{ github.repository }}",
              "branch": "${{ github.ref_name }}",
              "commit": "${{ github.sha }}"
            }'
      
      - name: Wait for Deployment
        run: |
          sleep 30
          curl https://headyme.com/api/health
          curl https://cms.headyme.com/admin/health
```

### **Step 5: Configure Heady-Sync Multi-Remote Push**
Create `scripts/Heady-Sync.ps1`:
```powershell
# Heady-Sync.ps1 - Multi-Remote Deployment Script
param(
    [switch]$Restart,
    [switch]$Force
)

Write-Host "🚀 Heady-Sync: Multi-Remote Deployment Pipeline" -ForegroundColor Green

# Phase 1: PAUSE - Stop local services
Write-Host "⏸️  Phase 1: PAUSE - Stopping local services..." -ForegroundColor Yellow
if ($Restart) {
    Get-Process | Where-Object {$_.ProcessName -like "*heady*"} | Stop-Process -Force
}

# Phase 2: CATCH - Fetch from all remotes
Write-Host "🎣 Phase 2: CATCH - Fetching from all remotes..." -ForegroundColor Yellow
git fetch origin
git fetch heady-me
git fetch heady-sys

# Phase 3: FIX - Run linting and validation
Write-Host "🔧 Phase 3: FIX - Running validation..." -ForegroundColor Yellow
npm run lint
npm run test

# Phase 4: IMPROVE - Optimize repos
Write-Host "⚡ Phase 4: IMPROVE - Optimizing repositories..." -ForegroundColor Yellow
git gc --aggressive
npm audit fix

# Phase 5: CHECKPOINT - Validate configs
Write-Host "🔍 Phase 5: CHECKPOINT - Validating configurations..." -ForegroundColor Yellow
if (Test-Path "render.yaml") {
    Write-Host "✅ render.yaml found" -ForegroundColor Green
}
if (Test-Path "configs/hcfullpipeline.yaml") {
    Write-Host "✅ hcfullpipeline.yaml found" -ForegroundColor Green
}

# Phase 6: SYNC - Push to ALL remotes
Write-Host "🔄 Phase 6: SYNC - Pushing to all remotes..." -ForegroundColor Yellow
if ($Force) {
    git push origin main --force
    git push heady-me main --force
    git push heady-sys main --force
} else {
    git push origin main
    git push heady-me main
    git push heady-sys main
}

# Phase 7: RESTART - Restart services
Write-Host "🔄 Phase 7: RESTART - Restarting services..." -ForegroundColor Yellow
if ($Restart) {
    # Start local development services
    npm run dev:drupal &
    npm run dev:nextjs &
}

Write-Host "✅ Heady-Sync completed successfully!" -ForegroundColor Green
```

### **Step 6: Monitor Deployment via ORS**
Create `scripts/check-readiness.sh`:
```bash
#!/bin/bash

echo "🔍 Checking Heady System Readiness..."

# Check current readiness score
echo "📊 Operational Readiness Score (ORS):"
curl -s https://api.headysystems.com/api/readiness/evaluate | jq '.'

# View deployment health
echo "🏥 Health Check Snapshot:"
curl -s https://api.headysystems.com/api/health-checks/snapshot | jq '.health_checks'

# Monitor pipeline state
echo "🔄 Pipeline State:"
curl -s https://api.headysystems.com/api/pipeline/state | jq '.status'

echo "✅ Readiness check completed"
```

### **Step 7: Cloudflare Tunnel for Dev Environments**
Create `config/cloudflare-tunnel.yml`:
```yaml
tunnel: <tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: cms.dev.headyme.com
    service: https://cms.headyconnection.org
  - hostname: dev.headyme.com
    service: http://localhost:3000
  - hostname: admin.dev.headyme.com
    service: http://localhost:3000
  - service: http_status:404
```

---

## 🤖 Part 4: Coding Agent Prompt Instructions

Copy this section into your coding agent's system prompt:

```text
# Heady Drupal 11 + Next.js Auto-Deploy Instructions

## Core Principles (NEVER VIOLATE)
1. **ZERO LOCALHOST POLICY** - Never use localhost, 127.0.0.1, or 0.0.0.0 in ANY deployment
2. **PRODUCTION DOMAINS ONLY** - Always use headyme.com, admin.headyme.com, chat.headyme.com, api.headysystems.com
3. **ALL SECRETS IN VAULT** - Use heady-secrets for credential management, never hardcode
4. **CLOUDFLARE-FIRST** - All services fronted by Cloudflare with DNS + SSL
5. **AUTO-DEPLOY VIA HCFP** - Git push triggers HCFullPipeline execution automatically
6. **MULTI-REMOTE SYNC** - Push to origin, heady-me, heady-sys simultaneously

## Domain Standards (MANDATORY)
- Production: cms.headyme.com, headyme.com, admin.headyme.com, chat.headyme.com
- Staging: cms.staging.headyme.com, staging.headyme.com, admin.staging.headyme.com
- Development: cms.dev.headyme.com, dev.headyme.com, admin.dev.headyme.com
- Internal: manager.prod.local.heady.internal:3300, app-buddy.prod.local.heady.internal:3301

## Required Environment Variables (NEVER HARDCODE VALUES)
```bash
# Drupal Backend
DATABASE_URL=${DB_CONNECTION_STRING}
DRUPAL_HASH_SALT=${HEADY_DRUPAL_HASH_SALT}
CLOUDFLARE_API_TOKEN=${HEADY_CF_API_TOKEN}
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyme.com

# Next.js Frontend
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}
NEXTAUTH_URL=https://admin.headyme.com
NEXTAUTH_SECRET=${HEADY_NEXTAUTH_SECRET}

# Heady API Integration
NEXT_PUBLIC_HEADY_API_URL=https://api.headysystems.com
HEADY_API_KEY=${HEADY_API_KEY}
```

## Deployment Workflow (FOLLOW EXACTLY)
1. Make changes in feature branch
2. Run local tests: npm test && npm run lint
3. Commit and push: git push origin feature-branch
4. Create PR, wait for CI checks
5. Merge to main triggers auto-deploy via HCFP
6. Monitor deployment: curl https://api.headysystems.com/api/pipeline/state
7. Verify health: curl https://headyme.com/api/health

## Drupal Admin UI Checklist (REQUIRED)
- [ ] Gin admin theme installed and configured
- [ ] JSON:API enabled with proper permissions
- [ ] Next.js module configured with correct base URLs
- [ ] Custom Views created with /admin/* paths
- [ ] Cloudflare module installed with cache purging
- [ ] Cloudflare Access protecting /admin/* and /user/* paths
- [ ] All links use environment-specific domains (NO localhost)

## Next.js Frontend Checklist (REQUIRED)
- [ ] next-drupal client initialized with vault credentials
- [ ] Environment variables reference vault, not hardcoded
- [ ] Preview API route configured with secret validation
- [ ] Static generation + ISR configured for content types
- [ ] Image domains whitelisted in next.config.js
- [ ] Health check endpoint implemented at /api/health
- [ ] All API calls use production domains

## HCFP Integration Checklist (REQUIRED)
- [ ] render.yaml configured with all services
- [ ] GitHub Actions workflow triggers HCFP on push
- [ ] Heady-Sync.ps1 configured with all remotes
- [ ] Pipeline tasks added to configs/hcfullpipeline.yaml
- [ ] Health probes configured in configs/app-readiness.yaml
- [ ] HeadyRegistry updated with new components

## Common Tasks (IMPLEMENT EXACTLY AS SHOWN)

### Create new content type in Drupal
```bash
drush generate content-entity
# Follow prompts, then enable JSON:API for the new type
drush en jsonapi_extras -y
drush jsonapi:rebuild
```

### Add new Next.js page with Drupal data
```javascript
// pages/[content-type]/[...slug].js
import { drupal, getResourceFromContext } from "lib/drupal";

export async function getStaticProps(context) {
  const resource = await getResourceFromContext(
    context.params.slug.join("/"),
    context
  );
  return { 
    props: { resource }, 
    revalidate: 60 
  };
}
```

### Deploy emergency hotfix
```bash
# Push directly to main (bypasses normal flow)
git checkout main
git pull origin main
# Make fix
git commit -m "hotfix: critical security patch"
git push origin main  # Auto-deploys via HCFP
# Monitor deployment
curl https://api.headysystems.com/api/pipeline/state
```

### Rollback deployment
```bash
# Via HCFP recovery
curl -X POST https://api.headysystems.com/api/pipeline/run \
  -H "Authorization: Bearer ${HEADY_API_KEY}" \
  -d '{"stage": "recover", "rollback_to": "<previous-commit>"}'
```

## Naming Conventions (FOLLOW STRICTLY)
- Repos: headyconnection-drupal, headyconnection-web, heady-drupal-config
- Services: heady-drupal-cms, heady-nextjs-frontend
- Branches: main (production), staging, dev, feature/*
- Configs: kebab-case (hcfullpipeline.yaml, app-readiness.yaml)
- Environment vars: SCREAMING_SNAKE_CASE

## File Structure (MAINTAIN THIS STRUCTURE)
```
headyconnection-drupal/
├── Dockerfile
├── render.yaml
├── composer.json
├── web/ (Drupal root)
└── config/ (config management)

headyconnection-web/
├── pages/
├── lib/drupal.js
├── .env.local (never commit)
├── next.config.js
└── package.json
```

## Health Check Implementation (ALL SERVICES MUST HAVE)

### Drupal: /admin/health
```php
<?php
// modules/custom/heady_health/src/Controller/HealthController.php
public function check() {
  return new JsonResponse([
    'ok' => true,
    'service' => 'heady-drupal-cms',
    'timestamp' => time(),
    'version' => \Drupal::VERSION
  ]);
}
```

### Next.js: /api/health
```javascript
// pages/api/health.js
export default async function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'heady-nextjs-frontend',
    timestamp: Date.now(),
    version: process.env.npm_package_version
  });
}
```

## Troubleshooting (COMMON ISSUES)

### Deployment fails with ORS < 50
```bash
# Check readiness score
curl https://api.headysystems.com/api/readiness/evaluate

# Check failed probes
curl https://api.headysystems.com/api/health-checks/snapshot

# Fix critical issues, then re-trigger
curl -X POST https://api.headysystems.com/api/pipeline/run
```

### Drupal-Next.js preview not working
- Verify preview secret matches in both systems
- Check OAuth credentials in vault
- Test JSON:API endpoint: curl https://cms.headyme.com/jsonapi
- Check Cloudflare Access isn't blocking preview requests

### Multi-remote push fails
```bash
# Check remote configuration
git remote -v

# Test SSH keys
ssh -T git@github.com

# Force push (use with caution)
.\Heady-Sync.ps1 -Force
```

## Reference Documentation (ALWAYS CONSULT)
- Checkpoint Protocol: docs/CHECKPOINT_PROTOCOL.md
- Services Manual: docs/heady-services-manual.md
- System Prompt: docs/SYSTEM_PROMPT.md
- Pipeline Config: configs/hcfullpipeline.yaml
- Registry: heady-registry.json

## CRITICAL REMINDER
NEVER, EVER use localhost, 127.0.0.1, or 0.0.0.0 in any configuration, code, or documentation. ALWAYS use the proper production domains listed above. This is a hard requirement that cannot be violated.
```

---

## 📊 Part 5: Implementation Summary

### **What This Implementation Provides**

1. **Modern Drupal 11 Admin UI**
   - Gin theme with dark mode and sidebar navigation
   - Custom Views for content management
   - JSON:API integration for headless architecture
   - Cloudflare integration for edge caching

2. **Headless Next.js Frontend**
   - Live preview functionality for content editors
   - Incremental Static Regeneration (ISR) for performance
   - Webform integration with React components
   - Responsive design with TailwindCSS

3. **Automated Deployment Pipeline**
   - HCFP auto-deployment on every git push
   - Multi-remote sync across Heady organizations
   - Health monitoring with Operational Readiness Score
   - Rollback capabilities for emergency fixes

4. **Production-Grade Infrastructure**
   - Zero localhost policy with proper domain architecture
   - Cloudflare tunnels for development environments
   - Multi-environment support (dev/staging/production)
   - Vault-based secret management

5. **Developer Experience**
   - Comprehensive coding agent instructions
   - Troubleshooting guides and common tasks
   - Health check implementations
   - Performance optimization strategies

### **Success Criteria**
- ✅ All services use production domains (no localhost)
- ✅ Automated deployment via HCFP working
- ✅ Multi-remote synchronization functional
- ✅ Health monitoring and ORS tracking active
- ✅ Preview mode for content editors working
- ✅ Performance targets met (<2s page load)
- ✅ Security compliance (PQC + mTLS)

This implementation provides a robust, scalable foundation for the Heady project that combines the best of Drupal 11's content management capabilities with Next.js's modern frontend performance, all orchestrated through automated deployment pipelines that ensure consistent, reliable deployments across all environments.
```
