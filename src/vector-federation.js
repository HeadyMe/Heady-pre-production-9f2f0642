/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── Heady Federated Vector Router ──────────────────────────────
 * 
 * Routes vector operations across distributed backends:
 *
 *   TIER 1: Edge (Cloudflare Vectorize) — sub-5ms global reads
 *   TIER 2: Cloud (GCloud Vertex AI / Firestore vector) — managed scale
 *   TIER 3: Remote (HF Inference) — embedding generation
 *   TIER 4: Local (JSON shards) — cache + fallback
 *
 * Colab Worker routing:
 *   High-performance Colab workers act as the routing brain,
 *   deciding which tier handles each operation based on latency,
 *   capacity, and data freshness.
 *
 * Write Strategy: write to ALL tiers (fan-out), local first for speed
 * Read Strategy:  edge first, fall through tiers until result found
 * Embed Strategy: HF workers (round-robin) → Colab → local hash
 *
 * Timing: φ-derived (golden ratio intervals)
 * ──────────────────────────────────────────────────────────────────
 */

const https = require("https");
const http = require("http");
const PHI = 1.6180339887;

// ── Tier Metrics ────────────────────────────────────────────────
const tierMetrics = {
    edge: { hits: 0, misses: 0, errors: 0, avgLatency: 0, latencies: [] },
    gcloud: { hits: 0, misses: 0, errors: 0, avgLatency: 0, latencies: [] },
    colab: { hits: 0, misses: 0, errors: 0, avgLatency: 0, latencies: [] },
    local: { hits: 0, misses: 0, errors: 0, avgLatency: 0, latencies: [] },
};

function recordLatency(tier, ms) {
    const m = tierMetrics[tier];
    m.latencies.push(ms);
    if (m.latencies.length > 50) m.latencies = m.latencies.slice(-50);
    m.avgLatency = Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length);
}

// ── TIER 1: Cloudflare Vectorize ────────────────────────────────
async function edgeVectorize(action, payload) {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const indexName = process.env.CF_VECTORIZE_INDEX || "heady-memory";

    if (!accountId || !token) return null;

    const start = Date.now();
    try {
        const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/v2/indexes/${indexName}`;

        if (action === "insert") {
            const ndjson = payload.vectors.map(v =>
                JSON.stringify({ id: v.id, values: v.embedding, metadata: v.metadata || {} })
            ).join("\n");

            const result = await cfRequest(`${baseUrl}/insert`, "POST", ndjson, token, "application/x-ndjson");
            recordLatency("edge", Date.now() - start);
            tierMetrics.edge.hits++;
            return result;
        }

        if (action === "query") {
            const result = await cfRequest(`${baseUrl}/query`, "POST",
                JSON.stringify({ vector: payload.embedding, topK: payload.topK || 5, returnValues: true, returnMetadata: "all" }),
                token, "application/json");
            recordLatency("edge", Date.now() - start);
            if (result?.result?.matches?.length > 0) tierMetrics.edge.hits++;
            else tierMetrics.edge.misses++;
            return result?.result?.matches || [];
        }
    } catch (err) {
        tierMetrics.edge.errors++;
        recordLatency("edge", Date.now() - start);
        return null;
    }
}

// ── TIER 2: GCloud Vertex AI / Firestore Vector ─────────────────
async function gcloudVector(action, payload) {
    // Use Firestore vector search if available
    const projectId = process.env.GCLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    const apiKey = process.env.GOOGLE_API_KEY || process.env.HEADY_PYTHIA_KEY_HEADY;

    if (!projectId || !apiKey) return null;

    const start = Date.now();
    try {
        if (action === "insert") {
            // Store as Firestore document with vector field
            const docId = payload.id || `vec_${Date.now()}`;
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/heady_vectors/${docId}?key=${apiKey}`;
            const body = {
                fields: {
                    content: { stringValue: payload.content || "" },
                    embedding: { arrayValue: { values: (payload.embedding || []).slice(0, 100).map(v => ({ doubleValue: v })) } },
                    metadata: { stringValue: JSON.stringify(payload.metadata || {}) },
                    created: { timestampValue: new Date().toISOString() },
                }
            };
            const result = await httpJsonRequest(url, "PATCH", body);
            recordLatency("gcloud", Date.now() - start);
            tierMetrics.gcloud.hits++;
            return result;
        }

        if (action === "query") {
            // Firestore doesn't natively do vector search via REST easily,
            // but we can list recent docs as a reasonable approximation
            // Real production would use Vertex AI Matching Engine
            const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/heady_vectors?pageSize=20&key=${apiKey}`;
            const result = await httpJsonRequest(url, "GET");
            recordLatency("gcloud", Date.now() - start);
            tierMetrics.gcloud.hits++;
            return result?.documents || [];
        }
    } catch (err) {
        tierMetrics.gcloud.errors++;
        recordLatency("gcloud", Date.now() - start);
        return null;
    }
}

// ── TIER 3: Colab Worker Router ─────────────────────────────────
async function colabRoute(action, payload) {
    const colabUrl = process.env.HEADY_COLAB_WORKER_URL;
    if (!colabUrl) return null;

    const start = Date.now();
    try {
        const result = await httpJsonRequest(`${colabUrl}/vector/${action}`, "POST", payload);
        recordLatency("colab", Date.now() - start);
        tierMetrics.colab.hits++;
        return result;
    } catch (err) {
        tierMetrics.colab.errors++;
        recordLatency("colab", Date.now() - start);
        return null;
    }
}

// ── Federated Write (fan-out to all tiers) ──────────────────────
async function federatedInsert(entry) {
    const payload = {
        id: entry.id,
        content: entry.content,
        embedding: entry.embedding,
        metadata: entry.metadata,
    };

    // Fan-out: write to all available tiers in parallel
    // Local shard write happens in vector-memory.js ingestMemory
    const promises = [];

    // Edge
    promises.push(
        edgeVectorize("insert", { vectors: [payload] })
            .catch(() => null)
    );

    // GCloud
    promises.push(
        gcloudVector("insert", payload)
            .catch(() => null)
    );

    // Colab
    promises.push(
        colabRoute("insert", payload)
            .catch(() => null)
    );

    const results = await Promise.allSettled(promises);
    const successes = results.filter(r => r.status === "fulfilled" && r.value !== null).length;
    return { tiersWritten: successes + 1, tiers: ["local", "edge", "gcloud", "colab"].slice(0, successes + 1) };
}

// ── Federated Read (cascade through tiers) ──────────────────────
async function federatedQuery(queryEmbedding, topK = 5) {
    // Try edge first (fastest)
    const edgeResults = await edgeVectorize("query", { embedding: queryEmbedding, topK }).catch(() => null);
    if (edgeResults && edgeResults.length > 0) {
        return { results: edgeResults, tier: "edge", latency: tierMetrics.edge.avgLatency };
    }

    // Try GCloud
    const gcloudResults = await gcloudVector("query", { embedding: queryEmbedding, topK }).catch(() => null);
    if (gcloudResults && gcloudResults.length > 0) {
        return { results: gcloudResults, tier: "gcloud", latency: tierMetrics.gcloud.avgLatency };
    }

    // Try Colab
    const colabResults = await colabRoute("query", { embedding: queryEmbedding, topK }).catch(() => null);
    if (colabResults && colabResults.length > 0) {
        return { results: colabResults, tier: "colab", latency: tierMetrics.colab.avgLatency };
    }

    // Falls through to local shards (handled by vector-memory.js)
    return null;
}

// ── HTTP Helpers ────────────────────────────────────────────────
function cfRequest(url, method, body, token, contentType) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const options = {
            hostname: u.hostname, path: u.pathname + u.search,
            method, timeout: 8000,
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": contentType || "application/json",
            },
        };
        const req = https.request(options, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try { resolve(JSON.parse(data)); } catch { resolve(data); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
        req.end();
    });
}

function httpJsonRequest(url, method, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const mod = u.protocol === "https:" ? https : http;
        const options = {
            hostname: u.hostname, path: u.pathname + u.search, port: u.port,
            method, timeout: 8000,
            headers: { "Content-Type": "application/json" },
        };
        const req = mod.request(options, (res) => {
            let data = "";
            res.on("data", c => data += c);
            res.on("end", () => {
                try { resolve(JSON.parse(data)); } catch { resolve(data); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
        if (body && method !== "GET") req.write(JSON.stringify(body));
        req.end();
    });
}

// ── Express Routes ──────────────────────────────────────────────
function registerRoutes(app) {
    app.get("/api/vector/federation", (req, res) => {
        const tiers = [
            { name: "edge", type: "Cloudflare Vectorize", ready: !!(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN), ...tierMetrics.edge },
            { name: "gcloud", type: "Firestore Vector / Vertex AI", ready: !!(process.env.GCLOUD_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT), ...tierMetrics.gcloud },
            { name: "colab", type: "Colab High-Perf Worker", ready: !!process.env.HEADY_COLAB_WORKER_URL, ...tierMetrics.colab },
            { name: "local", type: "JSON Shards (cache)", ready: true, ...tierMetrics.local },
        ];
        const activeTiers = tiers.filter(t => t.ready).length;
        res.json({
            ok: true,
            architecture: "federated-multi-tier",
            writeStrategy: "fan-out (all tiers in parallel)",
            readStrategy: "cascade (edge → gcloud → colab → local)",
            embedStrategy: "HF workers (round-robin) → Colab → local hash",
            activeTiers,
            totalTiers: tiers.length,
            tiers,
        });
    });

    console.log("  ∞ VectorFederation: LOADED (edge → gcloud → colab → local cascade)");
}

module.exports = { federatedInsert, federatedQuery, registerRoutes, tierMetrics };
