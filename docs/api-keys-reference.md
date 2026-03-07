# Heady Systems — API Services Reference

> Last updated: 2026-03-07 | Source: GCP Secret Manager + `.env` (local only)

> [!CAUTION]
> **Never commit API keys, tokens, or secrets to this file or any repository file.**
> All secrets are stored in GCP Secret Manager and loaded via environment variables at runtime.
> See `.env.example` for the required variable names.

---

## ✅ Active Services (12)

| Env Var | Service | Purpose |
|---|---|---|
| `DATABASE_URL` | **Neon Postgres (Scale)** | PG 16 + pgvector, primary datastore |
| `NEON_API_KEY` | **Neon Management** | Projects, branches, autoscaling |
| `PERPLEXITY_API_KEY` | **Perplexity Sonar Pro** | Deep research with citations |
| `GROQ_API_KEY` | **Groq** | Ultra-fast LLM inference |
| `OPENAI_API_KEY` | **OpenAI** | GPT-4o, service account |
| `HF_TOKEN` | **Hugging Face** | Embeddings, HeadyVinci |
| `GEMINI_API_KEY` | **Google Gemini** | Multi-model routing |
| `GITHUB_TOKEN` | **GitHub** | Repo management, CI/CD |
| `CLOUDFLARE_API_TOKEN` | **Cloudflare** | Edge workers, DNS, CDN |
| `STRIPE_SECRET_KEY` | **Stripe (Live)** | Payment processing |
| `PINECONE_API_KEY` | **Pinecone** | Distributed vector DB |
| `SENTRY_DSN` | **Sentry** | Error tracking |

## ⚠️ Known Issues

| Env Var | Service | Issue | Fix |
|---|---|---|---|
| `CLAUDE_API_KEY` | **Anthropic** | Key valid, no credits | Top up at anthropic.com billing |
| `UPSTASH_REDIS_REST_URL` | **Upstash** | Missing URL | Get from console.upstash.com → REST API |

## 📋 Required Environment Variables

### AI Providers

`PERPLEXITY_API_KEY`, `GROQ_API_KEY`, `OPENAI_API_KEY`, `CLAUDE_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `ANTHROPIC_ORG_ID`, `HF_TOKEN`, `GEMINI_API_KEY`, `GEMINI_API_KEY_HEADY`, `GOOGLE_API_KEY`

### DevOps & Infrastructure

`GITHUB_TOKEN`, `GITHUB_TOKEN_SECONDARY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_TOKEN_2`, `CLOUDFLARE_API_TOKEN_3`, `SENTRY_AUTH_TOKEN`, `SENTRY_DSN`, `OP_SERVICE_ACCOUNT_TOKEN`

### Database & Cache

`DATABASE_URL`, `NEON_API_KEY`, `PINECONE_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

### Commerce

`STRIPE_SECRET_KEY`

### Heady Internal

`HEADY_API_KEY`, `ADMIN_TOKEN`

---

## Secret Storage

| Environment | Method |
|-------------|--------|
| **Local dev** | `.env` file (never committed) |
| **CI/CD** | GitHub Actions secrets |
| **Cloud Run** | GCP Secret Manager |
| **Cloudflare** | Workers secrets / env vars |
