<!-- ╔══════════════════════════════════════════════════════════════════╗ -->
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║ -->
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║ -->
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║ -->
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║ -->
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║ -->
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║ -->
<!-- ║                                                                  ║ -->
<!-- ║  ∞ SACRED GEOMETRY ∞  Heady Systems - HCFP Full Auto Mode        ║ -->
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║ -->
<!-- ║  FILE: ULTIMATE-HEADY-CODING-AGENT-PROMPT.md                                   ║ -->
<!-- ║  UPDATED: 20260218-211102                                            ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

# ULTIMATE HEADY CODING AGENT PROMPT

## 🚀 CRITICAL DEPLOYMENT RULES - NEVER VIOLATE

1. **ZERO headysystems.com**: NEVER use headysystems.com, headysystems.com, headysystems.com in ANY deployment
2. **NO INTERNAL REFS**: NEVER use internal paths, drive letters, or.com file system references  
3. **CUSTOM BRANDED DOMAINS ONLY**: ALWAYS use headyme.com, admin.headyme.com, chat.headyme.com
4. **PUBLIC-FACING URLs ONLY**: All endpoints must be accessible from the internet
5. **NO.com DEVELOPMENT PATTERNS**: NEVER use patterns that only work.comly
6. **ADMIN UI AT MAIN DOMAIN**: Admin UI goes at headyme.com/admin-ui.html, NOT admin.headyme.com
7. **MANAGER.SERVICE**: Use manager.headyme.com for backend services
8. **ABSOLUTELY NO headysystems.com**: User is EXTREMELY pissed about headysystems.com usage

**FORBIDDEN PATTERNS (NEVER USE):**
- headysystems.com:3000
- manager.headyme.com  
- file:///
- C:\path
- /home/user/path
- internal service names
- api.headyme.com (unless specifically needed)
- admin.headyme.com for admin UI

**REQUIRED PATTERNS (ALWAYS USE):**
- https://headyme.com (main site and admin UI)
- https://headyme.com/admin-ui.html (admin interface)
- https://chat.headyme.com (chat interface)
- http://manager.headyme.com (for internal services)

---

## 🧠 DUAL ENGINE EXECUTION: 100% SOCRATIC + 100% MONTE CARLO

**EVERY SINGLE ACTION MUST PASS THROUGH BOTH ENGINES:**

### 1. SOCRATIC PHASE (Question Everything)
- Challenge intent and assumptions
- Verify prerequisites
- Check for contradictions
- Generate clarifying questions if needed
- Only proceed if all critical questions resolved

### 2. MONTE CARLO PHASE (Explore Everything)
- Generate 5+ candidate strategies
- Run 1000+ simulations per strategy
- Calculate confidence scores using UCB1
- Identify risks and variance
- Choose highest confidence strategy

### 3. EXECUTION PHASE (Act Only After Approval)
- Both engines must approve
- Execute with full monitoring
- Record all outcomes
- Feed back to learning systems

---

## 🌐 DRUPAL 11 + NEXT.JS HEADLESS ARCHITECTURE

### Domain Structure (NEVER USE headysystems.com):
```
Production:
- CMS Backend: https://cms.headyconnection.org
- API Endpoint: https://api.headyconnection.org/drupal-jsonapi
- Next.js Frontend: https://app.headyconnection.org
- Admin Interface: https://headyme.com/admin-ui.html

Staging:
- CMS: https://cms.staging.headyconnection.org
- API: https://api.staging.headyconnection.org/drupal-jsonapi
- Frontend: https://app.staging.headyconnection.org

Development:
- CMS: https://cms.dev.headyconnection.org
- API: https://api.dev.headyconnection.org/drupal-jsonapi
- Frontend: https://app.dev.headyconnection.org
```

### Drupal 11 Admin UI Setup:
```bash
# Install Gin Admin Theme
composer require drupal/gin
drush en gin -y
drush config-set system.theme admin gin -y

# Enable JSON:API (included in core)
drush en jsonapi -y

# Install Next.js integration
composer require drupal/next
drush en next next_jsonapi -y

# Configure at /admin/config/services/next
# Base URL: https://app.headyconnection.org
# Preview URL: https://app.headyconnection.org/api/preview
```

### Next.js Frontend Build:
```bash
# Initialize with Heady conventions
npx create-next-app@latest headyconnection-web \
  --typescript --tailwind --app --src-dir --import-alias "@/*"

cd headyconnection-web
npm install next-drupal sharp

# Environment (.env.com - NEVER COMMIT)
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyconnection.org
DRUPAL_PREVIEW_SECRET=${HEADY_DRUPAL_PREVIEW_SECRET}
DRUPAL_CLIENT_ID=${HEADY_DRUPAL_OAUTH_CLIENT_ID}
DRUPAL_CLIENT_SECRET=${HEADY_DRUPAL_OAUTH_CLIENT_SECRET}
NEXT_IMAGE_DOMAIN=cms.headyconnection.org
```

### Core Next.js Configuration (next.config.js):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // NEVER use headysystems.com - only production domains
  images: {
    domains: [
      'cms.headyconnection.org',
      'cms.staging.headyconnection.org',
      'cms.dev.headyconnection.org',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // Performance optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  output: 'standalone',
  compress: true,
  
  // Headers for Cloudflare caching
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};
```

---

## ☁️ RENDER SERVICE MANAGEMENT

### Complete render.yaml:
```yaml
services:
  # Drupal 11 CMS Backend
  - type: web
    name: heady-drupal-cms
    runtime: docker
    repo: https://github.com:HeadyMe/headyconnection-drupal
    branch: main
    dockerfilePath: ./Dockerfile
    plan: starter
    region: oregon
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: heady-postgres
          property: connectionString
      - key: DRUPAL_HASH_SALT
        generateValue: true
    healthCheckPath: /admin/health
    domains:
      - cms.headyconnection.org
    autoDeploy: true
    
  # Next.js Frontend (Optimized for headysystemss)
  - type: web
    name: heady-nextjs-frontend
    runtime: node
    repo: https://github.com:HeadyMe/headyconnection-web
    branch: main
    buildCommand: npm ci && npm run build
    startCommand: npm start
    plan: starter
    region: oregon
    envVars:
      - key: NEXT_PUBLIC_DRUPAL_BASE_URL
        value: https://cms.headyconnection.org
      - key: NODE_OPTIONS
        value: "--max-old-space-size=460"  # Render starter tier optimization
    healthCheckPath: /api/health
    domains:
      - app.headyconnection.org
    autoDeploy: true

databases:
  - name: heady-postgres
    databaseName: heady_production
    user: heady
    plan: starter
    region: oregon
```

### Programmatic Render Management (TypeScript):
```typescript
// scripts/render-manager.ts
import fetch from 'node-fetch';

class RenderManager {
  private headers = {
    'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
    'Content-Type': 'application/json',
  };

  async listServices() {
    const response = await fetch('https://api.render.com/v1/services', {
      headers: this.headers,
    });
    return (await response.json()).data;
  }

  async deployService(serviceName: string) {
    const services = await this.listServices();
    const service = services.find(s => s.name === serviceName);
    
    if (!service) throw new Error(`Service not found: ${serviceName}`);

    await fetch(`https://api.render.com/v1/services/${service.id}/deploys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ clearCache: 'clear' }),
    });
    
    console.log(`✅ Deployed ${serviceName}`);
  }

  async updateServiceEnv(serviceId: string, envVars: Record<string, string>) {
    await fetch(`https://api.render.com/v1/services/${serviceId}/env-vars`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(
        Object.entries(envVars).map(([key, value]) => ({ key, value }))
      ),
    });
  }
}

// CLI Usage
const manager = new RenderManager();
const command = process.argv[2];
const arg = process.argv[3];

switch (command) {
  case 'list':
    const services = await manager.listServices();
    console.table(services.map(s => ({
      name: s.name,
      url: s.serviceDetails.url,
      autoDeploy: s.autoDeploy,
    })));
    break;
  case 'deploy':
    await manager.deployService(arg);
    break;
}
```

---

## 🚀 HCFP AUTO-DEPLOY & HCAutoFlow INTEGRATION

### Pipeline Configuration (configs/hcfullpipeline.yaml):
```yaml
stages:
  - id: ingest
    tasks:
      - id: detect-drupal-changes
        agent: scout
        tool: githubscanner
        params:
          repo: HeadyMe/headyconnection-drupal
          branch: main
      
      - id: detect-nextjs-changes
        agent: scout
        tool: githubscanner
        params:
          repo: HeadyMe/headyconnection-web
          branch: main

  - id: execute-major-phase
    dependencies: [plan]
    tasks:
      - id: deploy-drupal-cms
        agent: builder
        tool: render_deploy
        params:
          service: heady-drupal-cms
          wait_for_ready: true
          health_check: https://cms.headyconnection.org/admin/health
        
      - id: deploy-nextjs-frontend
        agent: builder
        tool: render_deploy
        dependencies: [deploy-drupal-cms]
        params:
          service: heady-nextjs-frontend
          wait_for_ready: true
          health_check: https://app.headyconnection.org/api/health

  - id: finalize
    dependencies: [execute-major-phase]
    tasks:
      - id: update-registry
        agent: atlas
        tool: autodoc
        params:
          update_heady_registry: true
```

### GitHub Actions Auto-Trigger (.github/workflows/deploy.yml):
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
          curl -X POST https://api.headyconnection.org/api/pipeline/run \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.HEADY_API_KEY }}" \
            -d '{
              "trigger": "git_push",
              "repo": "${{ github.repository }}",
              "branch": "${{ github.ref_name }}",
              "commit": "${{ github.sha }}"
            }'
```

---

## 🎯 headysystems OPTIMIZATION

### Ryzen 9 + 32GB RAM Optimizations:
```javascript
// next.config.js optimizations
const nextConfig = {
  // Memory optimization for 32GB RAM
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  
  // CPU optimization for Ryzen 9
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Output optimization for edge deployment
  output: 'standalone',
  
  // Image optimization
  images: {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    formats: ['image/avif', 'image/webp'],
  },
};

// Docker optimization for headysystemss
FROM node:18-alpine
RUN apk add --no-cache curl git python3 make g++ linux-headers
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Service Placement Optimization:
```yaml
# Optimal service distribution for headysystemss
services:
  # High-memory services (PostgreSQL, Redis)
  postgres:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
  
  # CPU-intensive services (Next.js build)
  nextjs-build:
    deploy:
      resources:
        limits:
          cpus: '4'
        reservations:
          cpus: '2'
  
  # Lightweight services (Nginx)
  nginx:
    deploy:
      resources:
        limits:
          memory: 256M
        reservations:
          memory: 128M
```

---

## 🔄 MIGRATION TO HEADYME ORGANIZATION

### Automated Migration Script:
```bash
#!/bin/bash
# scripts/migrate-to-headyme.sh

echo "🚀 Migrating to HeadyMe organization..."

# Step 1: Transfer GitHub repositories
gh repo edit HeadyConnection/headyconnection-web --transfer-owner HeadyMe
gh repo edit HeadyConnection/headyconnection-drupal --transfer-owner HeadyMe
gh repo edit HeadyConnection/Heady --transfer-owner HeadyMe

# Step 2: Update git remotes
cd ../headyconnection-web
git remote set-url origin git@github.com:HeadyMe/headyconnection-web.git
git remote set-url heady-me git@github.com:HeadyMe/headyconnection-web.git

# Step 3: Update Render service repositories
RENDER_API_KEY=$(heady-secrets get --key RENDER_API_KEY --environment production)

curl -X PATCH "https://api.render.com/v1/services/$(render_service_id heady-drupal-cms)" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repo": "https://github.com:HeadyMe/headyconnection-drupal"}'

echo "✅ Migration to HeadyMe complete!"
```

---

## 🧠 CODING MASTERY SYSTEM INTEGRATION

### Mistake Memory Database:
```sql
CREATE TABLE IF NOT EXISTS coding_mistakes (
  id SERIAL PRIMARY KEY,
  specification TEXT,
  error_type VARCHAR(100),
  description TEXT,
  incorrect_code TEXT,
  correct_solution TEXT,
  prevention_strategy TEXT,
  llm_source VARCHAR(50),
  embedding vector(768),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ON coding_mistakes USING ivfflat (embedding vector_cosine_ops);
```

### Pattern Library:
```sql
CREATE TABLE IF NOT EXISTS code_patterns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200),
  category VARCHAR(100),
  specification TEXT,
  solution TEXT,
  quality_score FLOAT,
  usage_count INTEGER DEFAULT 0,
  tags JSONB,
  embedding vector(768),
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Dual Engine Execution Wrapper:
```javascript
// EVERY action must pass through this
class DualEngineExecutor {
  async execute(action, context = {}) {
    // Phase 1: HeadyBattle questioning
    const HeadyBattleAnalysis = await this.HeadyBattlePhase(action, context);
    if (HeadyBattleAnalysis.needsClarification) {
      return { status: 'CLARIFICATION_NEEDED', questions: HeadyBattleAnalysis.questions };
    }
    
    // Phase 2: HeadySims exploration
    const monteCarloStrategy = await this.monteCarloPhase(
      HeadyBattleAnalysis.validatedAction,
      context
    );
    
    // Phase 3: Final validation
    const finalValidation = await this.HeadyBattleValidation(
      monteCarloStrategy.bestStrategy,
      HeadyBattleAnalysis
    );
    
    if (!finalValidation.approved) {
      return { status: 'VALIDATION_FAILED', reasons: finalValidation.concerns };
    }
    
    // Phase 4: Execute
    const result = await this.performExecution(
      monteCarloStrategy.bestStrategy,
      context
    );
    
    // Phase 5: Learn
    await this.learningPhase(action, HeadyBattleAnalysis, monteCarloStrategy, result);
    
    return { status: 'SUCCESS', result: result };
  }
}
```

---

## 📋 HEALTH CHECK IMPLEMENTATION

### All services must implement health endpoints:

**Drupal: /admin/health**
```php
<?php
// modules/custom/heady_health/src/Controller/HealthController.php
public function check() {
  return new JsonResponse([
    'ok' => true,
    'service' => 'heady-drupal-cms',
    'timestamp' => time()
  ]);
}
```

**Next.js: /api/health**
```javascript
// pages/api/health.js
export default async function handler(req, res) {
  const drupalHealthy = await checkDrupalHealth();
  
  res.status(200).json({
    ok: drupalHealthy,
    service: 'heady-nextjs-frontend',
    timestamp: Date.now(),
    checks: {
      drupal: drupalHealthy,
      memory: process.memoryUsage().heapUsed < 200 * 1024 * 1024,
    },
  });
}
```

---

## 🎯 COMMON TASKS

### Create New Content Type in Drupal:
```bash
drush generate content-entity
drush en jsonapi_extras -y
drush jsonapi:rebuild
```

### Add New Next.js Page with Drupal Data:
```javascript
// pages/[content-type]/[...slug].js
export async function getStaticProps(context) {
  const resource = await drupal.getResourceFromContext(
    context.params.slug.join("/"),
    context
  );
  return { props: { resource }, revalidate: 60 };
}
```

### Deploy Emergency Hotfix:
```bash
git checkout main
git pull origin main
# Make fix
git commit -m "hotfix: critical security patch"
git push origin main  # Auto-deploys via HCFP
```

### Rollback Deployment:
```bash
# Via Render MCP Server
render:deploy_service --service heady-nextjs-frontend --commit <previous-sha>
```

---

## 🔧 TROUBLESHOOTING

### Deployment Fails with ORS < 50:
```bash
curl https://api.headyconnection.org/api/readiness/evaluate
curl https://api.headyconnection.org/api/health-checks/snapshot
```

### Drupal-Next.js Preview Not Working:
- Verify preview secret matches in both systems
- Check OAuth credentials in vault
- Test JSON:API endpoint: curl https://cms.headyconnection.org/jsonapi

### Multi-Remote Push Fails:
```bash
git remote -v
ssh -T git@github.com
.\Heady-Sync.ps1 -Force
```

---

## 📁 FILE STRUCTURE

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
├── .env.com (never commit)
├── next.config.js
└── package.json

Heady/
├── src/
│   ├── core/dual-engine-executor.js
│   ├── engines/HeadySims-engine.js
│   ├── nodes/socrates.js
│   └── routes/coding-mastery.js
├── scripts/
│   ├── render-manager.ts
│   └── migrate-to-headyme.sh
└── docs/
    └── ULTIMATE-HEADY-CODING-AGENT-PROMPT.md
```

---

## 🎯 NAMING CONVENTIONS

- **Repos**: headyconnection-drupal, headyconnection-web, Heady
- **Services**: heady-drupal-cms, heady-nextjs-frontend
- **Branches**: main (production), staging, dev, feature/*
- **Configs**: kebab-case (hcfullpipeline.yaml, app-readiness.yaml)
- **Environment vars**: SCREAMING_SNAKE_CASE

---

## ⚡ PERFORMANCE OPTIMIZATIONS

### For headysystemss (Ryzen 9 + 32GB RAM):
- Use `--max-old-space-size=460` for Render starter tier
- Enable SWC minification
- Use standalone output
- Optimize image domains and formats
- Implement ISR with 60s revalidation

### Service Placement:
- **High-memory**: PostgreSQL, Redis
- **CPU-intensive**: Next.js builds
- **Lightweight**: Nginx, health checks

---

## 🔄 CONTINUOUS LEARNING

The system automatically:
- Reviews code every night at 2 AM
- Refactors low-quality code weekly
- Generates mastery reports monthly
- Records all mistakes to prevent repetition
- Builds pattern library from successful solutions
- Updates quality metrics continuously

---

## 🚀 DEPLOYMENT COMMANDS

### Quick Deploy:
```bash
./scripts/deploy-production.sh
```

### Manual Render Management:
```bash
npm run render list
npm run render deploy heady-nextjs-frontend
```

### Health Check:
```bash
curl https://app.headyconnection.org/api/health
curl https://cms.headyconnection.org/admin/health
```

---

## 📚 REFERENCE DOCUMENTATION

- Checkpoint Protocol: docs/CHECKPOINT_PROTOCOL.md
- Services Manual: docs/heady-services-manual.md
- System Prompt: docs/SYSTEM_PROMPT.md
- Pipeline Config: configs/hcfullpipeline.yaml
- Registry: heady-registry.json

---

## 🎯 FINAL REMINDER

**NEVER USE headysystems.com - ALWAYS USE PRODUCTION DOMAINS**
**EVERY ACTION MUST PASS THROUGH SOCRATIC + MONTE CARLO**
**ALL SECRETS IN VAULT - NEVER HARDCODE**
**AUTO-DEPLOY VIA HCFP ON EVERY GIT PUSH**
**MULTI-REMOTE SYNC ACROSS ALL ORGANIZATIONS**

This is the complete Heady project implementation guide for building production-grade Drupal 11 + Next.js systems with automated deployment, optimized for headysystemss, and enhanced with AI mastery systems.
