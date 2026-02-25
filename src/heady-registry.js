/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ─── HeadyRegistry — Confidence-Scored System Knowledge ──────────
 * 
 * Maintains a live inventory of ALL system internals:
 *   - Services, endpoints, modules, configs, providers, connections
 *   - Each entry has a CONFIDENCE SCORE (0-1) based on recency + verification
 *   - Incremental targeted scans refresh only stale entries
 *   - Eliminates expensive global scans by maintaining high confidence
 *
 * Confidence Decay:
 *   100% → fresh verification (within 60s)
 *   90%  → verified within 5m
 *   75%  → verified within 30m
 *   50%  → verified within 2h
 *   25%  → stale (needs rescan)
 *   0%   → never verified
 *
 * Scan Strategy:
 *   - Every 30s: scan lowest-confidence entries (targeted)
 *   - Every 5m:  sweep entries below 50% confidence
 *   - On-demand: full refresh via API
 *   - NEVER full global scan unless explicitly requested
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const REG_FILE = path.join(__dirname, "..", "data", "heady-registry.json");
const REG_AUDIT = path.join(__dirname, "..", "data", "registry-audit.jsonl");
const dir = path.dirname(REG_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Confidence decay curve (ms → confidence multiplier)
function confidenceFromAge(ageMs) {
    if (ageMs < 60000) return 1.0;       // <1m = 100%
    if (ageMs < 300000) return 0.9;      // <5m = 90%
    if (ageMs < 1800000) return 0.75;    // <30m = 75%
    if (ageMs < 7200000) return 0.5;     // <2h = 50%
    if (ageMs < 28800000) return 0.25;   // <8h = 25%
    return 0.05;                          // ancient
}

// ── Registry Store ──────────────────────────────────────────────
let registry = { entries: {}, meta: { created: Date.now(), scanCount: 0, lastScan: null } };
try { registry = JSON.parse(fs.readFileSync(REG_FILE, "utf-8")); } catch { }

function save() { try { fs.writeFileSync(REG_FILE, JSON.stringify(registry, null, 2)); } catch { } }
function audit(entry) {
    try { fs.appendFileSync(REG_AUDIT, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n"); } catch { }
}

function setEntry(key, data) {
    registry.entries[key] = {
        ...data,
        key,
        lastVerified: Date.now(),
        confidence: 1.0,
        verifyCount: (registry.entries[key]?.verifyCount || 0) + 1,
    };
}

function getConfidence(key) {
    const entry = registry.entries[key];
    if (!entry) return 0;
    const age = Date.now() - (entry.lastVerified || 0);
    return confidenceFromAge(age);
}

function getAllWithConfidence() {
    const now = Date.now();
    const result = {};
    for (const [key, entry] of Object.entries(registry.entries)) {
        const age = now - (entry.lastVerified || 0);
        result[key] = { ...entry, confidence: confidenceFromAge(age), ageMs: age };
    }
    return result;
}

// ── Targeted Scanners ───────────────────────────────────────────

async function scanEndpoint(name, url, timeout = 5000) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.get(url, { timeout }, (res) => {
            let body = "";
            res.on("data", c => { body += c; if (body.length > 500) body = body.substring(0, 500); });
            res.on("end", () => {
                setEntry(`endpoint:${name}`, {
                    type: "endpoint", name, url,
                    status: res.statusCode === 200 ? "healthy" : "degraded",
                    httpStatus: res.statusCode,
                    latency: Date.now() - start,
                    preview: body.substring(0, 100),
                });
                resolve(true);
            });
        });
        req.on("error", () => {
            setEntry(`endpoint:${name}`, { type: "endpoint", name, url, status: "down", latency: Date.now() - start });
            resolve(false);
        });
        req.on("timeout", () => { req.destroy(); resolve(false); });
    });
}

function scanModule(name, filePath) {
    try {
        const exists = fs.existsSync(filePath);
        const stat = exists ? fs.statSync(filePath) : null;
        setEntry(`module:${name}`, {
            type: "module", name, path: filePath,
            status: exists ? "present" : "missing",
            size: stat ? stat.size : 0,
            modified: stat ? stat.mtime.toISOString() : null,
        });
        return exists;
    } catch { return false; }
}

function scanConfig(name, key) {
    const value = process.env[key];
    setEntry(`config:${name}`, {
        type: "config", name, envKey: key,
        status: value ? "set" : "missing",
        hasValue: !!value,
        valuePreview: value ? value.substring(0, 8) + "..." : null,
    });
    return !!value;
}

function scanDataFile(name, filePath) {
    try {
        const exists = fs.existsSync(filePath);
        if (!exists) { setEntry(`data:${name}`, { type: "data", name, path: filePath, status: "missing" }); return; }
        const stat = fs.statSync(filePath);
        let entries = 0;
        if (filePath.endsWith(".jsonl")) {
            entries = fs.readFileSync(filePath, "utf-8").trim().split("\n").length;
        } else if (filePath.endsWith(".json")) {
            const d = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            entries = Array.isArray(d) ? d.length : Object.keys(d).length;
        }
        setEntry(`data:${name}`, {
            type: "data", name, path: filePath,
            status: "present", size: stat.size, entries,
            modified: stat.mtime.toISOString(),
        });
    } catch { }
}

// ── Incremental Targeted Scan ───────────────────────────────────
async function incrementalScan() {
    const now = Date.now();
    // Find entries with lowest confidence
    const entries = getAllWithConfidence();
    const stale = Object.values(entries).filter(e => e.confidence < 0.5).sort((a, b) => a.confidence - b.confidence);

    let scanned = 0;
    for (const entry of stale.slice(0, 5)) { // Max 5 per cycle
        if (entry.type === "endpoint" && entry.url) {
            await scanEndpoint(entry.name, entry.url);
            scanned++;
        } else if (entry.type === "module" && entry.path) {
            scanModule(entry.name, entry.path);
            scanned++;
        } else if (entry.type === "config" && entry.envKey) {
            scanConfig(entry.name, entry.envKey);
            scanned++;
        } else if (entry.type === "data" && entry.path) {
            scanDataFile(entry.name, entry.path);
            scanned++;
        }
    }

    registry.meta.scanCount++;
    registry.meta.lastScan = new Date().toISOString();
    save();

    if (scanned > 0) audit({ type: "incremental_scan", scanned, staleCount: stale.length });
    return { scanned, staleCount: stale.length };
}

// ── Full Registry Population (initial or on-demand) ─────────────
async function fullPopulate() {
    const BASE = "http://127.0.0.1:3301";
    const endpoints = [
        "pulse", "compute/dashboard", "orchestrator/agents", "orchestrator/nodes",
        "optimize/status", "optimize/skills", "optimize/connectors",
        "remote/stats", "corrections/model", "vector/stats",
        "mcp/tools", "battle/leaderboard", "creative/pipelines",
        "auth/sessions", "benchmark/latest",
    ];
    for (const ep of endpoints) await scanEndpoint(ep, `${BASE}/api/${ep}`);

    const dataDir = path.join(__dirname, "..", "data");
    const modules = [
        ["agent-orchestrator", path.join(__dirname, "agent-orchestrator.js")],
        ["remote-compute", path.join(__dirname, "remote-compute.js")],
        ["compute-dashboard", path.join(__dirname, "compute-dashboard.js")],
        ["sdk-services", path.join(__dirname, "sdk-services.js")],
        ["provider-benchmark", path.join(__dirname, "provider-benchmark.js")],
        ["self-optimizer", path.join(__dirname, "self-optimizer.js")],
        ["corrections", path.join(__dirname, "corrections.js")],
        ["vector-memory", path.join(__dirname, "vector-memory.js")],
        ["heady-registry", path.join(__dirname, "heady-registry.js")],
    ];
    for (const [name, p] of modules) scanModule(name, p);

    const configs = [
        ["heady-api-key", "HEADY_API_KEY"], ["hf-token", "HF_TOKEN"], ["hf-token-2", "HF_TOKEN_2"],
        ["google-api-key", "GOOGLE_API_KEY"], ["headypythia-key-heady", "HEADY_PYTHIA_KEY_HEADY"],
        ["headynexus-key", "HEADY_NEXUS_KEY"], ["headycompute-key", "HEADY_COMPUTE_KEY"],
        ["groq-key", "GROQ_API_KEY"], ["perplexity-key", "PERPLEXITY_API_KEY"],
        ["cloudflare-token", "CLOUDFLARE_API_TOKEN"],
    ];
    for (const [name, key] of configs) scanConfig(name, key);

    const dataFiles = [
        ["overnight-audit", path.join(dataDir, "overnight-audit.jsonl")],
        ["corrections-audit", path.join(dataDir, "corrections-audit.jsonl")],
        ["remote-dispatch-audit", path.join(dataDir, "remote-dispatch-audit.jsonl")],
        ["optimization-audit", path.join(dataDir, "optimization-audit.jsonl")],
        ["registry-audit", path.join(dataDir, "registry-audit.jsonl")],
        ["vector-memory", path.join(dataDir, "vector-memory.json")],
        ["behavior-patterns", path.join(dataDir, "behavior-patterns.json")],
        ["provider-benchmarks", path.join(dataDir, "provider-benchmarks.json")],
        ["optimization-state", path.join(dataDir, "optimization-state.json")],
    ];
    for (const [name, p] of dataFiles) scanDataFile(name, p);

    save();
    audit({ type: "full_populate", entries: Object.keys(registry.entries).length });
    return { entries: Object.keys(registry.entries).length };
}

// ── Summary Stats ───────────────────────────────────────────────
function getSummary() {
    const entries = getAllWithConfidence();
    const byType = {};
    const byConfidence = { high: 0, medium: 0, low: 0, stale: 0 };
    let avgConfidence = 0;
    const count = Object.keys(entries).length;

    for (const e of Object.values(entries)) {
        byType[e.type] = (byType[e.type] || 0) + 1;
        avgConfidence += e.confidence;
        if (e.confidence >= 0.75) byConfidence.high++;
        else if (e.confidence >= 0.5) byConfidence.medium++;
        else if (e.confidence >= 0.25) byConfidence.low++;
        else byConfidence.stale++;
    }

    return {
        totalEntries: count,
        avgConfidence: count > 0 ? +(avgConfidence / count).toFixed(3) : 0,
        byType, byConfidence,
        scanCount: registry.meta.scanCount,
        lastScan: registry.meta.lastScan,
        globalScanNeeded: byConfidence.stale > count * 0.3, // Only if >30% stale
    };
}

// ── Express Routes ──────────────────────────────────────────────
function registerRoutes(app, vectorMem) {
    app.get("/api/registry", (req, res) => {
        res.json({ ok: true, summary: getSummary(), entries: getAllWithConfidence() });
    });

    app.get("/api/registry/summary", (req, res) => {
        res.json({ ok: true, ...getSummary() });
    });

    app.post("/api/registry/scan", async (req, res) => {
        const { mode } = req.body || {};
        if (mode === "full") {
            const result = await fullPopulate();
            res.json({ ok: true, mode: "full", ...result, summary: getSummary() });
        } else {
            const result = await incrementalScan();
            res.json({ ok: true, mode: "incremental", ...result, summary: getSummary() });
        }
    });

    app.get("/api/registry/stale", (req, res) => {
        const entries = getAllWithConfidence();
        const stale = Object.values(entries).filter(e => e.confidence < 0.5).sort((a, b) => a.confidence - b.confidence);
        res.json({ ok: true, stale, total: stale.length });
    });

    // ── Adaptive Scan Loop ────────────────────────────────────────
    // Interval adapts: fast (2s) when stale, coast (15s) when all confident
    let scanInterval = 5000;
    let vecSyncCounter = 0;
    const adaptiveScan = async () => {
        try {
            await incrementalScan();
            vecSyncCounter++;
            const summary = getSummary();
            if (summary.byConfidence.stale > summary.totalEntries * 0.3) {
                scanInterval = 2000;  // 30%+ stale → 2s urgent
            } else if (summary.byConfidence.stale > 0) {
                scanInterval = 5000;  // some stale → 5s
            } else if (summary.avgConfidence > 0.9) {
                scanInterval = 15000; // high confidence → coast 15s
            } else {
                scanInterval = 8000;  // moderate → 8s
            }
            // Vector sync every 10 scans
            if (vecSyncCounter % 10 === 0 && vectorMem && typeof vectorMem.ingestMemory === "function") {
                await vectorMem.ingestMemory({
                    content: `Registry: ${summary.totalEntries} entries, confidence=${summary.avgConfidence}, interval=${scanInterval}ms, scan #${summary.scanCount}`,
                    metadata: { type: "registry_state", ...summary.byConfidence, scanInterval },
                }).catch(() => { });
            }
        } catch { }
        setTimeout(adaptiveScan, scanInterval);
    };
    // Full populate on startup (2s), then start adaptive loop
    setTimeout(async () => { await fullPopulate().catch(() => { }); adaptiveScan(); }, 2000);

    console.log(`  ∞ HeadyRegistry: LOADED (adaptive scan, confidence-driven, →vector memory)`);
}

module.exports = { registerRoutes, getSummary, getAllWithConfidence, fullPopulate, incrementalScan, registry };
