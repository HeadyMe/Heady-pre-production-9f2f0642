# Heady Architecture

```
                     ┌─────────────────────────────┐
                     │   Cloudflare Edge Proxy      │
                     │   (300+ PoPs worldwide)      │
                     │   heady-edge-proxy.js        │
                     │   3013 lines | 30+ models    │
                     │   Rate limiting + Circuit     │
                     │   breaker + Prompt cache      │
                     └──────────┬──────────────┬────┘
                                │              │
                     ┌──────────▼────┐  ┌──────▼──────────┐
                     │  Edge Sites   │  │  API Proxy       │
                     │  (HTML direct)│  │  → HeadyManager  │
                     │  7 domains    │  │  → Ollama        │
                     └───────────────┘  └──────┬──────────┘
                                               │
              ┌────────────────────────────────▼───────────────────────┐
              │                   HeadyManager                         │
              │                 (Express, port 3301)                    │
              │                  2933 lines, 99 endpoints               │
              ├────────────────────────────────────────────────────────┤
              │                                                        │
              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
              │  │ Brain API │ │ Claude   │ │ Battle   │ │ HCFP     │ │
              │  │ /api/brain│ │ /api/claude │ /api/battle│ /api/hcfp│ │
              │  │ Parallel  │ │ SDK Smart│ │ Arena +  │ │ Governance│
              │  │ Race Chat │ │ Routing  │ │ Adversarial│ Engine  │ │
              │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
              │                                                        │
              │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
              │  │ Auth     │ │ Conductor│ │ Vector   │ │ Edge     │ │
              │  │ 4 methods│ │ Multi-   │ │ 3D Memory│ │ Deep Scan│ │
              │  │ Google+  │ │ Agent    │ │ + Vector │ │ + Status │ │
              │  │ Device+  │ │ Orchestra│ │ Sync     │ │          │ │
              │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
              └────────────────────────────────────────────────────────┘
                                       │
              ┌───────────┬────────────┼────────────┬──────────────┐
              │           │            │            │              │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌───▼───┐ ┌───────▼──┐
        │  Claude    │ │ OpenAI│ │  Gemini   │ │HuggingF│ │  Ollama  │
        │  SDK       │ │ GPT4o │ │  Flash    │ │ Qwen3  │ │  Local   │
        │  haiku →   │ │ -mini │ │  2.0      │ │ 235B   │ │  llama3.2│
        │  sonnet →  │ │       │ │           │ │        │ │          │
        │  opus      │ │       │ │           │ │        │ │          │
        │  Dual-Org  │ │       │ │           │ │        │ │          │
        └────────────┘ └───────┘ └───────────┘ └────────┘ └──────────┘

              ┌─────────────────────────────────────────────────────┐
              │                   20 AI Nodes                       │
              ├─────────────────────────────────────────────────────┤
              │ Core (10):  Jules · Observer · Builder · Atlas ·    │
              │             Conductor · Buddy · Bot · Maid · Lens · │
              │             Guard                                   │
              │ Premium (10): Pythia · Vinci · Patterns · Battle · │
              │               Forge · Nexus · MCP · Sims · Decomp ·│
              │               Story                                 │
              └─────────────────────────────────────────────────────┘

              ┌─────────────────────────────────────────────────────┐
              │                   7 Domains                         │
              ├─────────────────────────────────────────────────────┤
              │ headysystems.com  │ headyme.com  │ headyconnection  │
              │ headyio.com       │ headymcp.com │ headybuddy.org   │
              │ manager.headysystems.com (API)                      │
              └─────────────────────────────────────────────────────┘
```

## Claude SDK Smart Routing

| Complexity | Model | Thinking | Cost/req |
|------------|-------|----------|----------|
| LOW | claude-haiku-4-5 | No | ~$0.001 |
| MEDIUM | claude-sonnet-4 | No | ~$0.01 |
| HIGH | claude-sonnet-4 | Yes (6K tokens) | ~$0.05 |
| CRITICAL | claude-opus-4 | Yes (10K tokens) | ~$0.15 |

## Dual-Org Failover

| Org | Account | Credit |
|-----|---------|--------|
| Primary | headysystems | $30 |
| Secondary | headyconnection | $60 |
| **Total** | | **$90** |

## Tech Stack

- **Runtime**: Node.js 22 + Express
- **Edge**: Cloudflare Workers (300+ PoPs)
- **AI**: Anthropic SDK, OpenAI, Gemini, HuggingFace, Ollama
- **Auth**: Google OAuth, WARP, Device, Manual
- **Deploy**: Systemd, Docker Compose, GitHub Actions
- **Security**: Helmet (CSP/HSTS), mTLS, API keys
- **Monitoring**: HeadyLens (SoT), Watchdog (cron)
