# 🚀 Heady — Quick Start Guide

## Prerequisites
- Node.js 18+
- npm 9+

## 1. Start HeadyManager

```bash
cd ~/Heady
node heady-manager.js
# → Listening on :3301 | 99 endpoints | 19 services
```

Or via systemd (auto-starts on boot):
```bash
sudo systemctl start heady-manager
sudo systemctl status heady-manager
```

## 2. Verify Health

```bash
curl http://127.0.0.1:3301/api/pulse
# → { "status": "active", "version": "3.0.0" }
```

## 3. Chat with Heady Brain

```bash
curl -X POST http://127.0.0.1:3301/api/brain/chat \
  -H 'Content-Type: application/json' \
  -d '{"message": "Hello!"}'
```

The Brain API runs a **parallel race** across all configured providers:
- Claude (Anthropic SDK with smart model routing)
- OpenAI (GPT-4o-mini)
- Google Gemini (2.0 Flash)
- HuggingFace (Qwen3-235B)
- Ollama (local llama3.2)

First provider to respond wins.

## 4. Monitor Claude Usage

```bash
curl http://127.0.0.1:3301/api/brain/claude-usage
# → { "totalCost": 0.12, "budgetRemaining": { "total": 89.88 }, ... }
```

## 5. Key Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/pulse` | System health + version |
| `POST /api/brain/chat` | AI chat (parallel race) |
| `POST /api/brain/analyze` | Code/text analysis |
| `POST /api/brain/embed` | Vector embeddings |
| `POST /api/brain/search` | Knowledge search |
| `GET /api/brain/claude-usage` | Claude cost tracking |
| `GET /api/brain/memory-receipts` | Memory audit |

## 6. Environment Variables

Copy `.env.example` and fill in your keys:
```bash
cp .env.example .env
```

Required:
- `CLAUDE_API_KEY` — Anthropic API key (primary)
- `ANTHROPIC_SECONDARY_KEY` — Anthropic API key (failover)

Optional:
- `OPENAI_API_KEY` — OpenAI
- `GOOGLE_API_KEY` — Google Gemini
- `HF_TOKEN` — HuggingFace
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated)

## Architecture

```
HeadyManager (:3301) — API Gateway
├── Brain API — Multi-provider AI chat with parallel race
│   ├── Claude SDK — Smart routing (haiku → sonnet → opus)
│   ├── OpenAI/Gemini/HuggingFace — Cloud providers
│   └── Ollama — Local fallback
├── Battle API — Adversarial reasoning
├── Conductor — Multi-agent orchestration
├── HCFP — Governance engine
└── Auth — Google OAuth, device, WARP, manual
```
