/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PROPRIETARY AND CONFIDENTIAL — HEADYSYSTEMS INC.                  ║
 * ║  Copyright © 2024-2026 HeadySystems Inc. All Rights Reserved.      ║
 * ║                                                                     ║
 * ║  This file contains trade secrets of HeadySystems Inc.              ║
 * ║  Unauthorized copying, distribution, or use is strictly prohibited  ║
 * ║  and may result in civil and criminal penalties.                    ║
 * ║                                                                     ║
 * ║  Protected under the Defend Trade Secrets Act (18 U.S.C. § 1836)  ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
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

// ─── Security Layer (PQC + Handshake) ────────────────────────────────
const { headyPQC } = require("./security/pqc");
const Handshake = require("./security/handshake");
const rateLimiter = require("./security/rate-limiter");

if (!headyPQC || !Handshake) {
    console.error("🚨 [FATAL] PQC or Handshake modules missing. Core IP protection degraded. Halting Conductor.");
    process.exit(1);
}

console.log("🛡️ [Conductor] PQC Quantum-Resistant Hybrid Signatures ACTIVE for all mesh RPCs.");
console.log("🛡️ [Conductor] Redis Sliding-Window Rate Limiter Armed.");

const PHI = 1.6180339887;
const AUDIT_PATH = path.join(__dirname, "..", "data", "conductor-audit.jsonl");

// ─── Routing Table (Expanded for 19 Service Groups) ──────────────────
const ROUTING_TABLE = {
    // Tier 1: Core Agents
    embed: "embedding", store: "embedding",
    search: "search", query: "search",
    analyze: "reasoning", refactor: "reasoning",
    complete: "reasoning", chat: "reasoning",
    validate: "battle", arena: "battle",
    generate: "creative", remix: "creative",
    health: "ops", deploy: "ops", status: "ops",

    // Tier 2: Extended Logic
    code: "coding", refactor_logic: "coding", pr_review: "coding",
    audit: "governance", policy: "governance", compliance: "governance",
    scan: "vision", detect: "vision", ocr: "vision",
    simulate: "sims", predict: "sims", monte_carlo: "sims",
    forage: "swarm", hive: "swarm", swarm_nudge: "swarm",
    meta: "intelligence", logic: "intelligence", brain: "intelligence",

    // Tier 3: AI Provider Groups (Direct Routing)
    "heady-reasoning": "heady-reasoning",
    "heady-multimodal": "heady-multimodal",
    "heady-enterprise": "heady-enterprise",
    "heady-open-weights": "heady-open-weights",
    "heady-cloud-vertex": "heady-cloud-vertex",
    "heady-edge-local": "heady-edge-local",
    "heady-edge-native": "heady-edge-native",
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
    simulate: { strategy: "monte-carlo", cache: false, priority: "high", note: "UCB1 sampling optimization" },
};

// ─── Service Group Weights (Load Management) ────────────────────────
const GROUP_WEIGHTS = {
    reasoning: 1.0, coding: 0.95, intelligence: 0.9,
    embedding: 0.8, search: 0.75, swarm: 0.8,
    creative: 0.6, battle: 0.7, vision: 0.5,
    sims: 0.85, governance: 0.4, ops: 0.3,

    // Provider groups (lower priority for base scaling)
    "heady-reasoning": 0.5, "heady-multimodal": 0.5,
    "heady-enterprise": 0.4, "heady-open-weights": 0.3,
    "heady-cloud-vertex": 0.2, "heady-edge-local": 0.1,
    "heady-edge-native": 0.2
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
    async route(task, requestIp = '') {
        const start = Date.now();
        const action = task.action || "unknown";

        // ── 0. DEFENSE IN DEPTH (Rate Limiting) ──
        const limitStatus = await rateLimiter.checkLimit(requestIp, action);
        if (!limitStatus.allowed) {
            console.warn(`⛔ [DEFENSE] Conductor blocked request from ${requestIp}. Reason: ${limitStatus.reason}`);
            throw new Error(`429 Too Many Requests: ${limitStatus.reason}. Retry after ${limitStatus.retryAfter}s`);
        }

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
    if (!_conductor) {
        _conductor = new HeadyConductor();

        // ═══ AUTO-WIRE: DuckDB V2 Vector Memory ═══
        try {
            const duckdbMem = require('./intelligence/duckdb-memory');
            duckdbMem.init().then(() => {
                _conductor.setVectorMemory(duckdbMem);
                console.log("  🧠 [Conductor] DuckDB V2 Vector Memory WIRED for zone-aware routing.");
            }).catch(err => {
                console.warn(`  ⚠️ [Conductor] DuckDB init deferred: ${err.message}`);
            });
        } catch (e) {
            console.warn(`  ⚠️ [Conductor] DuckDB not available: ${e.message}`);
        }

        // ═══ AUTO-WIRE: Secret Rotation Audit ═══
        try {
            const { SecretRotation } = require('./security/secret-rotation');
            const sr = new SecretRotation();
            const audit = sr.audit();
            console.log(`  🔐 [Conductor] Secret Rotation Audit: ${audit.score} healthy (${audit.total} tracked, ${audit.expired.length} expired)`);
            if (audit.expired.length > 0) {
                console.warn(`  ⚠️ [Conductor] EXPIRED SECRETS: ${audit.expired.map(s => s.name).join(', ')}`);
            }
        } catch (e) {
            console.warn(`  ⚠️ [Conductor] Secret rotation audit skipped: ${e.message}`);
        }

        // ═══ AUTO-WIRE: DAG Engine & MLOps ═══
        try {
            const { getDAGEngine } = require('./ops/dag-engine');
            const { getMLOpsLogger } = require('./ops/mlops-logger');
            _conductor.dagEngine = getDAGEngine();
            _conductor.mlops = getMLOpsLogger();
            console.log("  🔗 [Conductor] DAG Engine and MLOps Telemetry auto-wired.");
        } catch (e) {
            console.warn(`  ⚠️ [Conductor] DAG framework deferred: ${e.message}`);
        }

        // ═══ AUTO-WIRE: Governance (RBAC & Approval Gates) ═══
        try {
            const { getRBACVendor } = require('./security/rbac-vendor');
            const { getApprovalGates } = require('./governance/approval-gates');
            _conductor.rbac = getRBACVendor();
            _conductor.gates = getApprovalGates();
            console.log("  🛑 [Conductor] Governance Layer (RBAC + HITL Gates) auto-wired.");
        } catch (e) {
            console.warn(`  ⚠️ [Conductor] Governance framework deferred: ${e.message}`);
        }
    }
    return _conductor;
}

module.exports = { HeadyConductor, getConductor };
