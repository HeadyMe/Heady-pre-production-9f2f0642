# Section 1: Vector Database Research for AI Agent Memory Systems

**Prepared:** March 7, 2026  
**Scope:** Comprehensive research on vector database optimization for sovereign/self-hosted AI agent memory architectures

---

## Table of Contents

1. [pgvector Index Comparison: HNSW vs IVFFlat vs Brute-Force](#1-pgvector-index-comparison)
2. [pgvector 0.7+ / 0.8+ Features and 2025–2026 Improvements](#2-pgvector-07--08-features)
3. [pgvector vs Specialized Competitors (Self-Hosted Focus)](#3-pgvector-vs-competitors)
4. [Hybrid Search: BM25 + Dense, ColBERT, SPLADE, BGE-M3](#4-hybrid-search)
5. [Graph RAG: GraphRAG, LightRAG, nano-graphrag](#5-graph-rag)
6. [2026 Embedding Model Benchmarks](#6-2026-embedding-models)

---

## 1. pgvector Index Comparison: HNSW vs IVFFlat vs Brute-Force

### 1.1 Algorithm Overview

**Brute-Force (Sequential Scan)**  
Exact nearest-neighbor search. Compares the query vector against every stored vector using the chosen distance metric. Guarantees 100% recall but scales as O(n·d) where n = number of vectors and d = dimensions. At 1M vectors / 1536d, sequential scan takes ~2.12 seconds per query in practice — unusable for interactive applications. No index construction overhead; suitable only for datasets under ~50,000 vectors or batch-offline workloads.

**IVFFlat (Inverted File with Flat Storage)**  
Partitions vectors into `lists` (Voronoi cells) via k-means at build time. At query time, the `probes` nearest cells are searched exactly. Key properties:
- Build time: fast (seconds to minutes), scales sub-linearly
- Index size: compact — smaller than HNSW
- Recall: depends critically on cluster quality at build time; defaults ~70–80%, tuned can reach 95%+
- **Critical constraint:** index quality is set at build time. If built on partial data or non-representative distribution, recall degrades permanently until rebuilt. Not suitable for continuous-insert workloads without periodic rebuilds.
- Best parameters: `lists = sqrt(n)` for datasets up to 1M; `lists = n/1000` for larger. Set `probes = sqrt(lists)` as starting point.

**HNSW (Hierarchical Navigable Small World)**  
Multi-layer graph index where each node stores approximate nearest neighbors. Inserts new nodes incrementally without requiring rebuild. Key properties:
- Build time: significantly longer than IVFFlat — hours for large datasets
- Index size: 2–5× larger than IVFFlat (stores graph neighbor connections)
- Recall: 95%+ at default parameters; 99%+ with tuning
- Handles incremental inserts without quality degradation
- Parameters: `m` (connections per node, default 16); `ef_construction` (build-time graph quality, default 64, use 200+ for production); `hnsw.ef_search` (query-time beam width, runtime-tunable)

### 1.2 Benchmark Results (pgvector 0.4.1 → 0.7.0, AWS r7gd.16xlarge / r7i.16xlarge)

The following results are from [Jonathan Katz's 150x speedup benchmark](https://jkatz.github.io/post/postgres/pgvector-performance-150x-speedup/) (PostgreSQL 16.2, 64 vCPU / 512 GiB, NVMe) and [AWS Aurora pgvector 0.7.0 analysis](https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/).

#### Dataset: dbpedia-openai-1000k-angular (1M vectors, 1536 dims) @ 99% recall

| Version | Method | Recall | QPS | p99 Latency (ms) | Index Build (s) | Index Size (GiB) |
|---------|--------|--------|-----|-----------------|-----------------|-----------------|
| 0.4.1 | IVFFlat | 0.994 | 8 | 150.16 | 474 | 7.56 |
| 0.5.0 | HNSW | 0.993 | 243 | 5.74 | 7,479 | 7.55 |
| 0.7.0 | HNSW (parallel) | 0.992 | 253 | 5.51 | **250** | 7.55 |

**Key takeaway:** HNSW delivers **30× more QPS** and **27× lower p99 latency** vs IVFFlat at equal recall. pgvector 0.7.0 parallel build cut HNSW build time from **2.08 hours to 4.2 minutes** (30× speedup) on this dataset.

#### Dataset: sift-128-euclidean (1M vectors, 128 dims) @ 99% recall

| Version | Method | Recall | QPS | p99 Latency (ms) | Index Build (s) | Index Size (GiB) |
|---------|--------|--------|-----|-----------------|-----------------|-----------------|
| 0.4.1 | IVFFlat | 0.999 | 33 | 44.05 | 58 | 0.51 |
| 0.5.0 | HNSW | 0.994 | 432 | 2.98 | 2,411 | 0.76 |
| 0.7.0 | HNSW (parallel) | 0.994 | **487** | **2.65** | **56** | 0.76 |

IVFFlat built faster (58s vs 56s for 0.7.0 HNSW) but delivered only 1/15 the throughput and 16× higher p99 latency.

#### Dataset: gist-960-euclidean (1M vectors, 960 dims) @ 90% recall

| Version | Method | Recall | QPS | p99 Latency (ms) | Index Build (s) | Index Size (GiB) |
|---------|--------|--------|-----|-----------------|-----------------|-----------------|
| 0.4.1 | IVFFlat | 0.965 | 13 | 128.91 | 300 | 3.82 |
| 0.5.0 | HNSW | 0.923 | 215 | 5.53 | 6,787 | 7.50 |
| 0.7.0 | HNSW (parallel) | 0.922 | **229** | **5.18** | **197** | 7.50 |

Note: IVFFlat achieves higher recall here (0.965 vs 0.922) because it searches more cells. HNSW can meet the target with tuned `ef_search`. HNSW uses 2× more disk space at 960 dims (graph overhead grows with dimensionality).

#### Dataset: glove-25-angular (1M vectors, 25 dims) @ 99% recall

| Version | Method | Recall | QPS | p99 Latency (ms) | Index Build (s) | Index Size (GiB) |
|---------|--------|--------|-----|-----------------|-----------------|-----------------|
| 0.4.1 | IVFFlat | 0.997 | 26 | 53.50 | 31 | 0.14 |
| 0.5.0 | HNSW | 0.995 | 493 | 2.64 | 2,538 | 0.45 |
| 0.7.0 | HNSW (parallel) | 0.995 | **522** | **2.50** | **48** | 0.45 |

At very low dimensions, HNSW still wins on throughput/latency but IVFFlat is more memory-efficient (0.14 GiB vs 0.45 GiB).

### 1.3 Scale vs. Performance Decision Matrix

Per [DEV Community analysis (March 2026)](https://dev.to/philip_mcclarence_2ef9475/ivfflat-vs-hnsw-in-pgvector-which-index-should-you-use-305p) and [Zylos Research (Jan 2026)](https://zylos.ai/research/pgvector-optimization-2025):

| Factor | HNSW | IVFFlat | Brute-Force |
|--------|------|---------|-------------|
| Build time (1M vectors) | Minutes (pgvector 0.7+) | Seconds | N/A |
| Build time (100M vectors) | Hours | Minutes | N/A |
| Index size vs. raw data | 2–5× larger | Compact | 0× (no index) |
| Default recall (@10) | ~95%+ | ~70–80% | 100% |
| Tuned recall | 99%+ | 95%+ | 100% |
| Incremental inserts | Handled well | Degrades quality | N/A |
| Maintenance | Minimal | Periodic rebuild | None |
| QPS @ 99% recall (1M vec) | ~250–500 | ~8–33 | <1 |
| p99 latency (ms, 1M vec) | ~2–6 | ~44–150 | ~2,000+ |
| Best scale | <50M vectors | <100M vectors (bulk-load) | <50K vectors |
| Concurrent insert support | Yes | No (rebuild required) | Yes |

**Scale breakpoints (based on community benchmarks and [Reddit practical reports](https://www.reddit.com/r/Rag/comments/1pijk7q/ivfflat_vs_hnsw_in_pgvector_with/)):**
- **<30K vectors:** Either method; brute-force acceptable
- **30K–50K vectors:** HNSW starts showing advantage
- **50K–1M vectors:** HNSW strongly preferred for production
- **1M–50M vectors:** HNSW with quantization; pgvectorscale StreamingDiskANN viable
- **>50M vectors:** Consider dedicated vector DB or pgvectorscale; pure pgvector starts straining

### 1.4 Memory Usage at Scale

- **HNSW memory at 1M × 1536d (float32):** ~7.5 GiB index + 6 GiB raw = ~13.5 GiB
- **HNSW memory at 1M × 1536d (halfvec/scalar quantized):** ~3.75 GiB index + 3 GiB raw = ~6.75 GiB
- **IVFFlat at 1M × 1536d:** ~7.5 GiB raw + ~0.5 GiB index overhead
- **HNSW graph overhead scales with `m`:** m=16 → ~96 bytes/vector; m=32 → ~192 bytes/vector
- At 100M vectors × 768d, HNSW index alone requires ~30–50 GB RAM to stay in memory

---

## 2. pgvector 0.7+ / 0.8+ Features

### 2.1 pgvector 0.7.0 (Released April 29, 2024)

Source: [PostgreSQL News pgvector 0.7.0 release](https://www.postgresql.org/about/news/pgvector-070-released-2852/), [PGXN 0.7.0](https://pgxn.org/dist/vector/0.7.0/)

#### New Data Types
- **`halfvec`:** 2-byte (half-precision float16) vectors. Supports indexing up to **4,000 dimensions** (vs 2,000 for `vector`). Directly usable in HNSW and IVFFlat indexes.
- **`sparsevec`:** Sparse vector type supporting up to 1,000 non-zero dimensions. Essential for SPLADE-style learned sparse retrieval.
- **`bit` type for binary vectors:** Supports HNSW/IVFFlat indexing up to **64,000 dimensions** using binary vectors.

#### Quantization Support
pgvector 0.7.0 adds quantization via PostgreSQL expression indexes ([Jonathan Katz blog](https://jkatz.github.io/post/postgres/pgvector-scalar-binary-quantization/)):

**Scalar Quantization (SQ / halfvec):**
```sql
-- 4-byte float → 2-byte float (50% storage reduction)
CREATE INDEX ON documents USING hnsw 
  ((embedding::halfvec(1536)) halfvec_cosine_ops)
  WITH (m=16, ef_construction=64);

-- Query
SELECT id FROM documents 
ORDER BY embedding::halfvec(1536) <=> $1::halfvec(1536) LIMIT 10;
```
- Storage reduction: **2× (50% savings)**
- Build time improvement: **~3× faster** vs full float32 HNSW
- Recall impact: Minimal — benchmark shows essentially identical recall at `ef_construction=256`

**Binary Quantization (BQ):**
```sql
-- 4-byte float → 1 bit per dimension (32× storage reduction)
CREATE INDEX ON documents USING hnsw 
  ((binary_quantize(embedding)::bit(1536)) bit_hamming_ops)
  WITH (m=16, ef_construction=64);
```
- Storage reduction: **32× (96.9% savings)**
- Build time improvement: **~50× faster** than float32 HNSW (0.7.0 scalar) or **~150× faster** vs HNSW 0.5.0
- Recall impact: Significant for low-dimensional data; works well for 1536d+ vectors with re-ranking
- **Best practice with BQ:** Over-fetch (2–4× candidates) then re-rank using original float vectors:
```sql
SELECT id FROM (
  SELECT id FROM documents 
  ORDER BY binary_quantize(embedding)::bit(1536) <~> binary_quantize($1) LIMIT 40
) candidates
ORDER BY embedding <=> $1 LIMIT 10;
```

**AWS Aurora Benchmark — Build Time Comparison (r7g.12xlarge):**

| Dataset | pgvector version | Load Duration (s) | Speedup | Recall |
|---------|----------------|-------------------|---------|--------|
| OpenAI 5M | 0.5.1 | 29,753 | 1.0× | 0.973 |
| OpenAI 5M | 0.7.0 | 1,272 | **23.4×** | 0.972 |
| OpenAI 5M | 0.7.0 + binary quantization | 445 | **66.8×** | 0.822 |
| Cohere 10M | 0.5.1 | 49,837 | 1.0× | 0.934 |
| Cohere 10M | 0.7.0 | 1,680 | **29.7×** | 0.952 |
| Cohere 10M | 0.7.0 + binary quantization | 739 | **67.5×** | 0.659 |

Source: [AWS Aurora pgvector 0.7.0 blog](https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/)

**Note:** Binary quantization recall drop (0.822 / 0.659) is recoverable with re-ranking to original float vectors.

#### Parallel HNSW Build
- Introduced in 0.6.0 (January 2024), refined in 0.7.0
- Configure with `SET max_parallel_maintenance_workers = N;`
- 1M × 1536d index: **87 minutes (single-thread) → 9.5 minutes (parallel, ~9×)** per [Supabase 0.6.0 analysis](https://supabase.com/blog/pgvector-fast-builds)
- With quantization + parallel: **~250 seconds (4.2 min)** for 1M × 1536d at 99% recall
- Parallel workers scale sub-linearly: 8 workers ≈ 6–8× faster (not 8×)

#### New Distance Functions
- `hamming_distance(bit, bit)` — fast Hamming distance for binary vectors
- `jaccard_distance(bit, bit)` — Jaccard similarity for binary vectors
- `<~>` operator: Hamming distance
- `<%>` operator: Jaccard distance
- L1 distance support for HNSW indexes

#### SIMD CPU Dispatching (x86-64)
pgvector 0.7.0 adds SIMD dispatch on Linux x86-64 (AVX-512, AVX2 auto-detection), providing 10–40% additional speedup on modern CPUs.

**Product Quantization (PQ):** Not yet implemented in pgvector. An [open GitHub issue (#605)](https://github.com/pgvector/pgvector/issues/605) discusses adding PQ; maintainers indicated interest but noted good results from existing SQ/BQ. PQ remains available in pgvectorscale (via StreamingDiskANN internal compression) and in competitor systems.

### 2.2 pgvector 0.8.0 (Released November 2024)

Source: [PostgreSQL News 0.8.0](https://www.postgresql.org/about/news/pgvector-080-released-2952/), [AWS Aurora 0.8.0 analysis](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/), [Nile database announcement](https://www.thenile.dev/blog/pgvector-080)

#### Iterative Index Scans (Critical Feature)
Solves the **overfiltering problem** — previously, HNSW with a WHERE clause would scan `ef_search` candidates, apply the filter, and return whatever survived (often <10% of limit). This produced incomplete result sets.

**New behavior:**
```sql
SET hnsw.iterative_scan = 'relaxed_order';
SET hnsw.max_scan_tuples = 20000;  -- configurable ceiling

-- Now auto-continues scanning until enough results pass the filter
SELECT id FROM documents 
WHERE category = 'finance'
ORDER BY embedding <=> $1 
LIMIT 10;
```

Three modes:
- `off` — legacy behavior (default for backward compatibility)
- `strict_order` — iterates while preserving exact distance ordering
- `relaxed_order` — iterates with approximate ordering (faster, recommended for production)

**Performance impact (AWS Aurora benchmark):**

| Configuration | 0% filter selectivity | 10% filter | 50% filter | 90% filter |
|---|---|---|---|---|
| 0.8.0 baseline (iterative=off) | 19.3ms | 20.0ms | 15.7ms | 99.8ms |
| 0.8.0 strict_order | 18.1ms | 197.1ms | 203.2ms | 344.0ms |
| 0.8.0 relaxed_order | 13.1ms | 150.8ms | 99.1ms | 397.9ms |
| 0.8.0 ef_search=200 strict | 28.8ms | 128.5ms | 57.9ms | 207.6ms |
| **0.8.0 ef_search=200 relaxed** | **30.7ms** | **85.7ms** | **70.7ms** | **160.3ms** |

**Result completeness:** Up to **100× improvement** in result completeness for highly selective filters.
**Zylos Research reports:** "9× faster filtered queries" and "100× better relevance for filtered queries" vs 0.7.x.

#### Additional 0.8.0 Improvements
- Improved cost estimation for better index selection when filtering (planner now correctly chooses B-tree over HNSW for highly selective metadata-only filters)
- Improved HNSW insert performance
- Improved HNSW on-disk index build performance
- Array-to-sparsevec casts
- Dropped PostgreSQL 12 support

### 2.3 pgvectorscale (StreamingDiskANN)

[Timescale's pgvectorscale](https://www.tigerdata.com/blog/pgvector-vs-qdrant) adds a third index type: **StreamingDiskANN**, a disk-resident approximate nearest neighbor index inspired by Microsoft's DiskANN:
- Stores index on disk (NVMe required), keeping only hot paths in RAM
- Uses **Statistical Binary Quantization (SBQ)** — improved accuracy vs standard BQ
- Single-threaded build (known limitation, parallelism in development)
- 50M × 768d benchmark: **471 QPS at 99% recall** — 11.4× higher throughput than Qdrant
- Build time: ~11.1 hours for 50M vectors (vs Qdrant's 3.3 hours)

---

## 3. pgvector vs. Specialized Competitors (Self-Hosted)

### 3.1 Deployment Philosophy Comparison

For sovereign/self-hosted deployments (critical for agent memory systems with sensitive data):

| Database | License | Architecture | Hosting | Operational Complexity |
|---|---|---|---|---|
| **pgvector** | PostgreSQL (open) | Extension on PostgreSQL | Self-host or managed Postgres | Low — uses existing PG ops tooling |
| **pgvectorscale** | Apache 2.0 | Extension + StreamingDiskANN | Self-host only | Low — Postgres-native |
| **Qdrant** | Apache 2.0 | Purpose-built (Rust) | Self-host (Docker/K8s) or Qdrant Cloud | Low-Medium |
| **Milvus** | Apache 2.0 | Distributed (Go/C++) | Self-host (standalone or cluster) or Zilliz Cloud | High (distributed) |
| **Weaviate** | BSD-3-Clause | Purpose-built (Go) | Self-host or Weaviate Cloud | Medium |
| **LanceDB** | Apache 2.0 | Embedded (Rust, Lance columnar) | Embedded in app (no server) | Very Low |
| **Pinecone** | Proprietary | Fully managed cloud | SaaS only (**not self-hostable**) | Minimal (no control) |

**Pinecone is not suitable for sovereign deployments** — it is SaaS-only with no self-hosting option.

### 3.2 Performance Benchmarks

#### pgvectorscale vs. Qdrant (50M vectors, 768d, Cohere embeddings)
Source: [Tiger Data / Timescale benchmark (April 2025)](https://www.tigerdata.com/blog/pgvector-vs-qdrant)

| Metric | pgvector + pgvectorscale | Qdrant | Winner |
|---|---|---|---|
| p50 latency @ 99% recall | 31.07ms | 30.75ms | Qdrant (+1%) |
| p95 latency @ 99% recall | 60.42ms | 36.73ms | Qdrant (+39%) |
| p99 latency @ 99% recall | 74.60ms | 38.71ms | Qdrant (+48%) |
| QPS @ 99% recall | **471.57** | 41.47 | pgvectorscale (**11.4×**) |
| QPS @ 90% recall | **1,589** | 360 | pgvectorscale (**4.4×**) |
| p50 latency @ 90% recall | 9.54ms | 4.74ms | Qdrant (50% lower) |
| Index build time (50M) | 11.1 hours | 3.3 hours | Qdrant (**3.4×** faster) |

**Interpretation:**
- **pgvectorscale wins on throughput** (concurrent queries) by a large margin — Postgres benefits from decades of lock-contention optimization
- **Qdrant wins on tail latency** — better for latency-sensitive single-user queries
- **Qdrant wins on index build time** — important for high-write workloads
- Both achieve sub-100ms p99 at 99% recall over 50M vectors

#### pgvectorscale vs. Pinecone (50M vectors, 1536d, 99% recall)
Source: [DEV Community comparison (March 2026)](https://dev.to/polliog/postgresql-as-a-vector-database-when-to-use-pgvector-vs-pinecone-vs-weaviate-4kfi)

| Metric | pgvectorscale | Pinecone s1 |
|---|---|---|
| QPS | 471 | 471 |
| p95 latency | **28ms** | 784ms |
| Cost | Infrastructure only | $70–1,200/month SaaS |

pgvectorscale delivers **28× lower p95 latency** at equal throughput vs Pinecone s1 — a striking result that challenges the managed-service performance narrative.

#### Milvus vs. Qdrant (SQuAD dataset, 384d)
Source: [F22 Labs benchmark (Feb 2026)](https://www.f22labs.com/blogs/qdrant-vs-milvus-which-vector-database-should-you-choose/)

| Metric | Milvus | Qdrant |
|---|---|---|
| Ingestion time (100K docs) | 12.02s | 41.27s |
| Query latency (avg) | 40ms | 94.52ms |
| Throughput (QPS) | **46.33** | 4.70 |

Milvus shows 10× throughput advantage and 2.6× lower query latency in this test, but Qdrant's latency is more predictable.

### 3.3 Feature Comparison Matrix

| Feature | pgvector | Qdrant | Milvus | Weaviate | LanceDB |
|---|---|---|---|---|---|
| **HNSW index** | ✓ | ✓ | ✓ | ✓ | ✓ (IVF-PQ primary) |
| **IVFFlat index** | ✓ | — | ✓ | — | ✓ |
| **DiskANN / disk-resident** | pgvectorscale | — | — | — | ✓ (Lance format) |
| **Scalar quantization** | ✓ (halfvec) | ✓ | ✓ | — | ✓ |
| **Binary quantization** | ✓ | ✓ | — | — | — |
| **Product quantization** | — | ✓ | ✓ | — | ✓ (IVF-PQ) |
| **Sparse vector / SPLADE** | ✓ (sparsevec) | ✓ | ✓ | — | — |
| **BM25 hybrid search** | Via pg_trgm/pgsearch | Via integration | ✓ (native Milvus 2.5) | ✓ (native) | — |
| **Multi-vector (ColBERT)** | — | ✓ (v1.7+) | ✓ | — | — |
| **Metadata filtering** | ✓ (SQL WHERE) | ✓ | ✓ | ✓ | ✓ |
| **ACID transactions** | ✓ | Partial | — | — | — |
| **SQL interface** | ✓ | — | — | GraphQL | — |
| **Horizontal scaling** | pgpool/Citus | ✓ | ✓ (distributed) | ✓ | Limited |
| **GPU acceleration** | — | — | ✓ | — | — |
| **Multi-tenancy** | PostgreSQL schemas | ✓ | ✓ | ✓ | — |
| **Backup / PITR** | ✓ (PostgreSQL standard) | Snapshots | — | — | ✓ (versioned) |

### 3.4 Operational Complexity for Self-Hosted Sovereign Deployments

| Aspect | pgvector | Qdrant | Milvus | Weaviate | LanceDB |
|---|---|---|---|---|---|
| **Installation** | `CREATE EXTENSION pgvector` | Docker image | Docker Compose / Helm | Docker / Helm | Python `pip install` |
| **Monitoring** | PostgreSQL standard tools | Prometheus/Grafana built-in | Prometheus/Grafana | Prometheus/Grafana | Application-level |
| **Backup** | pg_dump, WAL streaming | Snapshot API | — | REST API backup | File copy |
| **Auth/security** | PostgreSQL RBAC | API key + TLS | TLS + RBAC | API key + TLS | Application-level |
| **Learning curve** | Low (SQL) | Low-Medium | High | Medium | Very Low |
| **Operational maturity** | Very High (30+ years PG ops) | Medium (Rust, stable) | High (cloud-native) | Medium | Low |

### 3.5 Recommendation by Use Case

| Use Case | Recommended | Rationale |
|---|---|---|
| **Agent memory < 10M vectors, existing Postgres** | pgvector + pgvectorscale | Zero added infra, SQL, ACID, PITR |
| **Agent memory 10–100M vectors, high throughput** | pgvectorscale | 471 QPS at 99% recall, 11.4× Qdrant throughput |
| **Low tail-latency single queries, ~50M vectors** | Qdrant | 39–48% lower p95/p99 at same recall |
| **Billion+ vector scale, distributed** | Milvus | Designed for massive scale, GPU support |
| **Hybrid search + knowledge graph** | Weaviate | Native BM25 + dense + GraphQL |
| **Embedded/edge/local app** | LanceDB | Zero-server, ~3–15ms on disk, multimodal |
| **Sovereign, no SaaS dependency** | **Avoid Pinecone** | SaaS-only, no self-hosting |

---

## 4. Hybrid Search: BM25 + Dense, ColBERT, SPLADE, BGE-M3

### 4.1 Motivation and Architecture

Pure dense vector search excels at semantic understanding but can miss exact keyword matches, fail out-of-domain, and struggle with proper nouns, codes, and rare terms. BM25/lexical search has the opposite profile. **Hybrid search** combines both signal types.

**Why hybrid consistently wins:**
- BM25 alone: nDCG@10 ≈ **43.4** (BEIR average, 13 datasets)
- BM25 + cross-encoder reranker: nDCG@10 ≈ **52.5** (+9 points)
- ColBERTv2 (late interaction): nDCG@10 ≈ **53–55**
- Dense (top models): nDCG@10 ≈ **51–55**
- **Hybrid (BM25 + dense + RRF + rerank): +10–15% over individual methods**

Source: [AI News / keyword vs semantic hybrid overview](https://ainews.zedge.net/keyword-vs-semantic-search-why-the-real-win-is-in-the-hybrid/)

A key finding from IBM research (cited by [InfiniFlow](https://infiniflow.org/blog/best-hybrid-search-solution)): three-way retrieval (BM25 + dense + sparse/SPLADE) outperforms any two-way combination for RAG.

### 4.2 BM25 Sparse Retrieval

**Okapi BM25** is the industry standard lexical scoring function:

```
BM25(q,D) = Σ IDF(qi) × [f(qi,D)×(k1+1)] / [f(qi,D) + k1×(1−b+b×|D|/avgdl)]
```

- `k1` ≈ 1.2–2.0 (term frequency saturation)
- `b` ≈ 0.75 (document length normalization)
- Advantages: No training, interpretable, predictable, stable cross-domain
- Disadvantages: Vocabulary mismatch ("car" ≠ "automobile"), no semantic understanding

**BM25F:** Multi-field variant (different weights per field — e.g., title > body). Implemented natively in Weaviate 1.17+.

**When BM25 remains competitive:** BEIR adversarial evaluation shows all neural models degrade more than BM25 under adversarial perturbations (BM25: −30.3% NDCG, Dense: −19.9%, Hybrid: −13.8%). Source: [Ailog BEIR 2.0 leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/news/beir-benchmark-update).

### 4.3 SPLADE: Learned Sparse Retrieval

SPLADE (SParse Lexical AnD Expansion) models produce learned sparse vectors by training BERT-based models to generate token weights across the full vocabulary (30,000+ dimensions). Unlike BM25, SPLADE:
- Expands query/document terms (e.g., "first person land moon" → also weights "Armstrong", "NASA", "Apollo")
- Maintains sparse inverted-index compatibility
- Trains sparsity via FLOPS regularization

**BEIR zero-shot nDCG@10 comparison:**

| Model | nDCG@10 (BEIR, 13 datasets) |
|---|---|
| BM25 | 44.02 |
| ColBERTv2 | 49.95 |
| SPLADE v2 | 50.72 |
| SPLADE v3 | 51.68 |
| ELSER v2 | 52.07 |
| **Echo-Mistral-SPLADE** | **55.07** |
| LLM2Vec (dense, Mistral-7B) | 57.6 |

Source: [Echo-Mistral-SPLADE paper (Dec 2025)](https://www.emergentmind.com/topics/echo-mistral-splade)

**Key tradeoff:** SPLADE index sizes are much larger than BM25 (30K-dim sparse vectors per document) but much smaller than dense vector indexes. Effective for when you need interpretable keyword-like behavior with semantic expansion.

### 4.4 ColBERT: Late Interaction

ColBERT encodes queries and documents into **multi-vector representations** (one vector per token), then uses the MaxSim operator at query time:

```
Score(Q, D) = Σ_qi max_{dj ∈ D} (qi · dj)
```

This captures fine-grained token-level interactions — "late interaction" vs bi-encoder (dot product of single vectors).

**ColBERTv2 improvements** (2022, Stanford):
- Residual compression reduces storage 6–10× vs ColBERT v1
- PLAID engine: efficient retrieval in tens of ms on GPU, hundreds of ms on CPU
- BEIR nDCG@10: ~49.1 (source: [Ailog BEIR 2.0](https://app.ailog.fr/en/blog/news/beir-benchmark-update))

**Production ColBERT pattern** (per [Reddit hybrid search discussion](https://www.reddit.com/r/vectordatabase/comments/1jo9jtx/my_journey_into_hybrid_search_bgem3_qdrant/)):
1. First-stage: retrieve top-20 using dense + sparse (fast)
2. Second-stage: rerank with ColBERT (expensive but only over 20 candidates)
This approach amortizes ColBERT's latency cost.

**ColBERT storage overhead:** ~128 bytes × avg_tokens_per_doc × num_docs — typically 10–50× more than single-vector dense. Example: 1M docs × 100 avg tokens × 128d float16 = ~25 GB vs ~3 GB for single-vector.

### 4.5 BGE-M3: Unified Multi-Representation Model

[BGE-M3](https://huggingface.co/BAAI/bge-m3) (BAAI, January 2024) is the most practical hybrid retrieval model for self-hosted deployments, supporting all three retrieval modes simultaneously in a **single 560M-parameter model**:

- **Dense retrieval:** 1024-dimensional cosine similarity
- **Sparse retrieval (learned):** SPLADE-style token weights (similar to BM25 expansion)  
- **Multi-vector (ColBERT):** Late interaction token-level representations

**Multilingual:** 100+ languages, input up to 8,192 tokens.

**Usage pattern for hybrid search:**
```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel('BAAI/bge-m3', use_fp16=True)

output = model.encode(
    sentences, 
    return_dense=True, 
    return_sparse=True, 
    return_colbert_vecs=True
)

# Weighted hybrid score
score = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

**BGE-M3 performance vs BM25 (from paper and [Milvus integration](https://huggingface.co/BAAI/bge-m3)):**
- M3 hybrid (dense + sparse + colbert) consistently outperforms BM25 on MIRACL multilingual benchmark
- BGE-M3 dense alone achieves MTEB score ~63.0 (source: [Ailog MTEB comparison](https://app.ailog.fr/en/blog/guides/choosing-embedding-models))
- ColBERT in BGE-M3 is most useful as a re-ranker, not first-stage retrieval

### 4.6 Hybrid Fusion Methods

**Reciprocal Rank Fusion (RRF):**
```
RRF_score(d) = Σ_r 1/(k + rank_r(d))    [k=60 standard; k=0 for raw]
```
Scale-invariant: works even when BM25 scores (0–∞) and cosine similarity (−1 to 1) are in different ranges. Recommended default.

**Weighted Sum:** `α × dense_score + β × BM25_score` — requires per-dataset tuning of α, β. More accurate when tuned; fragile across domains.

**Weaviate hybrid search default** uses RRF with `alpha` parameter (0 = full BM25, 1 = full vector):
```graphql
{ Get { Documents(
    hybrid: { query: "...", alpha: 0.5 }
    limit: 10
  ) { title content } } }
```

### 4.7 Implementation Patterns

**Modern 2025–2026 Hybrid Stack:**
1. **First-stage parallel retrieval:**
   - Lexical index (PostgreSQL full-text search, Elasticsearch BM25, or native DB BM25)
   - Dense ANN (HNSW via pgvector or specialized DB)
   - Optional: SPLADE sparse vector index
2. **Fusion:** RRF (default) or learned weighted sum
3. **Optional second-stage re-ranking:** Cross-encoder or ColBERT on top-50 candidates
4. **Result:** Final ranked list

**Latency estimates (production):**
- Dense-only: 5–30ms query
- Hybrid (BM25 + dense + RRF): 30–90ms
- Hybrid + rerank (ColBERT on top 20): +10–20ms overhead
- Full three-way (BM25 + dense + SPLADE): ~50–150ms

Source: [Emergent Mind candidate retrieval analysis](https://www.emergentmind.com/topics/candidate-retrieval-dense-hybrid-search)

**nDCG@10 improvement (PIRB Polish benchmark, 41 tasks):**
- Hybrid outperformed BM25 by **17.3 NDCG@10 points**
- Hybrid outperformed dense by **up to 9 NDCG@10 points**

---

## 5. Graph RAG: GraphRAG, LightRAG, nano-graphrag

### 5.1 When to Use Graph RAG vs. Pure Vector RAG

A key finding from [arxiv.org RAG vs. GraphRAG systematic evaluation (March 2026)](https://arxiv.org/html/2502.11371v3): **RAG and GraphRAG are complementary, not competing.**

| Query Type | Better Method | Evidence |
|---|---|---|
| Single-hop factual | **Pure vector RAG** | Stronger on NQ dataset, detail-oriented subsets |
| Multi-hop reasoning | **GraphRAG** | Best on HotPotQA, MultiHop-RAG, multi-hop NovelQA |
| Complex relationships | **GraphRAG** | Explicit entity linking, causal chains |
| Summarization / broad themes | **GraphRAG (global)** | Community-level summaries |
| Low latency / simple queries | **Pure vector RAG** | 3–4× faster, less complex |

**Complementarity statistic:** On MultiHop-RAG, 13.6% of queries are answered correctly **only by GraphRAG** and 11.6% **only by RAG**. Integrating both improves performance by +6.4% (LLaMA 3.1-70B).

### 5.2 Microsoft GraphRAG

[Microsoft GraphRAG](https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/) (open-source, GitHub: `microsoft/graphrag`) builds a hierarchical knowledge graph from document corpora:

**Pipeline:**
1. Chunk documents → extract entities and relationships via LLM
2. Build knowledge graph (nodes = entities, edges = relationships)
3. Run community detection (Leiden algorithm) → generate community summaries
4. At query time:
   - **Local search:** vector + graph traversal for specific entities
   - **Global search:** community summary aggregation (map-reduce) for broad queries
   - **DRIFT search:** hybrid local + global

**LazyGraphRAG (2025):** Microsoft's improved variant that defers graph building until query time. In [BenchmarkQED](https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/) evaluation:
- LazyGraphRAG outperformed standard GraphRAG, vector RAG, and even **vector RAG with 1M-token context window** across all query types
- "Won all 96 comparisons" vs comparison conditions using GPT-4o

**Key limitations:**
- Very high indexing cost: ~$4 per legal document corpus (GPT-4o at standard pricing)
- Hundreds of API calls per retrieval (community traversal)
- Total tokens per query: up to 610,000 tokens (610 communities × 1,000 tokens each)
- Requires full rebuild on data changes (incremental updates not native)
- Build time for large corpora: hours to days

### 5.3 LightRAG

[LightRAG](https://github.com/HKUDS/LightRAG) (HKUDS, October 2024, ACL EMNLP Findings 2025) addresses GraphRAG's cost and inflexibility:

**Architecture: Dual-Level Retrieval**
- **Low-level:** Precise retrieval of specific entities and their relationships via keyword matching on graph key-value store
- **High-level:** Broad thematic retrieval by expanding to multi-hop neighboring nodes

**Key advantages over GraphRAG:**
- **Incremental updates:** New entities/relationships merged into existing graph without full rebuild (~50% lower update cost)
- **Lower retrieval cost:** <100 tokens per query (vs 610,000 for GraphRAG global)
- **Single API call per retrieval** (vs hundreds for GraphRAG)
- **Cost comparison:** Indexing a corpus costs ~$0.15 (LightRAG) vs ~$4 (GraphRAG)

**LightRAG benchmark win rates vs baselines:**

| Baseline | LightRAG Win Rate (Overall) | Best Domain |
|---|---|---|
| NaiveRAG | 60–85% | Legal (84.8%) |
| RQ-RAG | 60–86% | Legal (85.6%) |
| HyDE | 58–73% | Agriculture (75.2%) |
| GraphRAG | 49.6–54.8% | Legal (52.8%) |

Source: [LightRAG paper (arxiv 2410.05779)](https://arxiv.org/html/2410.05779v3)

**Performance metrics:**
- Query latency: ~80ms vs ~120ms for NaiveRAG (30% faster)
- Response times 20–30ms faster than standard RAG baselines
- LightRAG retrieval: single API call vs GraphRAG's hundreds

**Caveats from unbiased evaluation:** A [June 2025 arxiv study](https://arxiv.org/html/2506.06331v1) with bias-controlled evaluation found LightRAG's gains more moderate than reported — below 8% win rate vs most methods in unbiased conditions (except vs. advanced variants FGRAG, MGRAG). LightRAG tends to generate longer answers, which inflates win rates in LLM-as-judge evaluation.

**Query modes available:**
- `local` — entity-specific, graph-grounded
- `global` — high-level thematic
- `hybrid` — combines local + global
- `naive` — standard vector search fallback
- `mix` — knowledge graph + vector retrieval

### 5.4 nano-graphrag

[nano-graphrag](https://www.fincatch.io/blog/brief-breakdown-of-nano-graphrag-a-lightweight-alternative-to-graphrag) is a lightweight, hackable reimplementation of Microsoft GraphRAG:

**Design goals:** Simple (clean code), Fast (minimal overhead), Hackable (modify for custom use cases)

**Architecture mirrors GraphRAG but is simplified:**
- Entity extraction via DSPy framework + LLM
- Optional self-critique and refinement
- Three query modes: Naive (vector), Local (entity-graph), Global (thematic)
- Relationship weights (0–1) and proximity orders (1=direct, 2=second-order, 3=third-order)

**Use cases:**
- Prototyping GraphRAG pipelines before production deployment
- Research and experimentation
- Applications requiring deep customization of entity extraction or graph traversal logic
- Smaller corpora where GraphRAG's community abstraction overhead isn't justified

**Limitations:** Less battle-tested than LightRAG; smaller community; no native multi-graph support.

### 5.5 Graph RAG Architecture Patterns

**Pattern 1: Pure Graph RAG (Microsoft GraphRAG)**
- Best for: Global summarization queries, thematic analysis, when corpus relationships are the primary retrieval signal
- Setup: Full entity/relationship extraction, community detection, LLM-generated summaries

**Pattern 2: Dual-mode Hybrid (RAG + GraphRAG)**
- Best for: Mixed query workloads — route single-hop queries to vector RAG, multi-hop to GraphRAG
- Setup: Query classifier → dispatch to appropriate pipeline
- Performance gain: +1.1% (selection) to +6.4% (integration) over best single method

**Pattern 3: LightRAG Incremental (Real-time Agent Memory)**
- Best for: Agent memory systems with continuous document ingestion
- Setup: LightRAG with vector backend (pgvector) + graph backend (Neo4j or in-memory)
- Advantage: Incremental updates without full rebuild; low per-query cost

**Pattern 4: Vector-First with Graph Enrichment**
- Best for: Low-latency applications where graph adds quality, not replaces speed
- Setup: Dense retrieval → ColBERT reranking → graph expansion for multi-hop context
- Practical production approach for sub-100ms p99

---

## 6. 2026 Embedding Model Benchmarks

### 6.1 MTEB Leaderboard Overview (Early 2026)

The [Massive Text Embedding Benchmark (MTEB)](https://huggingface.co/spaces/mteb/leaderboard) evaluates models across 8 task types: Classification, Clustering, Pair Classification, Reranking, Retrieval, STS, Summarization, Bitext Mining.

**Current Top Models (MTEB English, as of January–March 2026):**

| Rank | Model | MTEB Score | Dimensions | Cost / 1M tokens | License | Context | Self-Hostable |
|------|-------|-----------|------------|-----------------|---------|---------|--------------|
| 1 | **Gemini-embedding-001** | 68.32 | 3072 | ~$4 | Proprietary | — | No |
| 2 | **Qwen3-Embedding-8B** | 70.58* | 4096 | Free | Apache 2.0 | 32K | Yes |
| 3 | **Voyage-3-large** | 66.8 | 2048 (MRL) | $120 | Proprietary | 32K | No |
| 4 | **Cohere Embed v4** | 65.2 | 1024 (MRL) | $120 | Proprietary | 128K | No |
| 5 | **OpenAI text-embedding-3-large** | 64.6 | 3072 (MRL) | $130 | Proprietary | 8K | No |
| 6 | **GTE-Qwen2-7B-instruct** | 70.24 | 3584 | Free | Apache 2.0 | 32K | Yes |
| 7 | **BGE-EN-ICL** | 68.78** | 4096 | Free | MIT | 8K | Yes |
| 8 | **Jina Embeddings v3** | 65.52 | 1024 (MRL) | Variable | Apache 2.0 | 8K | Yes |
| 9 | **Nomic Embed v2 (MoE)** | ~62–63 | 768 (MRL) | Free/$0.05 | Apache 2.0 | 512 | Yes |
| 10 | **BGE-M3** | 63.0 | 1024 | Free | MIT | 8K | Yes |

*Qwen3-Embedding-8B MTEB Multilingual score; English MTEB ~68+  
**BGE-EN-ICL (BEIR + AIR-Bench SOTA; exact MTEB English score varies by test run)  
Source: [Ailog MTEB comparison (Jan 2026)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models), [Modal MTEB article (Oct 2025)](https://modal.com/blog/mteb-leaderboard-article)

### 6.2 Model Deep-Dives

#### Voyage-3-large
Source: [Voyage AI blog (Jan 2025)](https://blog.voyageai.com/2025/01/07/voyage-3-large/)

- **Dimensions:** 2048, 1024, 512, 256 (Matryoshka learning)
- **Context length:** 32K tokens (vs OpenAI 8K, Cohere 512)
- **Quantization options:** float32, signed/unsigned int8, binary (quantization-aware training)
- **MTEB score:** ~66.8
- **Performance vs OpenAI text-embedding-3-large (float32 3072d):**
  - +9.74% average across 100 datasets (8 domains)
  - +10.58% at 1024 dimensions, +11.47% at 256 dimensions
  - +8.56% at 1/24 storage cost (int8 512d vs float 3072d)
  - +1.16% at 1/200 storage cost (binary 512d vs float 3072d)
  - Binary 512d still **outperforms OpenAI float 3072d** at 200× less storage
- **Multilingual:** 62 datasets, 26 languages; ranks first across all 8 domains
- **Cost:** $0.12 per 1M tokens (Cohere Embed v4 parity)
- **Self-hostable:** No (API only)
- **Best for:** Maximum retrieval quality for sovereign cloud or trusted API; domain-specific tuning (law, finance, code)

#### Cohere Embed v4
Source: [AWS Bedrock announcement (Oct 2025)](https://aws.amazon.com/about-aws/whats-new/2025/10/coheres-embed-v4-multimodal-embeddings-bedrock/), [CloudPrice spec](https://cloudprice.net/models/cohere.embed-v4:0)

- **Dimensions:** 1024 (Matryoshka, byte and binary quantization options)
- **Context length:** 128K tokens (largest in class)
- **MTEB score:** 65.2
- **BEIR 2.0 nDCG@10:** 53.7% (2nd overall)
- **Multimodal:** Yes — natively handles text, images, and interleaved text+images; processes documents with tables, graphs, diagrams, code, handwritten notes
- **Cost:** $0.12 per 1M tokens
- **Self-hostable:** No (API; available on AWS Bedrock, Azure AI, Cohere API)
- **Generalization gap:** Only −6.6% from in-domain to out-of-domain (smallest gap among top models)
- **Best for:** Enterprise RAG with complex multi-modal documents; noisy real-world data; multilingual enterprise deployments

#### GTE-Qwen2-7B-instruct
Source: [Hugging Face model card](https://huggingface.co/Alibaba-NLP/gte-Qwen2-7B-instruct)

- **Dimensions:** 3584
- **Context length:** 32K tokens
- **MTEB (56 tasks):** **70.24** — ranked #1 globally as of June 2024
- **C-MTEB (Chinese, 35 tasks):** 72.05
- **MTEB-fr:** 68.25 | **MTEB-pl:** 67.86
- **Model size:** 7B parameters, 26.45 GB (fp32)
- **License:** Apache 2.0 (commercial use permitted)
- **Architecture:** Decoder-only (Qwen2-7B) + bidirectional attention + instruction tuning (query-side only)
- **Cost:** Free (self-hosted); ~16–32 GB VRAM required
- **Best for:** Highest accuracy self-hosted retrieval; multilingual (Chinese+English especially strong); long-document understanding

#### Qwen3-Embedding-8B (2025–2026 successor)
Source: [BentoML open-source guide (Oct 2025)](https://www.bentoml.com/blog/a-guide-to-open-source-embedding-models), [Modal MTEB (Oct 2025)](https://modal.com/blog/mteb-leaderboard-article)

- **Dimensions:** 4096
- **MTEB Multilingual:** 70.58 (top of leaderboard as of late 2025)
- **License:** Apache 2.0
- **Also available:** Qwen3-Embedding-4B, Qwen3-Embedding-0.6B (flexible size/quality tradeoff)
- **Instruction-aware:** Supports user-defined instruction prefixes
- **Multilingual:** 100+ natural and programming languages
- **Best for:** State-of-the-art self-hosted retrieval at any scale

#### BGE-EN-ICL (In-Context Learning)
Source: [BAAI/bge-en-icl HuggingFace](https://huggingface.co/BAAI/bge-en-icl), [arXiv 2409.15700](https://arxiv.org/abs/2409.15700)

- **Base model:** Mistral-7B (7B parameters)
- **Dimensions:** 4096
- **Context length:** 8K tokens
- **License:** MIT
- **Key innovation:** Few-shot in-context learning — providing 2–3 query-response examples significantly boosts task-specific embedding quality without fine-tuning
- **MTEB/BEIR:** SOTA on BEIR and AIR-Bench as of release (July 2024)
- **Best for:** New domains with limited training data; tasks where 2–3 examples are readily available; adapter-free domain specialization

#### Jina Embeddings v3
Source: [Jina AI announcement (Oct 2024)](https://jina.ai/news/jina-embeddings-v3-a-frontier-multilingual-embedding-model/), [arXiv 2409.10173](https://arxiv.org/abs/2409.10173)

- **Parameters:** 570M (559M base XLM-RoBERTa + 13M LoRA)
- **Dimensions:** 1024 default; MRL supports 32, 64, 128, 256, 512, 768, 1024
- **Context length:** 8,192 tokens
- **MTEB overall:** 65.52 (strong for sub-1B model)
- **Languages:** 89 languages
- **License:** Apache 2.0 (self-hostable)
- **Architecture innovations:**
  - 5 LoRA adapters for task-specific optimization (retrieval.query, retrieval.passage, separation, classification, text-matching)
  - Late chunking support for long-document embeddings
  - FlashAttention2 compatible
- **MRL performance retention:** Maintains 92% of retrieval performance at 64 dimensions vs. 1024 dimensions
- **Cost:** Variable (self-hosted free; Jina API charged per token)
- **Best for:** Multilingual retrieval with self-hosting; efficient production deployment; long-context documents; tasks needing adapter specialization

#### Nomic Embed v2 (MoE variant)
Source: [Hugging Face nomic-embed-text-v2-moe](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe)

- **Parameters:** 305M (MoE: 8 experts, top-2 routing)
- **Dimensions:** 768 (MRL to 256)
- **Context length:** 512 tokens (significant limitation)
- **BEIR:** 52.86
- **MIRACL (multilingual):** 65.80 (beats Arctic Embed v2 Large at 66.00 despite fewer params)
- **License:** Apache 2.0
- **Key design:** Mixture-of-Experts architecture in embedding model class — unique in the space
- **Limitations:** 512-token context limit is restrictive for long documents; not competitive with 7B+ models on English MTEB
- **Best for:** Budget multilingual retrieval where GPU memory is constrained; comparable to models 2× its size on multilingual tasks

### 6.3 Self-Hosted vs. API Cost Comparison (1M tokens/day scenario)

| Model | Type | Cost/1M tokens | Monthly (1M tok/day) | Context | Self-Hostable |
|---|---|---|---|---|---|
| Qwen3-Embedding-8B | Open-source | Free* | ~$200 infra | 32K | Yes |
| GTE-Qwen2-7B | Open-source | Free* | ~$200 infra | 32K | Yes |
| BGE-EN-ICL | Open-source | Free* | ~$200 infra | 8K | Yes |
| Jina v3 | Open-source | Free* | ~$200 infra | 8K | Yes |
| Nomic Embed v2 | Open-source | $0.05 (API) | $1,500 | 512 | Yes |
| BGE-M3 | Open-source | Free* | ~$50–100 infra | 8K | Yes |
| Cohere Embed v4 | Proprietary | $0.12 | $3,600 | 128K | No |
| Voyage-3-large | Proprietary | $0.12 | $3,600 | 32K | No |
| OpenAI text-3-large | Proprietary | $0.13 | $3,900 | 8K | No |

*Self-hosted GPU inference costs: ~$0.50–2/hour for A100/H100 GPU; varies by hardware.

### 6.4 Benchmark Comparison: BEIR 2.0 Retrieval (nDCG@10)

From [Ailog BEIR 2.0 leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/news/beir-benchmark-update):

| Rank | Model | BEIR nDCG@10 | Recall@1000 | Type |
|---|---|---|---|---|
| 1 | Voyage-Large-2 | **54.8%** | 89.2% | Dense |
| 2 | Cohere Embed v4 | 53.7% | 87.8% | Dense |
| 3 | BGE-Large-EN | 52.3% | 86.1% | Dense |
| 4 | Gemini-embedding-001 | 52.1% | 86.9% | Dense |
| 5 | OpenAI text-3-large | 51.9% | 85.7% | Dense |
| 6 | Qwen3-Embedding-8B | 51.5% | 86.2% | Dense |
| 7 | E5-Mistral-7B | 51.2% | 84.9% | Dense |
| 8 | ColBERT-v2 | 49.1% | **88.3%** | Late Interaction |
| 9 | BM25 | 41.2% | 76.8% | Sparse |

**Key insight:** ColBERT-v2 has the highest Recall@1000 despite lower nDCG@10 — it's excellent for first-stage retrieval in two-stage systems.

### 6.5 Recommended Model Selection for AI Agent Memory

| Scenario | Model | Reasoning |
|---|---|---|
| **Sovereign self-hosted, best quality** | GTE-Qwen2-7B or Qwen3-Embedding-8B | Apache 2.0, highest MTEB, 32K context |
| **Sovereign self-hosted, balanced** | Jina v3 or BGE-EN-ICL | 89 languages, 8K context, task LoRA |
| **Multilingual agent memory** | BGE-M3 (hybrid) | Dense + sparse + ColBERT in one model |
| **Budget self-hosted** | Nomic Embed v2 | Apache 2.0, MoE efficiency, free |
| **API-based, max quality** | Voyage-3-large | +9.74% over OpenAI, 32K context, binary quantization |
| **API-based, multimodal docs** | Cohere Embed v4 | 128K context, multimodal, best domain generalization |
| **Hybrid retrieval (one model)** | BGE-M3 | Only model with dense + SPLADE + ColBERT unified |

---

## Appendix: Key Benchmark Summary Table

### pgvector Index Performance (1M vectors, 99% recall)

| Dim | Index | pgvector version | QPS | p99 (ms) | Build time | Index size |
|---|---|---|---|---|---|---|
| 128 (sift) | IVFFlat | 0.4.1 | 33 | 44 | 58s | 0.51 GiB |
| 128 (sift) | HNSW | 0.7.0 | **487** | **2.65** | 56s | 0.76 GiB |
| 960 (gist) | IVFFlat | 0.4.1 | 13 | 129 | 300s | 3.82 GiB |
| 960 (gist) | HNSW | 0.7.0 | **229** | **5.18** | 197s | 7.50 GiB |
| 1536 (openai) | IVFFlat | 0.4.1 | 8 | 150 | 474s | 7.56 GiB |
| 1536 (openai) | HNSW | 0.7.0 | **253** | **5.51** | 250s | 7.55 GiB |

### Vector Database Throughput @ 50M vectors, 99% recall

| Database | QPS | p50 (ms) | p95 (ms) | p99 (ms) | Build time |
|---|---|---|---|---|---|
| pgvectorscale (StreamingDiskANN) | **471** | 31.07 | 60.42 | 74.60 | 11.1h |
| Qdrant (HNSW + BQ) | 41 | 30.75 | 36.73 | **38.71** | **3.3h** |
| Pinecone s1 | ~471* | ~45 | 784 | — | Managed |

*Pinecone s1 at same throughput; 28× higher p95 latency per [DEV Community March 2026](https://dev.to/polliog/postgresql-as-a-vector-database-when-to-use-pgvector-vs-pinecone-vs-weaviate-4kfi)

---

## Key Takeaways for Agent Memory System Design

1. **Use HNSW over IVFFlat for production:** 15–30× better QPS, 20–30× lower p99 latency at equal recall. With pgvector 0.7+, build time penalty is largely eliminated (4 minutes for 1M vectors).

2. **pgvector 0.8.0 iterative scans are critical for filtered queries:** Agent memory systems constantly filter by user, session, or context — `hnsw.iterative_scan = relaxed_order` prevents incomplete result sets and delivers up to 100× better result completeness.

3. **Quantization strategy:** Use `halfvec` (scalar quantization) as the default — 50% memory savings with near-zero recall impact. Reserve binary quantization for very large indexes (>10M vectors) with mandatory re-ranking.

4. **pgvectorscale beats specialized DBs on throughput:** 11.4× more QPS than Qdrant at 50M vectors. If you're already on PostgreSQL, this is a compelling reason to stay.

5. **Hybrid search is mandatory for production:** BM25 + dense + RRF consistently adds 10–15% nDCG@10 over single-method retrieval. BGE-M3 provides all three modes (dense, sparse, ColBERT) from a single model — ideal for self-hosted deployments.

6. **Graph RAG for multi-hop agent reasoning:** Use LightRAG over GraphRAG for agent memory — it supports incremental updates (critical for continuous memory ingestion), costs 26× less to index, and retrieves with a single API call. Reserve pure vector RAG for single-hop fact retrieval.

7. **Embedding model selection:** For sovereign self-hosted deployments, GTE-Qwen2-7B-instruct or Qwen3-Embedding-8B (both Apache 2.0) provide the highest quality at no token cost. BGE-M3 is the pragmatic choice if you need hybrid retrieval in a single model under 1B parameters.

---

*Sources consolidated from:*
- [Jonathan Katz 150x speedup benchmark (Apr 2024)](https://jkatz.github.io/post/postgres/pgvector-performance-150x-speedup/)
- [AWS Aurora pgvector 0.7.0 analysis (Oct 2024)](https://aws.amazon.com/blogs/database/load-vector-embeddings-up-to-67x-faster-with-pgvector-and-amazon-aurora/)
- [pgvector 0.7.0 release notes (Apr 2024)](https://www.postgresql.org/about/news/pgvector-070-released-2852/)
- [pgvector 0.8.0 release notes (Nov 2024)](https://www.postgresql.org/about/news/pgvector-080-released-2952/)
- [AWS Aurora pgvector 0.8.0 analysis (May 2025)](https://aws.amazon.com/blogs/database/supercharging-vector-search-performance-and-relevance-with-pgvector-0-8-0-on-amazon-aurora-postgresql/)
- [Timescale pgvector vs Qdrant benchmark (Apr 2025)](https://www.tigerdata.com/blog/pgvector-vs-qdrant)
- [Instaclustr pgvector performance (Feb 2026)](https://www.instaclustr.com/education/vector-database/pgvector-performance-benchmark-results-and-5-ways-to-boost-performance/)
- [DEV Community IVFFlat vs HNSW (Mar 2026)](https://dev.to/philip_mcclarence_2ef9475/ivfflat-vs-hnsw-in-pgvector-which-index-should-you-use-305p)
- [Zylos Research pgvector optimization (Jan 2026)](https://zylos.ai/research/pgvector-optimization-2025)
- [Firecrawl best vector databases 2026 (Oct 2025)](https://www.firecrawl.dev/blog/best-vector-databases)
- [F22 Labs Milvus vs Qdrant (Feb 2026)](https://www.f22labs.com/blogs/qdrant-vs-milvus-which-vector-database-should-you-choose/)
- [arXiv RAG vs GraphRAG systematic evaluation (Mar 2026)](https://arxiv.org/html/2502.11371v3)
- [LightRAG paper / arXiv 2410.05779 (Oct 2024)](https://arxiv.org/html/2410.05779v3)
- [LightRAG GitHub HKUDS](https://github.com/HKUDS/LightRAG)
- [Microsoft BenchmarkQED LazyGraphRAG (Jun 2025)](https://www.microsoft.com/en-us/research/blog/benchmarkqed-automated-benchmarking-of-rag-systems/)
- [arXiv hybrid search trade-offs 2508.01405 (Nov 2025)](https://arxiv.org/html/2508.01405v2)
- [Weaviate hybrid search explained (Jan 2025)](https://weaviate.io/blog/hybrid-search-explained)
- [InfiniFlow hybrid search analysis (Jul 2024)](https://infiniflow.org/blog/best-hybrid-search-solution)
- [Echo-Mistral-SPLADE analysis (Dec 2025)](https://www.emergentmind.com/topics/echo-mistral-splade)
- [BGE-M3 HuggingFace model card](https://huggingface.co/BAAI/bge-m3)
- [BGE-EN-ICL HuggingFace / arXiv 2409.15700](https://arxiv.org/abs/2409.15700)
- [GTE-Qwen2-7B HuggingFace](https://huggingface.co/Alibaba-NLP/gte-Qwen2-7B-instruct)
- [Voyage-3-large announcement (Jan 2025)](https://blog.voyageai.com/2025/01/07/voyage-3-large/)
- [Jina Embeddings v3 / arXiv 2409.10173](https://arxiv.org/abs/2409.10173)
- [Nomic Embed v2 MoE HuggingFace](https://huggingface.co/nomic-ai/nomic-embed-text-v2-moe)
- [Ailog MTEB leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/guides/choosing-embedding-models)
- [Ailog BEIR 2.0 leaderboard (Jan 2026)](https://app.ailog.fr/en/blog/news/beir-benchmark-update)
- [Modal MTEB leaderboard article (Oct 2025)](https://modal.com/blog/mteb-leaderboard-article)
- [Cohere Embed v4 AWS Bedrock (Oct 2025)](https://aws.amazon.com/about-aws/whats-new/2025/10/coheres-embed-v4-multimodal-embeddings-bedrock/)
