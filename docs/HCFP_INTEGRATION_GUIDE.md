<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: docs/HCFP_INTEGRATION_GUIDE.md                                                    ║
<!-- ║  LAYER: docs                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HCFP Integration Guide - Localhost to Domains + Clean Builds + IDE Extensions

## Overview

This guide covers the complete HCFP (HCFullPipeline) integration that:

1. **Replaces localhost with internal domains** - Making services explicitly discoverable
2. **Implements clean builds on every change** - With intelligent error handling
3. **Integrates IDE extensions** - VS Code, JetBrains, and other editors
4. **Creates PWA desktop apps** - For seamless desktop integration
5. **Provides error recovery** - No blind rebuilds, intelligent classification

## Quick Start

### 1. Localhost-to-Domain Migration

```bash
# Dry-run to see what will change
node scripts/migrate-localhost-to-domains.js --dry-run

# Execute migration
node scripts/migrate-localhost-to-domains.js

# Verify no localhost references remain
node scripts/migrate-localhost-to-domains.js --verify-only
```

**Domain Mapping:**
- `localhost:3300` → `manager.dev.local.heady.internal:3300`
- `localhost:5432` → `db-postgres.dev.local.heady.internal:5432`
- `localhost:6379` → `db-redis.dev.local.heady.internal:6379`
- (and 12 more service mappings)

### 2. Setup PWA Desktop App

```bash
# Setup all browsers (Chrome, Edge, Firefox)
.\scripts\setup-pwa-desktop.ps1 -All

# Or specific browser
.\scripts\setup-pwa-desktop.ps1 -Chrome
.\scripts\setup-pwa-desktop.ps1 -Edge
```

Creates:
- Desktop shortcuts
- Start Menu entries
- PWA installation prompts

### 3. Install VS Code Extension

```bash
# Navigate to extension directory
cd distribution/ide/vscode

# Install dependencies
npm install

# Build extension
npm run compile

# Package for distribution
npm run package

# Or install locally in VS Code
# Extensions → Install from VSIX
```

**Features:**
- Inline code completions
- Chat sidebar
- Code explain, refactor, test generation
- Agent mode with voice input
- Direct connection to Heady Manager

### 4. Run Clean Build

```bash
# Full clean build (no cache artifacts)
npm run clean-build

# Or via CI/CD
git push origin main  # Triggers GitHub Actions
```

**What happens:**
1. Pre-flight checks (localhost validation, env vars)
2. Clean environment (remove all artifacts)
3. Install dependencies (deterministic from lock file)
4. Run tests
5. Build application
6. Error classification & recovery
7. Deploy to staging/production

## Architecture

### Service Discovery

All services are now discoverable via internal domains:

```
┌─────────────────────────────────────────────────────────────┐
│  Service Discovery: *.dev.local.heady.internal              │
├─────────────────────────────────────────────────────────────┤
│  manager.dev.local.heady.internal:3300  (API Gateway)       │
│  app-web.dev.local.heady.internal:3000  (Frontend)          │
│  db-postgres.dev.local.heady.internal:5432  (Database)      │
│  db-redis.dev.local.heady.internal:6379  (Cache)            │
│  tools-mcp.dev.local.heady.internal:3001  (MCP Gateway)     │
│  ai-ollama.dev.local.heady.internal:11434  (LLM)            │
│  (and 8 more services)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Error Classification

Errors are classified and handled intelligently:

**Transient (Auto-Retry)**
- Network timeouts
- Registry issues
- Flaky tests
- Resource contention

**Non-Recoverable (Fail Fast)**
- Syntax errors
- Missing files
- Configuration errors
- Test failures

**Infrastructure (Escalate)**
- Permission errors
- Disk/memory exhaustion
- Container issues

### Clean Build Pipeline

```
Commit → Pre-flight → Clean Build → Tests → Security Scan → Deploy
                ↓
         Error Classification
         ├─ Transient → Retry
         ├─ Non-recoverable → Fail + Alert
         └─ Infrastructure → Escalate
```

## Configuration Files

### Service Discovery
- **File**: `configs/domains/service-discovery.yaml`
- **Purpose**: Maps all localhost references to internal domains
- **Usage**: Referenced by all services for DNS resolution

### Clean Build CI
- **File**: `configs/workflows/clean-build.yml`
- **Purpose**: Full clean build on every change
- **Triggers**: Push, PR, nightly schedule

### Error Recovery
- **File**: `.windsurf/workflows/hcfp-error-recovery.md`
- **Purpose**: Error classification and recovery procedures
- **Usage**: Integrated into CI/CD pipeline

### Localhost Migration
- **File**: `.windsurf/workflows/hcfp-localhost-domain-migration.md`
- **Purpose**: Step-by-step migration guide
- **Usage**: Reference for domain replacement process

## IDE Integration

### VS Code Extension

**Location**: `distribution/ide/vscode/`

**Commands**:
- `heady.chat` - Open chat (Ctrl+Shift+H)
- `heady.explain` - Explain code (Ctrl+Shift+E)
- `heady.refactor` - Refactor selection
- `heady.tests` - Generate tests
- `heady.docs` - Generate documentation
- `heady.agent` - Agent mode
- `heady.voice` - Voice input

**Settings**:
```json
{
  "heady.apiEndpoint": "http://manager.dev.local.heady.internal:3300",
  "heady.mode": "hybrid",
  "heady.inlineCompletions": true,
  "heady.voiceEnabled": false
}
```

### Other IDEs

- **JetBrains**: `distribution/ide/jetbrains/`
- **Neovim**: `distribution/ide/neovim/`
- **Vim**: `distribution/ide/vim/`
- **Sublime**: `distribution/ide/sublime/`
- **Emacs**: `distribution/ide/emacs/`

## PWA Desktop App

### Installation

**Chrome/Edge**:
1. Run `setup-pwa-desktop.ps1 -All`
2. Click desktop shortcut
3. Click install icon in address bar
4. Click "Install"

**Firefox**:
1. Run `setup-pwa-desktop.ps1 -Firefox`
2. Click desktop shortcut
3. Bookmark or use as regular web app

### Features

- Standalone window (no browser UI)
- Offline support (service worker)
- Share target integration
- File handler integration
- Shortcuts to chat, dashboard, settings

### Manifest

**File**: `public/manifest.webmanifest`

**Key Properties**:
- `display: "standalone"` - Runs as app, not browser
- `start_url: "/"` - Opens to home page
- `icons` - App icons (192x192, 512x512, maskable)
- `shortcuts` - Quick actions (chat, dashboard, settings)
- `share_target` - Share files to app
- `file_handlers` - Handle file types

## Deployment

### Local Development

```bash
# 1. Setup hosts file (Windows)
# C:\Windows\System32\drivers\etc\hosts
127.0.0.1 manager.dev.local.heady.internal
127.0.0.1 app-web.dev.local.heady.internal
127.0.0.1 db-postgres.dev.local.heady.internal
127.0.0.1 db-redis.dev.local.heady.internal

# 2. Start services
npm run dev

# 3. Verify health
curl http://manager.dev.local.heady.internal:3300/api/health

# 4. Open PWA
# Click desktop shortcut or open in browser
```

### Staging Deployment

```bash
# 1. Push to develop branch
git push origin develop

# 2. CI/CD pipeline runs:
#    - Pre-flight checks
#    - Clean build
#    - Integration tests
#    - Security scan
#    - Deploy to staging

# 3. Verify staging
curl https://staging.heady.systems/api/health
```

### Production Deployment

```bash
# 1. Create PR from develop to main
# 2. CI/CD pipeline runs full validation
# 3. Manual approval required
# 4. Deploy to production
# 5. Smoke tests verify deployment
```

## Monitoring

### Health Checks

```bash
# Manager health
curl http://manager.dev.local.heady.internal:3300/api/health

# Service discovery
curl http://discovery.dev.local.heady.internal:8600/health

# Database
curl http://admin-postgres.dev.local.heady.internal:8080/health
```

### Metrics

**Build Metrics**:
- Build duration (target: <10 min)
- Success rate (target: >95%)
- Error type distribution
- Retry effectiveness

**Service Metrics**:
- Service health by domain
- Latency by service-to-service route
- Error rates by destination
- DNS resolution failures

### Alerts

**Critical**:
- Non-recoverable build errors
- Service unreachable
- Database connection failures

**Warning**:
- Transient errors after retries
- High latency
- DNS resolution issues

**Info**:
- Successful builds
- Service deployments
- Configuration changes

## Troubleshooting

### "Service not found" errors

1. **Check DNS resolution**:
   ```bash
   nslookup manager.dev.local.heady.internal
   ```

2. **Verify hosts file** (Windows):
   ```
   C:\Windows\System32\drivers\etc\hosts
   127.0.0.1 manager.dev.local.heady.internal
   ```

3. **Check service is running**:
   ```bash
   curl http://manager.dev.local.heady.internal:3300/api/health
   ```

### "Build failed" errors

1. **Check error classification**:
   ```bash
   grep error_type build-output.txt
   ```

2. **For transient errors**: Retry manually
3. **For code errors**: Fix the code issue
4. **For infrastructure**: Check resources (disk, memory)

### "Extension not connecting"

1. **Verify Heady Manager is running**:
   ```bash
   npm run dev
   ```

2. **Check extension settings**:
   - VS Code: Settings → Heady → API Endpoint
   - Should be: `http://manager.dev.local.heady.internal:3300`

3. **Check firewall**: Allow local connections

## References

- **Service Discovery**: `configs/service-discovery.yaml`
- **Migration Script**: `scripts/migrate-localhost-to-domains.js`
- **PWA Setup**: `scripts/setup-pwa-desktop.ps1`
- **VS Code Extension**: `distribution/ide/vscode/`
- **Clean Build Workflow**: `.github/workflows/clean-build.yml`
- **Error Recovery**: `.windsurf/workflows/hcfp-error-recovery.md`
- **Domain Migration**: `.windsurf/workflows/hcfp-localhost-domain-migration.md`
- **Registry**: `heady-registry.json`

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review relevant config files
3. Check CI/CD logs
4. Open GitHub issue with logs and reproduction steps
