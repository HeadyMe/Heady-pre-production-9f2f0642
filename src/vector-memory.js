/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady 3D Spatial Vector Memory ──────────────────────────────
 *
 * TRUE 3D ARCHITECTURE:
 *   - Every vector gets (x, y, z) coordinates via PCA-lite projection
 *   - 8 octant zones in 3D space for spatial locality
 *   - Zone-first query: search nearest zone first, expand if needed
 *   - Sharded across 5 Fibonacci shards for parallel scan
 *   - HF embedding workers (round-robin across tokens)
 *
 * 3D Projection:
 *   384-dim embedding → split into 3 groups of 128 dims
 *   x = average(dims[0..127]), y = average(dims[128..255]), z = average(dims[256..383])
 *   Zone = octant based on sign of (x, y, z) → 0-7
 *
 * Query Strategy:
 *   1. Project query to 3D, find query zone
 *   2. Search same-zone vectors FIRST (fast path)
 *   3. If score < threshold, expand to adjacent zones
 *   4. Merge all results, return top-K
 *
 * Embedding: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
 * Timing: φ-derived (golden ratio intervals)
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");
const HeadyGateway = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "gateway"));
const { createProviders } = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "providers"));

const PHI = 1.6180339887;
let federation = null;
try { federation = require("./vector-federation"); } catch { }
const VECTOR_STORE_PATH = path.join(__dirname, "..", "data", "vector-memory.json");
const SHARD_DIR = path.join(__dirname, "..", "data", "vector-shards");
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const MAX_VECTORS_PER_SHARD = 2000;
const NUM_SHARDS = 5;
const PERSIST_DEBOUNCE = Math.round(PHI ** 2 * 1000);
const ZONE_EXPAND_THRESHOLD = 0.5; // Expand to adjacent zones if best score is below this

if (!fs.existsSync(SHARD_DIR)) fs.mkdirSync(SHARD_DIR, { recursive: true });

// ── Sharded Storage ─────────────────────────────────────────────
const shards = [];
let hfClients = [];
let ingestCount = 0;
let queryCount = 0;
let remoteEmbedCount = 0;
let localFallbackCount = 0;

// ── 3D Zone Index ───────────────────────────────────────────────
// 8 octant zones based on sign of (x, y, z)
const zoneIndex = new Map(); // zoneId → [vectorRefs]
const zoneStats = { queries: 0, zoneHits: 0, expansions: 0 };
for (let i = 0; i < 8; i++) zoneIndex.set(i, []);

// ── Graph Layer (Hybrid RAG) ────────────────────────────────────
// Stores explicit entity-relationship edges alongside vector embeddings
// Enables multi-hop reasoning: "How did error X → rule Y → prevent Z?"
const graphEdges = new Map(); // nodeId → [{ target, relation, weight, ts }]
const GRAPH_PATH = path.join(__dirname, "..", "data", "vector-graph.json");
let graphEdgeCount = 0;

/**
 * PCA-lite: project 384-dim embedding → (x, y, z) coordinates
 * Split dims into 3 groups of 128, average each group
 */
function to3D(embedding) {
    if (!embedding || embedding.length < 3) return { x: 0, y: 0, z: 0 };
    const third = Math.floor(embedding.length / 3);
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < third; i++) {
        x += embedding[i] || 0;
        y += embedding[i + third] || 0;
        z += embedding[i + 2 * third] || 0;
    }
    return { x: x / third, y: y / third, z: z / third };
}

/**
 * Map 3D coords to octant zone (0-7)
 * Zone 0: (-, -, -), Zone 1: (+, -, -), ... Zone 7: (+, +, +)
 */
function assignZone(x, y, z) {
    return (x >= 0 ? 1 : 0) | (y >= 0 ? 2 : 0) | (z >= 0 ? 4 : 0);
}

/**
 * Get adjacent zones (zones that share at least one axis sign)
 */
function getAdjacentZones(zone) {
    const adjacent = [];
    for (let i = 0; i < 8; i++) {
        if (i === zone) continue;
        // Adjacent = differs by at most 1 bit (shares 2 of 3 axis signs)
        const diff = zone ^ i;
        if (diff === 1 || diff === 2 || diff === 4) adjacent.push(i);
    }
    return adjacent;
}

/**
 * 3D Euclidean distance between two 3D points
 */
function dist3D(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

// ── Shard Init ──────────────────────────────────────────────────
function initShards() {
    for (let i = 0; i < NUM_SHARDS; i++) {
        const shardPath = path.join(SHARD_DIR, `shard-${i}.json`);
        let vectors = [];
        try {
            if (fs.existsSync(shardPath)) {
                vectors = JSON.parse(fs.readFileSync(shardPath, "utf-8"));
            }
        } catch { }
        shards.push({ id: i, vectors, path: shardPath, dirty: false });
    }

    // Migrate from old single-file store
    try {
        if (fs.existsSync(VECTOR_STORE_PATH)) {
            const data = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, "utf-8"));
            const oldVectors = Array.isArray(data) ? data : data.vectors || [];
            if (oldVectors.length > 0 && shards.every(s => s.vectors.length === 0)) {
                logger.logSystem(`  \u221e VectorMemory: Migrating ${oldVectors.length} vectors into ${NUM_SHARDS} shards`);
                oldVectors.forEach((v, i) => {
                    shards[i % NUM_SHARDS].vectors.push(v);
                    shards[i % NUM_SHARDS].dirty = true;
                });
                persistAllShards();
                // Optionally remove old file after migration
                // fs.unlinkSync(VECTOR_STORE_PATH);
            }
        }
    } catch (e) {
        logger.warn(`  \u221e VectorMemory: Error during old vector store migration: ${e.message}`);
    }

    // Build 3D zone index from all existing vectors
    let indexed = 0;
    shards.forEach(shard => {
        shard.vectors.forEach(v => {
            if (v.embedding) {
                const pos = to3D(v.embedding);
                v._3d = pos;
                v._zone = assignZone(pos.x, pos.y, pos.z);
                zoneIndex.get(v._zone).push({ id: v.id, shardId: shard.id });
                indexed++;
            }
        });
    });

    const total = shards.reduce((s, sh) => s + sh.vectors.length, 0);
    const zoneDistribution = {};
    zoneIndex.forEach((refs, zone) => { if (refs.length > 0) zoneDistribution[zone] = refs.length; });
    logger.logSystem(`  \u221e VectorMemory: ${NUM_SHARDS} shards, ${total} vectors, ${indexed} indexed in 3D`);
    logger.logSystem(`  \u221e VectorMemory: Zone distribution: ${JSON.stringify(zoneDistribution)}`);

    // Load graph edges from disk
    try {
        if (fs.existsSync(GRAPH_PATH)) {
            const graphData = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf-8"));
            for (const [nodeId, edges] of Object.entries(graphData)) {
                graphEdges.set(nodeId, edges);
                graphEdgeCount += edges.length;
            }
            logger.logSystem(`  \u221e VectorMemory: ${graphEdgeCount} graph edges loaded`);
        }
    } catch (e) {
        logger.warn(`  \u221e VectorMemory: No graph data found or error loading graph: ${e.message}`);
    }
}

// ── SDK Gateway for Embeddings ───────────────────────────────────
let _gateway = null;
function getGateway() {
    if (!_gateway) {
        _gateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) _gateway.registerProvider(p);
    }
    return _gateway;
}

function initHFClients() {
    // Legacy — SDK gateway handles provider selection now
    logger.logSystem(`  \u221e VectorMemory: Embeddings via SDK Gateway (${EMBEDDING_MODEL})`);
}

// ── Embedding ───────────────────────────────────────────────────
let embedRoundRobin = 0;

async function embed(text) {
    const truncated = typeof text === "string" ? text.substring(0, 2000) : String(text).substring(0, 2000);

    // Strategy 1: HuggingFace Inference API (free tier, no token needed for public models)
    try {
        const hfRes = await fetch("https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(process.env.HF_TOKEN ? { "Authorization": `Bearer ${process.env.HF_TOKEN}` } : {}),
            },
            body: JSON.stringify({ inputs: truncated }),
            signal: AbortSignal.timeout(8000),
        });
        if (hfRes.ok) {
            const data = await hfRes.json();
            const embedding = Array.isArray(data) ? (Array.isArray(data[0]) ? data[0] : data) : null;
            if (embedding && embedding.length >= 100) {
                remoteEmbedCount++;
                return embedding;
            }
        }
    } catch { /* HF API failed, try next */ }

    // Strategy 2: Ollama local (if running)
    try {
        const ollamaRes = await fetch(`http://127.0.0.1:${process.env.OLLAMA_PORT || 11434}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "nomic-embed-text", prompt: truncated }),
            signal: AbortSignal.timeout(5000),
        });
        if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            if (data.embedding && data.embedding.length >= 100) {
                remoteEmbedCount++;
                return data.embedding;
            }
        }
    } catch { /* Ollama not available, fall through */ }

    // Strategy 3: Local hash embed (deterministic fallback — works but no semantic meaning)
    localFallbackCount++;
    return localHashEmbed(truncated, 384);
}

function localHashEmbed(text, dims) {
    const vec = new Float32Array(dims);
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
        let hash = 0;
        for (let j = 0; j < words[i].length; j++) {
            hash = ((hash << 5) - hash + words[i].charCodeAt(j)) | 0;
        }
        for (let d = 0; d < dims; d++) {
            vec[d] += Math.sin(hash * (d + 1) * 0.01) * (1.0 / words.length);
        }
    }
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return Array.from(vec.map(v => v / norm));
}

// ── Cosine Similarity ───────────────────────────────────────────
function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ── 3D-Aware Ingest ─────────────────────────────────────────────
async function ingestMemory({ content, metadata = {}, embedding = null }) {
    const text = typeof content === "string" ? content : JSON.stringify(content);
    const vec = embedding || await embed(text);

    // Compute 3D coordinates and zone
    const pos = to3D(vec);
    const zone = assignZone(pos.x, pos.y, pos.z);

    const entry = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: text.substring(0, 2000),
        embedding: vec,
        _3d: pos,
        _zone: zone,
        metadata: { ...metadata, ts: Date.now(), zone },
        created: new Date().toISOString(),
    };

    // Round-robin shard assignment
    const shardIdx = ingestCount % NUM_SHARDS;
    const shard = shards[shardIdx];
    shard.vectors.push(entry);
    shard.dirty = true;
    ingestCount++;

    // Update 3D zone index
    zoneIndex.get(zone).push({ id: entry.id, shardId: shardIdx });

    // Cap per-shard
    if (shard.vectors.length > MAX_VECTORS_PER_SHARD) {
        shard.vectors = shard.vectors.slice(-MAX_VECTORS_PER_SHARD);
        rebuildZoneIndex(); // Rebuild index after eviction
    }

    schedulePersist(shardIdx);

    // Fan-out to remote tiers
    if (federation) federation.federatedInsert(entry).catch(() => { });

    return entry.id;
}

// ── 3D Zone-First Query ─────────────────────────────────────────
async function queryMemory(query, topK = 5, filter = {}) {
    const totalVecs = shards.reduce((s, sh) => s + sh.vectors.length, 0);
    if (totalVecs === 0) return [];

    const queryEmbedding = await embed(query);
    const queryPos = to3D(queryEmbedding);
    const queryZone = assignZone(queryPos.x, queryPos.y, queryPos.z);
    queryCount++;
    zoneStats.queries++;

    // PHASE 1: Search same-zone vectors first (fast path)
    let results = searchZone(queryZone, queryEmbedding, topK, filter);

    const bestScore = results.length > 0 ? results[0].score : 0;

    // PHASE 2: If best score is below threshold, expand to adjacent zones
    if (bestScore < ZONE_EXPAND_THRESHOLD || results.length < topK) {
        zoneStats.expansions++;
        const adjacent = getAdjacentZones(queryZone);
        for (const adjZone of adjacent) {
            const adjResults = searchZone(adjZone, queryEmbedding, topK, filter);
            results = results.concat(adjResults);
        }
    }

    // PHASE 3: If still not enough, search ALL zones (full scan fallback)
    if (results.length < topK) {
        for (let z = 0; z < 8; z++) {
            if (z === queryZone || getAdjacentZones(queryZone).includes(z)) continue;
            const farResults = searchZone(z, queryEmbedding, topK, filter);
            results = results.concat(farResults);
        }
    }

    // Deduplicate, sort, return top-K
    const seen = new Set();
    const deduped = results.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
    deduped.sort((a, b) => b.score - a.score);

    if (deduped.length > 0 && deduped[0].score >= ZONE_EXPAND_THRESHOLD) {
        zoneStats.zoneHits++;
    }

    return deduped.slice(0, topK);
}

/**
 * Search vectors in a specific zone
 */
function searchZone(zone, queryEmbedding, topK, filter) {
    const results = [];

    shards.forEach(shard => {
        let candidates = shard.vectors.filter(v => (v._zone || 0) === zone);

        if (filter.type) candidates = candidates.filter(v => v.metadata?.type === filter.type);
        if (filter.since) candidates = candidates.filter(v => (v.metadata?.ts || 0) > filter.since);

        candidates.forEach(v => {
            results.push({
                id: v.id,
                content: v.content,
                score: cosineSim(queryEmbedding, v.embedding),
                metadata: v.metadata,
                created: v.created,
                shard: shard.id,
                zone: v._zone,
                _3d: v._3d,
            });
        });
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}

/**
 * Rebuild zone index from all shards
 */
function rebuildZoneIndex() {
    for (let i = 0; i < 8; i++) zoneIndex.set(i, []);
    shards.forEach(shard => {
        shard.vectors.forEach(v => {
            if (v._3d) {
                const zone = v._zone ?? assignZone(v._3d.x, v._3d.y, v._3d.z);
                v._zone = zone;
                zoneIndex.get(zone).push({ id: v.id, shardId: shard.id });
            }
        });
    });
}

// ── Persistence ─────────────────────────────────────────────────
const persistTimers = {};
function schedulePersist(shardIdx) {
    if (persistTimers[shardIdx]) return;
    persistTimers[shardIdx] = setTimeout(() => {
        try {
            const shard = shards[shardIdx];
            if (shard.dirty) {
                fs.writeFileSync(shard.path, JSON.stringify(shard.vectors, null, 0));
                shard.dirty = false;
            }
        } catch { }
        delete persistTimers[shardIdx];
    }, PERSIST_DEBOUNCE);
}

function persistAllShards() {
    shards.forEach(shard => {
        try {
            fs.writeFileSync(shard.path, JSON.stringify(shard.vectors, null, 0));
            shard.dirty = false;
        } catch { }
    });
}

// ── Graph Layer Functions ─────────────────────────────────────

/**
 * Add a directional relationship edge between two memory nodes.
 * @param {string} sourceId - Source vector ID
 * @param {string} targetId - Target vector ID  
 * @param {string} relation - Relationship type (e.g., "caused_by", "resolved_by", "led_to")
 * @param {number} weight - Edge weight (0.0 - 1.0)
 */
function addRelationship(sourceId, targetId, relation, weight = 1.0) {
    if (!graphEdges.has(sourceId)) graphEdges.set(sourceId, []);
    const edges = graphEdges.get(sourceId);
    // Deduplicate
    if (!edges.find(e => e.target === targetId && e.relation === relation)) {
        edges.push({ target: targetId, relation, weight, ts: Date.now() });
        graphEdgeCount++;
        _persistGraph();
    }
    return { sourceId, targetId, relation, weight };
}

/**
 * Get all relationships for a given node.
 */
function getRelationships(nodeId) {
    return graphEdges.get(nodeId) || [];
}

/**
 * Hybrid RAG query: vector similarity + graph traversal.
 * 1. Run standard vector query for top-K
 * 2. For each result, traverse graph edges (1-hop)
 * 3. Score = vector_score × (1 + relationship_weight)
 * 4. Return merged, enriched results
 */
async function queryWithRelationships(query, topK = 5, filter = {}, maxHops = 1) {
    // Phase 1: Vector search (breadth)
    const vectorResults = await queryMemory(query, topK * 2, filter);

    // Phase 2: Graph traversal (depth)
    const enriched = vectorResults.map(result => {
        const relationships = getRelationships(result.id);
        const relatedContent = [];

        // 1-hop traversal
        for (const edge of relationships) {
            // Find the target vector across shards
            for (const shard of shards) {
                const target = shard.vectors.find(v => v.id === edge.target);
                if (target) {
                    relatedContent.push({
                        id: target.id,
                        content: target.content?.substring(0, 200),
                        relation: edge.relation,
                        weight: edge.weight,
                        metadata: target.metadata,
                    });
                    break;
                }
            }
        }

        // Boost score based on relationship density
        const relationBoost = relationships.length > 0 ? 1 + (relationships.length * 0.05) : 1;

        return {
            ...result,
            score: result.score * relationBoost,
            relationships: relatedContent,
            graphEdges: relationships.length,
            hybrid: true,
        };
    });

    // Re-sort with boosted scores
    enriched.sort((a, b) => b.score - a.score);
    return enriched.slice(0, topK);
}

function _persistGraph() {
    try {
        const data = {};
        graphEdges.forEach((edges, nodeId) => { data[nodeId] = edges; });
        fs.writeFileSync(GRAPH_PATH, JSON.stringify(data, null, 0));
    } catch { /* best-effort */ }
}

// ── Stats ───────────────────────────────────────────────────────
function getStats() {
    const shardStats = shards.map(s => ({ id: s.id, vectors: s.vectors.length, dirty: s.dirty }));
    const total = shards.reduce((s, sh) => s + sh.vectors.length, 0);
    const zoneDistribution = {};
    zoneIndex.forEach((refs, zone) => { zoneDistribution[zone] = refs.length; });

    return {
        architecture: "3d-spatial-sharded",
        total_vectors: total,
        num_shards: NUM_SHARDS,
        max_per_shard: MAX_VECTORS_PER_SHARD,
        embedding_model: EMBEDDING_MODEL,
        hf_workers: hfClients.length,
        embedding_source: hfClients.length > 0 ? `hf-distributed (${hfClients.length} workers)` : "local-hash-fallback",
        dimensions: 384,
        spatial: {
            zones: 8,
            zone_distribution: zoneDistribution,
            zone_expand_threshold: ZONE_EXPAND_THRESHOLD,
            queries: zoneStats.queries,
            zone_hits: zoneStats.zoneHits,
            expansions: zoneStats.expansions,
            zone_hit_rate: zoneStats.queries > 0 ? +(zoneStats.zoneHits / zoneStats.queries * 100).toFixed(1) : 0,
        },
        graph: {
            totalEdges: graphEdgeCount,
            totalNodes: graphEdges.size,
            architecture: "hybrid-rag",
        },
        ingest_count: ingestCount,
        query_count: queryCount,
        remote_embeds: remoteEmbedCount,
        local_fallbacks: localFallbackCount,
        persist_debounce_ms: PERSIST_DEBOUNCE,
        shards: shardStats,
    };
}

// ── Init ────────────────────────────────────────────────────────
function init() {
    initShards();
    initHFClients();
}

// ── Express Routes ──────────────────────────────────────────────
function registerRoutes(app) {
    app.post("/api/vector/query", async (req, res) => {
        try {
            const { query, top_k, filter } = req.body;
            if (!query) return res.status(400).json({ error: "query required" });
            const results = await queryMemory(query, top_k || 5, filter || {});
            const total = shards.reduce((s, sh) => s + sh.vectors.length, 0);
            res.json({ ok: true, results, total_vectors: total, shards_searched: NUM_SHARDS, query_zone: results[0]?._zone });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/vector/store", async (req, res) => {
        try {
            const { content, metadata } = req.body;
            if (!content) return res.status(400).json({ error: "content required" });
            const id = await ingestMemory({ content, metadata });
            const total = shards.reduce((s, sh) => s + sh.vectors.length, 0);
            res.json({ ok: true, id, total_vectors: total, shard: ingestCount % NUM_SHARDS });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/api/vector/stats", (req, res) => {
        res.json({ ok: true, ...getStats() });
    });

    // 3D spatial map endpoint
    app.get("/api/vector/3d/map", (req, res) => {
        const zones = [];
        zoneIndex.forEach((refs, zoneId) => {
            // Get sample vectors from this zone for visualization
            const samples = [];
            const shardVectors = shards.flatMap(s => s.vectors.filter(v => v._zone === zoneId));
            shardVectors.slice(0, 5).forEach(v => {
                if (v._3d) {
                    samples.push({ id: v.id, x: +v._3d.x.toFixed(4), y: +v._3d.y.toFixed(4), z: +v._3d.z.toFixed(4), content: v.content?.substring(0, 60) });
                }
            });
            zones.push({
                zone: zoneId,
                octant: `(${zoneId & 1 ? '+' : '-'}, ${zoneId & 2 ? '+' : '-'}, ${zoneId & 4 ? '+' : '-'})`,
                count: refs.length,
                samples,
            });
        });

        res.json({
            ok: true,
            architecture: "3d-spatial-octant",
            total_zones: 8,
            active_zones: zones.filter(z => z.count > 0).length,
            total_vectors: shards.reduce((s, sh) => s + sh.vectors.length, 0),
            query_stats: zoneStats,
            zones,
        });
    });

    // ── Graph RAG Endpoints ─────────────────────────────────────
    app.post("/api/vector/graph/query", async (req, res) => {
        try {
            const { query, top_k, filter } = req.body;
            if (!query) return res.status(400).json({ error: "query required" });
            const results = await queryWithRelationships(query, top_k || 5, filter || {});
            res.json({ ok: true, results, architecture: "hybrid-rag" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/vector/graph/edge", (req, res) => {
        const { sourceId, targetId, relation, weight } = req.body;
        if (!sourceId || !targetId || !relation) {
            return res.status(400).json({ error: "sourceId, targetId, relation required" });
        }
        const edge = addRelationship(sourceId, targetId, relation, weight || 1.0);
        res.json({ ok: true, edge, totalEdges: graphEdgeCount });
    });

    app.get("/api/vector/graph/edges/:nodeId", (req, res) => {
        const edges = getRelationships(req.params.nodeId);
        res.json({ ok: true, nodeId: req.params.nodeId, edges, count: edges.length });
    });
}

module.exports = {
    init, ingestMemory, queryMemory, queryWithRelationships,
    addRelationship, getRelationships,
    getStats, registerRoutes, embed, to3D, assignZone,
};
