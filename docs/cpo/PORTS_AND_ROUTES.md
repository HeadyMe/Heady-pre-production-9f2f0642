# Canonical Ports and Routes
>
> **Single Source of Truth** — Last Updated: 2026-02-24

Every port, domain, and service in the Heady ecosystem. If it's not listed here, it doesn't exist.

## Core Services

| Service | Port | Domain Route | Criticality |
|---------|------|--------------|-------------|
| HeadyManager (API Gateway) | 3301 | api.headysystems.com, manager.* | 🔴 Critical |
| HCFP Auto-Success | — | Background daemon | 🔴 Critical |
| Lens Feeder (Telemetry) | — | Background daemon | 🟡 High |

## Public Websites — Primary Brands

| Brand | Port | Domain | Purpose |
|-------|------|--------|---------|
| HeadyBuddy | 9000 | headybuddy.org | AI companion portal |
| HeadySystems | 9001 | headysystems.com | Platform & corporate |
| HeadyConnection | 9002 | headyconnection.org | Impact & community |
| HeadyMCP | 9003 | headymcp.com | MCP connector marketplace |
| HeadyIO | 9004 | headyio.com | Developer portal |
| HeadyMe | 9005 | headyme.com | Personal AI cloud |

## Public Websites — Variant TLDs

| Brand | Port | Domain |
|-------|------|--------|
| HeadyBuddy (.org variant) | 9010 | headybuddy.org |
| HeadyConnection (.org) | 9011 | headyconnection.org |
| HeadyMCP (.com) | 9012 | headymcp.com |
| HeadyMe (.com) | 9013 | headyme.com |
| HeadySystems (.com) | 9014 | headysystems.com |
| Instant | 9015 | instant.headyme.com |
| 1ime1 | 9016 | 1ime1.com |

## Application Sites

| App | Port | Domain | Purpose |
|-----|------|--------|---------|
| HeadyWeb | 3000 | app.headyme.com | AI-powered search shell |
| Admin UI | 5173 | dashboard.headysystems.com | Ops command center |

## Edge & Observability

| Service | Port | Domain |
|---------|------|--------|
| Edge Worker | — | heady-edge-node.emailheadyconnection.workers.dev |
| Cloudflare Tunnel | — | All external domains → local ports |
| Nginx AI Gateway | 11442 | ai.headysystems.com |
| Ollama Core | 11434 | ollama.headysystems.com |

## API Endpoints (on HeadyManager :3301)

| Endpoint | Purpose |
|----------|---------|
| `/api/resilience/status` | Circuit breaker, cache, pool dashboard |
| `/api/resilience/breakers` | All circuit breaker states |
| `/api/resilience/caches` | Cache hit rates and sizes |
| `/api/resilience/pools` | Connection pool utilization |
| `/api/budget/route` | Cost-optimal AI model routing |
| `/api/budget/models` | Available model inventory |
| `/api/auth/*` | Authentication endpoints |
| `/api/headybuddy-config` | HeadyBuddy configuration |
| `/api/layer/*` | Layer management |

## Rules

1. **Never change a port** without updating `ecosystem.config.js`, `.cloudflared/config.yml`, and this doc.
2. **New sites** get the next sequential port (currently 9017).
3. **All external traffic** routes through Cloudflare Tunnel — never expose ports directly.
