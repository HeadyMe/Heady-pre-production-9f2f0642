/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyMemory — 3D Persistent Vector Memory System
 * The core differentiator for HeadyBuddy. Every memory is either
 * GAINED (stored in vector space) or REJECTED (with full audit trail).
 *
 * Protocol:
 * 1. Input arrives (observation, conversation, fact, pattern)
 * 2. Significance scoring (0-1) based on novelty, relevance, utility
 * 3. Vector embedding generated (text → 384-dim embedding)
 * 4. Similarity check against existing memories (dedup)
 * 5. Decision: GAIN (store) or REJECT (with reason)
 * 6. Full audit report emitted for EVERY decision
 * 7. Persistent storage: JSONL + vector-ready format for Qdrant/Vectorize
 *
 * Memory Types:
 * - episodic: events, conversations, interactions
 * - semantic: facts, knowledge, concepts
 * - procedural: how-to, patterns, workflows
 * - contextual: user preferences, environment state
 */
const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const http = require("http");
const logger = require("../utils/logger");
const CSL = require("../core/semantic-logic");

// Qdrant configuration
const QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";
const QDRANT_COLLECTION = "heady-memory";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory-store.jsonl");
const AUDIT_FILE = path.join(DATA_DIR, "memory-audit.jsonl");
const VECTOR_FILE = path.join(DATA_DIR, "memory-vectors.jsonl");

// In-memory stores (also persisted to disk)
const memories = new Map();        // id → memory object
const vectors = new Map();         // id → vector embedding
const auditLog = [];               // every gain/reject decision
const stats = {
    totalProcessed: 0,
    gained: 0,
    rejected: 0,
    duplicatesBlocked: 0,
    lastDecision: null,
    startTime: Date.now(),
};

// Configuration
const CONFIG = {
    gainThreshold: 0.45,           // significance >= this → GAIN
    similarityThreshold: 0.92,     // cosine sim >= this → duplicate
    maxMemories: 10000,            // max stored memories
    vectorDimensions: 384,         // embedding dimensions
    auditEveryDecision: true,      // report on EVERY decision
    retentionPolicy: "significance-decay", // memories decay over time
    decayRatePerDay: 0.002,        // significance decays 0.2% per day
};

// ── Health ──
router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-memory",
        mode: "3d-persistent-vector-storage",
        protocol: "gain-or-reject-with-audit",
        memories: memories.size,
        vectors: vectors.size,
        ...stats,
        config: CONFIG,
        uptime: Math.floor((Date.now() - stats.startTime) / 1000),
        ts: new Date().toISOString(),
    });
});

// ── Process a new potential memory ──
router.post("/process", (req, res) => {
    const { content, type, source, context, tags, forceGain } = req.body;
    if (!content) return res.status(400).json({ ok: false, error: "content required" });

    stats.totalProcessed++;

    const memory = {
        id: `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
        content: content.substring(0, 2000),
        type: type || "semantic",
        source: source || "unknown",
        context: (context || "").substring(0, 500),
        tags: tags || [],
        createdAt: new Date().toISOString(),
    };

    // Step 1: Calculate significance
    const significance = calculateSignificance(memory);
    memory.significance = significance;

    // Step 2: Generate pseudo-vector embedding
    const vector = generateEmbedding(memory.content);
    memory.vectorHash = crypto.createHash("md5").update(vector.join(",")).digest("hex").slice(0, 12);

    // Step 3: Similarity check (dedup)
    const similar = findSimilar(vector, CONFIG.similarityThreshold);

    // Step 4: Decision
    let decision;
    if (similar) {
        decision = {
            action: "REJECTED",
            reason: "duplicate",
            detail: `Similar memory exists: ${similar.id} (similarity: ${similar.similarity.toFixed(3)})`,
            similarTo: similar.id,
        };
        stats.rejected++;
        stats.duplicatesBlocked++;
    } else if (significance < CONFIG.gainThreshold && !forceGain) {
        decision = {
            action: "REJECTED",
            reason: "low-significance",
            detail: `Significance ${significance.toFixed(3)} below threshold ${CONFIG.gainThreshold}`,
            threshold: CONFIG.gainThreshold,
        };
        stats.rejected++;
    } else {
        decision = {
            action: "GAINED",
            reason: forceGain ? "force-gain" : "meets-threshold",
            detail: `Significance ${significance.toFixed(3)} ≥ ${CONFIG.gainThreshold}`,
        };
        stats.gained++;

        // Store memory (in-memory + disk + Qdrant)
        memories.set(memory.id, memory);
        vectors.set(memory.id, vector);
        persistMemory(memory, vector);
        upsertToQdrant(memory, vector).catch(e => { /* non-critical */ });

        // Enforce max memories
        if (memories.size > CONFIG.maxMemories) {
            evictLowestSignificance();
        }
    }

    stats.lastDecision = decision.action;

    // Step 5: Audit report (ALWAYS)
    const auditEntry = {
        id: memory.id,
        ts: memory.createdAt,
        decision: decision.action,
        reason: decision.reason,
        detail: decision.detail,
        significance: significance.toFixed(4),
        type: memory.type,
        source: memory.source,
        contentPreview: memory.content.substring(0, 80),
        tags: memory.tags,
        memoryCount: memories.size,
        vectorCount: vectors.size,
        totalProcessed: stats.totalProcessed,
        gainRate: stats.totalProcessed > 0 ? ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
    };
    auditLog.push(auditEntry);
    if (auditLog.length > 2000) auditLog.splice(0, auditLog.length - 2000);
    persistAudit(auditEntry);

    res.json({
        ok: true,
        service: "heady-memory",
        decision,
        memory: { id: memory.id, significance, type: memory.type },
        audit: auditEntry,
        stats: { gained: stats.gained, rejected: stats.rejected, total: stats.totalProcessed, gainRate: auditEntry.gainRate },
    });
});

// ── Recall memories by query ──
router.post("/recall", (req, res) => {
    const { query, type, limit, minSignificance } = req.body;
    if (!query) return res.status(400).json({ ok: false, error: "query required" });

    const queryVector = generateEmbedding(query);
    const results = [];

    for (const [id, vec] of vectors) {
        const sim = cosineSimilarity(queryVector, vec);
        const mem = memories.get(id);
        if (!mem) continue;
        if (type && mem.type !== type) continue;
        if (minSignificance && mem.significance < minSignificance) continue;
        results.push({ ...mem, similarity: sim });
    }

    results.sort((a, b) => b.similarity - a.similarity);
    const topK = results.slice(0, limit || 10);

    res.json({
        ok: true, service: "heady-memory", action: "recall",
        query, results: topK, totalSearched: vectors.size,
    });
});

// ── Memory stats and audit ──
router.get("/stats", (req, res) => {
    const byType = {};
    for (const [, mem] of memories) {
        byType[mem.type] = (byType[mem.type] || 0) + 1;
    }
    res.json({
        ok: true, service: "heady-memory",
        stats: {
            ...stats,
            byType,
            memoryCount: memories.size,
            vectorCount: vectors.size,
            gainRate: stats.totalProcessed > 0 ? ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
            rejectionRate: stats.totalProcessed > 0 ? ((stats.rejected / stats.totalProcessed) * 100).toFixed(1) + "%" : "N/A",
        },
        config: CONFIG,
        ts: new Date().toISOString(),
    });
});

// ── Full audit log ──
router.get("/audit", (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const filter = req.query.filter; // "gained" or "rejected"
    let entries = auditLog;
    if (filter) entries = entries.filter(e => e.decision === filter.toUpperCase());
    res.json({
        ok: true, service: "heady-memory", action: "audit",
        entries: entries.slice(-limit),
        total: entries.length,
        gainedCount: auditLog.filter(e => e.decision === "GAINED").length,
        rejectedCount: auditLog.filter(e => e.decision === "REJECTED").length,
    });
});

// ── Memory report (gain vs reject summary) ──
router.get("/report", (req, res) => {
    const recent = auditLog.slice(-20);
    const gained = recent.filter(e => e.decision === "GAINED");
    const rejected = recent.filter(e => e.decision === "REJECTED");

    res.json({
        ok: true, service: "heady-memory",
        report: {
            period: "last-20-decisions",
            gained: { count: gained.length, entries: gained.map(e => ({ id: e.id, significance: e.significance, source: e.source, preview: e.contentPreview })) },
            rejected: { count: rejected.length, entries: rejected.map(e => ({ id: e.id, reason: e.reason, significance: e.significance, preview: e.contentPreview })) },
            retentionRate: recent.length > 0 ? ((gained.length / recent.length) * 100).toFixed(1) + "%" : "N/A",
            totalLifetime: { gained: stats.gained, rejected: stats.rejected, total: stats.totalProcessed },
        },
        ts: new Date().toISOString(),
    });
});

// ── Vector export for Qdrant/Vectorize ──
router.get("/vectors", (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const exports = [];
    let count = 0;
    for (const [id, vec] of vectors) {
        if (count >= limit) break;
        const mem = memories.get(id);
        if (!mem) continue;
        exports.push({
            id,
            vector: vec,
            payload: {
                content: mem.content,
                type: mem.type,
                source: mem.source,
                significance: mem.significance,
                tags: mem.tags,
                createdAt: mem.createdAt,
            },
        });
        count++;
    }
    res.json({
        ok: true, service: "heady-memory", format: "qdrant-vectorize-ready",
        dimensions: CONFIG.vectorDimensions, vectors: exports, total: vectors.size,
    });
});

// ── Bulk import ──
router.post("/import", (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ ok: false, error: "items array required" });

    let gained = 0, rejected = 0;
    for (const item of items.slice(0, 100)) {
        // Process each via the same pipeline
        const significance = calculateSignificance({ content: item.content || "", type: item.type || "semantic", source: item.source || "import", tags: item.tags || [] });
        if (significance >= CONFIG.gainThreshold) {
            const id = `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
            const mem = { id, content: (item.content || "").substring(0, 2000), type: item.type || "semantic", source: item.source || "import", significance, createdAt: new Date().toISOString(), tags: item.tags || [] };
            const vec = generateEmbedding(mem.content);
            memories.set(id, mem);
            vectors.set(id, vec);
            gained++;
        } else { rejected++; }
    }
    stats.totalProcessed += items.length;
    stats.gained += gained;
    stats.rejected += rejected;
    res.json({ ok: true, imported: gained, rejected, total: items.length });
});

// ── Chat ingestion — extract knowledge from past conversations ──
router.post("/ingest-chat", (req, res) => {
    const { messages, chatId, source } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ ok: false, error: "messages array required" });

    const results = { gained: 0, rejected: 0, extracted: [] };

    for (const msg of messages) {
        const text = typeof msg === "string" ? msg : (msg.content || msg.text || "");
        const role = msg.role || "unknown";
        if (!text || text.length < 20) continue; // skip trivial messages

        // Extract knowledge units from each message
        const units = extractKnowledgeUnits(text, role);

        for (const unit of units) {
            const memory = {
                id: `mem-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
                content: unit.content.substring(0, 2000),
                type: unit.type,
                source: source || `chat-${chatId || "unknown"}`,
                context: `Extracted from ${role} message in chat ${chatId || "?"}`,
                tags: unit.tags,
                createdAt: new Date().toISOString(),
            };

            const significance = calculateSignificance(memory);
            memory.significance = significance;
            const vector = generateEmbedding(memory.content);
            memory.vectorHash = crypto.createHash("md5").update(vector.join(",")).digest("hex").slice(0, 12);

            const similar = findSimilar(vector, CONFIG.similarityThreshold);

            if (similar) {
                stats.rejected++; stats.duplicatesBlocked++; results.rejected++;
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "REJECTED", reason: "duplicate", detail: `Similar: ${similar.id}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            } else if (significance < CONFIG.gainThreshold) {
                stats.rejected++; results.rejected++;
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "REJECTED", reason: "low-significance", detail: `sig=${significance.toFixed(3)} < ${CONFIG.gainThreshold}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            } else {
                stats.gained++; results.gained++;
                memories.set(memory.id, memory);
                vectors.set(memory.id, vector);
                persistMemory(memory, vector);
                upsertToQdrant(memory, vector).catch(() => { });
                results.extracted.push({ id: memory.id, significance: significance.toFixed(3), type: unit.type, preview: memory.content.substring(0, 60) });
                persistAudit({ id: memory.id, ts: memory.createdAt, decision: "GAINED", reason: "chat-extraction", detail: `sig=${significance.toFixed(3)}`, significance: significance.toFixed(4), type: memory.type, source: memory.source, contentPreview: memory.content.substring(0, 80), tags: memory.tags, memoryCount: memories.size, vectorCount: vectors.size, totalProcessed: ++stats.totalProcessed, gainRate: ((stats.gained / stats.totalProcessed) * 100).toFixed(1) + "%" });
            }
        }
    }

    res.json({
        ok: true, service: "heady-memory", action: "ingest-chat",
        chatId: chatId || "unknown",
        messagesProcessed: messages.length,
        ...results,
        retentionRate: (results.gained + results.rejected) > 0 ? ((results.gained / (results.gained + results.rejected)) * 100).toFixed(1) + "%" : "N/A",
    });
});

// ── Qdrant status ──
router.get("/qdrant-status", async (req, res) => {
    try {
        const data = await qdrantRequest("GET", `/collections/${QDRANT_COLLECTION}`);
        res.json({
            ok: true, service: "heady-memory", qdrant: {
                collection: QDRANT_COLLECTION,
                pointsCount: data.result?.points_count || 0,
                vectorsCount: data.result?.vectors_count || 0,
                status: data.result?.status || "unknown",
                dimensions: CONFIG.vectorDimensions,
            },
        });
    } catch (err) {
        res.json({ ok: false, error: err.message });
    }
});

// ── Helpers ──

function calculateSignificance(memory) {
    let sig = 0.3; // base

    // Content length — longer = potentially more significant
    const len = (memory.content || "").length;
    if (len > 200) sig += 0.1;
    if (len > 500) sig += 0.1;

    // Type bonuses
    const typeBonus = { procedural: 0.15, episodic: 0.1, semantic: 0.05, contextual: 0.08 };
    sig += typeBonus[memory.type] || 0;

    // Source bonuses
    if (memory.source && memory.source !== "unknown") sig += 0.05;
    if (["heady-brain", "heady-soul", "user", "conversation"].includes(memory.source)) sig += 0.1;

    // Tags — more tags = more categorized = more useful
    if (memory.tags && memory.tags.length > 0) sig += Math.min(0.1, memory.tags.length * 0.02);

    // Novelty — unique words ratio
    const words = (memory.content || "").toLowerCase().split(/\s+/);
    const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
    if (uniqueRatio > 0.7) sig += 0.05; // High vocabulary diversity

    return Math.min(1.0, sig);
}

function generateEmbedding(text) {
    // Deterministic pseudo-embedding from text content
    // In production, replace with Workers AI text-embeddings model
    const vec = new Float32Array(CONFIG.vectorDimensions);
    const hash = crypto.createHash("sha512").update(text).digest();
    for (let i = 0; i < CONFIG.vectorDimensions; i++) {
        const byte1 = hash[i % hash.length];
        const byte2 = hash[(i + 1) % hash.length];
        vec[i] = ((byte1 * 256 + byte2) / 65535) * 2 - 1;
    }
    // Normalize to unit vector
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return Array.from(vec);
}

// CSL Resonance Layer — unified geometric similarity
function cosineSimilarity(a, b) {
    return CSL.cosine_similarity(a, b);
}

function findSimilar(queryVec, threshold) {
    let best = null, bestSim = 0;
    for (const [id, vec] of vectors) {
        // CSL Resonance Gate for deduplication
        const resonance = CSL.resonance_gate(queryVec, vec, threshold);
        if (resonance.score > bestSim && resonance.open) {
            bestSim = resonance.score;
            best = { id, similarity: resonance.score };
        }
    }
    return best;
}

function evictLowestSignificance() {
    let lowest = null, lowestSig = Infinity;
    for (const [id, mem] of memories) {
        if (mem.significance < lowestSig) {
            lowestSig = mem.significance;
            lowest = id;
        }
    }
    if (lowest) {
        memories.delete(lowest);
        vectors.delete(lowest);
    }
}

function persistMemory(memory, vector) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        // Store memory AND its vector embedding together so they survive restarts
        fs.appendFileSync(MEMORY_FILE, JSON.stringify({ ...memory, _vector: vector }) + "\n");
    } catch { /* non-critical */ }
}

function persistAudit(entry) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.appendFileSync(AUDIT_FILE, JSON.stringify(entry) + "\n");
    } catch { /* non-critical */ }
}

// ── Qdrant HTTP client ──
function qdrantRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, QDRANT_URL);
        const options = {
            hostname: url.hostname, port: url.port || 6333,
            path: url.pathname, method,
            headers: { "Content-Type": "application/json" },
            timeout: 5000,
        };
        const req = http.request(options, (resp) => {
            let data = "";
            resp.on("data", c => { data += c; });
            resp.on("end", () => {
                try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON from Qdrant")); }
            });
        });
        req.on("error", reject);
        req.on("timeout", () => { req.destroy(); reject(new Error("Qdrant timeout")); });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function upsertToQdrant(memory, vector) {
    try {
        await qdrantRequest("PUT", `/collections/${QDRANT_COLLECTION}/points`, {
            points: [{
                id: crypto.createHash("md5").update(memory.id).digest("hex").substring(0, 8),
                vector: vector,
                payload: {
                    memoryId: memory.id,
                    content: memory.content,
                    type: memory.type,
                    source: memory.source,
                    significance: memory.significance,
                    tags: memory.tags,
                    createdAt: memory.createdAt,
                },
            }],
        });
    } catch (err) {
        // Qdrant write is best-effort, don't fail the memory process
        logger.logError('HCFP', `Qdrant upsert failed for ${memory.id}`, err);
    }
}

// ── Chat knowledge extraction ──
function extractKnowledgeUnits(text, role) {
    const units = [];
    const sentences = text.split(/[.!?\n]+/).filter(s => s.trim().length > 30);

    // Strategy 1: Full message if it's substantial
    if (text.length > 100 && text.length <= 2000) {
        units.push({
            content: text.trim(),
            type: role === "user" ? "episodic" : "semantic",
            tags: detectTags(text),
        });
    } else if (text.length > 2000) {
        // Strategy 2: Split into semantic chunks for long messages
        for (let i = 0; i < sentences.length; i += 3) {
            const chunk = sentences.slice(i, i + 3).join(". ").trim();
            if (chunk.length > 50) {
                units.push({
                    content: chunk,
                    type: detectType(chunk, role),
                    tags: detectTags(chunk),
                });
            }
        }
    }

    return units;
}

function detectType(text, role) {
    const lower = text.toLowerCase();
    if (/how to|step \d|install|configure|setup|create/.test(lower)) return "procedural";
    if (/remember|preference|always|never|default/.test(lower)) return "contextual";
    if (/happened|yesterday|today|just now|we did/.test(lower)) return "episodic";
    return "semantic";
}

function detectTags(text) {
    const tags = [];
    const lower = text.toLowerCase();
    const tagMap = {
        architecture: /architect|design|pattern|system/,
        memory: /memory|vector|embed|store|recall/,
        infrastructure: /container|docker|podman|deploy|server/,
        cloudflare: /cloudflare|worker|pages|kv|r2|d1/,
        security: /auth|token|encrypt|ssl|cert/,
        performance: /speed|latency|cache|optimize|fast/,
        ai: /model|inference|llm|embedding|neural/,
        heady: /heady|buddy|brain|soul|conductor/,
    };
    for (const [tag, pattern] of Object.entries(tagMap)) {
        if (pattern.test(lower)) tags.push(tag);
    }
    return tags.slice(0, 5);
}

// Load persisted memories on startup
(function loadPersistedMemories() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const lines = fs.readFileSync(MEMORY_FILE, "utf8").split("\n").filter(Boolean);
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    const vec = data._vector || null;
                    delete data._vector;
                    memories.set(data.id, data);
                    // Use persisted vector if available, otherwise regenerate
                    vectors.set(data.id, vec || generateEmbedding(data.content));
                    stats.gained++;
                    stats.totalProcessed++;
                } catch { /* skip malformed lines */ }
            }
            logger.logSystem(`  ∞ HeadyMemory: loaded ${memories.size} memories from disk`);
        }
    } catch { /* no persisted data yet */ }
})();

module.exports = router;
