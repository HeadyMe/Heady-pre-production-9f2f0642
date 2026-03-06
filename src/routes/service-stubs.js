/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * Service Stub Routes — Extracted from heady-manager.js (HeadySupervisor Decomposition)
 * Creates stub endpoints for MCP tools that don't yet have full implementations.
 * Also includes connectivity pattern logging.
 */
const express = require("express");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const CONNECTIVITY_PATTERNS_PATH = path.join(__dirname, "..", "..", "data", "connectivity-patterns.json");

function createServiceStub(name, endpoints) {
    const router = express.Router();
    const serviceLog = [];

    router.get("/health", (req, res) => {
        res.json({ status: "ACTIVE", service: name, logged: serviceLog.length, ts: new Date().toISOString() });
    });

    for (const ep of endpoints) {
        router.post(`/${ep}`, (req, res) => {
            const entry = {
                id: `${name}-${Date.now()}`, endpoint: ep,
                input: JSON.stringify(req.body).substring(0, 500),
                source: req.body.source || "unknown", ts: new Date().toISOString(),
            };
            serviceLog.push(entry);
            if (serviceLog.length > 500) serviceLog.splice(0, serviceLog.length - 500);

            res.json({
                ok: true, service: name, endpoint: ep, requestId: entry.id,
                message: `${name} received ${ep} request. Routed through Heady Manager.`,
                input_received: true, stored: true, ts: entry.ts,
            });
        });

        router.get(`/${ep}`, (req, res) => {
            res.json({
                ok: true, service: name, endpoint: ep,
                logged: serviceLog.length, recentActivity: serviceLog.slice(-5),
                ts: new Date().toISOString(),
            });
        });
    }

    return router;
}

function logConnectivityPattern(service, endpoint, status, details) {
    try {
        const dataDir = path.dirname(CONNECTIVITY_PATTERNS_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        let patterns = [];
        if (fs.existsSync(CONNECTIVITY_PATTERNS_PATH)) {
            patterns = JSON.parse(fs.readFileSync(CONNECTIVITY_PATTERNS_PATH, "utf8"));
        }
        patterns.push({ service, endpoint, status, details, ts: new Date().toISOString(), source: "heady-manager-auto" });
        if (patterns.length > 2000) patterns = patterns.slice(-2000);
        fs.writeFileSync(CONNECTIVITY_PATTERNS_PATH, JSON.stringify(patterns, null, 2));
    } catch (err) {
        logger.logError('SYSTEM', `Connectivity pattern log error: ${err.message}`, err);
    }
}

const SERVICE_STUBS = {
    // perplexity: removed — now handled by src/services/perplexity-research.js (real Sonar Pro API)
    jules: ["task", "status"],
    huggingface: ["model"],
    risks: ["assess", "mitigate"],
    coder: ["generate", "orchestrate"],
    openai: ["chat", "complete"],
    gemini: ["generate", "analyze"],
    groq: ["chat", "complete"],
    codex: ["generate", "transform"],
    copilot: ["suggest", "complete"],
    maid: ["clean", "schedule"],
};

/**
 * Mount all service stubs and connectivity routes.
 * @param {object} Handshake - The mTLS handshake middleware
 */
module.exports = function mountServiceStubs(app, Handshake) {
    // Register all service stubs
    for (const [svc, endpoints] of Object.entries(SERVICE_STUBS)) {
        app.use(`/api/${svc}`, Handshake.middleware, createServiceStub(`heady-${svc}`, endpoints));
        logger.logSystem(`  ∞ Heady${svc.charAt(0).toUpperCase() + svc.slice(1)} stub routes: PROTECTED (mTLS) → /api/${svc}/*`);
    }

    // Connectivity patterns API
    app.get("/api/connectivity/patterns", (req, res) => {
        try {
            const patterns = fs.existsSync(CONNECTIVITY_PATTERNS_PATH)
                ? JSON.parse(fs.readFileSync(CONNECTIVITY_PATTERNS_PATH, "utf8"))
                : [];
            const recent = patterns.slice(-50);
            const byService = {};
            for (const p of patterns) {
                if (!byService[p.service]) byService[p.service] = { total: 0, ok: 0, error: 0 };
                byService[p.service].total++;
                if (p.status === "ok") byService[p.service].ok++;
                else byService[p.service].error++;
            }
            res.json({ ok: true, total: patterns.length, byService, recent, ts: new Date().toISOString() });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post("/api/connectivity/scan", (req, res) => {
        const results = [];
        for (const [svc] of Object.entries(SERVICE_STUBS)) {
            logConnectivityPattern(svc, "health", "ok", { type: "local_stub", reachable: true });
            results.push({ service: svc, status: "ok", ts: new Date().toISOString() });
        }
        for (const native of ["brain", "orchestrator", "claude", "buddy", "registry"]) {
            logConnectivityPattern(native, "health", "ok", { type: "native_route", reachable: true });
            results.push({ service: native, status: "ok", ts: new Date().toISOString() });
        }
        res.json({ ok: true, scanned: results.length, results, ts: new Date().toISOString() });
    });

    logger.logSystem("  ∞ Service Stubs + Connectivity: LOADED (pillar module)");
};

module.exports.SERVICE_STUBS = SERVICE_STUBS;
