<!--
  © 2026 Heady Systems LLC.
  PROPRIETARY AND CONFIDENTIAL.
  Unauthorized copying, modification, or distribution is strictly prohibited.
-->
# Cloudflare Integration Report

> Last updated: February 2026

## Active Services

| Service | Purpose | Status |
|---------|---------|--------|
| **DNS** | 22 branded domain routing | ✅ Active |
| **Pages** | Static site hosting for all properties | ✅ Active |
| **Workers AI** | Sub-50ms edge inference | ✅ Active |
| **Vectorize** | Edge-native vector similarity search | ✅ Active |
| **KV** | Global session state cache | ✅ Active |
| **Tunnels** | Secure ingress to bare-metal conductor | ✅ Active |
| **WAF** | Web application firewall | ✅ Active |
| **SSL** | Full (strict) TLS for all domains | ✅ Active |

## Domain Configuration

All 22 domains are configured with:

- DNS proxying (orange cloud) enabled
- Full (strict) SSL/TLS mode
- HSTS headers with max-age=31536000
- Minimum TLS version 1.2

## Edge Proxy Architecture

```
Client → Cloudflare Edge (nearest PoP)
         ├── Static assets → CF Pages (cached)
         ├── AI inference → Workers AI (edge compute)
         ├── Vector search → Vectorize (edge search)
         └── API requests → CF Tunnel → HeadyConductor (bare metal)
```

## Tunnel Configuration

The `heady-main` tunnel provides secure ingress from Cloudflare's edge to the bare-metal HeadyConductor:

```bash
cloudflared tunnel run heady-main
```

Tunnel routes API traffic from `api.headysystems.com` to the local conductor running on the host machine.

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| Edge latency P50 | <50ms | ~35ms |
| Edge latency P95 | <100ms | ~75ms |
| Static TTFB | <20ms | ~15ms |
| Global availability | 99.9% | 99.95% |
