/**
 * ─── Heady Self-Optimization Engine ───────────────────────────────
 * Continuous learning loop that auto-tunes the entire system:
 *
 * 1. BENCHMARK: Measure provider speeds, connection types, throughput
 * 2. ANALYZE:   Find patterns in vector memory (what works, what doesn't)
 * 3. TUNE:      Auto-adjust routing weights, group limits, provider priority
 * 4. TRAIN:     Ingest learnings back into vector memory as skills
 * 5. CONNECT:   Discover and wire new integrations dynamically
 *
 * Runs as a background loop every 60s, or on-demand via API.
 * Every optimization action → vector memory + audit trail.
 * ──────────────────────────────────────────────────────────────────
 */

const fs = require("fs");
const path = require("path");

const OPT_FILE = path.join(__dirname, "..", "data", "optimization-state.json");
const OPT_AUDIT = path.join(__dirname, "..", "data", "optimization-audit.jsonl");
const SKILLS_DIR = path.join(__dirname, "..", "data", "skills");
const dir = path.dirname(OPT_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });

let optState = {
    cycleCount: 0,
    lastRun: null,
    routingWeights: { hf: 1.0, gemini: 1.0, claude: 1.0, local: 0.5, edge: 0.8 },
    providerScores: {},
    skills: [],
    connectors: [],
    improvements: [],
    started: Date.now(),
};

try { optState = { ...optState, ...JSON.parse(fs.readFileSync(OPT_FILE, "utf-8")) }; } catch { }

function save() { try { fs.writeFileSync(OPT_FILE, JSON.stringify(optState, null, 2)); } catch { } }
function audit(entry) {
    try { fs.appendFileSync(OPT_AUDIT, JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n"); } catch { }
}

// ── 1. Benchmark Analysis ───────────────────────────────────────
function analyzeBenchmarks() {
    try {
        const benchFile = path.join(__dirname, "..", "data", "provider-benchmarks.json");
        const benches = JSON.parse(fs.readFileSync(benchFile, "utf-8"));
        const history = benches.history || [];
        if (history.length === 0) return null;

        // Average latencies across recent benchmarks
        const avgLatencies = {};
        const successRates = {};
        history.slice(-10).forEach(bench => {
            (bench.results || []).forEach(r => {
                if (!avgLatencies[r.provider]) { avgLatencies[r.provider] = []; successRates[r.provider] = { ok: 0, total: 0 }; }
                if (r.totalLatency) avgLatencies[r.provider].push(r.totalLatency);
                successRates[r.provider].total++;
                if (r.ok) successRates[r.provider].ok++;
            });
        });

        const scores = {};
        for (const [provider, latencies] of Object.entries(avgLatencies)) {
            const avgLat = latencies.reduce((a, b) => a + b, 0) / latencies.length;
            const sr = successRates[provider];
            const reliability = sr.total > 0 ? sr.ok / sr.total : 0;
            // Score: lower latency + higher reliability = better
            scores[provider] = {
                avgLatency: Math.round(avgLat),
                reliability: +(reliability * 100).toFixed(1),
                weight: +(reliability * (1000 / Math.max(avgLat, 100))).toFixed(3),
                samples: latencies.length,
            };
        }
        return scores;
    } catch { return null; }
}

// ── 2. Auto-Tune Routing Weights ────────────────────────────────
function tuneRouting(scores) {
    if (!scores) return [];
    const tunings = [];

    for (const [provider, score] of Object.entries(scores)) {
        const oldWeight = optState.routingWeights[provider] || 1.0;
        // Adjust weight based on performance score
        const newWeight = +Math.max(0.1, Math.min(2.0, score.weight)).toFixed(3);
        if (Math.abs(newWeight - oldWeight) > 0.05) {
            optState.routingWeights[provider] = newWeight;
            tunings.push({ provider, oldWeight, newWeight, reason: `latency=${score.avgLatency}ms reliability=${score.reliability}%` });
        }
    }
    optState.providerScores = scores;
    return tunings;
}

// ── 3. Skill Discovery ──────────────────────────────────────────
function discoverSkills() {
    const discovered = [];

    // Check for available integrations
    const integrations = [
        { name: "vector-search", check: () => fs.existsSync(path.join(__dirname, "vector-memory.js")), type: "core" },
        { name: "behavior-analysis", check: () => fs.existsSync(path.join(__dirname, "corrections.js")), type: "core" },
        { name: "remote-dispatch", check: () => fs.existsSync(path.join(__dirname, "remote-compute.js")), type: "compute" },
        { name: "provider-benchmark", check: () => fs.existsSync(path.join(__dirname, "provider-benchmark.js")), type: "perf" },
        { name: "edge-proxy", check: () => !!process.env.CLOUDFLARE_API_TOKEN, type: "infra" },
        { name: "hf-embeddings", check: () => !!process.env.HF_TOKEN, type: "ai" },
        { name: "gemini-multimodal", check: () => !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY), type: "ai" },
        { name: "claude-reasoning", check: () => !!process.env.ANTHROPIC_API_KEY, type: "ai" },
        { name: "openai-enterprise", check: () => !!process.env.OPENAI_API_KEY, type: "ai" },
        { name: "groq-fast", check: () => !!process.env.GROQ_API_KEY, type: "ai" },
        { name: "perplexity-research", check: () => !!process.env.PERPLEXITY_API_KEY, type: "ai" },
        { name: "notion-sync", check: () => !!process.env.NOTION_API_KEY, type: "integration" },
    ];

    for (const int of integrations) {
        try {
            const available = int.check();
            discovered.push({ name: int.name, type: int.type, available, status: available ? "active" : "missing" });
        } catch {
            discovered.push({ name: int.name, type: int.type, available: false, status: "error" });
        }
    }

    // Write skill file
    const activeSkills = discovered.filter(s => s.available);
    const skillManifest = {
        totalDiscovered: discovered.length,
        active: activeSkills.length,
        missing: discovered.length - activeSkills.length,
        skills: discovered,
        lastScan: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(SKILLS_DIR, "manifest.json"), JSON.stringify(skillManifest, null, 2));
    optState.skills = discovered;
    return skillManifest;
}

// ── 4. Connector Discovery ──────────────────────────────────────
function discoverConnectors() {
    const connectors = [];

    // Check for available connection types
    const checks = [
        { name: "http-rest", protocol: "HTTP/1.1", latency: "~2ms local, ~50ms remote", ready: true },
        { name: "https-tls13", protocol: "HTTPS/TLS1.3", latency: "~5ms local, ~80ms remote", ready: true },
        { name: "sse-stream", protocol: "Server-Sent Events", latency: "~1ms push", ready: true },
        { name: "websocket", protocol: "WS/WSS", latency: "~1ms bidirectional", ready: fs.existsSync(path.join(__dirname, "..", "heady-manager.js")) },
        { name: "sdk-hf", protocol: "@huggingface/inference", latency: "varies by model", ready: !!process.env.HF_TOKEN },
        { name: "sdk-genai", protocol: "@google/genai", latency: "~500ms flash", ready: !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY_HEADY) },
        { name: "sdk-anthropic", protocol: "@anthropic-ai/sdk", latency: "~800ms sonnet", ready: !!process.env.ANTHROPIC_API_KEY },
        { name: "edge-worker", protocol: "Cloudflare Workers", latency: "~2ms edge", ready: !!process.env.CLOUDFLARE_API_TOKEN },
        { name: "kv-store", protocol: "Cloudflare KV", latency: "~5ms global", ready: !!process.env.CLOUDFLARE_API_TOKEN },
        { name: "vector-local", protocol: "JSON + cosine", latency: "~0.5ms", ready: true },
    ];

    for (const c of checks) {
        connectors.push({ ...c, status: c.ready ? "connected" : "available" });
    }

    optState.connectors = connectors;
    return connectors;
}

// ── 5. Full Optimization Cycle ──────────────────────────────────
async function runOptimizationCycle(vectorMem) {
    const cycleStart = Date.now();
    optState.cycleCount++;

    const benchScores = analyzeBenchmarks();
    const tunings = tuneRouting(benchScores);
    const skills = discoverSkills();
    const connectors = discoverConnectors();

    // Generate improvement suggestions
    const improvements = [];
    if (skills.missing > 0) {
        const missing = skills.skills.filter(s => !s.available).map(s => s.name);
        improvements.push({ type: "skill_gap", message: `${skills.missing} skills missing: ${missing.join(", ")}`, priority: "medium" });
    }
    if (tunings.length > 0) {
        improvements.push({ type: "routing_tuned", message: `Adjusted ${tunings.length} provider weights based on benchmarks`, priority: "high" });
    }

    const activeConnectors = connectors.filter(c => c.ready).length;
    if (activeConnectors < connectors.length) {
        improvements.push({ type: "connector_gap", message: `${connectors.length - activeConnectors} connectors not wired`, priority: "low" });
    }

    optState.improvements = improvements;
    optState.lastRun = new Date().toISOString();
    save();

    const result = {
        cycle: optState.cycleCount,
        duration: Date.now() - cycleStart,
        benchScores,
        tunings,
        skills: { active: skills.active, total: skills.totalDiscovered },
        connectors: { ready: activeConnectors, total: connectors.length },
        improvements,
        routingWeights: optState.routingWeights,
    };

    audit({ type: "optimization:cycle", cycle: optState.cycleCount, duration: result.duration, tunings: tunings.length, improvements: improvements.length });

    // Store optimization results in vector memory
    if (vectorMem && typeof vectorMem.ingestMemory === "function") {
        await vectorMem.ingestMemory({
            content: `Optimization cycle #${optState.cycleCount}: ${tunings.length} routing tunings, ${skills.active}/${skills.totalDiscovered} skills active, ${activeConnectors}/${connectors.length} connectors ready. Improvements: ${improvements.map(i => i.message).join("; ")}`,
            metadata: { type: "optimization_cycle", cycle: optState.cycleCount },
        }).catch(() => { });
    }

    return result;
}

// ── Express Routes ──────────────────────────────────────────────
function registerRoutes(app, vectorMem) {
    app.get("/api/optimize/status", (req, res) => {
        res.json({ ok: true, ...optState, uptime: Date.now() - optState.started });
    });

    app.post("/api/optimize/run", async (req, res) => {
        try {
            const result = await runOptimizationCycle(vectorMem);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get("/api/optimize/skills", (req, res) => {
        const skills = discoverSkills();
        res.json({ ok: true, ...skills });
    });

    app.get("/api/optimize/connectors", (req, res) => {
        const connectors = discoverConnectors();
        res.json({ ok: true, connectors, total: connectors.length, ready: connectors.filter(c => c.ready).length });
    });

    app.get("/api/optimize/routing", (req, res) => {
        res.json({ ok: true, weights: optState.routingWeights, scores: optState.providerScores });
    });

    // Continuous optimization loop (every 60s)
    setInterval(async () => {
        try { await runOptimizationCycle(vectorMem); } catch { }
    }, 60000);

    // Run first cycle immediately
    setTimeout(async () => {
        try {
            const result = await runOptimizationCycle(vectorMem);
            console.log(`  ∞ First optimization: ${result.skills.active} skills, ${result.connectors.ready} connectors, ${result.tunings.length} tunings`);
        } catch { }
    }, 5000);

    console.log("  ∞ SelfOptimizer: LOADED (60s cycle → benchmark + tune + skill discovery + vector learn)");
}

module.exports = { runOptimizationCycle, registerRoutes, optState };
