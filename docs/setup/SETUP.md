<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
-->
# Heady AI Platform — Setup Guide

> Last updated: February 2026  
> Consolidated from previous setup, sync, device, and checklist docs.

## System Requirements

| Component | Minimum |
|-----------|---------|
| OS | Linux (Parrot OS 7 / Ubuntu 22+), macOS, Windows 11 |
| Node.js | 20+ |
| npm | 10+ |
| Python | 3.12+ |
| RAM | 16 GB |
| Storage | 50 GB free |

## Quick Setup

```bash
# 1. Clone & install
git clone https://github.com/headysystems/Heady.git
cd Heady && npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set HEADY_BRAIN_KEY, REDIS_URL, STRIPE_SECRET_KEY

# 3. Start
node src/heady-conductor.js
```

## Multi-Device Sync (Syncthing)

All devices sync via Syncthing over encrypted mesh:

| Folder | ID | Path | Devices |
|--------|-----|------|---------|
| Heady | `heady` | `/home/headyme/Heady` | primary, laptop, desktop, dev |
| Sites | `sites` | `/home/headyme/sites` | primary, laptop, desktop, dev |
| Knowledge | `knowledge` | `/home/headyme/.headyme` | primary, laptop, desktop |

**Dashboard:** `http://<device-ip>:8384`

## Git Configuration

```bash
git config --global user.name "HeadyMe"
git config --global user.email "e@headyconnection.org"
git config --global init.defaultBranch main
git config --global pull.rebase true
```

**Remotes:**

```
origin      git@github.com:HeadySystems/Heady.git
heady-me    git@github.com:HeadyMe/Heady.git
```

## MCP Server

Configure in `~/.config/mcp_config.json`:

```json
{
  "mcpServers": {
    "heady-local": {
      "command": "node",
      "args": ["/home/headyme/Heady/src/heady-local-server.js"],
      "cwd": "/home/headyme/Heady"
    }
  }
}
```

## Cloudflare Tunnel

Managed via `~/.cloudflared/config.yml`. All sites route through the `heady-primary` tunnel.

```bash
cloudflared tunnel run heady-primary
```

## Device Checklist

- [ ] Node.js 20+ installed
- [ ] `npm install` completes cleanly
- [ ] `.env` configured with required secrets
- [ ] Syncthing running and all folders synced
- [ ] Git remotes configured
- [ ] Cloudflare tunnel active
- [ ] `curl https://api.headysystems.com/api/conductor/health` returns `ok: true`

## Production Domains

| Domain | Purpose |
|--------|---------|
| headysystems.com | Commercial hub |
| headyme.com | Personal AI portal |
| headyio.com | Developer ecosystem |
| headyapi.com | API reference |
| headymcp.com | MCP tooling |
| headyconnection.org | Nonprofit |
| headybuddy.org | Peer support program |
| headyos.com | OS dashboard |
