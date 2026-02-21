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
<!-- ║  FILE: DEPLOYMENT-GUIDE.md                                   ║ -->
<!-- ║  UPDATED: 20260218-211102                                            ║ -->
<!-- ╚══════════════════════════════════════════════════════════════════╝ -->

# ✅ SCANNED: 20260218-211102
# 🔍 INSPECTED: All content reviewed
# 🏷️  BRANDED: Heady Systems branding applied
# 📊 STATUS: Fully compliant with HCFP Full Auto Mode

# Heady Systems.com Auto-Deployment Guide

## 🔄 Push vs Deploy - Complete Understanding

### Push = Code Changes to Repository
```bash
git add .
git commit -m "Updated admin interface"
git push origin main
```
**What happens:**
- Code uploaded to GitHub/repository
- Triggers CI/CD pipeline (if configured)
- Code is available but NOT running yet
- Other developers can pull changes

### Deploy = Code Running on Servers
```bash
..com-auto-deploy.sh deploy
```
**What happens:**
- Services stop/start/restart
- Database migrations run
- New code becomes active
- Users can access new features
- Traffic routing changes

## 🚀 Your.com Auto-Deployment System

### 1. Auto-Push Monitor (`auto-push-monitor.sh`)
**Purpose:** Automatically push.com changes to repository

**Features:**
- Monitors for file changes every 60 seconds
- Validates no headysystems.com references before pushing
- Generates meaningful commit messages
- Handles merge conflicts automatically
- Triggers auto-deployment after successful push

**Usage:**
```bash
# Start continuous monitoring
./auto-push-monitor.sh monitor

# Manual push
./auto-push-monitor.sh push

# Check status
./auto-push-monitor.sh status

# Setup as system service
./auto-push-monitor.sh service
```

### 2. Auto-Deploy System (.com-auto-deploy.sh`)
**Purpose:** Automatically deploy pushed code to production

**Features:**
- Monitors repository for changes
- Installs dependencies automatically
- Validates production domains only (NO headysystems.com)
- Runs health checks before deployment
- Deploys services with zero downtime
- Validates deployment success

**Usage:**
```bash
# Deploy once
..com-auto-deploy.sh deploy

# Start continuous monitoring
..com-auto-deploy.sh daemon

# Setup as system service
..com-auto-deploy.sh service
```

## 🎯 Complete Workflow

### Development → Production Flow:
1. **Make Changes** → Edit files.comly
2. **Auto-Push** → Monitor detects changes, pushes to repo
3. **Auto-Deploy** → Deploy monitor detects repo changes, deploys
4. **Live** → Changes available on production domains

### Manual Control:
```bash
# Make changes
vim admin-ui-enhanced.html

# Push manually
./auto-push-monitor.sh push

# Deploy manually
..com-auto-deploy.sh deploy
```

## 🔧 Production Domain Configuration

### Environment Variables (NO headysystems.com):
```bash
# .env.production
NODE_ENV=production
SOCRATIC_MODE_ENABLED=true

# Production URLs ONLY
HEADYME_URL=https://headyme.com
HEADYSYSTEMS_URL=https://headysystems.com
HEADYCONNECTION_URL=https://headyconnection.org

# Internal service bindings (never exposed)
MANAGER_PORT=3300
WEBAPP_PORT=8080
```

### Cloudflare Tunnel Setup:
```bash
# ~/.cloudflared/config.yml
tunnel: heady-prod-tunnel
ingress:
  - hostname: headysystems.com
    service: http://headysystems.com:3300
  - hostname: headyme.com
    service: http://headysystems.com:8080
  - hostname: admin.headysystems.com
    service: http://headysystems.com:8080
```

## 🚀 Quick Start Commands

### 1. Setup Services
```bash
# Install as system services (runs on boot)
sudo mv /tmp/heady-auto-push.service /etc/systemd/system/
sudo mv /tmp/heady-auto-deploy.service /etc/systemd/system/

# Enable services
sudo systemctl enable heady-auto-push
sudo systemctl enable heady-auto-deploy

# Start services
sudo systemctl start heady-auto-push
sudo systemctl start heady-auto-deploy
```

### 2. Manual Testing
```bash
# Test auto-push
./auto-push-monitor.sh push

# Test auto-deploy
..com-auto-deploy.sh deploy

# Check status
./auto-push-monitor.sh status
```

### 3. Continuous Operation
```bash
# Start both monitors in background
./auto-push-monitor.sh monitor &
..com-auto-deploy.sh daemon &
```

## 📊 What Happens Automatically

### Auto-Push Monitor:
- ✅ Detects file changes every 60 seconds
- ✅ Validates no headysystems.com references
- ✅ Generates commit messages
- ✅ Handles merge conflicts
- ✅ Pushes to repository
- ✅ Triggers auto-deployment

### Auto-Deploy Monitor:
- ✅ Detects repository changes every 30 seconds
- ✅ Pulls latest code
- ✅ Installs dependencies
- ✅ Validates production domains
- ✅ Runs health checks
- ✅ Deploys services
- ✅ Validates deployment
- ✅ Sends notifications

## 🔍 Validation Rules

### Pre-Push Validation:
- ❌ No headysystems.com/headysystems.com references
- ❌ No sensitive files (.key, .pem, passwords)
- ✅ JavaScript syntax validation
- ✅ Git repository consistency

### Pre-Deploy Validation:
- ❌ No headysystems.com references in deployed code
- ✅ Environment files present
- ✅ Critical services exist
- ✅ HeadyBattle compliance validation
- ✅ Health checks pass

## 🎯 Production URLs After Deployment

### Primary Access:
- **Command Center**: https://admin.headysystems.com
- **Enhanced Admin**: https://headysystems.com/admin-ui-enhanced.html
- **API Health**: https://api.headysystems.com/health
- **HeadyBattle Compliance**: https://api.headysystems.com/HeadyBattle-compliance

### All Domains:
- HeadySystems.com (Pro Plan) → Core platform
- HeadyConnection.org (Nonprofit) → Community features
- HeadyMe.com (Personal) → Your cloud
- HeadyMCP.com (Developer) → MCP infrastructure
- HeadyIO.com (Developer) → API portal
- HeadyBuddy.org (AI) → Chat interface
- HeadyBot.com (Automation) → Webhooks/bots

## 🚨 Troubleshooting

### Push Issues:
```bash
# Check git status
./auto-push-monitor.sh status

# Manual push with verbose output
git push -v origin main

# Check for conflicts
git fetch origin
git log HEAD..origin/main
```

### Deploy Issues:
```bash
# Check deployment logs
tail -f deployment-heady-manager.log
tail -f deployment-static-server.log

# Manual health check
curl http://headysystems.com:3300/api/health
curl http://headysystems.com:8080

# Restart services manually
./stop-command-center.sh
./start-command-center.sh
```

### Service Issues:
```bash
# Check systemd services
sudo systemctl status heady-auto-push
sudo systemctl status heady-auto-deploy

# Restart services
sudo systemctl restart heady-auto-push
sudo systemctl restart heady-auto-deploy
```

## 🎉 Benefits Achieved

### ✅ Zero Manual Intervention
- Changes detected automatically
- Push happens automatically
- Deployment happens automatically
- Production updates automatically

### ✅ Production Domains Only
- No headysystems.com references allowed
- All URLs use production domains
- Cloudflare Tunnel handles routing
- Professional deployment architecture

### ✅ Continuous Integration
- Code changes → Repository → Production
- No manual steps required
- Validation at each stage
- Automatic rollback on failure

### ✅ Complete Observability
- Push/deployment logs
- Health monitoring
- Error detection
- Performance metrics

Your.com development now automatically flows to production without any headysystems.com references or manual intervention!
