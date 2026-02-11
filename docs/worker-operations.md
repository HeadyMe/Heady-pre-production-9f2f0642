# Cloudflare Worker Operations Guide

## Daily Checks
1. Monitor worker metrics:
```bash
wrangler tail
```

2. Check error rates:
```bash
curl https://api.headyconnection.org/metrics
```

## Common Procedures

### Rollback Deployment
```bash
wrangler rollback <version-id>
```

### Update Secrets
```bash
wrangler secret put HEADY_JWT_SECRET
wrangler secret put HEADY_OIDC_CLIENT_SECRET
```

### Scale Workers
Adjust in Cloudflare Dashboard:
- Workers > Settings > Scaling

## Emergency Contacts
- Cloudflare Support: support@cloudflare.com
- Heady DevOps: devops@heady.io
