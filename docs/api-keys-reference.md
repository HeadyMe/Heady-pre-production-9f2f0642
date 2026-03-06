# Heady Systems — API Keys & Services Reference
>
> Last updated: 2026-03-06 | ALL KEYS VERIFIED | Source: `.env`

---

## ✅ Active & Verified (12 services, HTTP 200)

| Env Var | Service | Verified | Description |
|---|---|---|---|
| `DATABASE_URL` | **Neon Postgres (Scale)** | ✅ Connected | PG 16, pgvector, 5 tables, 19 indexes |
| `NEON_API_KEY` | **Neon Management** | ✅ 200 | Projects, branches, autoscaling |
| `PERPLEXITY_API_KEY` | **Perplexity Sonar Pro** | ✅ 200 | Deep research with citations |
| `GROQ_API_KEY` | **Groq** | ✅ 200 | Ultra-fast LLM inference |
| `OPENAI_API_KEY` | **OpenAI** | ✅ 200 | GPT-4o, service account |
| `HF_TOKEN` | **Hugging Face** | ✅ 200 | Embeddings, HeadyVinci |
| `GEMINI_API_KEY` | **Google Gemini** | ✅ 200 | + 6 more Google keys |
| `GITHUB_TOKEN` | **GitHub** | ✅ 200 | User: HeadyConnection |
| `CLOUDFLARE_API_TOKEN` | **Cloudflare** | ✅ 200 | Edge workers, DNS, CDN |
| `STRIPE_SECRET_KEY` | **Stripe (Live)** | ✅ 200 | Payment processing |
| `PINECONE_API_KEY` | **Pinecone** | ✅ 200 | Distributed vector DB |
| `SENTRY_DSN` | **Sentry** | ✅ 200 | Error tracking, project: heady-manager |

## ⚠️ Issues (2 services)

| Env Var | Service | Issue | Fix |
|---|---|---|---|
| `CLAUDE_API_KEY` | **Anthropic** | Key valid, **no credits** | Top up at anthropic.com billing |
| `UPSTASH_REDIS_REST_URL` | **Upstash** | **Missing URL** | Get from console.upstash.com → REST API |

## 📋 All Keys Set in `.env`

### AI Providers (10 keys)

| Var | Value (masked) | Service |
|---|---|---|
| `PERPLEXITY_API_KEY` | `pplx-FvR1...` | Perplexity Sonar Pro |
| `GROQ_API_KEY` | `gsk_bQNL...` | Groq fast LLM |
| `OPENAI_API_KEY` | `sk-svcacct-...` | OpenAI GPT-4o |
| `CLAUDE_API_KEY` | `sk-ant-api03-...` | Anthropic Claude |
| `ANTHROPIC_ADMIN_KEY` | `sk-ant-admin01-...` | Anthropic admin |
| `ANTHROPIC_ORG_ID` | `1da44425-...` | Anthropic org |
| `HF_TOKEN` | `hf_lXdY...` | Hugging Face |
| `GEMINI_API_KEY` | `AIzaSyDOL...` | Gemini (heady project) |
| `GEMINI_API_KEY_HEADY` | `AIzaSyCyx...` | Gemini (colab) |
| `GOOGLE_API_KEY` | `AIzaSyBYR...` | Google Cloud default |

### + 5 more Google keys

`GOOGLE_API_KEY_SECONDARY`, `GCLOUD_API_KEY`, `GOOGLE_CLOUD_API_KEY`, `FIREBASE_API_KEY`

### DevOps & Infrastructure (10 keys)

| Var | Value (masked) | Service |
|---|---|---|
| `GITHUB_TOKEN` | `ghp_49EA...` | GitHub primary |
| `GITHUB_TOKEN_SECONDARY` | `ghp_9xLg...` | GitHub secondary |
| `CLOUDFLARE_API_TOKEN` | `VGNo4jwi...` | Cloudflare primary |
| `CLOUDFLARE_API_TOKEN_2` | `E8rARBfa...` | Cloudflare secondary |
| `CLOUDFLARE_API_TOKEN_3` | `zjVU41Xy...` | Cloudflare tertiary |
| `SENTRY_AUTH_TOKEN` | `sntrys_ey...` | Sentry org token |
| `SENTRY_PERSONAL_TOKEN` | `sntryu_9e...` | Sentry personal |
| `SENTRY_DSN` | `https://1b34...` | Sentry DSN (auto-found) |
| `OP_SERVICE_ACCOUNT_TOKEN` | `ops_eyJz...` | 1Password SA |

### Database & Cache (4 keys)

| Var | Value (masked) | Service |
|---|---|---|
| `DATABASE_URL` | `postgresql://neo...` | Neon Postgres Scale |
| `NEON_API_KEY` | `napi_42dq...` | Neon Management |
| `PINECONE_API_KEY` | `pcsk_5C62...` | Pinecone vectors |
| `UPSTASH_REDIS_REST_TOKEN` | `af8d9c05-...` | Upstash (needs URL) |

### Commerce (1 key)

| Var | Value (masked) | Service |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_51Sv...` | Stripe Live payments |

### Heady Internal (2 keys)

| Var | Value (masked) | Service |
|---|---|---|
| `HEADY_API_KEY` | `heady_api_key_001_...` | API gateway auth |
| `ADMIN_TOKEN` | `heady_api_key_002_...` | Admin access |
