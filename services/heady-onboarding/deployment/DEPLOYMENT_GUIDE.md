# HeadyMe Pilot Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Setup ✅
- [ ] PostgreSQL database provisioned
- [ ] Database URL added to environment variables
- [ ] NextAuth secret generated (32+ characters)
- [ ] All OAuth provider credentials configured (minimum: Google, GitHub, HuggingFace)
- [ ] Cloudflare API token configured (for email routing)
- [ ] HeadyCloud API key obtained
- [ ] HeadyMCP API key obtained
- [ ] HeadyBuddy API key obtained

### 2. Domain & DNS Configuration ✅
- [ ] headyme.com domain configured
- [ ] SSL certificate installed
- [ ] MX records configured for @headyme.com email
- [ ] Cloudflare Email Routing enabled

### 3. Database Setup ✅
```bash
npx prisma generate
npx prisma db push
```
- [ ] User table created
- [ ] Account & Session tables created
- [ ] OnboardingLog table created
- [ ] ApiKeyUsage table created

### 4. Integration Testing ✅
- [ ] OAuth sign-in works for all configured providers
- [ ] Onboarding flow completes successfully
- [ ] Email forwarding configured correctly
- [ ] HeadyCloud workspace creation works
- [ ] HeadyMCP registration succeeds
- [ ] HeadyBuddy config sync works
- [ ] API key generation functional
- [ ] Dashboard loads correctly

### 5. Monitoring & Analytics ✅
- [ ] Health check endpoint responding: /api/health
- [ ] Error tracking configured (Sentry recommended)
- [ ] Analytics tracking setup
- [ ] Admin dashboard accessible: /api/admin/users
- [ ] Onboarding metrics dashboard: /api/admin/analytics

## Deployment Options

### Option 1: Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
```

**Required Environment Variables:**
- DATABASE_URL
- NEXTAUTH_URL (https://headyme.com)
- NEXTAUTH_SECRET
- All OAuth provider credentials
- All integration API keys

### Option 2: Docker + Cloud Run
```bash
# Build image
docker build -t heady-onboarding .

# Push to registry
docker tag heady-onboarding gcr.io/YOUR_PROJECT/heady-onboarding
docker push gcr.io/YOUR_PROJECT/heady-onboarding

# Deploy to Cloud Run
gcloud run deploy heady-onboarding \
  --image gcr.io/YOUR_PROJECT/heady-onboarding \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 3: Docker Compose (Development)
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Post-Deployment Verification

### 1. Smoke Tests
```bash
# Health check
curl https://headyme.com/api/health

# Should return:
# {"status":"healthy","timestamp":"...","services":{...}}
```

### 2. User Flow Test
1. Visit https://headyme.com
2. Click "Sign in with Google"
3. Complete authentication
4. Should redirect to /onboarding/create-account
5. Choose username → Continue
6. Configure email → Continue
7. Set permissions → Continue
8. Setup HeadyBuddy → Complete
9. Should redirect to /dashboard
10. Verify API key is displayed
11. Test quick actions (HeadyMCP, HeadyCloud, etc.)

### 3. Admin Verification
```bash
# Check user count
curl https://headyme.com/api/admin/users

# Check analytics
curl https://headyme.com/api/admin/analytics
```

## Rollback Plan

If issues arise:

### Vercel
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback [deployment-url]
```

### Docker/Cloud Run
```bash
# Revert to previous revision
gcloud run services update-traffic heady-onboarding \
  --to-revisions PREVIOUS_REVISION=100
```

## Scaling Considerations

### Database
- Start: 2 vCPU, 4GB RAM (supports ~1000 concurrent users)
- Scale: Monitor connection pool usage
- Add read replicas for > 10,000 users

### Application
- Start: 1 instance, 512MB RAM
- Auto-scale: 1-10 instances based on CPU/memory
- Cold start optimization: Keep 1 warm instance

### Rate Limiting
Add rate limiting for pilot:
- Auth endpoints: 10 requests/minute per IP
- API endpoints: 1000 requests/hour per API key
- Admin endpoints: Require authentication

## Monitoring Setup

### Sentry (Error Tracking)
```bash
npm install @sentry/nextjs

# Add to next.config.js
const { withSentryConfig } = require('@sentry/nextjs')
```

### Datadog (APM)
```bash
npm install dd-trace

# Add to server startup
require('dd-trace').init()
```

### Health Check Monitoring
Set up cron job or uptime monitor:
- Check /api/health every 1 minute
- Alert if status != "healthy"
- Alert if response time > 2 seconds

## Backup Strategy

### Database Backups
- Automated daily backups
- 30-day retention
- Test restore procedure monthly

### Configuration Backup
- Store .env.example in version control
- Document all environment variables
- Keep encrypted backup of secrets in 1Password/Vault

## Support & Troubleshooting

### Common Issues

**Issue: OAuth callback fails**
- Check NEXTAUTH_URL matches production domain
- Verify OAuth redirect URIs in provider settings

**Issue: Database connection errors**
- Verify DATABASE_URL is correct
- Check database firewall allows connections
- Ensure connection pool size is adequate

**Issue: Email forwarding not working**
- Verify Cloudflare Email Routing is enabled
- Check MX records are configured
- Test with Cloudflare dashboard

**Issue: Slow onboarding steps**
- Check database query performance
- Monitor external API calls (HeadyCloud, HeadyMCP, etc.)
- Add caching where appropriate

### Getting Help
- GitHub Issues: https://github.com/HeadyMe/heady-production/issues
- Email: eric@headyconnection.org
- Docs: https://headyio.com

## Launch Checklist

Before announcing pilot:
- [ ] All 5 onboarding steps tested end-to-end
- [ ] At least 3 OAuth providers working
- [ ] Email forwarding confirmed working
- [ ] Dashboard displays user data correctly
- [ ] API keys generated and functional
- [ ] HeadyMCP integration tested
- [ ] HeadyCloud integration tested
- [ ] HeadyBuddy integration tested
- [ ] Health check endpoint monitored
- [ ] Error tracking active
- [ ] Backup strategy implemented
- [ ] Support email configured
- [ ] Documentation published

## Success Metrics

Track these KPIs during pilot:
- **Signup conversion**: Target 60%+
- **Onboarding completion**: Target 70%+
- **Time to activate**: Target < 5 minutes
- **Daily active users**: Track trend
- **API usage per user**: Track average
- **Error rate**: Keep < 1%
- **Page load time**: Keep < 2 seconds
- **User satisfaction**: Survey after 1 week

---

**Status**: ✅ Ready for Pilot Deployment
**Last Updated**: March 7, 2026
**Maintained By**: HeadySystems Engineering Team
