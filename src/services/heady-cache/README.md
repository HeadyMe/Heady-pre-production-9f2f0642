# HeadyCache

Intelligent semantic cache for the Heady AI platform. Eliminates redundant API calls by matching semantically similar queries instead of only exact matches.

**Port:** `3105`  
**Node:** `>=20.0.0`  
**Sacred Geometry:** `PHI = 1.618033988749895`

---

## Architecture

```
 Client
   │
   ▼
 Express (helmet / cors / compression)
   │
   ▼
 HeadyCache (index.js)
   ├── SemanticMatcher  ──► HeadyEmbed (port 3103)
   │     └── VPTree (ANN search)
   ├── EvictionEngine
   │     └── LRU / LFU / TTL / Similarity-Aware / Hybrid
   ├── CacheAnalytics
   └── Storage Backend
         ├── MemoryStore   (default)
         ├── FileStore     (JSON-lines + WAL)
         └── PgStore       (PostgreSQL + pgvector)
```

### Semantic Cache Flow

```
GET request ("What is the boiling point of water?")
     │
     ├── 1. Hash match (SHA-256 of key)
     │        ↓ exact hit → return immediately
     │
     ├── 2. Embed key via HeadyEmbed → 384-dim vector
     │
     ├── 3. VP-tree ANN search (k=1) over indexed vectors
     │        ↓ similarity ≥ threshold → return cached result
     │
     └── 4. Cache miss → caller computes result → SET
```

---

## Quick Start

### Memory backend (default)

```bash
cd src/services/heady-cache
npm install
npm start
```

### Docker

```bash
# Memory backend
docker compose up heady-cache

# File-backed (persistent)
docker compose --profile file up

# PostgreSQL + pgvector
docker compose --profile pg up
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HEADY_CACHE_PORT` | `3105` | HTTP port |
| `HEADY_CACHE_BACKEND` | `memory` | `memory` \| `file` \| `pg` |
| `HEADY_CACHE_MAX_SIZE` | `50000` | Max entries per namespace |
| `HEADY_CACHE_TTL` | `3600000` | Default TTL (ms) |
| `HEADY_CACHE_SIMILARITY_THRESHOLD` | `0.95` | Cosine similarity threshold |
| `HEADY_CACHE_EVICTION_POLICY` | `lru` | `lru` \| `lfu` \| `ttl` \| `similarity` \| `hybrid` |
| `HEADY_CACHE_WRITE_STRATEGY` | `write-through` | `write-through` \| `write-behind` |
| `HEADY_CACHE_WRITE_BEHIND_INTERVAL` | `8090` | Write-behind flush interval (ms) |
| `HEADY_CACHE_DISTANCE_METRIC` | `cosine` | `cosine` \| `euclidean` \| `dot` |
| `HEADY_CACHE_SLIDING_TTL` | `true` | Reset TTL on cache hit |
| `HEADY_CACHE_FILE_PATH` | `/tmp/heady-cache.jsonl` | File store path |
| `HEADY_CACHE_WAL_PATH` | `/tmp/heady-cache.wal` | WAL path |
| `HEADY_CACHE_PG_URL` | `postgresql://localhost:5432/heady_cache` | PostgreSQL URL |
| `HEADY_EMBED_URL` | `http://localhost:3103` | HeadyEmbed service URL |
| `HEADY_CACHE_COST_PER_CALL` | `0.002` | USD cost per avoided API call |
| `HEADY_CACHE_MEMORY_THRESHOLD` | `536870912` | Memory pressure threshold (bytes) |

---

## API Reference

All requests use `Content-Type: application/json`.

### `POST /cache/get`

Semantic or exact cache lookup.

**Request:**
```json
{
  "key": "What is the boiling point of water?",
  "namespace": "chemistry",
  "threshold": 0.92,
  "exactOnly": false
}
```

**Response (hit):**
```json
{
  "hit": true,
  "value": { "answer": "100°C at sea level" },
  "similarity": 0.9834,
  "exact": false,
  "meta": {
    "namespace": "chemistry",
    "ttl": 3600000,
    "createdAt": 1709856000000,
    "accessCount": 7
  }
}
```

**Response (miss):**
```json
{ "hit": false }
```

---

### `POST /cache/set`

Store a cache entry with optional pre-computed embedding.

**Request:**
```json
{
  "key": "What is the boiling point of water?",
  "value": { "answer": "100°C at sea level" },
  "namespace": "chemistry",
  "ttl": 86400000,
  "vector": [0.12, 0.45, ...],
  "skipEmbed": false
}
```

**Response:**
```json
{ "id": "a3f8c2d1e7b4..." }
```

---

### `DELETE /cache/:key?namespace=<ns>`

Delete an entry by exact key.

```
DELETE /cache/What%20is%20the%20boiling%20point%20of%20water%3F?namespace=chemistry
```

**Response:**
```json
{ "deleted": true }
```

---

### `POST /cache/batch/get`

Batch semantic lookup (max 1000 per request).

**Request:**
```json
{
  "requests": [
    { "key": "query 1", "namespace": "ns" },
    { "key": "query 2" }
  ]
}
```

**Response:**
```json
{
  "results": [
    { "hit": true, "value": "...", "similarity": 0.98, "exact": true },
    { "hit": false }
  ]
}
```

---

### `POST /cache/batch/set`

Batch store (max 1000 per request).

**Request:**
```json
{
  "requests": [
    { "key": "key1", "value": "v1", "ttl": 3600000 },
    { "key": "key2", "value": "v2" }
  ]
}
```

**Response:**
```json
{ "results": [{ "id": "abc..." }, { "id": "def..." }] }
```

---

### `DELETE /cache/namespace/:ns`

Clear all entries in a namespace.

```
DELETE /cache/namespace/chemistry
```

**Response:**
```json
{ "cleared": true }
```

---

### `GET /cache/stats`

Lightweight stats snapshot.

```json
{
  "hits": 1240,
  "semanticHits": 87,
  "exactHits": 1153,
  "misses": 310,
  "sets": 310,
  "hitRate": 0.8,
  "missRate": 0.2,
  "evictions": 42,
  "entries": 268,
  "bytes": 2097152,
  "uptimeMs": 3600000
}
```

---

### `GET /cache/analytics`

Full analytics report including latency histograms, hot keys, namespace breakdown, and savings.

```json
{
  "hits": 1240,
  "hitRate": 0.8,
  "latency": {
    "get": { "count": 1550, "p50": 2, "p95": 8, "p99": 32, "mean": 3.2 },
    "set": { "count": 310, "p50": 15, "p95": 64, "p99": 128 },
    "batch": { "count": 5, "p50": 32, "p95": 128 }
  },
  "hotKeys": [
    { "key": "What is the capital of France?", "count": 94 }
  ],
  "savings": {
    "callsAvoided": 1240,
    "costSaved": 2.48,
    "costPerCall": 0.002
  },
  "namespaces": {
    "chemistry": { "hits": 400, "misses": 50, "hitRate": 0.889 }
  },
  "timeSeries": [
    { "ts": 1709856060000, "hitRate": 0.78, "entries": 250, "p99GetMs": 28 }
  ]
}
```

---

### `POST /cache/warm`

Warm the cache from a data source (max 10000 entries per request).

**Request:**
```json
{
  "entries": [
    { "key": "Q: boiling point water", "value": "100°C", "namespace": "chemistry" },
    { "key": "Q: speed of light",      "value": "299792458 m/s" }
  ]
}
```

**Response:**
```json
{ "warmed": 2, "failed": 0 }
```

---

### `GET /health`

Basic health check (Docker / Kubernetes compatible).

```json
{
  "status": "ok",
  "backend": "memory",
  "entries": 268,
  "uptime": 3600000
}
```

### `GET /health/detailed`

Extended health check with memory, system, and analytics checks.

```json
{
  "status": "ok",
  "service": "heady-cache",
  "version": "1.0.0",
  "timestamp": "2026-03-07T11:00:00.000Z",
  "latencyMs": 3,
  "checks": {
    "memory": { "heapUsedMb": 48, "rssMb": 92, "status": "ok" },
    "system": { "freePercent": 64, "status": "ok" },
    "cache": { "status": "ok", "latencyMs": 1, "entries": 268 },
    "analytics": { "status": "ok", "hitRate": 0.8 }
  }
}
```

---

## Semantic Matching

### VP-Tree (Vantage Point Tree)

HeadyCache uses a VP-tree for sub-linear approximate nearest neighbor (ANN) search over 384-dimensional embedding vectors. The tree:

- Builds incrementally (configurable rebuild threshold, default 100 changes)
- Supports cosine, euclidean, and dot product distance metrics
- Falls back to a linear scan when the tree is dirty between rebuilds
- Rebuilds at `O(n log n)` when threshold is reached

### Similarity Threshold

The `HEADY_CACHE_SIMILARITY_THRESHOLD` (default `0.95`) controls how similar a query must be to a cached key to count as a hit. A threshold of `1.0` = exact match only (but hash lookup is still used for perfect exact matches). A threshold of `0.80` is more aggressive and may return more false positives.

### Embedding Fallback

If HeadyEmbed is unavailable (or `skipEmbed: true`), HeadyCache falls back to SHA-256 hash exact matching. Availability is re-checked every 30 seconds.

---

## Storage Backends

### Memory (default)

Fast, non-persistent. Best for stateless deployments or ephemeral caches.

```
HEADY_CACHE_BACKEND=memory
```

- LRU doubly-linked list for O(1) eviction
- Periodic TTL sweep every 60 seconds
- Byte size estimation via JSON serialization

### File (JSON-lines + WAL)

Persistent across restarts. Uses Write-Ahead Logging for durability.

```
HEADY_CACHE_BACKEND=file
HEADY_CACHE_FILE_PATH=/data/heady-cache.jsonl
HEADY_CACHE_WAL_PATH=/data/heady-cache.wal
```

- Main snapshot: one `{key, value, meta}` JSON per line
- WAL: append-only operation log for durability
- Compaction triggered after 1000 WAL entries (configurable)
- In-memory MemoryStore used for fast reads; disk only for persistence

### PostgreSQL + pgvector

Production-grade, horizontally scalable. Requires `pgvector` extension.

```
HEADY_CACHE_BACKEND=pg
HEADY_CACHE_PG_URL=postgresql://user:pass@host:5432/heady_cache
```

- Native `vector <=> query` cosine similarity in SQL
- IVFFlat index for fast ANN
- Schema auto-created on startup
- pgvector's `<=>` operator is the cosine distance operator

---

## Eviction Policies

| Policy | Description |
|---|---|
| `lru` | Evict least recently accessed entries |
| `lfu` | Evict least frequently accessed entries |
| `ttl` | Evict entries closest to expiry first |
| `similarity` | Evict entries with the most similar neighbors (most redundant) |
| `hybrid` | Weighted combination: `lru×0.4 + lfu×0.3 + ttl×0.2 + similarity×0.1` |

Memory pressure (heap > `HEADY_CACHE_MEMORY_THRESHOLD`) triggers aggressive eviction of 25% of cache entries regardless of policy.

---

## Write Strategies

### Write-Through (default)

Writes go synchronously to the backing store before returning. Guarantees consistency; adds latency equal to the store's write time.

### Write-Behind

Writes are queued in memory and flushed to the backing store asynchronously at a configurable interval (default `~8090ms` = `5000 × PHI`). The semantic index is updated synchronously, so reads work immediately. Risk: data loss on crash before flush.

---

## Tests

```bash
npm test
npm run test:coverage
```

Tests cover: VPTree construction/kNN/range search, all similarity functions, SemanticMatcher hash and vector indexing, MemoryStore CRUD/LRU/LFU/TTL, FileStore WAL replay, EvictionEngine all policies, CacheAnalytics counters/histograms/savings, HeadyCache integration (get/set/delete/batch/warm/health), and all Express routes via supertest.

---

## Production Deployment (Cloud Run)

```yaml
# cloud-run.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: heady-cache
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT/heady-cache:latest
          ports:
            - containerPort: 3105
          env:
            - name: HEADY_CACHE_BACKEND
              value: memory
            - name: HEADY_CACHE_MAX_SIZE
              value: "50000"
            - name: HEADY_EMBED_URL
              value: https://heady-embed-SERVICE_HASH-uc.a.run.app
          resources:
            limits:
              memory: 2Gi
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health
              port: 3105
            initialDelaySeconds: 10
```

---

## Project Structure

```
heady-cache/
├── index.js              # HeadyCache main service class
├── semantic-matcher.js   # VP-tree + embedding-based ANN search
├── eviction.js           # LRU/LFU/TTL/similarity/hybrid eviction
├── analytics.js          # Hit rate, latency histograms, savings
├── routes.js             # Express router
├── server.js             # HTTP server entry point
├── health.js             # Detailed health check
├── config.js             # Environment-based configuration
├── package.json
├── Dockerfile
├── docker-compose.yml
├── storage/
│   ├── memory-store.js   # In-memory LRU + TTL store
│   ├── file-store.js     # JSON-lines + WAL persistent store
│   └── pg-store.js       # PostgreSQL + pgvector store
└── __tests__/
    └── heady-cache.test.js
```
