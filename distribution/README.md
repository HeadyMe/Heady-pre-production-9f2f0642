<!-- HEADY_BRAND:BEGIN
<!-- ╔══════════════════════════════════════════════════════════════════╗
<!-- ║  ██╗  ██╗███████╗ █████╗ ██████╗ ██╗   ██╗                     ║
<!-- ║  ██║  ██║██╔════╝██╔══██╗██╔══██╗╚██╗ ██╔╝                     ║
<!-- ║  ███████║█████╗  ███████║██║  ██║ ╚████╔╝                      ║
<!-- ║  ██╔══██║██╔══╝  ██╔══██║██║  ██║  ╚██╔╝                       ║
<!-- ║  ██║  ██║███████╗██║  ██║██████╔╝   ██║                        ║
<!-- ║  ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝    ╚═╝                        ║
<!-- ║                                                                  ║
<!-- ║  ∞ SACRED GEOMETRY ∞  Organic Systems · Breathing Interfaces    ║
<!-- ║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ║
<!-- ║  FILE: distribution/README.md                                                    ║
<!-- ║  LAYER: root                                                  ║
<!-- ╚══════════════════════════════════════════════════════════════════╝
<!-- HEADY_BRAND:END
-->
# HeadyWeb Distribution Pack

**Every way to use, deploy, sell, and connect to the HeadyWeb ecosystem — in one folder.**

## What's Inside

| Folder | Contents |
|--------|----------|
| `headyweb/` | All forms of HeadyWeb: Desktop, Browser Shell, Web Shell, Mobile Shell |
| `browser/` | HeadyWeb Browser (local/hybrid/cloud) + extensions for Chrome, Firefox, Edge, Safari |
| `ide/` | Extensions for VS Code, JetBrains, Neovim, and others |
| `mobile/` | Android APKs for Chat, Dev, Voice, Automations, HeadyWeb Mobile |
| `mcp/` | MCP server configs and tool definitions (GitHub, Slack, Notion, Drive, Docker, Calendar) |
| `docker/` | Docker Compose profiles for every deployment combo |
| `bundles/` | App bundle definitions (Personal, Pro, Dev, Creator, Automations, Enterprise) |
| `billing-config/` | Payment schemes, pricing tiers, usage metering, revenue share configs |
| `api-clients/` | SDK templates for JS/TS, Python, Go, CLI |
| `automations/` | Connector templates for Zapier, n8n, Make, webhooks |
| `docs/` | Install guides, admin docs, connector docs |

## Deployment Modes

| Mode | Description | Docker Profile |
|------|------------|----------------|
| **Local Offline** | Everything on-device, no cloud calls | `local-offline.yml` |
| **Local Dev** | Local with hot-reload and debug | `local-dev.yml` |
| **Hybrid** | Local orchestrator + cloud models when needed | `hybrid.yml` |
| **Cloud SaaS** | Full cloud deployment | `cloud-saas.yml` |
| **API Only** | Headless API server, no UI | `api-only.yml` |
| **Full Suite** | Everything enabled | `full-suite.yml` |

## Payment Schemes (Pre-Wired)

- **Subscriptions** — Flat monthly/yearly, tiered plans
- **Usage-Based** — Pay-per-token, per-call, per-minute
- **Freemium + Trials** — Free tier + 14-day reverse trials
- **Per-Seat** — Team billing per user
- **API Monetization** — Marketplace-ready API products
- **Revenue Share** — 3rd-party plugin/agent payouts
- **Gateways** — Stripe, PayPal, Apple Pay, Google Pay pre-configured

## Quick Start

```bash
# Local offline (everything on-device)
cd docker && docker compose -f base.yml -f profiles/local-offline.yml up

# Hybrid (local + cloud fallback)
cd docker && docker compose -f base.yml -f profiles/hybrid.yml up

# Full suite (everything)
cd docker && docker compose -f base.yml -f profiles/full-suite.yml up

# Install all Android APKs
cd mobile/android && bash install-all-android.sh

# Install browser extension (Chrome)
# Load unpacked from distribution/browser/extensions/chrome/

# Install VS Code extension
code --install-extension distribution/ide/vscode/heady-dev-companion.vsix
```

## Bundle Examples

| Bundle | Includes | Price Model |
|--------|----------|-------------|
| **Personal** | Browser ext + Mobile Chat | Free / $5/mo |
| **Pro** | + Desktop + Voice + Dev tools | $12/mo |
| **Dev Pack** | Browser + IDE exts + Mobile Dev | $12/mo |
| **Creator Pack** | Browser + Voice + Automations | $15/mo |
| **Enterprise** | Everything + Admin + SSO + SLA | Custom |

---

*HeadySystems / HeadyConnection — Sacred Geometry Architecture*
