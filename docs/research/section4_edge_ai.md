# Section 4: Edge AI Research
## Comprehensive Technical Report — March 2026

---

## Table of Contents
1. [Cloudflare Workers AI Platform](#1-cloudflare-workers-ai-platform)
2. [Edge Inference Patterns](#2-edge-inference-patterns)
3. [Edge AI Platform Comparison](#3-edge-ai-platform-comparison)
4. [Durable Agents on Cloudflare](#4-durable-agents-on-cloudflare)
5. [Vectorize vs pgvector](#5-vectorize-vs-pgvector)
6. [Edge-First AI Pipeline Architectures](#6-edge-first-ai-pipeline-architectures)

---

## 1. Cloudflare Workers AI Platform

### 1.1 Overview

Cloudflare Workers AI is a serverless AI inference platform that runs on Cloudflare's global network across ~300 data centers. It offers 50+ open-source models spanning LLMs, image generation, embeddings, audio, translation, and classification — all served from edge-proximate GPUs without the developer managing any infrastructure.

- **Source**: [Cloudflare Workers AI Overview](https://developers.cloudflare.com/workers-ai/)
- Models are accessed via a single binding (`env.AI.run()`) inside a Cloudflare Worker, or via the REST API from any origin.
- Pricing unit is the **Neuron** — Cloudflare's proprietary compute unit that normalizes across model sizes and task types.
- As of Developer Week 2025, Cloudflare deployed GPUs in nearly **200 cities worldwide**, making Workers AI one of the most geographically distributed inference platforms available.
- The underlying inference engine is **Infire**, a proprietary Rust-based LLM serving engine that uses granular CUDA graphs, JIT compilation, and paged KV caching to maximize GPU utilization across constrained edge hardware.

Source: [Cloudflare AI Week 2025 Updates](https://www.cloudflare.com/innovation-week/ai-week-2025/updates/), [Technical deep-dive on Infire](https://dev.to/onepoint/architecting-agentic-systems-at-the-edge-a-technical-strategic-analysis-of-the-cloudflare-3761)

---

### 1.2 Pricing Model

Workers AI uses a **Neuron-based billing** model. Every input format (tokens, audio seconds, image tiles) maps to a Neuron count, then priced uniformly.

| Plan | Free Allocation | Paid Rate |
|---|---|---|
| Workers Free | 10,000 Neurons/day | N/A — must upgrade |
| Workers Paid ($5/mo base) | 10,000 Neurons/day | **$0.011 per 1,000 Neurons** |

Source: [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

Per-model pricing was introduced in February 2025, replacing the previous bucket-based approach. This allows Cloudflare to pass on per-model optimization savings directly.

---

### 1.3 LLM Model Catalog and Pricing

#### Active LLM Models (as of early 2026)

| Model | Input ($/M tokens) | Output ($/M tokens) | Notes |
|---|---|---|---|
| `@cf/meta/llama-3.2-1b-instruct` | $0.027 | $0.201 | Smallest/fastest Llama |
| `@cf/meta/llama-3.2-3b-instruct` | $0.051 | $0.335 | |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | $0.045 | $0.384 | **Recommended fast 8B** |
| `@cf/meta/llama-3.2-11b-vision-instruct` | $0.049 | $0.676 | Multimodal (image+text) |
| `@cf/meta/llama-3.1-70b-instruct-fp8-fast` | $0.293 | $2.253 | **Recommended 70B** |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | $0.293 | $2.253 | Latest 70B variant |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | $0.270 | $0.850 | MoE, 17B × 16 experts |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | $0.497 | $4.881 | Reasoning model |
| `@cf/qwen/qwq-32b` | $0.660 | $1.000 | Reasoning model |
| `@cf/qwen/qwen3-30b-a3b-fp8` | $0.051 | $0.335 | MoE, efficient |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | $0.351 | $0.555 | 128k context, vision |
| `@cf/google/gemma-3-12b-it` | $0.345 | $0.556 | 128k context, LoRA |
| `@cf/openai/gpt-oss-120b` | $0.350 | $0.750 | OpenAI open-weight |
| `@cf/openai/gpt-oss-20b` | $0.200 | $0.300 | OpenAI open-weight, fast |
| `@cf/ibm-granite/granite-4.0-h-micro` | $0.017 | $0.112 | **Cheapest LLM** |
| `@cf/zai-org/glm-4z-flash` | $0.060 | $0.400 | 131k context window |
| `@cf/meta/llama-guard-3-8b` | $0.484 | $0.030 | Content safety classifier |

Source: [Workers AI Pricing Page](https://developers.cloudflare.com/workers-ai/platform/pricing/)

**Key observations:**
- The cheapest useful LLM is Granite 4.0 micro at $0.017/M input tokens — suitable for classification and short-form generation
- The best price/performance 8B is `llama-3.1-8b-instruct-fp8-fast` at $0.045/$0.384 per M tokens
- The most capable frontier-class model is `gpt-oss-120b` at $0.350/$0.750 — cheaper than OpenAI direct for the same model
- 2-4× inference speed improvements were rolled out in Developer Week 2025 via speculative decoding and prefix caching for top models

---

### 1.4 Embedding Model Catalog and Pricing

| Model | Dimensions | Input ($/M tokens) | Notes |
|---|---|---|---|
| `@cf/baai/bge-small-en-v1.5` | 384 | $0.020 | Fast, English |
| `@cf/baai/bge-base-en-v1.5` | 768 | $0.067 | Balanced |
| `@cf/baai/bge-large-en-v1.5` | 1024 | $0.204 | High quality, English |
| `@cf/baai/bge-m3` | Variable | $0.012 | Multilingual |
| `@cf/qwen/qwen3-embedding-0.6b` | Variable | $0.012 | Latest, multilingual |
| `@cf/pfnet/plamo-embedding-1b` | Variable | $0.019 | Japanese |
| `@cf/google/embeddinggemma-300m` | Variable | TBD | Google, 100+ languages |

Source: [Workers AI Pricing Page](https://developers.cloudflare.com/workers-ai/platform/pricing/)

---

### 1.5 Image Generation Models

| Model | Cost | Notes |
|---|---|---|
| `@cf/black-forest-labs/flux-1-schnell` | $0.0000528/512×512 tile | Fast, open |
| `@cf/black-forest-labs/flux-2-dev` | $0.00021/input tile/step | High quality |
| `@cf/black-forest-labs/flux-2-klein-4b` | $0.000059 input / $0.000287 output per tile | Ultra-fast distilled |
| `@cf/black-forest-labs/flux-2-klein-9b` | $0.015/first MP | 9B FLUX.2 variant |
| `@cf/leonardo/lucid-origin` | $0.006996/tile | Partner (Leonardo.AI) |
| `@cf/leonardo/phoenix-1.0` | $0.005830/tile | Partner (Leonardo.AI) |

---

### 1.6 Audio Model Pricing

| Model | Cost | Notes |
|---|---|---|
| `@cf/openai/whisper` | $0.0005/audio min | ASR, batch |
| `@cf/openai/whisper-large-v3-turbo` | $0.0005/audio min | Faster Whisper variant |
| `@cf/deepgram/nova-3` | $0.0052/audio min | Real-time STT |
| `@cf/deepgram/nova-3 (WebSocket)` | $0.0092/audio min | Live streaming STT |
| `@cf/deepgram/flux (WebSocket)` | $0.0077/audio min | Voice agent ASR |
| `@cf/myshell-ai/melotts` | $0.0002/audio min | TTS |
| `@cf/deepgram/aura-2-en` | $0.030/1k chars input | High-quality TTS |

---

### 1.7 Other Models

| Model | Cost | Notes |
|---|---|---|
| `@cf/huggingface/distilbert-sst-2-int8` | $0.026/M tokens | Sentiment classification |
| `@cf/baai/bge-reranker-base` | $0.003/M tokens | Reranking for RAG |
| `@cf/microsoft/resnet-50` | $2.51/M images | Image classification |
| `@cf/meta/m2m100-1.2b` | $0.342/M tokens in+out | Translation |

---

### 1.8 Rate Limits

Per [Workers AI Limits documentation](https://developers.cloudflare.com/workers-ai/platform/limits/):

| Task Type | Rate Limit |
|---|---|
| Text Generation (general) | 300 requests/minute |
| Text Embeddings | 3,000 requests/minute |
| Text Embeddings (bge-large) | 1,500 requests/minute |
| Image Classification | 3,000 requests/minute |
| Object Detection | 3,000 requests/minute |
| Text Classification | 2,000 requests/minute |
| Summarization | 1,500 requests/minute |
| Image Generation (text-to-image) | 720 requests/minute |
| Automatic Speech Recognition | 720 requests/minute |
| Translation | 720 requests/minute |

**Notes:**
- Rate limits are per task type, not per account
- Beta models may have lower limits
- Limits apply even to local Wrangler development runs

---

### 1.9 Cloudflare Vectorize Service

Vectorize is Cloudflare's managed vector database, tightly integrated with Workers AI.

#### Limits

| Feature | Limit |
|---|---|
| Indexes per account | 50,000 (Paid) / 100 (Free) |
| Vectors per index | **10,000,000** (current V2) |
| Max dimensions per vector | 1,536 (float32) |
| Metadata per vector | 10 KiB |
| Max topK with values/metadata | 20 |
| Max topK without values/metadata | 100 |
| Max upsert batch (Workers) | 1,000 |
| Max upsert batch (HTTP API) | 5,000 |
| Namespaces per index | 50,000 (Paid) / 1,000 (Free) |
| Metadata indexes per Vectorize index | 10 |
| Max namespace name | 64 bytes |

Source: [Vectorize Limits](https://developers.cloudflare.com/vectorize/platform/limits/)

#### Pricing

| Metric | Free Tier | Paid Tier |
|---|---|---|
| Queried vector dimensions | 30M/month | First 50M included, then **$0.01/M** |
| Stored vector dimensions | 5M total | First 10M included, then **$0.05/100M** |

**No charges** for CPU, memory, index hours, or number of indexes.

**Example cost scenarios** (from [Vectorize Pricing](https://developers.cloudflare.com/vectorize/platform/pricing/)):

| Workload | Dimensions | Vectors | Queries/mo | Est. Monthly Cost |
|---|---|---|---|---|
| Experiment | 384 | 5,000 | 10,000 | ~$0.06 (within free tier) |
| Scaling | 768 | 25,000 | 50,000 | ~$0.59 |
| Production | 768 | 50,000 | 200,000 | ~$1.94 |
| Large | 768 | 250,000 | 500,000 | ~$5.86 |
| XL | 1,536 | 500,000 | 1,000,000 | ~$23.42 |

Vectorize is exceptionally cheap at moderate scale. At $47/month for 1M 1536-dim vectors with 1M reads and 1M writes, it competes favorably with managed alternatives.

Source: [Liveblocks Vector Database Comparison](https://liveblocks.io/blog/whats-the-best-vector-database-for-building-ai-products)

---

## 2. Edge Inference Patterns

### 2.1 Streaming Responses (SSE / Server-Sent Events)

Workers AI natively supports streaming inference by passing `stream: true` to any text generation model. The Worker returns a `ReadableStream` formatted as SSE that clients consume via standard `EventSource` or fetch streaming APIs.

```typescript
// Worker streaming handler
const stream = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
  prompt: body.prompt,
  stream: true,
  max_tokens: 1000
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  }
});
```

Source: [How to Use Cloudflare Workers AI](https://oneuptime.com/blog/post/2026-01-28-cloudflare-workers-ai/view), [Cloudflare Agents — Using AI Models](https://developers.cloudflare.com/agents/api-reference/using-ai-models/)

**Streaming benefits at the edge:**
- First token arrives directly from the nearest Cloudflare PoP, eliminating origin round-trip latency
- Avoids buffering large model outputs that would exceed Worker memory limits
- Particularly important for reasoning models (DeepSeek R1, QwQ-32B) which generate long chain-of-thought before answering

**WebSocket streaming** is also supported for bidirectional low-latency connections — critical for voice agents using Deepgram's real-time STT/TTS models on Workers AI.

---

### 2.2 Batch Processing

Workers AI introduced an **async batch API** in Developer Week 2025. Batch mode allows:
- Submitting groups of inference requests as a single API call
- Asynchronous processing with result polling or webhook delivery
- Cost savings on models that support batch (marked in the catalog with `Batch` capability)

Models supporting batch: Llama 3.3 70B, Llama 4 Scout, Qwen3, BGE embeddings (large/base/small), Aura-2 TTS.

Batch is well-suited for:
- Offline document embedding pipelines
- Bulk content classification
- Pre-computing embeddings for Vectorize ingestion
- Evaluation and testing runs

---

### 2.3 Caching Strategies at the Edge

#### Response Caching
For deterministic or near-deterministic prompts (temperature=0, fixed system prompts), responses can be cached at the Cloudflare Cache layer. Cache-Control headers on the Worker response control CDN TTLs. This eliminates inference costs entirely for repeated identical queries.

#### Prefix Caching (KV Cache)
Cloudflare introduced **prefix caching** on the inference backend in Developer Week 2025. For long system prompts shared across many requests (e.g., a static RAG preamble), the KV cache state is reused, reducing TTFT and compute costs.

#### Semantic Cache via AI Gateway
Cloudflare's **AI Gateway** provides semantic caching — responses to semantically similar (but not identical) prompts are cached and returned without re-running inference. This is distinct from exact-match caching.

AI Gateway also provides:
- Unified logging across OpenAI, Anthropic, Workers AI, etc.
- Rate limiting
- Token usage analytics
- Dynamic routing (failover between providers)

The AI Gateway is currently free to use, with no per-token markup on proxied providers.

Source: [Cloudflare AI Gateway Pricing](https://www.truefoundry.com/blog/understanding-cloudflare-ai-gateway-pricing-a-complete-breakdown), [Developer Week 2025 Recap](https://flaredup.substack.com/p/developer-week-2025-recap-everything)

#### Embedding Caching
Embeddings should be computed once and cached in Vectorize or Workers KV. Workers KV is eventually consistent and globally replicated — suitable for read-heavy embedding lookups. Durable Objects provide strongly consistent key-value storage for embedding metadata requiring consistency.

#### Edge Cache Pattern (CDN + KV)
For cacheable AI responses (e.g., product recommendations, FAQ answers):
1. Worker checks Workers KV for cached response (sub-millisecond read)
2. On miss: runs inference, stores result in KV with TTL
3. On hit: returns instantly from cache

This pattern can reduce inference costs by 60–80% for typical RAG workloads with repeated queries.

---

### 2.4 Context Window Limitations

Most Workers AI models have undocumented or model-specific context windows. Notable documented windows:
- `@cf/zai-org/glm-4z-flash`: **131,072 tokens**
- `@cf/mistralai/mistral-small-3.1-24b-instruct`: **128k tokens**
- `@cf/google/gemma-3-12b-it`: **128k tokens**
- `@cf/mistral/mistral-7b-instruct-v0.1`: **32k tokens**
- Most smaller Llama models: 4k–8k tokens (inferred from base model specs)

For long-context RAG, use models with 128k+ context or chunk documents and use Vectorize retrieval.

---

## 3. Edge AI Platform Comparison

### 3.1 High-Level Comparison Matrix

| Dimension | Cloudflare Workers AI | AWS Bedrock | Azure AI (Phi/Foundry) | Vercel AI SDK (Edge) |
|---|---|---|---|---|
| **Inference location** | 300+ edge PoPs (200 with GPUs) | Regional (us-east-1 etc.) | Regional data centers | Edge PoPs (via partner CDN) |
| **Cold start** | <1ms (V8 isolates) | 100–500ms (container) | 100–500ms | <50ms (V8 isolates) |
| **P50 global latency** | 10–30ms | 80–200ms | 80–200ms | 10–30ms (edge runtime) |
| **Model selection** | 50+ open-source models | 100+ (Claude, Titan, Llama, Mistral) | GPT-4, o-series, Phi family | Passthrough to any API |
| **Cheapest LLM** | $0.017/M in (Granite micro) | $0.10/M in (Llama 3.2 1B via on-demand) | Free (Phi-3 mini/3.5 mini) | Depends on model API |
| **Custom models** | LoRA fine-tunes on select models | Full fine-tuning + import | Full fine-tuning + RAI | N/A (proxies external APIs) |
| **Integrated vector DB** | Vectorize (edge-native) | None (separate service) | None (separate service) | None |
| **Streaming** | Native SSE + WebSocket | Via SDK, regional | Via SDK, regional | Native (AI SDK useChat) |
| **Stateful agents** | Durable Objects (built-in) | Lambda + DynamoDB | Azure Functions + CosmosDB | Not natively supported |
| **DX / SDK** | `env.AI.run()`, Vercel AI SDK | Boto3, Bedrock SDK | Azure SDK, Foundry SDK | `useChat`, `useCompletion` |
| **Pricing model** | Pay-per-Neuron (no idle cost) | Pay-per-token or provisioned | Pay-per-token (Phi free) | Passthrough + platform fee |
| **Observability** | AI Gateway, Tail Workers | CloudWatch, X-Ray | Application Insights | Vercel Analytics |
| **Execution limits** | 30s CPU (5min cron), 128MB RAM | 15min (Lambda), 10GB RAM | 10min (Consumption), 1.5GB | 10s (Edge), 300s (Pro serverless) |

Sources: [Cloudflare Workers vs Lambda vs Cloud Functions comparison](https://inventivehq.com/blog/cloudflare-workers-vs-aws-lambda-vs-google-cloud-functions-vs-azure-functions-comparison), [Vercel AI Review 2026](https://www.truefoundry.com/blog/vercel-ai-review-2026-we-tested-it-so-you-dont-have-to), [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), [Azure Foundry Models Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/)

---

### 3.2 Pricing Deep-Dive

#### Cloudflare Workers AI — LLM Inference
- **Llama 3.1 8B (fp8-fast)**: $0.045 input / $0.384 output per 1M tokens
- **Llama 3.3 70B**: $0.293 input / $2.253 output per 1M tokens
- **DeepSeek R1 32B**: $0.497 input / $4.881 output per 1M tokens

#### AWS Bedrock — LLM Inference (on-demand, us-east-1)
- **Claude 3.5 Sonnet**: $6.00 input / $30.00 output per 1M tokens
- **Claude 3.7 Sonnet**: $3.00 input / $15.00 output per 1M tokens
- **Llama 3.2 1B**: $0.10 / $0.10 per 1M tokens (symmetric)
- **Llama 3.2 11B**: $0.35 / $0.35 per 1M tokens
- **Llama 3.2 90B**: $2.00 / $2.00 per 1M tokens
- **DeepSeek V3.1**: $0.597 / $1.730 per 1M tokens
- **Gemma 3 4B**: $0.04 / $0.08 per 1M tokens

Sources: [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), [nOps Bedrock Pricing 2026](https://www.nops.io/blog/amazon-bedrock-pricing/)

**No edge inference**: AWS Bedrock runs only in standard AWS regions. To get low-latency inference close to users, teams must either use AWS Local Zones (EC2-hosted models, more operational overhead) or pair Bedrock with CloudFront/Lambda@Edge for the API layer — but inference still runs in region.

Source: [AWS Local Zones for Conversational AI](https://aws.amazon.com/blogs/machine-learning/reduce-conversational-ai-response-time-through-inference-at-the-edge-with-aws-local-zones/)

#### Azure AI — LLM Inference
- **Phi-3-mini (4k/128k)**: Free via Azure AI Foundry (MaaS)
- **Phi-3.5-mini**: Free via MaaS
- **Phi-3-small-8k**: $0.00015 input / $0.0006 output per 1K tokens = $0.15 / $0.60 per 1M tokens
- **Phi-4-mini, Phi-4**: Free via MaaS (Microsoft model family)

Azure's Phi family is **free for inference** via the Foundry MaaS API. This makes Azure competitive for small-model use cases (Phi-3-mini at 3.8B parameters, Phi-4-mini), though model diversity is limited to Microsoft's own portfolio and partners.

Sources: [Azure Phi Pricing](https://azure.microsoft.com/en-us/products/phi), [Azure Foundry Models Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/)

#### Vercel AI SDK with Edge Functions
Vercel doesn't provide inference — it provides SDKs (`useChat`, `useCompletion`, `streamText`) and Edge Function hosting to proxy calls to external LLM providers. You pay:
- Vercel platform: $0 (Hobby) to $20/mo (Pro)
- LLM provider directly: OpenAI, Anthropic, etc. rates
- No per-token Vercel markup

**Execution limits** are a critical DX concern:
- Hobby plan: **10-second** serverless timeout
- Pro plan: **15-second** default, up to **300 seconds** configurable
- Edge Functions: strict first-byte timeout (unsuitable for heavy reasoning models)

Source: [Vercel AI Review 2026](https://www.truefoundry.com/blog/vercel-ai-review-2026-we-tested-it-so-you-dont-have-to)

---

### 3.3 Latency Benchmarks

| Platform | P50 Latency | P95 Latency | P99 Latency | Cold Start |
|---|---|---|---|---|
| Cloudflare Workers (non-AI, global) | 10–30ms | ~50ms | ~100ms | <1ms |
| Vercel Edge Functions (global) | ~106ms | ~178ms | ~328ms | <50ms |
| Vercel Serverless (warm) | ~246ms | ~563ms | ~855ms | 800–2,500ms |
| Traditional Serverless (Lambda) | 100–300ms | ~500ms | ~1,000ms+ | 100–1,000ms |

Source: [Openstatus Vercel Edge vs Serverless Benchmark](https://www.openstatus.dev/blog/monitoring-latency-vercel-edge-vs-serverless), [Digital Applied Serverless Guide](https://www.digitalapplied.com/blog/serverless-functions-vercel-cloudflare-guide)

Cloudflare Workers' sub-millisecond cold starts are due to V8 isolates vs. container-based runtimes. The platform claims a **99.99% warm request rate** through consistent hashing that routes traffic to pre-warmed isolates.

For AI inference specifically, Workers AI adds model inference latency on top of Worker execution latency. TTFT (time to first token) for `llama-3.1-8b-instruct-fp8-fast` is typically 200–500ms depending on prompt length and current GPU load, but this is served from the nearest GPU-equipped PoP, not a single region.

---

### 3.4 Developer Experience (DX) Comparison

**Cloudflare Workers AI**
- Single `env.AI.run()` call; zero infra configuration
- Full Vercel AI SDK compatibility (`workers-ai-provider`)
- TanStack AI support via `@cloudflare/tanstack-ai`
- Local dev with `wrangler dev` — model calls routed to Cloudflare (no local GPU required)
- Integrated with Vectorize, Durable Objects, KV, R2 in one platform

**AWS Bedrock**
- IAM-heavy setup with boto3 or Bedrock SDK
- No edge inference; function still needs regional deployment
- Excellent for enterprises already in AWS, poor for edge-first architectures
- Best model diversity: Claude, Titan, Llama, Mistral, Gemini in one API

**Azure AI (Phi/Foundry)**
- Free Phi models are compelling for cost-sensitive workloads
- Foundry provides unified API endpoint
- Deep Microsoft 365 / Azure AD integration
- No edge inference; regional Azure deployment only

**Vercel AI SDK**
- Best-in-class React/Next.js DX (`useChat`, resumable streams)
- Execution time limits are a real constraint for complex agents
- Acts as a proxy — developer still manages which LLM backend to use
- No persistent state primitives

Source: [Top 9 Cloudflare AI Alternatives](https://www.truefoundry.com/blog/top-9-cloudflare-ai-alternatives-and-competitors-for-2026-ranked)

---

## 4. Durable Agents on Cloudflare

### 4.1 Durable Objects Architecture

Durable Objects are Cloudflare's **stateful serverless primitive** — combining compute and storage co-located in a single globally-unique micro-server. Each Durable Object instance:
- Runs on a specific Cloudflare data center (determined by name or geography)
- Has strongly consistent, transactional SQLite storage (V2) or key-value storage
- Maintains in-memory state between requests (while active)
- Handles WebSocket connections (one-to-many)
- Schedules future work via alarms

Source: [Durable Objects Overview](https://developers.cloudflare.com/durable-objects/), [Durable Objects One Pager Sept 2025](https://cf-assets.www.cloudflare.com/slt3lc6tev37/17rXWtjsVFRTOnpK4x8sYX/d2a97d47b168e78c06955ca9afd344e2/Durable_Objects_One_Pager_-Sept_2025-__2_.pdf)

For AI agents, each Durable Object instance can serve as a **persistent agent session**:
- Maintains full conversation history in SQLite
- Streams AI responses over persistent WebSocket connections
- Schedules autonomous background tasks via alarms
- Coordinates tool calls with strongly consistent state

The Cloudflare Agents SDK (TypeScript) provides an `AIChatAgent` base class that handles all of this automatically. Source: [Cloudflare Agents Platform](https://developers.cloudflare.com/agents/)

---

### 4.2 Hibernatable WebSockets

The **Hibernation API** is the key cost optimization for long-running agent sessions:
- A Durable Object with an open WebSocket does **not** incur duration charges while hibernated
- The WebSocket connection is maintained (client connection is preserved) even while the DO is in a dormant state
- The DO wakes automatically when a new WebSocket message arrives or an alarm fires
- Without Hibernation, a DO holding a WebSocket connection bills wall-clock duration continuously — expensive for idle sessions

Source: [Durable Objects Best Practices Guide Dec 2025](https://developers.cloudflare.com/changelog/post/2025-12-15-rules-of-durable-objects/)

**When to use Hibernation:**
- Chat agents with sporadic activity (user messages separated by minutes/hours)
- Persistent voice connections that go idle
- Long-running agent workflows with polling loops

**Implementation pattern:**
```typescript
// Inside Durable Object
async webSocketMessage(ws: WebSocket, message: string) {
  // Wake from hibernation, process message, re-enter hibernation
  const state = await this.ctx.storage.get("agentState");
  const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    messages: [...state.history, { role: "user", content: message }],
    stream: true
  });
  // Stream response back over WebSocket
  for await (const chunk of response) {
    ws.send(JSON.stringify(chunk));
  }
}
```

---

### 4.3 Alarm Scheduling

Durable Object **alarms** enable time-based agent actions without polling:
- Each DO can have at most **one alarm** set at a time
- `setAlarm(timestamp)` schedules future execution
- On alarm fire, the DO wakes and runs `alarm()` handler
- Alarm billing: 1 row written (per `setAlarm()`) under SQLite backend

Use cases for AI agents:
- **Scheduled memory consolidation**: Periodically summarize conversation history to compress context
- **Proactive agent actions**: Trigger autonomous tasks on a schedule (e.g., daily briefings)
- **Session expiration**: Clean up state after inactivity timeout
- **Retry logic**: Reschedule failed tool calls with exponential backoff

Source: [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

---

### 4.4 State Persistence Patterns

#### SQLite Storage Backend (recommended for new Durable Objects)
- Full SQLite database per Durable Object instance
- Strongly consistent reads and writes (ACID)
- Same pricing as D1: $0.001/M rows read, $1.00/M rows written, $0.20/GB-month stored
- 5GB free per account on the Paid plan

**Agent state schema example:**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,       -- 'user' | 'assistant' | 'tool'
  content TEXT NOT NULL,
  metadata JSON,
  created_at INTEGER NOT NULL
);

CREATE TABLE agent_state (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### Key-Value Storage Backend (legacy, Paid only)
- 4KB read units (read $0.20/M units, write $1.00/M units)
- Simpler API but less expressive than SQL
- Suitable for simple session counters, feature flags

#### In-Memory State
- Durable Objects can maintain JavaScript objects in memory
- Survives multiple requests within a single active session
- Lost on hibernation/eviction — must be backed by SQLite for durability
- Use for: ephemeral caches, connection pooling, computed values derived from storage

---

### 4.5 Durable Objects Pricing

| Metric | Free Plan | Paid Plan |
|---|---|---|
| Requests | 100,000/day | 1M included, then $0.15/M |
| Duration (wall-clock while active) | 13,000 GB-s/day | 400,000 GB-s included, then $12.50/M GB-s |
| SQLite rows read | 5M/day | First 25B/month included, then $0.001/M |
| SQLite rows written | 100,000/day | First 50M/month included, then $1.00/M |
| Storage | 5GB total | 5GB-month included, then $0.20/GB-month |

Source: [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

**Cost optimization principle**: Use the Hibernation API to minimize billable duration. A DO that hibernates between messages accrues zero duration charges during idle periods — only CPU-active time is billed (128MB granularity per Object).

---

### 4.6 Agent Architecture: Cloudflare Agents SDK

The Agents SDK provides a complete TypeScript framework for persistent AI agents built on Durable Objects. Source: [Cloudflare Agents Overview](https://developers.cloudflare.com/agents/)

```typescript
import { AIChatAgent } from "agents/ai-chat-agent";

export class MyAgent extends AIChatAgent<Env> {
  // Message history, tools, and state managed automatically
  async onMessage(message: string) {
    // Full AI chat with tool use
    await this.chat({
      model: "@cf/meta/llama-3.1-8b-instruct",
      messages: this.history,
      tools: { searchKnowledgeBase, sendEmail }
    });
  }

  // Schedule future work
  async scheduleTask(delay: number) {
    await this.schedule(delay, "doBackgroundWork");
  }
}
```

Key features:
- **Automatic message persistence** in SQLite (survives restarts, deploys, hibernation)
- **Resumable streams**: client reconnects pick up where the stream left off
- **WebSocket native**: `useAgentChat` React hook for frontend
- **MCP server support**: expose agent as tool for other agents
- **Multi-agent orchestration**: Workers call other DO-backed agents via RPC

Cost comparison (from a real migration case study):
- AWS Lambda for equivalent stateful agent: **$237,250/month**
- Cloudflare Workers + Durable Objects equivalent: **$9,125/month** (~96% reduction)

The difference: Lambda bills wall-clock duration including I/O wait; Workers bills only CPU-active time.

Source: [Architecting Agentic Systems at the Edge](https://dev.to/onepoint/architecting-agentic-systems-at-the-edge-a-technical-strategic-analysis-of-the-cloudflare-3761)

---

## 5. Vectorize vs pgvector

### 5.1 Feature Comparison Matrix

| Feature | Cloudflare Vectorize | pgvector (self-hosted) |
|---|---|---|
| **Type** | Managed, serverless, edge-native | PostgreSQL extension, self/managed |
| **Open source** | No | Yes (MIT) |
| **Max vectors per index** | 10,000,000 (V2) | Limited only by PostgreSQL infra |
| **Max dimensions** | 1,536 | 16,000 (HNSW) |
| **Namespaces/tenancy** | 50,000 namespaces per index | Table/schema partitioning |
| **Hybrid search (FTS + vector)** | **Not supported** | Yes (via `tsvector` + pgvector) |
| **Metadata filtering** | Limited (10 indexed attributes, 64 bytes each) | Full SQL `WHERE` clauses |
| **Transactions** | No | Yes (ACID) |
| **Indexing algorithm** | Proprietary (async, optimized for reads) | HNSW (best recall) or IVFFlat (lower memory) |
| **Edge-native latency** | Sub-millisecond (internal RPC from Worker) | Variable (depends on host, network path) |
| **Connection model** | HTTP binding (Workers) | TCP (not usable in edge runtime) |
| **ORM support** | Workers SDK only (no Prisma etc.) | Incomplete in Prisma as of late 2025 |
| **Self-host option** | No | Yes |
| **Data residency compliance** | Unclear (not in CF data location suite) | Full control |
| **Pricing basis** | Vector dimensions × queries | PostgreSQL infra only |

Sources: [Liveblocks Vector DB Guide](https://liveblocks.io/blog/whats-the-best-vector-database-for-building-ai-products), [Firecrawl Best Vector Databases 2026](https://www.firecrawl.dev/blog/best-vector-databases), [Cloudflare Vectorize vs pgvector Reddit](https://www.reddit.com/r/vectordatabase/comments/1h51nel/cloudflare_vectorize_comparison_eg_w_pgvector/)

---

### 5.2 Performance Benchmarks

#### pgvector + pgvectorscale (Timescale)
- **471 QPS** at 99% recall on 50M vectors
- **11.4× better throughput** than Qdrant at the same recall
- **p95 latency 28× lower** than Pinecone s1 at 99% recall
- Uses **DiskANN + Statistical Binary Quantization** algorithm
- Self-hosting on AWS is ~75% cheaper than Pinecone for comparable workloads
- Hard ceiling: performance degrades beyond 100M vectors

Source: [Firecrawl Best Vector Databases 2026](https://www.firecrawl.dev/blog/best-vector-databases) (May 2025 benchmarks)

#### Cloudflare Vectorize
- No official QPS or latency benchmarks published by Cloudflare
- **Network latency**: effectively zero when called from Workers (internal Cloudflare RPC, not HTTP)
- From external origins: standard HTTP API with 30–100ms overhead per call depending on origin region
- Asynchronous indexing on write (reads are fast, writes are eventually consistent for search)

#### Competitive Landscape (for reference)
| Database | QPS at 50M vectors (99% recall) | p99 Latency |
|---|---|---|
| pgvectorscale | 471 | Very low |
| Qdrant | 41.47 | ~1ms at small scale |
| Pinecone | ~40 | **7ms p99** at any scale |
| Elasticsearch | ~60 (ANN) | Sub-50ms (ANN) |
| Redis | 62% more than competitors (low-dim) | Sub-millisecond |

Source: [Firecrawl Best Vector Databases](https://www.firecrawl.dev/blog/best-vector-databases)

---

### 5.3 Edge Retrieval Scenario Analysis

#### Scenario A: Cloudflare-native RAG (Vectorize)

```
User Request → Worker (PoP closest to user)
  → Vectorize query (internal RPC, ~1ms)
  → Workers AI embedding (in-process)
  → Workers AI LLM generation (edge GPU)
  → Streaming response to user
```

**Total added latency for vector retrieval**: ~1–5ms (internal to Cloudflare network)
**Advantage**: The entire RAG pipeline runs at the edge PoP nearest to the user
**Constraint**: No hybrid search, limited metadata filtering, 10M vector cap per index

#### Scenario B: Worker + Remote pgvector

```
User Request → Worker (PoP closest to user)
  → HTTP to pgvector on Supabase/Neon (external network)
    → Adds 20–200ms depending on DB region vs. Worker PoP
  → Workers AI embedding
  → Workers AI LLM
  → Streaming response
```

**Total added latency for vector retrieval**: 20–200ms (external HTTP call)
**Advantage**: Full SQL + hybrid search, unlimited scale, mature ecosystem
**Constraint**: Workers use V8 isolates — TCP socket access is not available. Must use HTTP-based PostgreSQL drivers (e.g., Supabase's REST API, Neon's HTTP serverless driver)

Source: [PingCAP Edge Functions + TiDB guide](https://www.pingcap.com/blog/reducing-latency-by-80-with-edge-functions-tidb-serverless/)

#### Decision Matrix

| Scenario | Recommended Choice | Rationale |
|---|---|---|
| Cloudflare-native stack, <10M vectors, no hybrid search | **Vectorize** | Lowest latency, zero extra infra |
| Need hybrid (vector + FTS) search | **pgvector + HTTP-compatible driver** | Vectorize lacks FTS |
| Need SQL filtering (e.g., `WHERE tenant_id = ?`) | **pgvector** | Vectorize metadata filtering is limited |
| >10M vectors | **pgvector or Pinecone** | Vectorize 10M cap requires sharding |
| Multi-tenant SaaS with 50k+ tenants | **Vectorize** (50k namespaces) or Turbopuffer | Best multi-tenant support |
| Strict data residency requirements | **pgvector (self-hosted)** | Vectorize residency unclear |
| Cost-sensitive at moderate scale | **Vectorize** | $1.94/mo for 50k vectors, 200k queries |

---

### 5.4 Consistency Model Differences

| Aspect | Vectorize | pgvector |
|---|---|---|
| Write consistency | **Eventual** (async indexing) | **Immediate** (synchronous HNSW/IVFFlat update) |
| Read after write | May see stale results briefly | Immediate consistency |
| ACID transactions | No | Yes |
| Replication | Managed by Cloudflare globally | Manual or managed PostgreSQL replication |

For most RAG use cases (document ingestion → query), eventual consistency is acceptable. For real-time scenarios where documents must be immediately searchable after ingestion (customer support ticket updates, live document editing), pgvector's synchronous indexing provides better guarantees.

---

## 6. Edge-First AI Pipeline Architectures

### 6.1 Core Design Principle

The edge-first AI pattern separates inference workloads by complexity and latency requirements:

```
Fast Path (Edge)                   Slow Path (Cloud Origin)
─────────────────                  ─────────────────────────
• Classification                   • Complex multi-step reasoning
• Semantic caching lookup          • Document ingestion / chunking
• Short-form generation            • Fine-tuning / training
• Embedding generation             • Heavy batch processing
• Intent detection                 • Long-context document analysis
• Auth / routing decisions         • Multi-agent orchestration (complex)
• Guard/safety checking            • PDF/media processing
```

The Worker serves as the **intelligent router** — determining whether to serve a response from cache, handle locally, or proxy to an appropriate cloud backend.

---

### 6.2 Workload Partitioning Strategy

#### Tier 1: Edge-only (Cloudflare Workers AI)
Best for workloads under 300ms total acceptable latency, requiring global distribution.

| Workload | Model | Latency Target |
|---|---|---|
| Intent classification | `distilbert-sst-2-int8` | <50ms |
| Short chat completions | `llama-3.2-1b-instruct` | 100–300ms |
| Embedding generation | `bge-small-en-v1.5` | 20–80ms |
| Content safety check | `llama-guard-3-8b` | 100–200ms |
| Semantic cache lookup | Vectorize similarity query | 1–5ms |
| Image classification | `resnet-50` | 30–100ms |
| Reranking | `bge-reranker-base` | 20–50ms |

#### Tier 2: Edge-orchestrated, Origin-executed
Worker handles routing/auth, delegates to Cloud Run (or other origin) for heavy tasks.

| Workload | Model/Service | Origin | Notes |
|---|---|---|---|
| Long-context reasoning | Claude, GPT-4 via AI Gateway | AWS/Azure regional | 128k+ token contexts |
| Multi-step agent workflows | LangGraph, CrewAI | Cloud Run | Complex tool chains |
| Document ingestion + chunking | Custom pipeline | Cloud Run | CPU/memory intensive |
| Fine-tuned inference | Custom models | SageMaker/Vertex | Requires provisioned GPUs |
| Video/audio processing | FFMPEG + Whisper | Cloud Run | Large file handling |

#### Tier 3: Fully Origin (Cloud Run / Cloud)
Workloads not suitable for edge:

- Large batch embedding jobs (millions of documents)
- Model fine-tuning and training
- Complex database joins (SQL workloads far from edge)
- Long-running background tasks (>5 minutes)
- Memory-intensive processing (>128MB per request)

---

### 6.3 Smart Placement for AI Workers

Cloudflare's **Smart Placement** feature automatically routes Workers to the optimal location when they make heavy use of backend services (databases, APIs):

- Analyzes request duration across candidate edge locations
- If a Worker's P50 latency is significantly lower running near the origin DB, it gets placed there
- Once placed optimally, temporary traffic drops no longer cause reversion to default location (improved in March 2025)
- Particularly relevant for AI workers that make round-trips to `pgvector` or `Cloud Run` models

Source: [Smart Placement Docs](https://developers.cloudflare.com/workers/configuration/placement/), [Smart Placement Stabilization Changelog](https://developers.cloudflare.com/changelog/2025-03-22-smart-placement-stablization/)

**Architectural guidance**: Split edge logic (auth, caching, routing) and backend logic (DB queries, heavy inference) into separate Workers. Enable Smart Placement only on the backend Worker, allowing it to run near the database while the edge Worker handles user proximity.

---

### 6.4 Reference Architecture: Edge-First RAG Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                    Client (any region)                   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP/WebSocket
┌────────────────────────▼────────────────────────────────┐
│             Cloudflare Edge Worker (PoP ~10ms)           │
│                                                          │
│  1. Auth check (JWT validation, ~1ms)                    │
│  2. Cache lookup: AI Gateway semantic cache              │
│     ├─ HIT: Return cached response (<5ms)               │
│     └─ MISS: Continue pipeline                          │
│  3. Intent classification (distilbert, ~30ms)            │
│     ├─ simple: Handle locally with 1B model              │
│     └─ complex: Route to origin pipeline                │
│  4. Safety check (llama-guard, ~100ms)                  │
│  5. Vectorize similarity search (~3ms)                  │
│  6. LLM generation with context (llama-8b, ~200ms)      │
│  7. Stream response via SSE                             │
└─────────────────────────────────────────────────────────┘
                         │ (complex queries only)
                         │ Service Binding RPC
┌────────────────────────▼────────────────────────────────┐
│           Cloud Run Origin Worker (regional)             │
│           (via Cloudflare Tunnel or public URL)          │
│                                                          │
│  - Multi-step reasoning (Claude/GPT-4)                  │
│  - Long-context document Q&A (128k+ tokens)             │
│  - Tool execution (web search, code interpreter)        │
│  - Complex RAG with pgvector hybrid search              │
│  - Result streaming back to edge Worker                 │
└─────────────────────────────────────────────────────────┘
                         │ Async
┌────────────────────────▼────────────────────────────────┐
│          Cloudflare Queues + Workers (background)        │
│                                                          │
│  - Document ingestion pipeline                         │
│  - Embedding generation + Vectorize upsert             │
│  - Memory consolidation for Durable Object agents      │
│  - Evaluation / logging pipeline                        │
└─────────────────────────────────────────────────────────┘
```

---

### 6.5 Edge + Origin Latency Trade-offs

Cloudflare Workers have no cold starts (<1ms), but a Worker calling an origin in another region adds the round-trip. Key latency figures:

| Edge Worker PoP → Origin | Network Latency |
|---|---|
| Same Cloudflare datacenter | ~1ms (internal RPC) |
| Same metro area / region | 5–15ms |
| Cross-continental (e.g., EU Worker → US-East) | 80–150ms |
| Global worst case | 200–300ms |

**Hyperdrive** mitigates database round-trip latency from Workers by maintaining persistent connection pools to PostgreSQL near the database, effectively reducing per-query overhead from 100ms+ to ~5ms for Workers far from the database.

Source: [Inventive HQ Cloudflare vs Lambda Comparison](https://inventivehq.com/blog/cloudflare-workers-vs-aws-lambda-vs-google-cloud-functions-vs-azure-functions-comparison)

**Recommendation**: For the edge-first architecture, use Cloudflare **AI Gateway's dynamic routing** to:
1. Try Workers AI first (edge, lowest latency)
2. Fall back to Bedrock/Azure on timeout or model unavailability
3. Apply rate limiting and semantic caching uniformly across providers

---

### 6.6 Adaptive Routing Pattern

Based on the ASTA (Adaptive Speech-to-Action) research model, real-world edge AI systems benefit from **metric-aware routing** that dynamically selects inference path based on:

- Query complexity (token count, context depth)
- Current edge GPU load / TTFT estimates
- User tier / SLA requirements
- Model capability requirements (multimodal, tool use, etc.)

Source: [ASTA Adaptive Edge-Cloud Inference Paper](https://arxiv.org/html/2512.12769v1)

```typescript
// Adaptive routing in Cloudflare Worker
async function routeInference(request: InferenceRequest, env: Env) {
  const complexity = await classifyComplexity(request, env);
  
  if (complexity === "simple" && request.tokenEstimate < 500) {
    // Fast path: edge 1B model, ~100ms TTFT
    return env.AI.run("@cf/meta/llama-3.2-1b-instruct", request);
  } else if (complexity === "medium" && request.tokenEstimate < 4000) {
    // Medium path: edge 8B model, ~300ms TTFT
    return env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8-fast", request);
  } else {
    // Slow path: origin with capable model, route via AI Gateway
    return routeToOrigin(request, env);
  }
}
```

---

### 6.7 Cloudflare Platform Integration Map for AI Workloads

| Layer | Cloudflare Service | Function |
|---|---|---|
| **Edge Compute** | Workers | Request handling, routing, streaming, auth |
| **AI Inference** | Workers AI + Infire | LLM, embeddings, classification, image, audio |
| **Vector Memory** | Vectorize | RAG retrieval, semantic similarity |
| **Agent State** | Durable Objects | Persistent session, WebSocket, alarms |
| **Key-Value Cache** | Workers KV | Response cache, session metadata |
| **Object Storage** | R2 | Documents, media, model artifacts |
| **SQL** | D1 | Relational data, structured metadata |
| **Observability** | AI Gateway | Request logging, caching, rate limiting |
| **Async Work** | Queues + Workflows | Background tasks, ingestion pipelines |
| **Multi-agent** | Service Bindings | Type-safe RPC between Workers/Agents |
| **Security** | Firewall for AI | Prompt injection, PII detection at edge |

---

## Summary and Recommendations

### Key Findings

1. **Cloudflare Workers AI pricing** is highly competitive for open-source models. The 8B fp8-fast models ($0.045/$0.384 per 1M tokens) offer near-frontier capability at a fraction of Bedrock/Azure pricing for equivalent model size. The free Neuron allocation (10k/day) enables prototyping at zero cost.

2. **Vectorize** is the right choice for Cloudflare-native stacks at <10M vectors. Its ~$47/month for 1M vectors at moderate query load, combined with sub-millisecond query latency from Workers, makes it unbeatable for tightly integrated edge RAG. The lack of hybrid search is the primary limitation.

3. **pgvector** (with `pgvectorscale`) is the right choice when hybrid search, SQL joins, or >10M vectors are required. With 471 QPS at 99% recall and 28× lower p95 latency than Pinecone at the same recall, it's a strong performer — but requires an HTTP-compatible driver (Supabase REST, Neon HTTP) to work from Cloudflare Workers.

4. **Durable Objects** represent the most sophisticated serverless stateful primitive available today for AI agents. The Hibernation API enables extremely low-cost persistent agent sessions (billed only for CPU-active time), and the native WebSocket + SQLite combination eliminates the need for external Redis and WebSocket infrastructure.

5. **Edge-first architecture** with a fast/slow path split provides the best price-performance balance. Classifying queries at the edge (intent classification, safety checking) with lightweight models before routing complex queries to origin allows a 60–80% reduction in expensive model invocations.

6. **AWS Bedrock** has no edge inference capability — Cloudflare Workers AI is architecturally superior for global, low-latency AI applications. Bedrock's strength is model diversity (Claude, proprietary models) not accessible on Workers AI.

7. **Vercel AI SDK** is an excellent DX layer for React/Next.js applications but is not an inference platform. Its 10–300 second execution limits make it unsuitable as the primary runtime for complex agents.

---

*Sources consolidated from: [Cloudflare Workers AI Docs](https://developers.cloudflare.com/workers-ai/), [Cloudflare Vectorize Docs](https://developers.cloudflare.com/vectorize/), [Cloudflare Durable Objects Docs](https://developers.cloudflare.com/durable-objects/), [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/), [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), [Azure AI Foundry Pricing](https://azure.microsoft.com/en-us/pricing/details/ai-foundry-models/microsoft/), [Vercel AI Review 2026](https://www.truefoundry.com/blog/vercel-ai-review-2026-we-tested-it-so-you-dont-have-to), [Firecrawl Vector DB Comparison](https://www.firecrawl.dev/blog/best-vector-databases), [Liveblocks Vector DB Guide](https://liveblocks.io/blog/whats-the-best-vector-database-for-building-ai-products), [Architecting Agentic Systems at the Edge](https://dev.to/onepoint/architecting-agentic-systems-at-the-edge-a-technical-strategic-analysis-of-the-cloudflare-3761), [Cloudflare Developer Week 2025 Recap](https://flaredup.substack.com/p/developer-week-2025-recap-everything), [Workers Placement Docs](https://developers.cloudflare.com/workers/configuration/placement/), [Openstatus Latency Benchmarks](https://www.openstatus.dev/blog/monitoring-latency-vercel-edge-vs-serverless)*
