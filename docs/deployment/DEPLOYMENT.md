<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
-->
# Heady AI Platform — Deployment Guide

> Last updated: February 2026  
> Consolidated canonical deployment reference.

## Architecture

```
┌─────────────────────────────────────┐
│        Cloudflare Edge              │
│  DNS + CDN + Workers AI + Tunnels   │
├─────────────────────────────────────┤
│      HeadyConductor                 │
│  Federated Liquid Router (Port 3300)│
├─────────────────────────────────────┤
│      HeadyBrain + 20 AI Nodes      │
│  + HeadySwarm + HeadyBees           │
├─────────────────────────────────────┤
│      DuckDB Vector Memory V2        │
├─────────────────────────────────────┤
│      Security: PQC + mTLS + Rate    │
└─────────────────────────────────────┘
```

## Quick Deploy

```bash
cd /home/headyme/Heady

# Regenerate all 13 templated site distributions
node scripts/generate-sites.js

# Deploy conductor
pm2 start src/heady-conductor.js --name heady-conductor

# Verify
curl https://api.headysystems.com/api/conductor/health
```

## Site Generation

The `scripts/generate-sites.js` script generates 13 branded site distributions from a shared template:

```bash
node scripts/generate-sites.js
```

**Custom (non-generated) sites** require manual updates:

- `sites/admin-ui/` — HeadyOS Admin Canvas
- `sites/headyweb/` — HeadyWeb search engine
- `sites/headyos/` — HeadyOS marketing
- `sites/headyapi/` — HeadyAPI documentation
- `sites/heady-discord/` — Discord bot landing

## Cloudflare Tunnel

All sites are served through the `heady-primary` tunnel. Config at `~/.cloudflared/config.yml`.

```bash
# Restart tunnel
sudo systemctl restart cloudflared

# Verify all routes
cloudflared tunnel info heady-primary
```

## Systemd Services

```bash
# HeadyConductor
sudo systemctl enable --now heady-conductor

# Cloudflare Tunnel
sudo systemctl enable --now cloudflared

# Check status
sudo systemctl status heady-conductor cloudflared
```

## Hugging Face Spaces

| Space | Repo | Purpose |
|-------|------|---------|
| HeadyBrain | `HeadyMe/heady-hf-space` | Main demo + Quantum IP |
| HeadySystems | `HeadyMe/headysystems-hf-space` | Platform overview |
| HeadyConnection | `HeadyMe/headyconnection-hf-space` | Nonprofit topology |

```bash
cd heady-hf-space && git add -A && git commit -m "update" && git push
```

## CI/CD (GitHub Actions)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `hf-deploy.yml` | Push to `main` | Sync to HF Spaces |
| `security-scan.yml` | PR / Push | CodeQL + TruffleHog + Gitleaks |
| `branding.yml` | PR | Block competitor names in user-facing views |

## Health Verification

```bash
# All primary domains
for domain in headyme.com headysystems.com headyconnection.org headybuddy.org headyapi.com headyio.com headymcp.com headyos.com; do
  echo "$domain: $(curl -sLo /dev/null -w '%{http_code}' https://$domain)"
done

# API health
curl -s https://api.headysystems.com/api/conductor/health | jq .
```
