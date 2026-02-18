# 🌐 Heady Drupal 11 + Next.js Implementation Guide

## 🎯 Overview

This guide implements a complete headless Drupal 11 + Next.js system with HCFP auto-deploy, dual-engine validation, and production optimization for the Heady project.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drupal 11      │    │   Heady API      │    │   Next.js       │
│                 │    │                 │    │                 │
│ • Content Mgmt   │◄──►│ • Dual Engine   │◄──►│ • Frontend UI   │
│ • JSON:API      │    │ • Validation    │    │ • ISR           │
│ • Gin Theme     │    │ • Orchestration  │    │ • Preview       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Render.com    │
                    │                 │
                    │ • Auto-deploy   │
                    │ • SSL/CDN       │
                    │ • Monitoring    │
                    └─────────────────┘
```

## 🌐 Domain Structure

**Production Environment:**
- CMS Backend: https://cms.headyconnection.org
- API Endpoint: https://api.headyconnection.org/drupal-jsonapi
- Next.js Frontend: https://app.headyconnection.org
- Admin Interface: https://headyme.com/admin-ui.html

**Staging Environment:**
- CMS: https://cms.staging.headyconnection.org
- API: https://api.staging.headyconnection.org/drupal-jsonapi
- Frontend: https://app.staging.headyconnection.org

**Development Environment:**
- CMS: https://cms.dev.headyconnection.org
- API: https://api.dev.headyconnection.org/drupal-jsonapi
- Frontend: https://app.dev.headyconnection.org

## 📋 Implementation Checklist

### Phase 1: Drupal 11 Backend ✅
- [x] Composer configuration with all required modules
- [x] Dockerfile optimized for production
- [x] Render.com service configuration
- [x] Health check endpoints
- [x] Gin admin theme configuration
- [x] JSON:API and Next.js integration modules

### Phase 2: Next.js Frontend ✅
- [x] Package.json with all dependencies
- [x] Next.js configuration optimized for production
- [x] Drupal client integration
- [x] Health check API route
- [x] Dockerfile for deployment
- [x] Render.com service configuration

### Phase 3: Auto-Deploy Pipeline ✅
- [x] Render service management scripts
- [x] Migration to HeadyMe organization
- [x] Production deployment script
- [x] GitHub Actions workflows
- [x] Multi-remote sync configuration

### Phase 4: Dual-Engine Integration ✅
- [x] Socratic questioning engine
- [x] Monte Carlo exploration engine
- [x] Action interceptor for 100% validation
- [x] Render service management APIs
- [x] Learning and memory systems

## 🚀 Quick Start

### 1. Deploy Drupal 11 CMS
```bash
cd headyconnection-drupal
composer install
docker build -t heady-drupal-cms .
docker run -p 8080:80 heady-drupal-cms
```

### 2. Deploy Next.js Frontend
```bash
cd headyconnection-web
npm install
npm run build
npm start
```

### 3. Start Heady Manager
```bash
cd Heady
npm start
```

### 4. Full Production Deployment
```bash
./scripts/deploy-production.sh
```

## 🔧 Configuration

### Environment Variables

**Drupal Backend:**
```bash
DATABASE_URL=postgresql://heady:password@manager.headyme.com:5432/heady
DRUPAL_HASH_SALT=your-hash-salt
CLOUDFLARE_API_TOKEN=your-cf-token
```

**Next.js Frontend:**
```bash
NEXT_PUBLIC_DRUPAL_BASE_URL=https://cms.headyconnection.org
DRUPAL_CLIENT_ID=your-oauth-client-id
DRUPAL_CLIENT_SECRET=your-oauth-secret
DRUPAL_PREVIEW_SECRET=your-preview-secret
```

**Heady Manager:**
```bash
HEADY_API_KEY=your-api-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_AI_KEY=your-google-key
```

## 🧪 Testing

### Health Checks
```bash
# Drupal CMS
curl https://cms.headyconnection.org/admin/health

# Next.js Frontend
curl https://app.headyconnection.org/api/health

# Heady Manager
curl https://api.headyconnection.org/api/health
```

### API Endpoints
```bash
# Socratic questioning
curl -X POST https://api.headyconnection.org/api/socratic/question \
  -H "Content-Type: application/json" \
  -d '{"request": "Hello"}'

# Monte Carlo strategy
curl -X POST https://api.headyconnection.org/api/dual-engine/test \
  -H "Content-Type: application/json" \
  -d '{"test": "dual engine"}'

# Render service management
curl -X POST https://api.headyconnection.org/api/render/list \
  -H "Content-Type: application/json"
```

## 🔄 Auto-Deploy Workflow

### Git Push → Auto-Deploy
1. Push to main branch
2. GitHub Actions triggers HCFP
3. Pipeline validates with dual-engine
4. Render services auto-deploy
5. Health checks verify deployment
6. DNS/SSL updates via Cloudflare

### Manual Deployment
```bash
# Deploy specific service
npm run render deploy heady-drupal-cms

# Update environment variables
npm run render update <service-id> '{"KEY": "value"}'

# Full production deployment
./scripts/deploy-production.sh
```

## 📊 Monitoring

### Health Metrics
- System health: `/api/health`
- Dual engine status: `/api/dual-engine/status`
- Render services: `/api/render/list`
- Execution memory: `/api/memory/stats`

### Performance Metrics
- Page load times: <2 seconds
- API response: <500ms
- Memory usage: <200MB (Next.js)
- CPU utilization: <80%

## 🔒 Security

### Domain Rules
- **NEVER** use localhost, 127.0.0.1, or 0.0.0.0
- **ALWAYS** use headyme.com, cms.headyconnection.org, app.headyconnection.org
- **NO** internal paths or local file system references
- **ALL** endpoints must be public-facing and accessible

### Authentication
- OAuth2 for admin operations
- Cloudflare Access for admin paths
- API keys stored in vault
- SSL termination at Cloudflare edge

## 🎯 Success Metrics

### Deployment Success
- Deployment success rate: >95%
- Rollback frequency: <5%
- Health check pass rate: 100%
- Auto-deploy trigger success: >90%

### Performance
- Page load time: <2 seconds
- API response time: <500ms
- Memory usage: <200MB (Next.js)
- CPU utilization: <80%

### Validation
- Dual-engine coverage: 100%
- Socratic clarification rate: <20%
- Monte Carlo confidence: >0.85
- Learning system updates: 100%

## 🛠️ Troubleshooting

### Common Issues

**Deployment fails with ORS < 50**
```bash
# Check readiness score
curl https://api.headyconnection.org/api/readiness/evaluate

# Fix critical issues, then re-trigger
curl -X POST https://api.headyconnection.org/api/pipeline/run
```

**Drupal-Next.js preview not working**
```bash
# Verify preview secret matches
curl https://cms.headyconnection.org/jsonapi

# Check OAuth credentials
heady-secrets get --key DRUPAL_CLIENT_ID
```

**Render service won't start**
```bash
# Check service logs
npm run render list

# Redeploy with cache clear
npm run render deploy <service-name>
```

### Debug Commands
```bash
# Check all services
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs <service>

# Restart services
docker-compose -f docker-compose.production.yml restart
```

## 📚 Documentation

- [Ultimate Heady Coding Agent Prompt](docs/ULTIMATE-HEADY-CODING-AGENT-PROMPT.md)
- [Drupal 11 Integration Guide](docs/DRUPAL-11-INTEGRATION-GUIDE.md)
- [HCFull Pipeline Documentation](docs/HCFP-IMMEDIATE-DEPLOYMENT.md)
- [Dual Engine System](docs/DUAL-ENGINE-EXECUTION.md)

## 🎉 Conclusion

Your Heady Drupal 11 + Next.js system is now fully operational with:

✅ **Production-ready headless architecture**
✅ **100% dual-engine validation**  
✅ **Automated deployment pipeline**
✅ **Optimized for mini-computers**
✅ **Zero localhost compliance**
✅ **Multi-environment support**
✅ **Comprehensive monitoring**
✅ **Security best practices**

The system will automatically deploy on every git push, validate every action through Socratic + Monte Carlo engines, and continuously learn from all outcomes.
