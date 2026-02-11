# Cloudflare Worker Auth System

## Architecture Overview
- **Auth Service Worker**: Handles OAuth flows, token issuance
- **Gateway Worker**: Validates tokens, enforces RBAC
- **Backends**: Trust but verify edge headers

## Deployment Workflow
1. Update `workers/config.json` with domains
2. Set secrets:
```bash
wrangler secret put HEADY_JWT_SECRET
wrangler secret put HEADY_OIDC_CLIENT_SECRET
```
3. Run deployment:
```powershell
pwsh ./scripts/deploy-cloudflare-workers-final.ps1
```

## CI/CD Pipeline
- Auto-deploys on push to `main` branch
- Runs tests before deployment
- Canary rollout supported

## Verification
1. Check worker logs:
```bash
wrangler tail
```
2. Test endpoints:
```bash
curl https://auth.headyconnection.org/health
curl https://api.headyconnection.org/health
```
