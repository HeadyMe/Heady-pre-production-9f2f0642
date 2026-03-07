---
name: heady-embedding-router
description: >
  Use when routing embedding requests across multiple providers with intelligent model selection,
  circuit breaker failover, LRU caching, cost optimization, and CSL-gated provider scoring.
  Supports Nomic, Jina, Cohere, Voyage, and local Ollama. Phi-scaled cache sizes, TTLs, and
  circuit breaker parameters. Includes dimensionality reduction via MRL truncation.
  Keywords: embedding router, embedding model, multi-provider, circuit breaker, LRU cache, Nomic,
  Jina, Cohere, Voyage, Ollama, embedding cost, MRL, dimensionality reduction, Heady embedding.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Embedding Router

## When to Use This Skill

Use this skill when you need to:

- Route embedding requests to the best provider based on context
- Implement circuit breaker failover across embedding providers
- Cache embeddings with phi-scaled TTL and LRU eviction
- Optimize embedding costs across providers
- Select embedding models based on text length, language, domain
- Truncate dimensions via Matryoshka Representation Learning (MRL)

## Provider Registry (2026)

| Provider | Dimensions | Context | Cost/M tokens | Strengths |
|----------|-----------|---------|---------------|-----------|
| Nomic v2 | 768 | 512 | $0.05 | Open source, self-hostable |
| Jina v3 | 1024 | 8K | $0.018 | Long context, code |
| Cohere v4 | 1024 | 128K | $0.12 | Multimodal, domain gen |
| Voyage 3 | 2048 | 32K | $0.12 | Best MTEB, binary quant |
| BGE-M3 | 1024 | 8K | Free | Hybrid dense+sparse+ColBERT |
| GTE-Qwen2 | 1536 | 32K | Free | Best self-hosted, Apache 2.0 |

## Instructions

### 1. Routing Logic

Priority cascade:
1. **Sovereignty requirement** → local/self-hosted provider
2. **CSL-gated scoring** → `cslGate(providerScore, querySimilarity, threshold)`
3. **Text length** → long docs to Jina/Voyage, short to Nomic
4. **Cost budget** → max `ψ¹⁰ × 0.1 ≈ $0.000618` per request
5. **Domain match** → code→Jina, multilingual→Cohere, general→Voyage

### 2. Circuit Breaker (phi-scaled)

Per-provider circuit breaker:
- States: CLOSED → OPEN → HALF_OPEN → CLOSED
- Failure threshold: fib(5) = 5 consecutive errors
- Reset timeout: `1000 × ψ × fib(8)` ≈ 12,978ms
- Half-open probes: fib(3) = 2 test requests

Fallback chain: primary → secondary → local Ollama

### 3. LRU Cache (Fibonacci-sized)

- Max entries: fib(20) = 6,765
- TTL: fib(17) × 1000 = 1,597,000ms (~26.6 minutes)
- Cache key: content hash + provider + options
- Batch cache lookup for efficiency

### 4. Dimensionality Reduction (MRL)

When storage budget is limited, truncate embeddings:
- Full (provider native): max quality
- 384d: suitable for most Heady operations (standard)
- 256d: acceptable for pre-filtering
- 128d: edge/mobile only

Truncation requires L2 renormalization after slicing.

### 5. Cost Optimization

- Self-hosted (BGE-M3, GTE-Qwen2): $0/token, higher latency
- API budget cap: `Math.pow(PSI, 10) * 0.1 ≈ $0.000618` per request
- Batch embeddings: group requests to minimize API calls
- Cache hit ratio target: > ψ (> 61.8%)

## Evidence Paths

- `section1-vector-db/modules/embedding-router.js`
- `section1-vector-db/scripts/benchmark-embeddings.js`
