/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
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
const https = require("https");

const MANAGER_URL = process.env.HEADY_MANAGER_URL || "https://127.0.0.1:3301";
const LENS_SOURCE_OF_TRUTH_ENDPOINT = "/api/lens/source-of-truth?refresh=1";
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
    "auto-success": "/api/auto-success/health",
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
    let sourceOfTruth = "direct-polling";

    // Prefer HeadyLens as canonical realtime monitoring source.
    try {
        const lensTruth = await fetchLocal(LENS_SOURCE_OF_TRUTH_ENDPOINT);
        const services = lensTruth?.realtime?.services;
        if (Array.isArray(services) && services.length > 0) {
            sourceOfTruth = "heady-lens";
            for (const svc of services) {
                const serviceName = String(svc.service || "").replace(/^heady-/, "");
                if (!serviceName) continue;
                results[serviceName] = {
                    status: svc.status || (svc.healthy ? "OK" : "DEGRADED"),
                    healthy: !!svc.healthy,
                    latencyMs: svc.latencyMs ?? null,
                    error: svc.error || null,
                    source: "heady-lens",
                };
            }
            total = Object.keys(results).length;
            healthy = Object.values(results).filter(s => s.healthy).length;
        }
    } catch {
        sourceOfTruth = "direct-polling-fallback";
    }

    // Fallback path: direct service polling only if Lens truth is unavailable.
    if (total === 0) {
        for (const [name, endpoint] of Object.entries(SERVICE_ENDPOINTS)) {
            total++;
            try {
                const data = await fetchLocal(endpoint);
                results[name] = { status: data.status || "OK", healthy: true, latencyMs: data._latency, source: "conductor-direct" };
                healthy++;
            } catch (err) {
                results[name] = { status: "DOWN", healthy: false, error: err.message, source: "conductor-direct" };
            }
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
        perspective: systemModel.perspective,
        sourceOfTruth,
        ts: systemModel.lastPoll,
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
    let lensTruth = null;
    try {
        lensData = await fetchLocal("/api/lens/memory");
    } catch { lensData = { error: "Lens unreachable" }; }

    try {
        lensTruth = await fetchLocal("/api/lens/source-of-truth");
    } catch {
        lensTruth = { error: "Lens source-of-truth unavailable" };
    }

    const comparison = {
        conductor: {
            perspective: systemModel.perspective,
            overallHealth: systemModel.overallHealth,
            trackedServices: Object.keys(systemModel.services).length,
            healthyServices: Object.values(systemModel.services).filter(s => s.healthy).length,
            lastPoll: systemModel.lastPoll,
        },
        lens: {
            sourceOfTruth: lensTruth,
            memory: lensData,
        },
        synthesis: {
            agreement: lensTruth?.realtime ? "lens-is-source-of-truth" : "lens-unavailable",
            blindSpots: identifyBlindSpots(systemModel, lensTruth),
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

// ─── Auto-Success Task Orchestration Awareness ──────────────────────
let _autoSuccessEngine = null;

function bindAutoSuccess(engine) {
    _autoSuccessEngine = engine;
    // Wire cycle completions into conductor log
    engine.on("cycle:completed", (evt) => {
        const entry = {
            id: `conductor-as-${Date.now()}`, action: "auto-success-cycle",
            cycle: evt.cycle, tasksRun: evt.tasksRun,
            succeeded: evt.succeeded, durationMs: evt.durationMs,
            safeMode: evt.safeMode, ts: evt.ts,
        };
        conductorLog.push(entry);
        if (conductorLog.length > 200) conductorLog.splice(0, conductorLog.length - 200);
    });
}

router.get("/tasks", (req, res) => {
    if (!_autoSuccessEngine) {
        return res.json({
            ok: true, service: "heady-conductor", tasks: null,
            note: "Auto-Success engine not wired to Conductor",
            ts: new Date().toISOString(),
        });
    }
    const summary = _autoSuccessEngine.getConductorSummary();
    res.json({
        ok: true, service: "heady-conductor",
        perspective: systemModel.perspective,
        overallHealth: systemModel.overallHealth,
        autoSuccess: summary,
        ts: new Date().toISOString(),
    });
});

// ── Helpers ──
function fetchLocal(endpoint) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const url = new URL(endpoint, MANAGER_URL);
        const client = url.protocol === "https:" ? https : http;
        const req = client.request({
            hostname: url.hostname,
            port: url.port || (url.protocol === "https:" ? 443 : 80),
            path: `${url.pathname}${url.search}`,
            method: "GET",
            timeout: 3000,
            rejectUnauthorized: false,
        }, (resp) => {
            let data = "";
            resp.on("data", (c) => { data += c; });
            resp.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    parsed._latency = Date.now() - start;
                    resolve(parsed);
                } catch { reject(new Error("Invalid JSON")); }
            });
        });

        req.on("error", reject);
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
        });
        req.end();
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
    if (!lensData?.realtime) spots.push("Lens source-of-truth unavailable for comparison");
    if (Object.values(model.services).some(s => !s.healthy)) {
        const down = Object.entries(model.services).filter(([, s]) => !s.healthy).map(([n]) => n);
        spots.push(`Services down: ${down.join(", ")}`);
    }
    return spots.length > 0 ? spots : ["No blind spots detected"];
}

module.exports = router;
module.exports.bindAutoSuccess = bindAutoSuccess;
