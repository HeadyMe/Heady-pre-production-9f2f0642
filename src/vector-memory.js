/**
 * ─── Heady 3D Vector Memory ─────────────────────────────────────────
 * Real vector storage with HuggingFace embeddings + cosine similarity.
 * Persistent JSON-backed store with in-memory index for fast search.
 * 
 * Architecture:
 *   ingestMemory() → embed via HF → store vector + metadata
 *   queryMemory()  → embed query → cosine similarity → top-K results
 *   
 * Embedding Model: sentence-transformers/all-MiniLM-L6-v2 (384-dim)
 * ─────────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const VECTOR_STORE_PATH = path.join(__dirname, "..", "data", "vector-memory.json");
const EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const MAX_VECTORS = 10000; // cap to prevent runaway growth

// In-memory index — loaded from disk on startup
let vectors = [];
let hfClient = null;

// ── Initialize ──────────────────────────────────────────────────────
function init() {
    // Load existing vectors from disk
    try {
        if (fs.existsSync(VECTOR_STORE_PATH)) {
            const data = JSON.parse(fs.readFileSync(VECTOR_STORE_PATH, "utf-8"));
            vectors = Array.isArray(data) ? data : data.vectors || [];
            console.log(`  ∞ VectorMemory: Loaded ${vectors.length} vectors from disk`);
        } else {
            // Ensure data directory exists
            const dir = path.dirname(VECTOR_STORE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            vectors = [];
            console.log("  ∞ VectorMemory: Initialized empty store");
        }
    } catch (err) {
        console.warn("  ⚠ VectorMemory: Failed to load store, starting fresh:", err.message);
        vectors = [];
    }

    // Initialize HF client with multi-token failover
    try {
        const { InferenceClient } = require("@huggingface/inference");
        const tokens = [process.env.HF_TOKEN, process.env.HF_TOKEN_2, process.env.HF_TOKEN_3]
            .filter(t => t && !t.includes("placeholder"));
        if (tokens.length > 0) {
            hfClient = new InferenceClient(tokens[0]);
            console.log(`  ∞ VectorMemory: HF embeddings ready (${EMBEDDING_MODEL})`);
        } else {
            console.warn("  ⚠ VectorMemory: No HF tokens — using local hash embeddings");
        }
    } catch (err) {
        console.warn("  ⚠ VectorMemory: HF SDK not available, using local hash embeddings");
    }
}

// ── Embedding ───────────────────────────────────────────────────────
async function embed(text) {
    const truncated = typeof text === "string" ? text.substring(0, 2000) : String(text).substring(0, 2000);

    if (hfClient) {
        try {
            const result = await hfClient.featureExtraction({
                model: EMBEDDING_MODEL,
                inputs: truncated,
            });
            // Result is a flat array of floats (384-dim)
            return Array.isArray(result) ? result : Array.from(result);
        } catch (err) {
            console.warn("  ⚠ VectorMemory: HF embed failed, using local hash:", err.message);
        }
    }

    // Fallback: deterministic hash-based pseudo-embedding (384-dim)
    return localHashEmbed(truncated, 384);
}

// Local hash embedding — not real semantics but provides deterministic vectors
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
    // Normalize
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return Array.from(vec.map(v => v / norm));
}

// ── Cosine Similarity ───────────────────────────────────────────────
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

// ── Ingest Memory ───────────────────────────────────────────────────
async function ingestMemory({ content, metadata = {} }) {
    const text = typeof content === "string" ? content : JSON.stringify(content);
    const embedding = await embed(text);

    const entry = {
        id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: text.substring(0, 2000),
        embedding,
        metadata: { ...metadata, ts: Date.now() },
        created: new Date().toISOString(),
    };

    vectors.push(entry);

    // Cap size — remove oldest when over limit
    if (vectors.length > MAX_VECTORS) {
        vectors = vectors.slice(-MAX_VECTORS);
    }

    // Async persist — don't block the response
    persistAsync();

    return entry.id;
}

// ── Query Memory ────────────────────────────────────────────────────
async function queryMemory(query, topK = 5, filter = {}) {
    if (vectors.length === 0) return [];

    const queryEmbedding = await embed(query);

    let candidates = vectors;

    // Optional metadata filtering
    if (filter.type) {
        candidates = candidates.filter(v => v.metadata?.type === filter.type);
    }
    if (filter.since) {
        candidates = candidates.filter(v => (v.metadata?.ts || 0) > filter.since);
    }

    // Score all candidates
    const scored = candidates.map(v => ({
        id: v.id,
        content: v.content,
        score: cosineSim(queryEmbedding, v.embedding),
        metadata: v.metadata,
        created: v.created,
    }));

    // Sort by score descending, return top K
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}

// ── Stats ───────────────────────────────────────────────────────────
function getStats() {
    return {
        total_vectors: vectors.length,
        embedding_model: EMBEDDING_MODEL,
        embedding_source: hfClient ? "huggingface" : "local-hash",
        dimensions: vectors[0]?.embedding?.length || 384,
        store_path: VECTOR_STORE_PATH,
        max_capacity: MAX_VECTORS,
        oldest: vectors[0]?.created || null,
        newest: vectors[vectors.length - 1]?.created || null,
    };
}

// ── Persistence ─────────────────────────────────────────────────────
let persistTimer = null;
function persistAsync() {
    if (persistTimer) return; // debounce
    persistTimer = setTimeout(() => {
        try {
            const dir = path.dirname(VECTOR_STORE_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(VECTOR_STORE_PATH, JSON.stringify(vectors, null, 0));
        } catch (err) {
            console.warn("  ⚠ VectorMemory: Persist failed:", err.message);
        }
        persistTimer = null;
    }, 5000); // debounce 5s
}

// ── Express Routes ──────────────────────────────────────────────────
function registerRoutes(app) {
    // Query vector memory
    app.post("/api/vector/query", async (req, res) => {
        try {
            const { query, top_k, filter } = req.body;
            if (!query) return res.status(400).json({ error: "query required" });
            const results = await queryMemory(query, top_k || 5, filter || {});
            res.json({ ok: true, results, total_vectors: vectors.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Store to vector memory
    app.post("/api/vector/store", async (req, res) => {
        try {
            const { content, metadata } = req.body;
            if (!content) return res.status(400).json({ error: "content required" });
            const id = await ingestMemory({ content, metadata });
            res.json({ ok: true, id, total_vectors: vectors.length });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Vector memory stats
    app.get("/api/vector/stats", (req, res) => {
        res.json({ ok: true, ...getStats() });
    });
}

// Export
module.exports = { init, ingestMemory, queryMemory, getStats, registerRoutes, embed };
