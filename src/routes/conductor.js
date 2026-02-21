/**
 * HeadyConductor — System Orchestrator & Overall Perspective
 * Gets the complete picture through high-level system comprehension
 * rather than granular differentials (that's HeadyLens's job).
 *
 * Architecture: Conductor polls all services, synthesizes health,
 * makes orchestration decisions, and compares its understanding
 * against Lens's differential view to identify blind spots.
 *
 * Conductor = WHAT the system is doing (macro)
 * Lens = HOW the system is changing (micro)
 * Comparison = value in seeing both perspectives
 */
const express = require("express");
const router = express.Router();
const http = require("http");

const MANAGER_URL = process.env.HEADY_MANAGER_URL || "http://127.0.0.1:3301";
const conductorLog = [];
const systemModel = {
    services: {},
    lastPoll: null,
    overallHealth: 1.0,
    perspective: "initializing",
};

// All services Conductor tracks
const SERVICE_ENDPOINTS = {
    soul: "/api/soul/health",
    battle: "/api/battle/health",
    hcfp: "/api/hcfp/health",
    patterns: "/api/patterns/health",
    ops: "/api/ops/health",
    maintenance: "/api/maintenance/health",
    lens: "/api/lens/health",
    vinci: "/api/vinci/health",
    notion: "/api/notion/health",
};

router.get("/health", (req, res) => {
    res.json({
        status: "ACTIVE",
        service: "heady-conductor",
        mode: "system-orchestrator",
        perspective: systemModel.perspective,
        overallHealth: systemModel.overallHealth,
        trackedServices: Object.keys(SERVICE_ENDPOINTS).length,
        lastPoll: systemModel.lastPoll,
        orchestrationEvents: conductorLog.length,
        ts: new Date().toISOString(),
    });
});

// Full system poll — Conductor's way of understanding
router.post("/poll", async (req, res) => {
    const results = {};
    let healthy = 0;
    let total = 0;

    for (const [name, endpoint] of Object.entries(SERVICE_ENDPOINTS)) {
        total++;
        try {
            const data = await fetchLocal(endpoint);
            results[name] = { status: data.status || "OK", healthy: true, latencyMs: data._latency };
            healthy++;
        } catch (err) {
            results[name] = { status: "DOWN", healthy: false, error: err.message };
        }
    }

    systemModel.services = results;
    systemModel.lastPoll = new Date().toISOString();
    systemModel.overallHealth = total > 0 ? healthy / total : 0;
    systemModel.perspective = systemModel.overallHealth >= 0.9 ? "all-systems-nominal"
        : systemModel.overallHealth >= 0.5 ? "degraded" : "critical";

    const entry = {
        id: `conductor-${Date.now()}`, action: "poll",
        healthy, total, health: systemModel.overallHealth,
        perspective: systemModel.perspective, ts: systemModel.lastPoll,
    };
    conductorLog.push(entry);
    if (conductorLog.length > 200) conductorLog.splice(0, conductorLog.length - 200);

    res.json({ ok: true, service: "heady-conductor", action: "poll", ...entry, services: results });
});

// Orchestrate — make a system-level decision
router.post("/orchestrate", (req, res) => {
    const { action, target, priority } = req.body;
    const entry = {
        id: `conductor-${Date.now()}`, action: action || "auto",
        target: target || "system", priority: priority || "normal",
        systemHealth: systemModel.overallHealth,
        perspective: systemModel.perspective,
        decision: deriveDecision(action, systemModel),
        ts: new Date().toISOString(),
    };
    conductorLog.push(entry);
    if (conductorLog.length > 200) conductorLog.splice(0, conductorLog.length - 200);

    res.json({ ok: true, service: "heady-conductor", orchestration: entry });
});

// Compare Conductor perspective vs Lens differentials
router.get("/compare-lens", async (req, res) => {
    let lensData = null;
    try {
        lensData = await fetchLocal("/api/lens/memory");
    } catch { lensData = { error: "Lens unreachable" }; }

    const comparison = {
        conductor: {
            perspective: systemModel.perspective,
            overallHealth: systemModel.overallHealth,
            trackedServices: Object.keys(systemModel.services).length,
            healthyServices: Object.values(systemModel.services).filter(s => s.healthy).length,
            lastPoll: systemModel.lastPoll,
        },
        lens: lensData,
        synthesis: {
            agreement: lensData?.memory ? "both-active" : "lens-unavailable",
            blindSpots: identifyBlindSpots(systemModel, lensData),
            recommendation: systemModel.overallHealth >= 0.9 ? "nominal — continue auto-success" : "investigate degraded services",
        },
        ts: new Date().toISOString(),
    };

    res.json({ ok: true, service: "heady-conductor", comparison });
});

// System model
router.get("/model", (req, res) => {
    res.json({ ok: true, model: systemModel, ts: new Date().toISOString() });
});

router.get("/orchestrate", (req, res) => res.json({ ok: true, recent: conductorLog.slice(-10) }));

// ── Helpers ──
function fetchLocal(endpoint) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const url = new URL(endpoint, MANAGER_URL);
        http.get(url.href, { timeout: 3000 }, (resp) => {
            let data = "";
            resp.on("data", (c) => { data += c; });
            resp.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    parsed._latency = Date.now() - start;
                    resolve(parsed);
                } catch { reject(new Error("Invalid JSON")); }
            });
        }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("Timeout")); });
    });
}

function deriveDecision(action, model) {
    if (model.overallHealth >= 0.9) return { action: "maintain", note: "System healthy — continue auto-success mode" };
    if (model.overallHealth >= 0.5) return { action: "investigate", note: "Degraded — check unhealthy services" };
    return { action: "escalate", note: "Critical — immediate attention required" };
}

function identifyBlindSpots(model, lensData) {
    const spots = [];
    if (!model.lastPoll) spots.push("Conductor has not polled yet");
    if (!lensData?.memory) spots.push("Lens memory unavailable for comparison");
    if (Object.values(model.services).some(s => !s.healthy)) {
        const down = Object.entries(model.services).filter(([, s]) => !s.healthy).map(([n]) => n);
        spots.push(`Services down: ${down.join(", ")}`);
    }
    return spots.length > 0 ? spots : ["No blind spots detected"];
}

module.exports = router;
