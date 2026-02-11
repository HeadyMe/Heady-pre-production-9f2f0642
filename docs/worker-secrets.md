# Cloudflare Worker Secrets Setup

## Required Secrets
1. **GitHub Secrets**
   - `CLOUDFLARE_API_TOKEN`: Cloudflare API token with:
     - Worker:Edit
     - Account:Read
     - Zone:Read

2. **Cloudflare Worker Secrets**
   - `HEADY_JWT_SECRET`: JWT signing key
   - `HEADY_OIDC_CLIENT_SECRET`: OAuth client secret

## Setup Instructions

### GitHub Secrets
1. Go to Repository Settings > Secrets > Actions
2. Add each secret with name/value pairs

### Cloudflare Secrets
```bash
# Set secrets for each worker
wrangler secret put HEADY_JWT_SECRET --env production
wrangler secret put HEADY_OIDC_CLIENT_SECRET --env production
```
