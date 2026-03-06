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
const CSL = require("./core/semantic-logic");
let HeadyGateway = null;
let createProviders = null;
try {
    HeadyGateway = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "gateway"));
    ({ createProviders } = require(path.join(__dirname, "..", "heady-hive-sdk", "lib", "providers")));
} catch { /* SDK not available — using direct embedding strategies */ }

const PHI = 1.6180339887;
let federation = null;
try { federation = require("./vector-federation"); } catch { }
const VECTOR_STORE_PATH = path.join(__dirname, "..", "data", "vector-memory.json");
const SHARD_DIR = path.join(__dirname, "..", "data", "vector-shards");
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const MAX_VECTORS_PER_SHARD = 2000;
const NUM_SHARDS = 5;
const PERSIST_DEBOUNCE = Math.round(PHI ** 2 * 1000);
const ZONE_EXPAND_THRESHOLD = 0.35; // Lowered from 0.5 — MiniLM cosine sims on short text rarely exceed 0.5
const REPRESENTATION_PROFILES = Object.freeze({
    cartesian: "cartesian",
    spherical: "spherical",
    isometric: "isometric",
});
const MAX_OUTBOUND_SAMPLE = 100;
const DEFAULT_OUTBOUND_SAMPLE = 12;
const PUBLIC_CHANNELS = new Set(["github", "public-api", "canvas", "sandbox", "internal"]);
const AUTONOMY_MAINTENANCE_MS = Math.round(PHI ** 5 * 1000);
const DEFAULT_DECAY_THRESHOLD = 0.15;
const DEFAULT_LTM_THRESHOLD = 0.5;

// ── Memory Importance Scoring Coefficients ──────────────────────
// I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
// Frequency, Recency (exponential decay), and Surprise (deviation from norm)
const MEMORY_ALPHA = 0.3;  // α — Frequency weight
const MEMORY_BETA = 0.4;  // β — Recency weight
const MEMORY_GAMMA = 0.00001; // γ — Decay rate (ms scale)
const MEMORY_DELTA = 0.3;  // δ — Surprise weight

// Access frequency tracker: vectorId → { freq, lastAccess }
const accessLog = new Map();

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

const autonomousState = {
    enabled: true,
    intervalMs: AUTONOMY_MAINTENANCE_MS,
    lastRunAt: null,
    lastStatus: "idle",
    lastSummary: null,
    runs: 0,
    errors: 0,
};
let autonomyTimer = null;


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

function toSpherical(point) {
    const x = point?.x || 0;
    const y = point?.y || 0;
    const z = point?.z || 0;
    const r = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    const theta = Math.atan2(y, x);
    const phi = r === 0 ? 0 : Math.acos(Math.min(1, Math.max(-1, z / r)));
    return {
        r: +r.toFixed(6),
        theta: +theta.toFixed(6),
        phi: +phi.toFixed(6),
    };
}

function toIsometric(point) {
    const x = point?.x || 0;
    const y = point?.y || 0;
    const z = point?.z || 0;
    return {
        ix: +(x - y).toFixed(6),
        iy: +(((x + y) / 2) - z).toFixed(6),
    };
}

function projectPoint(point, profile = REPRESENTATION_PROFILES.cartesian) {
    if (!point) {
        return profile === REPRESENTATION_PROFILES.spherical
            ? { r: 0, theta: 0, phi: 0 }
            : profile === REPRESENTATION_PROFILES.isometric
                ? { ix: 0, iy: 0 }
                : { x: 0, y: 0, z: 0 };
    }

    if (profile === REPRESENTATION_PROFILES.spherical) return toSpherical(point);
    if (profile === REPRESENTATION_PROFILES.isometric) return toIsometric(point);
    return {
        x: +point.x.toFixed(6),
        y: +point.y.toFixed(6),
        z: +point.z.toFixed(6),
    };
}

function normalizeChannel(channel = "internal") {
    const normalized = String(channel || "internal").toLowerCase().trim();
    return PUBLIC_CHANNELS.has(normalized) ? normalized : "internal";
}

function normalizeTopK(topK = DEFAULT_OUTBOUND_SAMPLE) {
    const parsed = Number.parseInt(String(topK), 10);
    if (!Number.isFinite(parsed)) return DEFAULT_OUTBOUND_SAMPLE;
    return Math.min(MAX_OUTBOUND_SAMPLE, Math.max(1, parsed));
}

function resolveProjectionProfile({ profile, channel } = {}) {
    const normalizedChannel = normalizeChannel(channel);
    if (profile && Object.values(REPRESENTATION_PROFILES).includes(profile)) {
        return profile;
    }
    if (normalizedChannel === "github" || normalizedChannel === "public-api") {
        return REPRESENTATION_PROFILES.spherical;
    }
    if (normalizedChannel === "canvas" || normalizedChannel === "sandbox") {
        return REPRESENTATION_PROFILES.isometric;
    }
    return REPRESENTATION_PROFILES.cartesian;
}

function buildOutboundRepresentation({ channel = "internal", profile, topK = DEFAULT_OUTBOUND_SAMPLE } = {}) {
    const normalizedChannel = normalizeChannel(channel);
    const clampedTopK = normalizeTopK(topK);
    const resolvedProfile = resolveProjectionProfile({ profile, channel: normalizedChannel });
    const totalVectors = shards.reduce((s, sh) => s + sh.vectors.length, 0);
    const sample = shards
        .flatMap(shard => shard.vectors)
        .map(entry => ({ entry, importance: computeImportance(entry) }))
        .sort((a, b) => {
            // Primary sort: importance score (highest first)
            const impDiff = b.importance - a.importance;
            if (Math.abs(impDiff) > 0.01) return impDiff;
            // Tiebreaker: recency
            const tsDiff = (b.entry.metadata?.ts || 0) - (a.entry.metadata?.ts || 0);
            if (tsDiff !== 0) return tsDiff;
            return String(a.entry.id || "").localeCompare(String(b.entry.id || ""));
        })
        .slice(0, clampedTopK)
        .map(({ entry, importance }) => ({
            id: entry.id,
            zone: entry._zone ?? 0,
            representation: projectPoint(entry._3d || { x: 0, y: 0, z: 0 }, resolvedProfile),
            type: entry.metadata?.type || "unknown",
            ts: entry.metadata?.ts || null,
            importance: +importance.toFixed(3),
        }));

    return {
        ok: true,
        channel: normalizedChannel,
        profile: resolvedProfile,
        architecture: "3d-vector-projection-router",
        projection_mode: "auto-adjusted",
        top_k: clampedTopK,
        total_vectors: totalVectors,
        active_zones: Array.from(zoneIndex.entries()).filter(([, refs]) => refs.length > 0).length,
        generated_at: new Date().toISOString(),
        constraints: {
            max_outbound_sample: MAX_OUTBOUND_SAMPLE,
            default_outbound_sample: DEFAULT_OUTBOUND_SAMPLE,
        },
        sample,
    };
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
                logger.info(`  \u221e VectorMemory: Migrating ${oldVectors.length} vectors into ${NUM_SHARDS} shards`);
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
    logger.info(`  \u221e VectorMemory: ${NUM_SHARDS} shards, ${total} vectors, ${indexed} indexed in 3D`);
    logger.info(`  \u221e VectorMemory: Zone distribution: ${JSON.stringify(zoneDistribution)}`);

    // Load graph edges from disk
    try {
        if (fs.existsSync(GRAPH_PATH)) {
            const graphData = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf-8"));
            for (const [nodeId, edges] of Object.entries(graphData)) {
                graphEdges.set(nodeId, edges);
                graphEdgeCount += edges.length;
            }
            logger.info(`  \u221e VectorMemory: ${graphEdgeCount} graph edges loaded`);
        }
    } catch (e) {
        logger.warn(`  \u221e VectorMemory: No graph data found or error loading graph: ${e.message}`);
    }
}

// ── SDK Gateway for Embeddings ───────────────────────────────────
let _gateway = null;
function getGateway() {
    if (!_gateway && HeadyGateway && createProviders) {
        _gateway = new HeadyGateway({ cacheTTL: 300000 });
        const providers = createProviders(process.env);
        for (const p of providers) _gateway.registerProvider(p);
    }
    return _gateway;
}

function initHFClients() {
    // Legacy — SDK gateway handles provider selection now
    logger.info(`  \u221e VectorMemory: Embeddings via SDK Gateway (${EMBEDDING_MODEL})`);
}

// ── Embedding ───────────────────────────────────────────────────
let embedRoundRobin = 0;

async function embed(text) {
    const truncated = typeof text === "string" ? text.substring(0, 2000) : String(text).substring(0, 2000);

    // Strategy 0: Local GPU Embedding Server (Colab CUDA — fastest)
    const gpuUrl = process.env.HEADY_EMBEDDING_URL;
    if (gpuUrl) {
        try {
            const gpuRes = await fetch(`${gpuUrl}/embed`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texts: truncated }),
                signal: AbortSignal.timeout(5000),
            });
            if (gpuRes.ok) {
                const data = await gpuRes.json();
                if (data.ok && data.embeddings?.length > 0) {
                    const embedding = data.embeddings[0];
                    if (embedding.length >= 100) {
                        remoteEmbedCount++;
                        return embedding;
                    }
                }
            }
        } catch { /* GPU server not available, fall through */ }
    }

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

// ── Cosine Similarity — Delegated to CSL Resonance Layer ────────
function cosineSim(a, b) {
    return CSL.cosine_similarity(a, b);
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

    // Track access for importance scoring (frequency component)
    const finalResults = deduped.slice(0, topK);
    finalResults.forEach(r => trackAccess(r.id));

    return finalResults;
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
            projection_profiles: Object.values(REPRESENTATION_PROFILES),
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

// ═══════════════════════════════════════════════════════════════════════
// MEMORY IMPORTANCE SCORING & STM→LTM CONSOLIDATION
// Implements the evolutionary memory architecture:
//   I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
//   - Frequency: how often this memory is accessed
//   - Recency: exponential decay based on time since creation
//   - Surprise: deviation from the vector space mean (novelty)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute memory importance score for a vector entry.
 * I(m) = αFreq(m) + βe^(-γΔt) + δSurp(m)
 *
 * @param {Object} entry - Vector entry with embedding, metadata
 * @returns {number} Importance score (0.0 - 1.0+)
 */
function computeImportance(entry) {
    const now = Date.now();
    const id = entry.id;

    // Frequency component: normalized access count
    const access = accessLog.get(id) || { freq: 0, lastAccess: now };
    const maxFreq = Math.max(1, ...Array.from(accessLog.values()).map(a => a.freq));
    const freqScore = access.freq / maxFreq;

    // Recency component: exponential decay since creation
    const age = now - (entry.metadata?.ts || now);
    const recencyScore = Math.exp(-MEMORY_GAMMA * age);

    // Surprise component: how far this vector is from the zone centroid
    // High surprise = novel/unique content = more important
    let surpriseScore = 0.5; // default
    if (entry._3d) {
        const zone = entry._zone ?? 0;
        const zoneVectors = [];
        shards.forEach(s => s.vectors.forEach(v => {
            if (v._zone === zone && v._3d) zoneVectors.push(v._3d);
        }));
        if (zoneVectors.length > 1) {
            // Centroid of the zone
            const cx = zoneVectors.reduce((s, v) => s + v.x, 0) / zoneVectors.length;
            const cy = zoneVectors.reduce((s, v) => s + v.y, 0) / zoneVectors.length;
            const cz = zoneVectors.reduce((s, v) => s + v.z, 0) / zoneVectors.length;
            const distFromCentroid = dist3D(entry._3d, { x: cx, y: cy, z: cz });
            // Normalize: max distance in zone
            const maxDist = Math.max(0.001, ...zoneVectors.map(v => dist3D(v, { x: cx, y: cy, z: cz })));
            surpriseScore = Math.min(1.0, distFromCentroid / maxDist);
        }
    }

    return MEMORY_ALPHA * freqScore + MEMORY_BETA * recencyScore + MEMORY_DELTA * surpriseScore;
}

/**
 * Track a memory access (for frequency scoring).
 * Called automatically during queryMemory.
 */
function trackAccess(id) {
    const existing = accessLog.get(id) || { freq: 0, lastAccess: 0 };
    existing.freq++;
    existing.lastAccess = Date.now();
    accessLog.set(id, existing);
}

/**
 * Apply decay to all memories — reduce importance of old, unused content.
 * Memories below the decay threshold are candidates for eviction.
 *
 * @param {number} threshold - Importance score below which to mark for decay (default: 0.15)
 * @returns {Object} { decayed, total, preserved }
 */
function applyDecay(threshold = 0.15) {
    let decayed = 0, total = 0, preserved = 0;

    shards.forEach(shard => {
        const scored = shard.vectors.map(v => ({
            entry: v,
            importance: computeImportance(v),
        }));

        total += scored.length;

        // Keep only vectors above the decay threshold
        const surviving = scored.filter(s => {
            if (s.importance >= threshold) {
                preserved++;
                return true;
            }
            decayed++;
            return false;
        });

        if (surviving.length < scored.length) {
            shard.vectors = surviving.map(s => s.entry);
            shard.dirty = true;
        }
    });

    if (decayed > 0) {
        rebuildZoneIndex();
        persistAllShards();
        logger.info(`  ∞ VectorMemory: Decay applied — ${decayed} decayed, ${preserved} preserved of ${total}`);
    }

    return { decayed, total, preserved };
}

/**
 * Selective Density Gating — filters semantically redundant content.
 * Before ingesting, checks if highly similar content already exists.
 * Only stores content that adds new semantic information.
 *
 * @param {string} content - Content to check
 * @param {number} gateThreshold - Similarity above which to reject (default: 0.92)
 * @returns {Promise<boolean>} true if content should be stored (passes gate)
 */
async function densityGate(content, gateThreshold = 0.92) {
    const total = shards.reduce((s, sh) => s + sh.vectors.length, 0);
    if (total === 0) return true; // Empty memory — always accept

    const results = await queryMemory(content, 1);
    if (results.length === 0) return true;

    // CSL Resonance Gate: if closest match resonates too strongly, reject (redundant)
    // Inversion: store only if resonance is BELOW the gate threshold
    return !CSL.resonance_gate(
        results[0].embedding || [],
        await embed(typeof content === 'string' ? content : JSON.stringify(content)),
        gateThreshold
    ).open;
}

/**
 * Smart ingest with density gating — only stores non-redundant content.
 *
 * @param {Object} params - Same as ingestMemory
 * @param {number} gateThreshold - Similarity threshold (default: 0.92)
 * @returns {Promise<string|null>} Vector ID if stored, null if rejected as redundant
 */
async function smartIngest({ content, metadata = {}, embedding = null }, gateThreshold = 0.92) {
    const shouldStore = await densityGate(
        typeof content === 'string' ? content : JSON.stringify(content),
        gateThreshold,
    );

    if (!shouldStore) return null; // Density gate rejected — redundant content

    return ingestMemory({ content, metadata, embedding });
}

/**
 * STM → LTM Consolidation — distill episodic sequences into semantic facts.
 * Scores all memories by importance, keeps top-scoring as LTM,
 * compacts low-scoring into summary entries.
 *
 * @param {number} ltmThreshold - Importance score for LTM promotion (default: 0.5)
 * @returns {Object} { promoted, compacted, total }
 */
async function consolidateMemory(ltmThreshold = 0.5) {
    let promoted = 0, compacted = 0, total = 0;

    for (const shard of shards) {
        const scored = shard.vectors.map(v => ({
            entry: v,
            importance: computeImportance(v),
        }));

        total += scored.length;

        // Partition into LTM (high importance) and STM candidates
        const ltm = scored.filter(s => s.importance >= ltmThreshold);
        const stm = scored.filter(s => s.importance < ltmThreshold);

        promoted += ltm.length;

        // Mark LTM entries
        ltm.forEach(s => {
            s.entry.metadata = s.entry.metadata || {};
            s.entry.metadata._memoryTier = 'LTM';
            s.entry.metadata._importance = +s.importance.toFixed(3);
        });

        // Compact STM entries into summary blocks (group by zone)
        if (stm.length > 10) {
            const byZone = {};
            stm.forEach(s => {
                const z = s.entry._zone || 0;
                if (!byZone[z]) byZone[z] = [];
                byZone[z].push(s);
            });

            const compactedEntries = [];
            for (const [zone, entries] of Object.entries(byZone)) {
                if (entries.length <= 3) {
                    compactedEntries.push(...entries.map(e => e.entry));
                    continue;
                }

                // Distill: keep top 3 by importance, summarize rest
                entries.sort((a, b) => b.importance - a.importance);
                compactedEntries.push(...entries.slice(0, 3).map(e => e.entry));
                compacted += entries.length - 3;

                // Create a compact summary entry for the rest
                const summaryContent = entries.slice(3)
                    .map(e => e.entry.content?.substring(0, 50))
                    .filter(Boolean)
                    .join(' | ');

                if (summaryContent) {
                    const summaryEntry = {
                        id: `ltm_compact_${Date.now()}_z${zone}`,
                        content: `[CONSOLIDATED] Zone ${zone}: ${summaryContent}`,
                        embedding: entries[Math.floor(entries.length / 2)].entry.embedding, // median embedding
                        _3d: entries[Math.floor(entries.length / 2)].entry._3d,
                        _zone: parseInt(zone),
                        metadata: {
                            type: 'ltm_consolidation',
                            _memoryTier: 'LTM',
                            sourceCount: entries.length - 3,
                            ts: Date.now(),
                        },
                        created: new Date().toISOString(),
                    };
                    compactedEntries.push(summaryEntry);
                }
            }

            shard.vectors = [...ltm.map(s => s.entry), ...compactedEntries];
            shard.dirty = true;
        }
    }

    if (compacted > 0) {
        rebuildZoneIndex();
        persistAllShards();
        logger.info(`  ∞ VectorMemory: Consolidation — ${promoted} LTM, ${compacted} compacted, ${total} total`);
    }

    return { promoted, compacted, total };
}

function getAutonomousState() {
    return {
        ...autonomousState,
        timerActive: Boolean(autonomyTimer),
    };
}

async function runAutonomousMaintenance({
    decayThreshold = DEFAULT_DECAY_THRESHOLD,
    ltmThreshold = DEFAULT_LTM_THRESHOLD,
} = {}) {
    const startedAt = Date.now();
    autonomousState.lastStatus = "running";
    try {
        const decay = applyDecay(decayThreshold);
        const consolidation = await consolidateMemory(ltmThreshold);
        const summary = {
            decay,
            consolidation,
            duration_ms: Date.now() - startedAt,
            ts: new Date().toISOString(),
        };
        autonomousState.runs += 1;
        autonomousState.lastRunAt = summary.ts;
        autonomousState.lastSummary = summary;
        autonomousState.lastStatus = "ok";
        return { ok: true, ...summary };
    } catch (error) {
        autonomousState.errors += 1;
        autonomousState.lastRunAt = new Date().toISOString();
        autonomousState.lastStatus = "error";
        autonomousState.lastSummary = { error: error.message, ts: autonomousState.lastRunAt };
        logger.logError("SYSTEM", "VectorMemory autonomous maintenance failed", error);
        return { ok: false, error: error.message, ts: autonomousState.lastRunAt };
    }
}

function startAutonomousMaintenance(intervalMs = AUTONOMY_MAINTENANCE_MS) {
    const safeInterval = Math.max(1000, Number(intervalMs) || AUTONOMY_MAINTENANCE_MS);
    autonomousState.intervalMs = safeInterval;

    if (autonomyTimer) clearInterval(autonomyTimer);
    autonomyTimer = setInterval(() => {
        runAutonomousMaintenance().catch((error) => {
            logger.logError("SYSTEM", "VectorMemory autonomy interval error", error);
        });
    }, safeInterval);

    if (typeof autonomyTimer.unref === "function") autonomyTimer.unref();
    autonomousState.enabled = true;
    logger.info(`  ∞ VectorMemory: Autonomous maintenance enabled (${safeInterval}ms)`);
    return getAutonomousState();
}

function stopAutonomousMaintenance() {
    if (autonomyTimer) {
        clearInterval(autonomyTimer);
        autonomyTimer = null;
    }
    autonomousState.enabled = false;
    autonomousState.lastStatus = "stopped";
    return getAutonomousState();
}

// ═══════════════════════════════════════════════════════════════════════
// SEMANTIC DRIFT DETECTION (Whitepaper §Vector Embeddings)
// Compares baseline embedding snapshots against current state.
// Detects when module meaning has diverged > threshold (default 0.75).
// ═══════════════════════════════════════════════════════════════════════

const DRIFT_BASELINE_PATH = path.join(__dirname, '..', 'data', 'drift-baselines.json');
const DRIFT_ALERT_THRESHOLD = 0.75;
const driftBaselines = new Map();

// Load persisted baselines on startup
function loadDriftBaselines() {
    try {
        if (fs.existsSync(DRIFT_BASELINE_PATH)) {
            const data = JSON.parse(fs.readFileSync(DRIFT_BASELINE_PATH, 'utf-8'));
            for (const [id, baseline] of Object.entries(data)) {
                driftBaselines.set(id, baseline);
            }
            logger.info(`  ∞ VectorMemory: ${driftBaselines.size} drift baselines loaded`);
        }
    } catch { /* no baselines yet */ }
}

function persistDriftBaselines() {
    try {
        const data = {};
        driftBaselines.forEach((v, k) => { data[k] = v; });
        fs.writeFileSync(DRIFT_BASELINE_PATH, JSON.stringify(data, null, 0));
    } catch { /* best-effort */ }
}

/**
 * Snapshot current embedding for a given vector ID as its drift baseline.
 * Future drift checks compare the current embedding against this snapshot.
 */
function snapshotBaseline(vectorId) {
    for (const shard of shards) {
        const entry = shard.vectors.find(v => v.id === vectorId);
        if (entry && entry.embedding) {
            driftBaselines.set(vectorId, {
                embedding: entry.embedding,
                _3d: entry._3d,
                snapshotAt: new Date().toISOString(),
                content: entry.content?.substring(0, 100),
            });
            persistDriftBaselines();
            return { ok: true, id: vectorId, snapshotAt: driftBaselines.get(vectorId).snapshotAt };
        }
    }
    return { ok: false, error: `Vector ${vectorId} not found` };
}

/**
 * Snapshot ALL current vectors as baselines (full system checkpoint).
 */
function snapshotAllBaselines() {
    let count = 0;
    shards.forEach(shard => {
        shard.vectors.forEach(v => {
            if (v.embedding) {
                driftBaselines.set(v.id, {
                    embedding: v.embedding,
                    _3d: v._3d,
                    snapshotAt: new Date().toISOString(),
                    content: v.content?.substring(0, 100),
                });
                count++;
            }
        });
    });
    persistDriftBaselines();
    return { ok: true, baselined: count };
}

/**
 * Detect semantic drift: compare current embeddings vs baselines.
 * Returns vectors where cosine similarity has dropped below the threshold.
 * §Autonomous Refactoring Feedback Loop — detects when meaning has degraded.
 */
function detectDrift(threshold = DRIFT_ALERT_THRESHOLD) {
    const drifted = [];
    const checked = [];

    driftBaselines.forEach((baseline, id) => {
        // Find the current version of this vector
        for (const shard of shards) {
            const current = shard.vectors.find(v => v.id === id);
            if (current && current.embedding && baseline.embedding) {
                const sim = cosineSim(current.embedding, baseline.embedding);
                const entry = {
                    id,
                    similarity: +sim.toFixed(4),
                    baselineDate: baseline.snapshotAt,
                    content: current.content?.substring(0, 80),
                    zone: current._zone,
                };
                checked.push(entry);
                if (sim < threshold) {
                    drifted.push({ ...entry, alert: 'SEMANTIC_DRIFT', threshold });
                }
                break;
            }
        }
    });

    return {
        ok: true,
        threshold,
        checked: checked.length,
        baselines: driftBaselines.size,
        drifted: drifted.length,
        alerts: drifted,
        checkedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// COSINE SIMILARITY ALERTING (Whitepaper §Self-Awareness)
// Monitor pairwise similarity between zone centroids.
// Alert when any zone centroid pair drops below threshold.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute centroid for each zone and check pairwise cosine similarity.
 * Alerts if zone coherence drops below threshold (modules are diverging).
 */
function checkZoneCoherence(alertThreshold = 0.75) {
    const centroids = new Map();
    const alerts = [];

    // Compute zone centroids in embedding space
    for (let z = 0; z < 8; z++) {
        const zoneVecs = shards.flatMap(s =>
            s.vectors.filter(v => v._zone === z && v.embedding)
        );
        if (zoneVecs.length === 0) continue;

        const dims = zoneVecs[0].embedding.length;
        const centroid = new Array(dims).fill(0);
        zoneVecs.forEach(v => {
            v.embedding.forEach((val, i) => { centroid[i] += val; });
        });
        centroid.forEach((_, i) => { centroid[i] /= zoneVecs.length; });
        centroids.set(z, { embedding: centroid, count: zoneVecs.length });
    }

    // Pairwise cosine similarity between zone centroids
    const zoneIds = Array.from(centroids.keys());
    const pairs = [];
    for (let i = 0; i < zoneIds.length; i++) {
        for (let j = i + 1; j < zoneIds.length; j++) {
            const sim = cosineSim(centroids.get(zoneIds[i]).embedding, centroids.get(zoneIds[j]).embedding);
            const pair = {
                zoneA: zoneIds[i],
                zoneB: zoneIds[j],
                similarity: +sim.toFixed(4),
            };
            pairs.push(pair);
            if (sim < alertThreshold) {
                alerts.push({ ...pair, alert: 'ZONE_COHERENCE_DROP', threshold: alertThreshold });
            }
        }
    }

    // Intra-zone coherence: average similarity within each zone
    const intraZone = [];
    for (const [z, data] of centroids) {
        const zoneVecs = shards.flatMap(s =>
            s.vectors.filter(v => v._zone === z && v.embedding)
        );
        if (zoneVecs.length < 2) continue;

        let totalSim = 0, pairCount = 0;
        const sample = zoneVecs.slice(0, 20); // sample for perf
        for (let i = 0; i < sample.length; i++) {
            for (let j = i + 1; j < sample.length; j++) {
                totalSim += cosineSim(sample[i].embedding, sample[j].embedding);
                pairCount++;
            }
        }
        const avgSim = pairCount > 0 ? totalSim / pairCount : 1;
        intraZone.push({ zone: z, avgSimilarity: +avgSim.toFixed(4), vectorCount: zoneVecs.length });
        if (avgSim < alertThreshold) {
            alerts.push({ zone: z, avgSimilarity: +avgSim.toFixed(4), alert: 'INTRA_ZONE_FRAGMENTED', threshold: alertThreshold });
        }
    }

    return {
        ok: alerts.length === 0,
        activeZones: centroids.size,
        pairwiseChecks: pairs.length,
        intraZoneChecks: intraZone.length,
        alerts,
        pairs,
        intraZone,
        checkedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// AGENT LIFECYCLE MANAGER (Whitepaper §Sacred Geometry Multi-Agent)
// Spawn, observe, and terminate agent threads with 3D position tracking.
// Agents occupy positions in the vector space and model each other's
// boundaries — group-structured state spaces.
// ═══════════════════════════════════════════════════════════════════════

const activeAgents = new Map();
let agentIdCounter = 0;

/**
 * Spawn a new agent thread in the 3D vector space.
 * @param {Object} opts - Agent configuration
 * @param {string} opts.type - Agent type (refactor, test, security, deploy, research)
 * @param {string} opts.task - Task description
 * @param {number} opts.zone - Preferred zone (0-7), or auto-assigned
 */
function spawnAgent({ type = 'general', task = '', zone = null } = {}) {
    const id = `agent_${++agentIdCounter}_${Date.now()}`;

    // Auto-assign zone if not specified: pick least-saturated zone
    if (zone === null) {
        let minCount = Infinity;
        let minZone = 0;
        for (const [z, refs] of zoneIndex) {
            const agentsInZone = Array.from(activeAgents.values()).filter(a => a.zone === z).length;
            const total = refs.length + agentsInZone;
            if (total < minCount) { minCount = total; minZone = z; }
        }
        zone = minZone;
    }

    // Compute 3D position: zone centroid + random offset
    const zoneVecs = shards.flatMap(s => s.vectors.filter(v => v._zone === zone && v._3d));
    let position;
    if (zoneVecs.length > 0) {
        const cx = zoneVecs.reduce((s, v) => s + v._3d.x, 0) / zoneVecs.length;
        const cy = zoneVecs.reduce((s, v) => s + v._3d.y, 0) / zoneVecs.length;
        const cz = zoneVecs.reduce((s, v) => s + v._3d.z, 0) / zoneVecs.length;
        const jitter = 0.01;
        position = { x: cx + (Math.random() - 0.5) * jitter, y: cy + (Math.random() - 0.5) * jitter, z: cz + (Math.random() - 0.5) * jitter };
    } else {
        const sign = (bit) => (zone & bit) ? 0.1 : -0.1;
        position = { x: sign(1), y: sign(2), z: sign(4) };
    }

    const agent = {
        id,
        type,
        task,
        zone,
        position,
        status: 'spawned',
        spawnedAt: new Date().toISOString(),
        lastUpdate: new Date().toISOString(),
        metrics: { actionsCompleted: 0, vectorsModified: 0, errors: 0 },
    };

    activeAgents.set(id, agent);
    logger.info(`  ∞ AgentManager: Spawned ${type} agent ${id} in zone ${zone}`);
    return agent;
}

/**
 * Observe all active agents — returns positions, status, and group state.
 * §Group-structured state spaces: each agent models the boundaries of others.
 */
function observeAgents() {
    const agents = Array.from(activeAgents.values());

    // Compute boundary awareness: each agent knows about its neighbors
    const withBoundaries = agents.map(agent => {
        const neighbors = agents
            .filter(a => a.id !== agent.id)
            .map(a => ({
                id: a.id,
                type: a.type,
                distance: dist3D(agent.position, a.position),
                zone: a.zone,
                status: a.status,
            }))
            .sort((a, b) => a.distance - b.distance);

        return {
            ...agent,
            nearestAgents: neighbors.slice(0, 3),
            zonePopulation: agents.filter(a => a.zone === agent.zone).length,
        };
    });

    return {
        ok: true,
        totalAgents: agents.length,
        byType: agents.reduce((acc, a) => { acc[a.type] = (acc[a.type] || 0) + 1; return acc; }, {}),
        byZone: agents.reduce((acc, a) => { acc[a.zone] = (acc[a.zone] || 0) + 1; return acc; }, {}),
        agents: withBoundaries,
        observedAt: new Date().toISOString(),
    };
}

/**
 * Update an agent's status and metrics.
 */
function updateAgent(agentId, update = {}) {
    const agent = activeAgents.get(agentId);
    if (!agent) return { ok: false, error: `Agent ${agentId} not found` };

    if (update.status) agent.status = update.status;
    if (update.task) agent.task = update.task;
    if (update.actionsCompleted) agent.metrics.actionsCompleted += update.actionsCompleted;
    if (update.vectorsModified) agent.metrics.vectorsModified += update.vectorsModified;
    if (update.errors) agent.metrics.errors += update.errors;
    agent.lastUpdate = new Date().toISOString();

    return { ok: true, agent };
}

/**
 * Terminate an agent thread.
 */
function terminateAgent(agentId) {
    const agent = activeAgents.get(agentId);
    if (!agent) return { ok: false, error: `Agent ${agentId} not found` };

    agent.status = 'terminated';
    agent.terminatedAt = new Date().toISOString();
    activeAgents.delete(agentId);
    logger.info(`  ∞ AgentManager: Terminated ${agent.type} agent ${agentId}`);
    return { ok: true, agent };
}

// ── Init ────────────────────────────────────────────────────────
function init() {
    initShards();
    initHFClients();
    loadDriftBaselines();
    startAutonomousMaintenance();
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
            const id = await smartIngest({ content, metadata });
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

    app.get("/api/vector/health", (req, res) => {
        const stats = getStats();
        res.json({
            ok: true,
            module: "vector-memory",
            status: "healthy",
            architecture: "3d-spatial-sharded-hybrid-rag",
            total_vectors: stats.total_vectors,
            active_zones: Object.values(stats.spatial.zone_distribution || {}).filter(c => c > 0).length,
            uptime_ms: Math.round(process.uptime() * 1000),
            counters: {
                ingest_count: stats.ingest_count,
                query_count: stats.query_count,
                remote_embeds: stats.remote_embeds,
                local_fallbacks: stats.local_fallbacks,
            },
        });
    });

    app.get("/api/vector/autonomy/health", (req, res) => {
        res.json({ ok: true, autonomy: getAutonomousState() });
    });

    app.post("/api/vector/autonomy/run", async (req, res) => {
        const result = await runAutonomousMaintenance({
            decayThreshold: req.body?.decay_threshold,
            ltmThreshold: req.body?.ltm_threshold,
        });
        res.status(result.ok ? 200 : 500).json(result);
    });

    app.get("/api/vector/projection/outbound", (req, res) => {
        const payload = buildOutboundRepresentation({
            channel: req.query.channel || "internal",
            profile: req.query.profile,
            topK: req.query.top_k,
        });
        res.json(payload);
    });

    // ── Semantic Drift Detection Endpoints ───────────────────────
    app.post("/api/vector/drift/snapshot", (req, res) => {
        const { vectorId } = req.body || {};
        if (vectorId) {
            res.json(snapshotBaseline(vectorId));
        } else {
            res.json(snapshotAllBaselines());
        }
    });

    app.get("/api/vector/drift/check", (req, res) => {
        const threshold = parseFloat(req.query.threshold) || DRIFT_ALERT_THRESHOLD;
        res.json(detectDrift(threshold));
    });

    // ── Zone Coherence Alerting Endpoints ────────────────────────
    app.get("/api/vector/coherence/check", (req, res) => {
        const threshold = parseFloat(req.query.threshold) || 0.75;
        res.json(checkZoneCoherence(threshold));
    });

    // ── 3D Visualization Endpoint (full topology) ───────────────
    app.get("/api/vector/3d/topology", (req, res) => {
        const topK = Math.min(50, parseInt(req.query.top_k) || 20);
        const zones = [];

        for (let z = 0; z < 8; z++) {
            const zoneVecs = shards.flatMap(s =>
                s.vectors.filter(v => v._zone === z && v._3d)
            );
            const count = zoneVecs.length;
            if (count === 0) {
                zones.push({ zone: z, count: 0, centroid: null, density: 0, vectors: [] });
                continue;
            }

            // Centroid
            const cx = zoneVecs.reduce((s, v) => s + v._3d.x, 0) / count;
            const cy = zoneVecs.reduce((s, v) => s + v._3d.y, 0) / count;
            const cz = zoneVecs.reduce((s, v) => s + v._3d.z, 0) / count;

            // Density = vectors per unit volume (spread)
            const spread = count > 1
                ? zoneVecs.reduce((s, v) => s + dist3D(v._3d, { x: cx, y: cy, z: cz }), 0) / count
                : 0.01;

            // Sample vectors for visualization
            const sample = zoneVecs.slice(0, topK).map(v => ({
                id: v.id,
                x: +v._3d.x.toFixed(5),
                y: +v._3d.y.toFixed(5),
                z: +v._3d.z.toFixed(5),
                type: v.metadata?.type || 'unknown',
                tier: v.metadata?._memoryTier || 'STM',
                content: v.content?.substring(0, 60),
            }));

            zones.push({
                zone: z,
                octant: `(${z & 1 ? '+' : '-'}, ${z & 2 ? '+' : '-'}, ${z & 4 ? '+' : '-'})`,
                count,
                centroid: { x: +cx.toFixed(5), y: +cy.toFixed(5), z: +cz.toFixed(5) },
                density: +(count / Math.max(0.001, spread)).toFixed(2),
                avgSpread: +spread.toFixed(5),
                vectors: sample,
            });
        }

        // Agent positions in 3D space
        const agentPositions = Array.from(activeAgents.values()).map(a => ({
            id: a.id, type: a.type, zone: a.zone, status: a.status,
            x: +a.position.x.toFixed(5), y: +a.position.y.toFixed(5), z: +a.position.z.toFixed(5),
        }));

        res.json({
            ok: true,
            architecture: '3d-spatial-octant-topology',
            total_vectors: shards.reduce((s, sh) => s + sh.vectors.length, 0),
            active_zones: zones.filter(z => z.count > 0).length,
            active_agents: activeAgents.size,
            zones,
            agents: agentPositions,
            generated_at: new Date().toISOString(),
        });
    });

    // ── Agent Lifecycle Endpoints ────────────────────────────────
    app.post("/api/agents/spawn", (req, res) => {
        const { type, task, zone } = req.body || {};
        res.json(spawnAgent({ type, task, zone }));
    });

    app.get("/api/agents/observe", (req, res) => {
        res.json(observeAgents());
    });

    app.patch("/api/agents/:agentId", (req, res) => {
        res.json(updateAgent(req.params.agentId, req.body || {}));
    });

    app.delete("/api/agents/:agentId", (req, res) => {
        res.json(terminateAgent(req.params.agentId));
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
    getStats, registerRoutes, embed, to3D, assignZone, cosineSim,
    projectPoint, resolveProjectionProfile, buildOutboundRepresentation,
    normalizeChannel, normalizeTopK,
    getAutonomousState, runAutonomousMaintenance, startAutonomousMaintenance, stopAutonomousMaintenance,
    // Evolutionary Memory Architecture
    computeImportance, trackAccess, applyDecay,
    densityGate, smartIngest, consolidateMemory,
    // Whitepaper Gap Tasks — Semantic Drift & Alert & Agent Lifecycle
    snapshotBaseline, snapshotAllBaselines, detectDrift, checkZoneCoherence,
    spawnAgent, observeAgents, updateAgent, terminateAgent,
};
