# HeadyVector

**Production-ready vector search service** for the Heady AI platform — a self-hosted replacement for Pinecone/Weaviate backed by **PostgreSQL + pgvector**.

---

## Features

| Feature | Implementation |
|---|---|
| Vector storage | pgvector (float4 columns) |
| Semantic search | HNSW cosine similarity |
| Full-text search | PostgreSQL `tsvector`/`tsquery` (BM25-like) |
| Hybrid search | Reciprocal Rank Fusion (RRF) with configurable `alpha` |
| Diverse search | Maximum Marginal Relevance (MMR) |
| Graph RAG | Entity-relationship graph with multi-hop traversal |
| Multi-tenancy | Collections + namespaces |
| Embeddings | 384-dim and 768-dim |
| Indexing | HNSW and IVFFlat (auto-selected by collection size) |
| Migrations | Auto-run versioned SQL migrations on startup |
| Scaling | Sacred Geometry (PHI=1.618) pool sizing |

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    HeadyVector Service                   │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ collections│ │  search  │  │ graph-rag│  │ health │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  indexes │  │migrations│  │      routes.js        │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│                                                          │
│          PostgreSQL + pgvector (via pg Pool)              │
└──────────────────────────────────────────────────────────┘
```

### Database schema

```
heady_collections          — collection metadata, HNSW params
heady_vectors              — vectors (embedding vector(384|768), content tsvector)
heady_graph_nodes          — graph nodes (document, chunk, entity, concept)
heady_graph_edges          — directed edges with weights
heady_graph_communities    — community assignments (Louvain-inspired)
heady_query_metrics        — query latency tracking
heady_vector_migrations    — migration version tracking
```

---

## Quick start

### Docker Compose (recommended)

```bash
cd src/services/heady-vector
docker compose up -d

# View logs
docker compose logs -f heady-vector

# With pgAdmin UI
docker compose --profile dev up -d
```

### Direct (requires PostgreSQL with pgvector)

```bash
# Install dependencies
npm install

# Set environment
export DATABASE_URL=postgresql://heady:heady@localhost:5432/heady_vector
export HEADY_VECTOR_PORT=3103

# Start
node server.js
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `HEADY_VECTOR_PORT` | `3103` | HTTP port |
| `DATABASE_URL` | `postgresql://heady:heady@localhost:5432/heady_vector` | PostgreSQL connection string |
| `PG_POOL_SIZE` | `16` | Connection pool max size |
| `PG_SSL` | `false` | Enable SSL for PG (`"true"`) |
| `HNSW_M` | `16` | HNSW max connections per node |
| `HNSW_EF_CONSTRUCTION` | `200` | HNSW build-time candidate list |
| `HNSW_EF_SEARCH` | `100` | HNSW query-time candidate list |
| `IVFFLAT_LISTS` | `100` | IVFFlat cluster count |
| `BM25_WEIGHT` | `0.3` | BM25 weight in hybrid search |
| `SEMANTIC_WEIGHT` | `0.7` | Semantic weight in hybrid search |
| `DEFAULT_ALPHA` | `0.7` | Default hybrid alpha (0=BM25, 1=semantic) |
| `DEFAULT_TOP_K` | `10` | Default search result count |
| `BATCH_UPSERT_SIZE` | `261` | Vectors per batch chunk (PHI²×100) |
| `GRAPH_MAX_DEPTH` | `3` | Max graph traversal depth |
| `GRAPH_MAX_NODES` | `100` | Max nodes returned in traversal |
| `LOG_LEVEL` | `info` | Logging level |

---

## API Reference

### Health

```
GET  /health          Full health check
GET  /health/live     Kubernetes liveness probe
GET  /health/ready    Kubernetes readiness probe
GET  /metrics         Service runtime metrics
```

### Collections

```
POST   /collections           Create collection
GET    /collections           List collections (?limit=&offset=)
GET    /collections/:name     Get collection
GET    /collections/:name/stats  Collection statistics
PATCH  /collections/:name     Update settings
DELETE /collections/:name     Delete collection + all vectors
```

**Create collection body:**
```json
{
  "name": "my-docs",
  "dimension": 384,
  "description": "Document embeddings",
  "indexType": "hnsw",
  "distanceMetric": "cosine",
  "hnswM": 16,
  "hnswEfConstruction": 200,
  "hnswEfSearch": 100,
  "metadataSchema": {
    "required": ["source"],
    "properties": {
      "source": { "type": "string" },
      "score": { "type": "number" }
    }
  }
}
```

### Vectors

```
POST   /vectors/upsert              Upsert single or batch vectors
GET    /vectors/:id                 Get vector by UUID
DELETE /vectors/:id                 Delete vector by UUID
POST   /vectors/delete-by-filter    Delete by metadata filter
```

**Upsert single:**
```json
{
  "collection": "my-docs",
  "id": "doc-001",
  "namespace": "default",
  "vector": [0.1, 0.2, ...],
  "content": "The text content for BM25 search",
  "metadata": { "source": "wiki", "topic": "ml" }
}
```

**Upsert batch:**
```json
{
  "collection": "my-docs",
  "batchSize": 261,
  "vectors": [
    { "id": "a", "vector": [...], "content": "...", "metadata": {} },
    { "id": "b", "vector": [...], "content": "...", "metadata": {} }
  ]
}
```

### Search

```
POST /vectors/search       Semantic, BM25, or hybrid search
POST /vectors/search/mmr   Maximum Marginal Relevance (diverse) search
```

**Semantic search:**
```json
{
  "collection": "my-docs",
  "type": "semantic",
  "vector": [0.1, 0.2, ...],
  "topK": 10,
  "namespace": "default",
  "filter": { "topic": "ml" }
}
```

**BM25 search:**
```json
{
  "collection": "my-docs",
  "type": "bm25",
  "query": "machine learning transformers",
  "topK": 10
}
```

**Hybrid search (RRF):**
```json
{
  "collection": "my-docs",
  "type": "hybrid",
  "vector": [0.1, 0.2, ...],
  "query": "machine learning",
  "alpha": 0.7,
  "topK": 10,
  "filter": { "score": { "$gte": 0.5 } }
}
```

**alpha parameter:**
- `1.0` = pure semantic (vector similarity only)
- `0.0` = pure BM25 (keyword search only)
- `0.7` = 70% semantic + 30% BM25 (default)

**Metadata filter operators:**
```json
{ "score": { "$gt": 0.5 } }
{ "topic": { "$in": ["ml", "ai"] } }
{ "$and": [{ "topic": "ml" }, { "score": { "$gte": 0.7 } }] }
{ "$or": [{ "topic": "ml" }, { "topic": "db" }] }
```

**MMR search:**
```json
{
  "collection": "my-docs",
  "vector": [0.1, 0.2, ...],
  "topK": 10,
  "lambda": 0.5
}
```
`lambda`: 1.0 = pure relevance, 0.0 = pure diversity.

### Graph RAG

```
POST  /graph/nodes                   Add graph node
GET   /graph/nodes/:id               Get node
DELETE /graph/nodes/:id              Delete node
GET   /graph/nodes/:id/edges         Get node's edges
POST  /graph/edges                   Add edge
POST  /graph/traverse                BFS traversal
POST  /graph/rag                     Graph RAG retrieval
POST  /graph/paths                   Find paths between nodes
POST  /graph/community/detect        Run community detection
POST  /graph/pagerank                Compute PageRank
GET   /graph/visualize               Export for D3/Cytoscape
```

**Add node:**
```json
{
  "label": "Machine Learning",
  "nodeType": "concept",
  "content": "A branch of AI focused on learning from data",
  "vector": [0.1, 0.2, ...],
  "properties": { "domain": "AI", "importance": 0.9 }
}
```

Node types: `document`, `chunk`, `entity`, `concept`, `custom`

**Add edge:**
```json
{
  "sourceId": "uuid-a",
  "targetId": "uuid-b",
  "edgeType": "related_to",
  "weight": 0.8,
  "bidirectional": false
}
```

Edge types: `references`, `contains`, `related_to`, `derived_from`, `mentions`, `co_occurs`, `custom`

**Graph traversal:**
```json
{
  "seedNodeIds": ["uuid-a", "uuid-b"],
  "maxDepth": 3,
  "maxNodes": 100,
  "edgeTypes": ["contains", "references"],
  "minWeight": 0.1,
  "direction": "outgoing"
}
```

**Graph RAG retrieval:**
```json
{
  "collection": "my-docs",
  "vector": [0.1, 0.2, ...],
  "query": "neural network architectures",
  "topK": 10,
  "entityTopK": 5,
  "maxDepth": 2,
  "nodeTypes": ["document", "chunk"]
}
```

Graph RAG algorithm:
1. Find top `entityTopK` entity/concept nodes semantically similar to the query
2. BFS-traverse their neighborhood up to `maxDepth`
3. Collect all `document`/`chunk` nodes in the subgraph
4. Score and rank by cosine similarity or PageRank
5. Return assembled context with path metadata

### Index management

```
POST /indexes/rebuild    Rebuild HNSW/IVFFlat index for a collection
POST /indexes/optimize   VACUUM ANALYZE (improves query plans)
GET  /indexes/health     Index health summary
```

### Migrations

```
GET /migrations/status   View all migrations and their applied status
```

---

## Hybrid search: RRF explained

Reciprocal Rank Fusion combines ranked lists from different retrieval systems:

```
RRF_score(d) = Σ_i [weight_i / (k + rank_i(d))]
```

Where:
- `k = 60` (smoothing constant, prevents dominance by top ranks)
- `rank_i(d)` = rank of document `d` in system `i`
- `weight_i` = alpha (semantic) or 1-alpha (BM25)

Documents in both lists get boosted. Documents in only one list are included at lower scores.

---

## HNSW index tuning

| Parameter | Default | Effect |
|---|---|---|
| `m` | 16 | More connections → better recall, more memory |
| `ef_construction` | 200 | Higher → better index quality, slower build |
| `ef_search` | 100 | Higher → better recall, slower queries |

**Recommended settings by use case:**

```
High recall (RAG):        m=32, ef_construction=400, ef_search=200
Balanced:                 m=16, ef_construction=200, ef_search=100 (default)
High throughput:          m=8,  ef_construction=100, ef_search=50
```

---

## Sacred Geometry scaling

HeadyVector uses PHI (φ = 1.618033988749895) for default sizing:

```js
PG_POOL_SIZE = round(PHI * 10) = 16
BATCH_UPSERT_SIZE = round(PHI² * 100) = 261
```

---

## Running tests

```bash
# Start PostgreSQL
docker compose up -d postgres

# Run tests
DATABASE_URL=postgresql://heady:heady@localhost:5432/heady_vector \
  npx jest __tests__/heady-vector.test.js --runInBand --verbose
```

Tests cover:
- Migration idempotency + schema validation
- Collection CRUD + metadata schema enforcement
- Vector upsert (single + batch), get, delete, filter-delete
- Semantic search (top-K, ordering, filter, namespace, pagination)
- BM25 search (keyword matching, empty results, validation)
- Hybrid RRF search (alpha variants, edge cases)
- MMR diverse search (lambda variants)
- Metadata filter builder (all operators)
- Graph nodes + edges CRUD
- BFS traversal (depth limits, cycle prevention)
- Graph RAG retrieval (entity anchoring, path assembly)
- Community detection + PageRank
- Visualization export (D3 format)
- Health checks (DB, pgvector, index status)
- Config (PHI, defaults)

---

## Cloud Run deployment

```yaml
# service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: heady-vector
spec:
  template:
    spec:
      containers:
        - image: gcr.io/PROJECT/heady-vector:latest
          ports:
            - containerPort: 3103
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: heady-vector-secrets
                  key: DATABASE_URL
            - name: NODE_ENV
              value: production
          resources:
            limits:
              memory: 2Gi
              cpu: "2"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3103
            initialDelaySeconds: 30
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3103
            initialDelaySeconds: 10
            periodSeconds: 10
```

---

## File structure

```
heady-vector/
├── server.js           Express server entry point
├── index.js            HeadyVector class (main service)
├── config.js           Configuration + PHI constants
├── migrations.js       Database migration system
├── collections.js      Collection management
├── indexes.js          HNSW/IVFFlat index lifecycle
├── search.js           Semantic + BM25 + hybrid + MMR search
├── graph-rag.js        Graph RAG + traversal + community detection
├── health.js           Health checks
├── routes.js           Express router (all endpoints)
├── init-db.sql         PostgreSQL initialization (extensions)
├── Dockerfile          Multi-stage production image
├── docker-compose.yml  Postgres + service + pgAdmin
└── __tests__/
    └── heady-vector.test.js   Full integration test suite
```

---

## License

Heady AI Platform — Internal service. © 2026 Heady Connection.
