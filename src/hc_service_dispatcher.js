/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * HeadyServiceDispatcher — Unified Intelligent Service Router
 *
 * Single entry point for ALL Heady services. Accepts either:
 *   - Explicit service name → direct routing
 *   - Natural-language intent → Liquid Allocator selects best service
 *
 * Every dispatch is logged to the cognitive telemetry audit trail.
 */
const EventEmitter = require("events");

// ─── Service Catalog ─────────────────────────────────────────────────
// Maps every service to its API endpoint and semantic capabilities.
const SERVICE_CATALOG = {
    // ─── AI Providers ────────────────────────────────────────────────
    chat: { endpoint: "/api/brain/chat", method: "POST", caps: ["inference", "reasoning", "conversation"], component: "brain" },
    analyze: { endpoint: "/api/brain/analyze", method: "POST", caps: ["code-analysis", "text-analysis", "security"], component: "brain" },
    embed: { endpoint: "/api/brain/embed", method: "POST", caps: ["embedding", "vector", "semantic-search"], component: "brain" },
    search: { endpoint: "/api/brain/search", method: "POST", caps: ["knowledge-search", "semantic-retrieval"], component: "brain" },
    jules: { endpoint: "/api/headyjules/chat", method: "POST", caps: ["deep-reasoning", "architecture", "thinking"], component: "brain" },
    compute: { endpoint: "/api/headycompute/chat", method: "POST", caps: ["general-ai", "function-calling"], component: "brain" },
    pythia: { endpoint: "/api/headypythia/generate", method: "POST", caps: ["multimodal", "vision", "generation"], component: "brain" },
    fast: { endpoint: "/api/groq/chat", method: "POST", caps: ["ultra-fast", "low-latency", "quick-response"], component: "brain" },
    coder: { endpoint: "/api/coder/generate", method: "POST", caps: ["code-generation", "scaffold", "orchestrate"], component: "brain" },
    codex: { endpoint: "/api/codex/generate", method: "POST", caps: ["code-transform", "documentation"], component: "brain" },
    copilot: { endpoint: "/api/copilot/suggest", method: "POST", caps: ["inline-suggest", "completion", "context-aware"], component: "brain" },

    // ─── Core Engines ────────────────────────────────────────────────
    soul: { endpoint: "/api/soul/analyze", method: "POST", caps: ["reflection", "introspection", "quality-eval"], component: "soul" },
    battle: { endpoint: "/api/battle/session", method: "POST", caps: ["competition", "ranking", "multi-model-eval"], component: "battle" },
    patterns: { endpoint: "/api/patterns/analyze", method: "POST", caps: ["pattern-detection", "code-analysis", "design"], component: "patterns" },
    risks: { endpoint: "/api/risks/assess", method: "POST", caps: ["vulnerability-scan", "risk-assessment", "security"], component: "patterns" },
    vinci: { endpoint: "/api/vinci/predict", method: "POST", caps: ["prediction", "creative-learning", "recognition"], component: "vinci" },
    lens: { endpoint: "/api/lens/analyze", method: "POST", caps: ["visual-analysis", "image-processing", "detection"], component: "lens" },
    memory: { endpoint: "/api/memory/search", method: "POST", caps: ["vector-search", "3d-memory", "context-recall"], component: "brain" },

    // ─── Operations & Maintenance ───────────────────────────────────
    ops: { endpoint: "/api/ops/deploy", method: "POST", caps: ["deployment", "infrastructure", "devops"], component: "ops" },
    maid: { endpoint: "/api/maid/clean", method: "POST", caps: ["cleanup", "housekeeping", "scheduling"], component: "maintenance" },
    maintenance: { endpoint: "/api/maintenance/status", method: "GET", caps: ["health-monitoring", "backup", "restore"], component: "maintenance" },

    // ─── Integrations ───────────────────────────────────────────────
    notion: { endpoint: "/api/notion/sync", method: "POST", caps: ["knowledge-sync", "documentation", "notebooks"], component: "notion" },
    edge: { endpoint: "/api/edge/chat", method: "POST", caps: ["edge-inference", "edge-embed", "low-latency"], component: "cloud" },
    buddy: { endpoint: "/api/buddy/chat", method: "POST", caps: ["personal-assist", "multi-provider", "memory"], component: "buddy" },
    research: { endpoint: "/api/perplexity/research", method: "POST", caps: ["deep-research", "web-search", "academic"], component: "brain" },
    huggingface: { endpoint: "/api/headyhub/model", method: "POST", caps: ["model-search", "model-info", "inference"], component: "brain" },
    orchestrator: { endpoint: "/api/orchestrator/send", method: "POST", caps: ["task-routing", "wavelength-align", "coordination"], component: "conductor" },

    // ─── Pipeline & System ──────────────────────────────────────────
    "auto-flow": { endpoint: "/api/hcfp/auto-flow", method: "POST", caps: ["pipeline", "batch-processing", "auto-success"], component: "auto-success" },
    "deep-scan": { endpoint: "/api/edge/deep-scan", method: "POST", caps: ["project-mapping", "deep-analysis", "context"], component: "brain" },
    "auto-success": { endpoint: "/api/auto-success/status", method: "GET", caps: ["engine-status", "task-cycling", "optimization"], component: "auto-success" },
    health: { endpoint: "/api/health", method: "GET", caps: ["health-check", "system-status", "uptime"], component: "conductor" },
    liquid: { endpoint: "/api/liquid/state", method: "GET", caps: ["allocation-state", "flow-tracking", "context-route"], component: "conductor" },
    scientist: { endpoint: "/api/scientist/status", method: "GET", caps: ["integrity-check", "determinism", "drift-detection"], component: "conductor" },
    qa: { endpoint: "/api/qa/status", method: "GET", caps: ["quality-assurance", "endpoint-probing", "validation"], component: "conductor" },

    // ─── DAW / MIDI / Spatial ───────────────────────────────────────
    daw: { endpoint: "/api/daw/bridge", method: "POST", caps: ["midi-bridge", "daw-control", "audio-data-transfer", "osc-transport"], component: "creative" },
    midi: { endpoint: "/api/daw/midi", method: "POST", caps: ["midi-to-data", "midi-transform", "note-mapping", "cc-routing"], component: "creative" },
    spatial: { endpoint: "/api/spatial/context", method: "POST", caps: ["spatial-context", "3d-position", "audio-spatial", "ump-transport"], component: "deep-intel" },
};

// ─── Intent Keywords → Service Mapping ──────────────────────────────
const INTENT_KEYWORDS = {
    "chat": "chat", "talk": "chat", "ask": "chat", "converse": "chat",
    "analyze": "analyze", "review": "analyze", "inspect": "analyze", "audit": "analyze",
    "embed": "embed", "vector": "embed", "embedding": "embed",
    "search": "search", "find": "search", "lookup": "search", "query": "search",
    "code": "coder", "generate code": "coder", "scaffold": "coder", "build": "coder",
    "refactor": "analyze", "improve": "analyze",
    "security": "risks", "vulnerability": "risks", "risk": "risks", "scan": "risks",
    "pattern": "patterns", "design pattern": "patterns", "architecture": "patterns",
    "deploy": "ops", "infrastructure": "ops", "scale": "ops",
    "clean": "maid", "cleanup": "maid", "housekeeping": "maid",
    "backup": "maintenance", "restore": "maintenance", "update": "maintenance",
    "vision": "lens", "image": "lens", "visual": "lens", "detect": "lens",
    "predict": "vinci", "learn": "vinci", "recognize": "vinci", "creative": "vinci",
    "think": "jules", "reason": "jules", "deep": "jules", "complex": "jules",
    "fast": "fast", "quick": "fast", "speed": "fast", "instant": "fast",
    "research": "research", "academic": "research", "web search": "research",
    "notion": "notion", "sync": "notion", "knowledge": "notion",
    "memory": "memory", "recall": "memory", "remember": "memory",
    "battle": "battle", "arena": "battle", "compete": "battle", "compare": "battle",
    "soul": "soul", "reflect": "soul", "introspect": "soul",
    "health": "health", "status": "health", "uptime": "health",
    "pipeline": "auto-flow", "auto-flow": "auto-flow",
    "edge": "edge", "cloudflare": "edge", "edge ai": "edge",
    "buddy": "buddy", "assistant": "buddy", "help": "buddy",
    "model": "huggingface", "huggingface": "huggingface", "hub": "huggingface",
    "orchestrate": "orchestrator", "coordinate": "orchestrator", "route": "orchestrator",
    "midi": "midi", "daw": "daw", "audio": "daw", "osc": "daw", "note": "midi",
    "spatial": "spatial", "3d": "spatial", "position": "spatial", "ump": "spatial",
};

// ─── Service Dispatcher Class ───────────────────────────────────────
class HeadyServiceDispatcher extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.catalog = { ...SERVICE_CATALOG };
        this.dispatchLog = [];
        this.totalDispatches = 0;
        this.managerUrl = opts.managerUrl || "https://127.0.0.1:3301";
    }

    /**
     * Resolve which service to use based on intent or explicit name.
     * @param {string} intent - Natural language intent
     * @param {string} service - Explicit service name
     * @returns {{ serviceName: string, entry: object, confidence: number }}
     */
    resolve(intent, service) {
        // Explicit service name → direct lookup
        if (service && this.catalog[service]) {
            return { serviceName: service, entry: this.catalog[service], confidence: 1.0 };
        }

        // Intent-based resolution: keyword matching
        if (intent) {
            const lower = intent.toLowerCase();

            // Check exact keyword matches first
            for (const [keyword, svcName] of Object.entries(INTENT_KEYWORDS)) {
                if (lower.includes(keyword) && this.catalog[svcName]) {
                    return { serviceName: svcName, entry: this.catalog[svcName], confidence: 0.9 };
                }
            }

            // Fuzzy capability match: score all services by cap overlap
            let best = null;
            let bestScore = 0;
            const words = lower.split(/\s+/);
            for (const [name, entry] of Object.entries(this.catalog)) {
                let score = 0;
                for (const cap of entry.caps) {
                    for (const word of words) {
                        if (cap.includes(word) || word.includes(cap.split("-")[0])) score++;
                    }
                }
                if (score > bestScore) {
                    bestScore = score;
                    best = { serviceName: name, entry, confidence: Math.min(0.8, score * 0.2) };
                }
            }
            if (best && best.confidence > 0.1) return best;
        }

        // Fallback to chat (Heady Brain)
        return { serviceName: "chat", entry: this.catalog.chat, confidence: 0.3 };
    }

    /**
     * Dispatch a request to the resolved service.
     * @param {{ intent?, service?, params? }} request
     * @returns {Promise<object>} result from the service
     */
    async dispatch(request = {}) {
        const { intent, service, params = {} } = request;
        const resolved = this.resolve(intent, service);
        const start = Date.now();

        const record = {
            id: `dispatch-${++this.totalDispatches}`,
            resolved: resolved.serviceName,
            confidence: resolved.confidence,
            endpoint: resolved.entry.endpoint,
            method: resolved.entry.method,
            intent: intent || null,
            explicitService: service || null,
            ts: new Date().toISOString(),
        };

        try {
            const fetch = globalThis.fetch || require("node-fetch");
            const url = `${this.managerUrl}${resolved.entry.endpoint}`;
            const opts = { signal: AbortSignal.timeout(25000) };

            // Dynamic headers with handshake if available
            const headers = { "Content-Type": "application/json", "X-Heady-Source": "service-dispatcher" };

            let result;
            if (resolved.entry.method === "GET") {
                const res = await fetch(url, { ...opts, method: "GET", headers });
                result = await res.json();
            } else {
                const body = { ...params, source: "heady-service-dispatcher" };
                // Map common fields
                if (intent && !body.message && !body.content && !body.query && !body.prompt && !body.task) {
                    body.message = intent;
                }
                const res = await fetch(url, { ...opts, method: "POST", headers, body: JSON.stringify(body) });
                result = await res.json();
            }

            record.latencyMs = Date.now() - start;
            record.success = true;
            this.dispatchLog.push(record);
            if (this.dispatchLog.length > 500) this.dispatchLog.splice(0, this.dispatchLog.length - 500);
            this.emit("dispatch:success", record);
            return { ok: true, service: resolved.serviceName, confidence: resolved.confidence, result };

        } catch (err) {
            record.latencyMs = Date.now() - start;
            record.success = false;
            record.error = err.message;
            this.dispatchLog.push(record);
            this.emit("dispatch:error", record);
            return { ok: false, service: resolved.serviceName, error: err.message };
        }
    }

    /** Get the full service catalog. */
    getCatalog() {
        return Object.entries(this.catalog).map(([name, entry]) => ({
            name,
            endpoint: entry.endpoint,
            method: entry.method,
            capabilities: entry.caps,
            component: entry.component,
        }));
    }

    /** Get dispatch history. */
    getHistory(limit = 20) {
        return this.dispatchLog.slice(-limit);
    }

    /** Get dispatcher health. */
    getHealth() {
        const recent = this.dispatchLog.slice(-100);
        const successes = recent.filter(r => r.success).length;
        return {
            status: "ACTIVE",
            totalDispatches: this.totalDispatches,
            totalServices: Object.keys(this.catalog).length,
            recentSuccessRate: recent.length > 0 ? Math.round((successes / recent.length) * 100) : 100,
            avgLatencyMs: recent.length > 0 ? Math.round(recent.reduce((s, r) => s + (r.latencyMs || 0), 0) / recent.length) : 0,
            ts: new Date().toISOString(),
        };
    }
}

// ─── Express Routes ─────────────────────────────────────────────────
function registerServiceRoutes(app, dispatcher) {

    app.get("/api/service/health", (req, res) => {
        res.json({ ok: true, ...dispatcher.getHealth() });
    });

    app.get("/api/service/catalog", (req, res) => {
        res.json({ ok: true, services: dispatcher.getCatalog() });
    });

    app.get("/api/service/history", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json({ ok: true, history: dispatcher.getHistory(limit), total: dispatcher.totalDispatches });
    });

    app.post("/api/service", async (req, res) => {
        try {
            const result = await dispatcher.dispatch(req.body);
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Preview resolution without dispatching
    app.post("/api/service/resolve", (req, res) => {
        const { intent, service } = req.body || {};
        const resolved = dispatcher.resolve(intent, service);
        res.json({
            ok: true,
            resolved: resolved.serviceName,
            confidence: resolved.confidence,
            endpoint: resolved.entry.endpoint,
            method: resolved.entry.method,
            capabilities: resolved.entry.caps,
        });
    });

    console.log("  🔀 HeadyService Dispatcher: LOADED (unified intelligent routing)");
    console.log(`    → ${Object.keys(SERVICE_CATALOG).length} services in catalog`);
    console.log("    → Endpoints: /api/service, /catalog, /health, /history, /resolve");
}

module.exports = { HeadyServiceDispatcher, registerServiceRoutes, SERVICE_CATALOG, INTENT_KEYWORDS };
