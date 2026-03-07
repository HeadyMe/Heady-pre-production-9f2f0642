# HeadyInfer

**Production-ready multi-model inference gateway for the Heady AI platform.**

HeadyInfer replaces direct provider SDK usage with a unified gateway featuring provider racing, automatic failover, response caching, and cost optimization. It integrates seamlessly with the Heady architecture (CommonJS, Express, Sacred Geometry PHI scaling, Docker/Cloud Run).

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Provider Adapters](#provider-adapters)
- [Circuit Breaker](#circuit-breaker)
- [Provider Racing](#provider-racing)
- [Response Cache](#response-cache)
- [Cost Tracking](#cost-tracking)
- [Task Routing](#task-routing)
- [Docker Deployment](#docker-deployment)
- [Testing](#testing)
- [File Structure](#file-structure)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         HeadyInfer                              │
│                                                                 │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │  Router  │  │  Racing    │  │ CircuitBreaker│  │  Cache  │  │
│  │ (matrix) │  │ (parallel) │  │  (PHI backoff)│  │  (LRU)  │  │
│  └──────────┘  └────────────┘  └──────────────┘  └─────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Provider Adapters                      │   │
│  │  Anthropic │ OpenAI │ Google │ Groq │ Local (Ollama)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────┐  ┌──────────────┐   │
│  │          Cost Tracker                │  │  Dedup Map   │   │
│  │  (budget caps, alerts, downgrade)    │  │  (5s window) │   │
│  └──────────────────────────────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
POST /api/v1/infer
        │
        ▼
  Validate request
        │
        ▼
  Dedup check ──────── (hit) ──► Return pending response
        │ (miss)
        ▼
  Cache check ──────── (hit) ──► Return cached response
        │ (miss)
        ▼
  Route resolution
  (matrix + affinity + budget)
        │
        ├── Racing enabled? ──► Fire N providers concurrently
        │                       Return first success
        │
        └── Sequential failover: primary → fallback1 → fallback2
                  (each wrapped in circuit breaker)
                        │
                        ▼
               Record cost, cache, audit log
                        │
                        ▼
                   Return response
```

---

## Quick Start

### 1. Install dependencies

```bash
cd heady-native-services
npm install express helmet cors compression
```

### 2. Set environment variables

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export GOOGLE_AI_API_KEY=...
export GROQ_API_KEY=gsk_...
```

### 3. Run the server

```bash
node src/services/heady-infer/server.js
```

Server starts on port **3102** by default.

### 4. Make an inference request

```bash
curl -X POST http://localhost:3102/api/v1/infer \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Explain circuit breakers in distributed systems."}],
    "taskType": "general"
  }'
```

### 5. Embed in existing Express app

```js
const { createHeadyInfer } = require('./src/services/heady-infer');
const { createRouter }      = require('./src/services/heady-infer/routes');

const gateway = createHeadyInfer();
app.use('/infer', createRouter(gateway));
```

---

## Configuration

All configuration is driven by environment variables, with sensible defaults.

### Provider Keys

| Variable            | Description                        | Default |
|---------------------|------------------------------------|---------|
| `ANTHROPIC_API_KEY` | Anthropic API key                  | (none)  |
| `OPENAI_API_KEY`    | OpenAI API key                     | (none)  |
| `GOOGLE_AI_API_KEY` | Google AI Studio API key           | (none)  |
| `GROQ_API_KEY`      | Groq Cloud API key                 | (none)  |
| `OLLAMA_ENABLED`    | Enable local Ollama adapter        | `false` |
| `OLLAMA_BASE_URL`   | Ollama base URL                    | `http://localhost:11434` |

### Server

| Variable           | Description        | Default |
|--------------------|--------------------|---------|
| `HEADY_INFER_PORT` | HTTP port          | `3102`  |
| `NODE_ENV`         | Environment        | `development` |
| `LOG_LEVEL`        | Logging verbosity  | `info`  |

### Budget

| Variable               | Description                 | Default  |
|------------------------|-----------------------------|----------|
| `BUDGET_DAILY_CAP`     | Daily spend cap (USD)       | `50`     |
| `BUDGET_MONTHLY_CAP`   | Monthly spend cap (USD)     | `500`    |
| `BUDGET_ANTHROPIC`     | Anthropic daily cap (USD)   | `20`     |
| `BUDGET_OPENAI`        | OpenAI daily cap (USD)      | `20`     |
| `BUDGET_GOOGLE`        | Google daily cap (USD)      | `10`     |
| `BUDGET_GROQ`          | Groq daily cap (USD)        | `5`      |
| `BUDGET_AUTO_DOWNGRADE`| Auto-downgrade near limits  | `true`   |

### Circuit Breaker

| Variable                | Description                          | Default |
|-------------------------|--------------------------------------|---------|
| `CB_FAILURE_THRESHOLD`  | Failures before opening circuit      | `5`     |
| `CB_TIMEOUT`            | Ms before HALF_OPEN probe            | `60000` |
| `CB_PHI_BACKOFF_BASE`   | Base backoff ms (PHI-scaled)         | `5000`  |
| `CB_PHI_BACKOFF_MAX`    | Maximum backoff ms                   | `300000`|

### Caching

| Variable              | Description                          | Default    |
|-----------------------|--------------------------------------|------------|
| `CACHE_ENABLED`       | Enable response cache                | `true`     |
| `CACHE_MAX_SIZE`      | Max cached entries (LRU eviction)    | `1000`     |
| `CACHE_DEFAULT_TTL`   | Cache TTL in ms                      | `3600000`  |
| `CACHE_BYPASS_TEMP`   | Bypass cache if temp > this value    | `0`        |

### Racing

| Variable                | Description                         | Default |
|-------------------------|-------------------------------------|---------|
| `RACING_ENABLED`        | Enable provider racing              | `true`  |
| `RACING_MAX_CONCURRENT` | Max providers to race at once       | `3`     |
| `RACING_TIMEOUT`        | Race timeout in ms                  | `10000` |

---

## API Reference

### POST `/api/v1/infer`

Unified inference endpoint.

**Request body:**
```json
{
  "messages": [{"role": "user", "content": "..."}],
  "prompt": "...",           // alternative to messages
  "taskType": "general",    // see routing section
  "model": "gpt-4o",        // optional explicit model
  "provider": "openai",     // optional explicit provider
  "temperature": 0,         // 0-2 (default: 0)
  "maxTokens": 4096,        // default: 4096
  "noCache": false          // bypass cache
}
```

**Task types:** `code_generation`, `code_review`, `architecture`, `research`, `quick_task`, `creative`, `security_audit`, `documentation`, `general`

**Response:**
```json
{
  "success": true,
  "response": {
    "provider": "anthropic",
    "model": "claude-3-5-sonnet-20241022",
    "content": "...",
    "role": "assistant",
    "finishReason": "stop",
    "usage": {"inputTokens": 150, "outputTokens": 420, "totalTokens": 570},
    "costUsd": 0.000705,
    "latencyMs": 1234,
    "timestamp": "2026-03-07T04:46:00Z"
  }
}
```

---

### POST `/api/v1/infer/stream`

Server-Sent Events streaming. Returns `text/event-stream`.

```
event: delta
data: {"text": "Hello", "provider": "anthropic"}

event: delta
data: {"text": " world", "provider": "anthropic"}

event: complete
data: {"provider": "anthropic", "model": "...", "usage": {...}, "costUsd": 0.001}

event: close
data: {}
```

---

### POST `/api/v1/infer/race`

Explicitly races all available providers. Returns the first successful response.

```json
{
  "success": true,
  "response": { ... },
  "raceAnalytics": { "anthropic": { "wins": 5, "winRate": 0.8, ... } }
}
```

---

### GET `/api/v1/providers`

List all configured providers with circuit state and metrics.

---

### GET `/api/v1/providers/:id/health`

Ping a specific provider. Returns `200` if healthy, `503` if not.

---

### GET `/api/v1/costs`

Cost dashboard: current day/month totals, remaining budget, by-provider breakdown.

---

### GET `/api/v1/costs/report?days=30`

Detailed cost report with projections, by-model and by-task breakdowns.

---

### GET `/api/v1/routing`

Current routing matrix and affinity statistics.

---

### PUT `/api/v1/routing`

Update routing for a task type at runtime.

```json
{"taskType": "code_generation", "providers": ["anthropic/claude-3-5-sonnet-20241022", "openai/gpt-4o"]}
```

---

### GET `/api/v1/metrics`

Full performance metrics: request counts, latencies, cache hit rates, circuit states, racing analytics.

---

### GET `/api/v1/health`

Quick liveness check. Add `?detailed=true` to include provider pings.

---

### POST `/api/v1/circuits/:id/reset`

Manually reset a provider's circuit breaker (e.g. after a resolved incident).

---

## Provider Adapters

Each adapter implements a standard interface: `generate()`, `stream()`, `health()`, `getModels()`, `estimateCost()`.

### Supported Models

| Provider   | Models                                                         |
|------------|----------------------------------------------------------------|
| Anthropic  | claude-3-5-sonnet-20241022, claude-3-opus-20240229, claude-3-haiku-20240307 |
| OpenAI     | gpt-4o, gpt-4o-mini, o1                                       |
| Google     | gemini-2.0-flash, gemini-1.5-pro                              |
| Groq       | llama-3.1-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768 |
| Local      | Any model loaded in Ollama (llama3.1, mistral, codellama, etc.) |

All adapters use raw HTTP (no vendor SDKs), keeping the gateway dependency-light.

---

## Circuit Breaker

Per-provider circuit breaker with three states:

```
    [CLOSED] ──5 failures/60s──► [OPEN] ──PHI backoff──► [HALF_OPEN]
       ▲                                                      │
       └──────────── 2 successes ◄────────────────────────────┘
                                         │ 1 failure ──► [OPEN]
```

**PHI-scaled backoff:** Each time a circuit re-opens, the recovery wait time increases by a factor of PHI (1.618). Starting from a 5-second base, wait times escalate to 8s, 13s, 21s, 34s... up to a configurable maximum (default 5 minutes). This mirrors natural growth patterns.

---

## Provider Racing

When `RACING_ENABLED=true`, HeadyInfer fires requests to multiple providers concurrently and returns the first successful response. Losers are cancelled.

**Weighted racing:** Providers that win races most often get higher weights and are more likely to be selected in future races. Weights decay on losses and timeout using the `weightDecay` factor (default 0.95).

**Race analytics:**
```bash
curl http://localhost:3102/api/v1/metrics | jq .racing
```

---

## Response Cache

Deterministic cache using SHA-256 keyed on `(model, messages, temperature, maxTokens)`.

- **Bypasses automatically** when `temperature > 0` (non-deterministic outputs)
- **LRU eviction** when `maxSize` is reached
- **Per-model TTL** configurable (e.g., 30 min for haiku, 1 hour for flash)
- **Cache warming** via `cache.warm(entries)` for historical data

---

## Cost Tracking

Real-time USD cost accumulation with budget enforcement:

1. Every request records `inputTokens × inputRate + outputTokens × outputRate`
2. Alerts fire at 50%, 75%, 90%, and 100% of daily/monthly caps
3. **Auto-downgrade:** At 75%+ budget utilization, requests are automatically routed to cheaper models within the same provider
4. **Budget gate:** At 100%, requests are rejected with `429 Budget Exceeded`

---

## Task Routing

The routing matrix maps each task type to an ordered list of `provider/model` strings:

```
code_generation → [anthropic/claude-3-5-sonnet, openai/gpt-4o, groq/llama-70b]
quick_task      → [groq/llama-8b-instant,        openai/gpt-4o-mini, google/gemini-flash]
architecture    → [anthropic/claude-3-opus,       openai/o1, anthropic/claude-3-5-sonnet]
security_audit  → [anthropic/claude-3-opus,       openai/o1, anthropic/claude-3-5-sonnet]
...
```

**Affinity learning:** HeadyInfer tracks success rates per `(taskType, model)` pair and gradually biases routing toward models that perform best for each task type. A minimum of 5 attempts is required before affinity data influences routing decisions.

**Update routing at runtime:**
```bash
curl -X PUT http://localhost:3102/api/v1/routing \
  -H "Content-Type: application/json" \
  -d '{"taskType": "code_generation", "providers": ["groq/llama-3.1-70b-versatile"]}'
```

---

## Docker Deployment

### Build and run

```bash
# Build image
docker build -t heady-infer:latest .

# Run with API keys
docker run -p 3102:3102 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e OPENAI_API_KEY=sk-... \
  heady-infer:latest
```

### Docker Compose

```bash
# Standard (cloud providers only)
docker-compose up heady-infer

# With local Ollama
docker-compose --profile local-models up

# With Redis (for future distributed cache)
docker-compose --profile redis up
```

### Cloud Run

```bash
gcloud run deploy heady-infer \
  --image gcr.io/PROJECT_ID/heady-infer:latest \
  --port 3102 \
  --set-env-vars ANTHROPIC_API_KEY=...,OPENAI_API_KEY=... \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 10
```

---

## Testing

```bash
# Run all tests
npx jest src/services/heady-infer/__tests__/heady-infer.test.js

# With coverage
npx jest --coverage src/services/heady-infer/__tests__/heady-infer.test.js

# Watch mode
npx jest --watch src/services/heady-infer/__tests__/heady-infer.test.js
```

The test suite covers: routing resolution, racing with win/loss tracking, circuit breaker state transitions, PHI backoff calculation, cache LRU eviction and TTL expiry, cost accumulation and alerting, failover chains, request deduplication, and cache integration.

---

## File Structure

```
heady-infer/
├── index.js              # HeadyInfer gateway class (main entrypoint)
├── server.js             # Express app + standalone startup
├── routes.js             # Express Router (all endpoints)
├── config.js             # Environment-driven configuration
├── router.js             # Task-aware routing engine
├── racing.js             # Provider racing engine
├── circuit-breaker.js    # Circuit breaker (CLOSED/OPEN/HALF_OPEN)
├── response-cache.js     # LRU response cache
├── cost-tracker.js       # Cost accumulation + budget enforcement
├── health.js             # Liveness + readiness checks
├── Dockerfile            # Production Docker image (Node 20 Alpine)
├── docker-compose.yml    # Docker Compose (gateway + Ollama + Redis)
├── providers/
│   ├── base-provider.js  # Abstract base class
│   ├── anthropic.js      # Claude adapter
│   ├── openai.js         # GPT adapter
│   ├── google.js         # Gemini adapter
│   ├── groq.js           # Groq adapter
│   └── local.js          # Ollama adapter
└── __tests__/
    └── heady-infer.test.js  # Full test suite
```

---

## Integration with Heady

Mount HeadyInfer in your existing Heady Express app:

```js
// In your main express app
const { createHeadyInfer } = require('./src/services/heady-infer');
const { createRouter }      = require('./src/services/heady-infer/routes');

const inferGateway = createHeadyInfer();

// Mount under existing API prefix
app.use('/api/v1/infer', createRouter(inferGateway));

// Or use programmatically in other services
async function getCompletion(prompt, taskType = 'general') {
  return inferGateway.generate({
    messages: [{ role: 'user', content: prompt }],
    taskType,
  });
}
```

---

## Sacred Geometry Scaling

HeadyInfer honors the Heady platform's PHI (1.618) scaling principle throughout:

- **Circuit breaker backoff:** Each recovery wait = `base × PHI^n`
- **Progressive fallback timeouts:** Each fallback attempt gets `prev × PHI` more time
- **Port:** 3102 is reserved per Heady's service port allocation

---

*HeadyInfer v1.0.0 — Built for the Heady AI Platform*
