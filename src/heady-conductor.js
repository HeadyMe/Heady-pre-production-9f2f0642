/**
 * HeadyConductor — Federated Liquid Routing Hub
 * ═══════════════════════════════════════════════════════════════
 *
 * Single routing brain that federates ALL application-level routing:
 *   1. Task routing   → service group assignment (absorbed DynamicRouter)
 *   2. Zone routing   → 3D vector spatial zone for locality
 *   3. Brain routing  → multi-brain layer selection (HCSysOrchestrator)
 *   4. Pattern routing → known optimization paths
 *
 * Does NOT touch infrastructure routing (Cloudflare edge, GCloud LBs)
 * — those run at different network layers and are already optimal.
 *
 * Liquid protocol: conductor spawns, scales, and reclaims routing
 * decisions dynamically based on load and pattern history.
 *
 * @module HeadyConductor
 */

"use strict";

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

const PHI = 1.6180339887;
const AUDIT_PATH = path.join(__dirname, "..", "data", "conductor-audit.jsonl");

// ─── Routing Table (absorbed from DynamicRouter) ────────────────────
const ROUTING_TABLE = {
    embed: "embedding", store: "embedding",
    search: "search", query: "search",
    analyze: "reasoning", refactor: "reasoning",
    complete: "reasoning", chat: "reasoning",
    validate: "battle", arena: "battle",
    generate: "creative", remix: "creative",
    health: "ops", deploy: "ops",
    status: "ops",
};

// ─── Pattern Optimizations ──────────────────────────────────────────
const PATTERN_OPTIMIZATIONS = {
    chat: { strategy: "stream-first", cache: false, priority: "high", note: "prefer streaming for real-time feel" },
    analyze: { strategy: "batch-friendly", cache: true, priority: "medium", note: "can batch multiple analyses" },
    embed: { strategy: "cache-embeddings", cache: true, priority: "low", note: "identical text → cached embedding" },
    search: { strategy: "zone-first", cache: true, priority: "high", note: "3D spatial zone for locality" },
    complete: { strategy: "context-window", cache: false, priority: "medium", note: "fill context window optimally" },
    refactor: { strategy: "diff-only", cache: false, priority: "low", note: "return diffs, not full files" },
    generate: { strategy: "parallel-variants", cache: false, priority: "medium", note: "generate N variants in parallel" },
    validate: { strategy: "deterministic", cache: true, priority: "high", note: "reproducible validation" },
};

// ─── Service Group Weights (for load-aware routing) ─────────────────
const GROUP_WEIGHTS = {
    reasoning: 1.0,    // highest demand
    embedding: 0.8,
    search: 0.7,
    creative: 0.6,
    battle: 0.4,
    ops: 0.3,
};

class HeadyConductor extends EventEmitter {
    constructor() {
        super();
        this.started = Date.now();
        this.routeCount = 0;
        this.routeHistory = [];
        this.vectorMem = null;
        this.orchestrator = null;

        // Route hit counters per service group
        this.groupHits = {};
        for (const group of Object.values(ROUTING_TABLE)) {
            this.groupHits[group] = 0;
        }

        // Federated layer status
        this.layers = {
            taskRouter: { active: true, type: "dynamic-table", routes: Object.keys(ROUTING_TABLE).length },
            vectorZone: { active: false, type: "3d-spatial-octant", zones: 0 },
            brainRouter: { active: false, type: "hc-sys-orchestrator" },
            patternEngine: { active: true, type: "known-optimizations", patterns: Object.keys(PATTERN_OPTIMIZATIONS).length },
        };

        // Ensure data dir
        const dir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    /**
     * Wire vector memory for zone-aware routing.
     */
    setVectorMemory(vectorMem) {
        this.vectorMem = vectorMem;
        this.layers.vectorZone.active = true;
        if (vectorMem.zones) {
            this.layers.vectorZone.zones = vectorMem.zones.length || 8;
        }
    }

    /**
     * Wire orchestrator for supervisor-aware routing.
     */
    setOrchestrator(orchestrator) {
        this.orchestrator = orchestrator;
    }

    /**
     * ═══ Primary Route Decision ═══
     * The single entry point for ALL routing decisions.
     *
     * @param {Object} task - { action, payload }
     * @returns {Object} - { serviceGroup, vectorZone, pattern, weight, routeId }
     */
    async route(task) {
        const start = Date.now();
        const action = task.action || "unknown";

        // ── 1. SERVICE GROUP (absorbed DynamicRouter) ──
        const serviceGroup = ROUTING_TABLE[action] || "reasoning";
        this.groupHits[serviceGroup] = (this.groupHits[serviceGroup] || 0) + 1;

        // ── 2. VECTOR ZONE (3D spatial locality) ──
        let vectorZone = null;
        if (this.vectorMem && task.payload) {
            const queryText = task.payload.message || task.payload.content ||
                task.payload.text || task.payload.query || "";
            if (queryText && queryText.length >= 5) {
                try {
                    const zoneInfo = this.vectorMem.getZoneForQuery
                        ? await this.vectorMem.getZoneForQuery(queryText)
                        : null;
                    if (zoneInfo) vectorZone = zoneInfo;
                } catch { /* zone routing optional */ }
            }
        }

        // ── 3. PATTERN OPTIMIZATION ──
        const pattern = PATTERN_OPTIMIZATIONS[action] || null;

        // ── 4. WEIGHT (load-aware priority) ──
        const weight = GROUP_WEIGHTS[serviceGroup] || 0.5;

        // ── Build route decision ──
        const routeId = `route-${++this.routeCount}-${Date.now().toString(36)}`;
        const decision = {
            routeId,
            action,
            serviceGroup,
            vectorZone,
            pattern,
            weight,
            latency: Date.now() - start,
            ts: Date.now(),
        };

        // Track
        this.routeHistory.push(decision);
        if (this.routeHistory.length > 200) this.routeHistory = this.routeHistory.slice(-100);
        this._audit({ type: "conductor:route", ...decision });
        this.emit("route", decision);

        return decision;
    }

    /**
     * Simple synchronous route (for DynamicRouter compatibility).
     * Used by orchestrator when it doesn't need zone/pattern awareness.
     */
    routeSync(task) {
        return ROUTING_TABLE[task.action] || "reasoning";
    }

    /**
     * Get federated routing status — all layers.
     */
    getStatus() {
        const totalRoutes = this.routeCount;
        const topGroups = Object.entries(this.groupHits)
            .sort((a, b) => b[1] - a[1])
            .map(([group, hits]) => ({ group, hits, pct: totalRoutes > 0 ? Math.round(hits / totalRoutes * 100) : 0 }));

        return {
            ok: true,
            architecture: "federated-liquid-conductor",
            uptime: Date.now() - this.started,
            totalRoutes,
            layers: this.layers,
            groupHits: topGroups,
            recentRoutes: this.routeHistory.slice(-10).map(r => ({
                routeId: r.routeId, action: r.action, serviceGroup: r.serviceGroup,
                vectorZone: r.vectorZone, latency: r.latency,
            })),
            supervisors: this.orchestrator ? this.orchestrator.supervisors.size : 0,
            minConcurrent: this.orchestrator ? this.orchestrator.minConcurrent : 150,
        };
    }

    /**
     * Get the full route map — which actions go where.
     */
    getRouteMap() {
        const map = {};
        for (const [action, group] of Object.entries(ROUTING_TABLE)) {
            if (!map[group]) map[group] = { actions: [], weight: GROUP_WEIGHTS[group] || 0.5, hits: this.groupHits[group] || 0 };
            map[group].actions.push({
                action,
                pattern: PATTERN_OPTIMIZATIONS[action] || null,
            });
        }
        return { ok: true, architecture: "federated-liquid-conductor", groups: map };
    }

    /**
     * Register Express routes for conductor status.
     */
    registerRoutes(app) {
        app.get("/api/conductor/status", (req, res) => {
            res.json(this.getStatus());
        });

        app.get("/api/conductor/route-map", (req, res) => {
            res.json(this.getRouteMap());
        });

        app.get("/api/conductor/health", (req, res) => {
            const status = this.getStatus();
            res.json({
                ok: true,
                uptime: status.uptime,
                totalRoutes: status.totalRoutes,
                layers: Object.fromEntries(
                    Object.entries(status.layers).map(([k, v]) => [k, v.active])
                ),
                supervisors: status.supervisors,
            });
        });

        // Route analysis — test a hypothetical route
        app.post("/api/conductor/analyze-route", async (req, res) => {
            try {
                const { action, payload } = req.body;
                if (!action) return res.status(400).json({ error: "action required" });
                const decision = await this.route({ action, payload: payload || {} });
                res.json({ ok: true, decision });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        console.log("  ∞ HeadyConductor: LOADED (federated liquid routing)");
        console.log("    → Endpoints: /api/conductor/status, /route-map, /health, /analyze-route");
        console.log(`    → Layers: ${Object.entries(this.layers).filter(([, v]) => v.active).map(([k]) => k).join(", ")}`);
    }

    _audit(entry) {
        const line = JSON.stringify({ ...entry, ts: entry.ts || new Date().toISOString() });
        try { fs.appendFileSync(AUDIT_PATH, line + "\n"); } catch { }
        this.emit("audit", entry);
    }
}

// ─── Singleton ──────────────────────────────────────────────────────
let _conductor = null;
function getConductor() {
    if (!_conductor) _conductor = new HeadyConductor();
    return _conductor;
}

module.exports = { HeadyConductor, getConductor };
