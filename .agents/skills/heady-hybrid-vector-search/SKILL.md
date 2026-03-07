---
name: heady-hybrid-vector-search
description: >
  Use when implementing or optimizing hybrid search combining BM25 full-text with dense vector
  similarity and optional SPLADE sparse retrieval. Covers Reciprocal Rank Fusion (RRF), pgvector
  HNSW/IVFFlat index optimization, halfvec scalar quantization, binary pre-filtering, iterative
  scan, CSL-gated weight modulation, and phi-scaled search parameters.
  Keywords: hybrid search, BM25, dense vector, SPLADE, RRF, pgvector, HNSW, IVFFlat, vector search,
  embedding search, semantic search, Heady vector memory, halfvec, quantization.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Hybrid Vector Search

## When to Use This Skill

Use this skill when you need to:

- Implement search combining keyword (BM25) and semantic (dense vector) retrieval
- Configure pgvector HNSW indexes for optimal recall/latency tradeoff
- Add SPLADE sparse retrieval as a third signal
- Tune RRF fusion parameters
- Optimize pgvector for high-dimensional vectors (384d–1536d) at scale (1M–100M)
- Implement scalar quantization (halfvec) or binary pre-filtering
- Apply CSL-gated dynamic weight adjustment to search fusion

## Architecture

```
Query → [BM25 (tsvector GIN)] ──┐
      → [Dense HNSW (cosine)]  ──┤──→ RRF Fusion → Dedup → Re-rank → Results
      → [SPLADE Sparse (opt)]  ──┘
```

Performance benchmarks (BEIR average):
- BM25 alone: nDCG@10 ≈ 43.4
- Dense alone: nDCG@10 ≈ 51–55
- Hybrid (BM25 + dense + RRF): +10–15% over individual
- Three-way (BM25 + dense + SPLADE): best overall

## Instructions

### 1. Phi-Scaled Search Parameters

All parameters derive from phi-math:
- `efSearch`: fib(11) = 89 (HNSW beam width)
- `binaryOversample`: fib(7) = 13 (phi-scaled oversampling)
- `rerankTopK`: fib(8) = 21 (re-rank candidates)
- `slowQueryThresholdMs`: 1000 × ψ ≈ 618ms

### 2. Fusion Weights (phi-derived)

Two-way: `phiFusionWeights(2)` → [dense: 0.618, bm25: 0.382]
Three-way: `phiFusionWeights(3)` → [dense: 0.528, bm25: 0.326, sparse: 0.146]

### 3. CSL-Gated Dynamic Weights

When a query has a CSL confidence score, modulate weights:
```javascript
const gatedDense = cslGate(denseWeight, cslScore, CSL_THRESHOLDS.MEDIUM);
const gatedBm25 = bm25Weight + (denseWeight - gatedDense);
```

### 4. RRF Score Computation

```
RRF_score(d) = Σ (weight_i × 1 / (k + rank_i(d)))
```
Standard k=60 (scale-invariant).

### 5. pgvector Index Optimization

HNSW parameters by scale (Fibonacci triples):
- Small (<100K): m=fib(7)=13, ef_construction=fib(9)=34, ef_search=fib(8)=21
- Medium (100K–1M): m=fib(8)=21, ef_construction=fib(11)=89, ef_search=fib(10)=55
- Large (1M–10M): m=fib(8)=21, ef_construction=fib(12)=144, ef_search=fib(11)=89

### 6. Quantization Strategy

- **Halfvec (scalar quantization)**: 50% memory savings, <3% recall loss. Use for hot path.
- **Binary quantization**: 32× storage reduction, use for pre-filtering with exact re-ranking.
- **pgvector 0.8.0 iterative scan**: Enables filtered queries without recall penalty.

## Evidence Paths

- `section1-vector-db/modules/hybrid-search.js`
- `section1-vector-db/modules/vector-memory-optimizer.js`
- `section1-vector-db/migrations/001_hnsw_optimization.sql`
- `section1-vector-db/configs/pgvector-optimized.yaml`
