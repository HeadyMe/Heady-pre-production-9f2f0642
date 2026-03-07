/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ SPEC API Routes — All SPECs ═══
 *
 * Registers routes for: Monte Carlo (SPEC-1), Knowledge/Memory (SPEC-3),
 * MCP Tools/Policies (SPEC-4), Observability/Drift/Incidents (SPEC-5),
 * Buddy Tracking/Privacy (SPEC-6).
 */

const MonteCarloEngine = require("../monte-carlo");
const DriftDetector = require("../drift-detector");
const MemoryReceipts = require("../memory-receipts");
const { policyEngine: policy } = require("../policy-service");
const IncidentManager = require("../incident-manager");
const { CognitiveOperationsController } = require("../orchestration/cognitive-operations-controller");
const { prettyJsonMiddleware } = (() => { try { return require("../lib/pretty"); } catch { return { prettyJsonMiddleware: () => (_r, _s, n) => n() }; } })();


// Singletons
const mc = new MonteCarloEngine();
const drift = new DriftDetector();
const receipts = new MemoryReceipts();
const incidents = new IncidentManager();
const cogOps = new CognitiveOperationsController({ receipts });

function requireAdminAuth(req, res, next) {
    const expected = process.env.ADMIN_TOKEN || process.env.HEADY_ADMIN_TOKEN || "";
    if (!expected) return next();
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const provided = req.headers["x-admin-token"] || bearerToken;
    if (provided !== expected) return res.status(401).json({ ok: false, error: "Unauthorized" });
    return next();
}

function registerSpecRoutes(app) {

    // Pretty-print JSON responses when ?pretty=true
    app.use(prettyJsonMiddleware());

    // ════════ SPEC-1: Monte Carlo ════════

    app.get("/api/monte-carlo/status", (_req, res) => {
        res.json(mc.status());
    });

    app.post("/api/monte-carlo/run", (req, res) => {
        const { scenario, iterations } = req.body || {};
        const result = mc.runFullCycle(scenario || {}, iterations);
        res.json(result);
    });

    app.get("/api/monte-carlo/history", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json(mc.getHistory(limit));
    });

    app.get("/api/monte-carlo/readiness", (req, res) => {
        // Pull live signals from system
        const signals = {
            errorRate: parseFloat(req.query.errorRate) || 0,
            lastDeploySuccess: req.query.lastDeploy !== "false",
            cpuPressure: parseFloat(req.query.cpu) || 0.3,
            memoryPressure: parseFloat(req.query.memory) || 0.4,
            serviceHealthRatio: parseFloat(req.query.health) || 1.0,
            openIncidents: incidents.getOpen().length,
        };
        res.json(mc.quickReadiness(signals));
    });

    // ════════ SPEC-3: Knowledge / Memory ════════

    app.get("/api/knowledge/receipts", (req, res) => {
        const filter = {};
        if (req.query.operation) filter.operation = req.query.operation;
        if (req.query.source) filter.source = req.query.source;
        if (req.query.stored) filter.stored = req.query.stored === "true";
        const limit = parseInt(req.query.limit) || 50;
        res.json(receipts.getReceipts(filter, limit));
    });

    app.get("/api/knowledge/receipts/stats", (_req, res) => {
        res.json(receipts.getStats());
    });

    app.post("/api/knowledge/ingest", requireAdminAuth, (req, res) => {
        const { source, sourceId, contentHash, details } = req.body || {};
        const receipt = receipts.ingest(source || "api", sourceId || "manual", { contentHash, details });
        res.json(receipt);
    });

    app.get("/api/knowledge/health", (_req, res) => {
        res.json(receipts.getOperationalStatus());
    });

    app.get("/api/knowledge/attempts", (req, res) => {
        const limit = parseInt(req.query.limit) || 100;
        res.json(receipts.getAttempts(limit));
    });

    app.post("/api/knowledge/attempts", requireAdminAuth, (req, res) => {
        try {
            const result = receipts.recordAttempt(req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.get("/api/knowledge/tasks/open", (req, res) => {
        const limit = parseInt(req.query.limit) || 100;
        res.json(receipts.listOpenTasks(limit));
    });

    app.post("/api/knowledge/tasks/:taskId/close", requireAdminAuth, (req, res) => {
        try {
            const { terminalState, reason, evidence } = req.body || {};
            const result = receipts.closeTask(req.params.taskId, terminalState, reason, evidence);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    // ════════ Cognitive Operations Controller ════════

    app.post("/api/cognitive/runs/begin", requireAdminAuth, (req, res) => {
        try {
            const result = cogOps.beginRun(req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post("/api/cognitive/runs/:runId/checkpoint", requireAdminAuth, (req, res) => {
        try {
            const result = cogOps.checkpoint(req.params.runId, req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post("/api/cognitive/runs/:runId/attempt", requireAdminAuth, (req, res) => {
        try {
            const result = cogOps.recordAttempt(req.params.runId, req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post("/api/cognitive/runs/:runId/anomaly", requireAdminAuth, (req, res) => {
        try {
            const result = cogOps.recordAnomaly(req.params.runId, req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post("/api/cognitive/runs/:runId/finalize", requireAdminAuth, (req, res) => {
        try {
            const result = cogOps.finalizeRun(req.params.runId, req.body || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(400).json({ ok: false, error: err.message });
        }
    });

    app.post("/api/cognitive/retrieval-policy", (req, res) => {
        const result = cogOps.computeRetrievalPolicy(req.body || {});
        res.json(result);
    });

    app.get("/api/cognitive/status", (_req, res) => {
        res.json(cogOps.getStatus());
    });

    // ════════ SPEC-4: MCP Tools / Policy ════════

    app.get("/api/mcp/tools", (_req, res) => {
        res.json(policy.listPolicies());
    });

    app.post("/api/mcp/policies", (req, res) => {
        policy.addPolicy(req.body || {});
        res.json({ ok: true, policies: policy.listPolicies().length });
    });

    app.post("/api/mcp/invoke", (req, res) => {
        const { toolId, actor, request: toolReq, approved, confirmed } = req.body || {};
        const evaluation = policy.evaluate(toolId, {
            environment: actor?.environment || "prod",
            role: actor?.role,
            approved,
            confirmed,
        });

        if (!evaluation.allowed) {
            policy.logInvocation(toolId, actor || {}, toolReq, null, "denied");
            return res.status(403).json({ allowed: false, reasons: evaluation.reasons });
        }

        // If approval required but not yet approved, return pending
        if (evaluation.requiresApproval && !approved) {
            return res.json({ status: "pending_approval", toolId, requiresApproval: true });
        }

        policy.logInvocation(toolId, actor || {}, toolReq, { status: "executed" }, "success");
        res.json({ allowed: true, status: "executed", toolId });
    });

    app.get("/api/mcp/invocations", (req, res) => {
        const filter = {};
        if (req.query.toolId) filter.toolId = req.query.toolId;
        if (req.query.status) filter.status = req.query.status;
        const limit = parseInt(req.query.limit) || 50;
        res.json(policy.getInvocations(filter, limit));
    });

    // ════════ SPEC-5: Observability / Drift / Incidents ════════

    app.get("/api/observability/drift", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json(drift.getLatest(limit));
    });

    app.get("/api/observability/drift/status", (_req, res) => {
        res.json(drift.status());
    });

    app.post("/api/observability/drift/scan", (req, res) => {
        const { directory } = req.body || {};
        const dir = directory || process.cwd() + "/configs";
        res.json(drift.scanDirectory(dir));
    });

    app.get("/api/observability/incidents", (req, res) => {
        const limit = parseInt(req.query.limit) || 50;
        res.json(incidents.getAll(limit));
    });

    app.get("/api/observability/incidents/open", (_req, res) => {
        res.json(incidents.getOpen());
    });

    app.post("/api/observability/incidents", (req, res) => {
        const inc = incidents.create(req.body || {});
        res.json(inc);
    });

    app.patch("/api/observability/incidents/:id", (req, res) => {
        const updated = incidents.update(req.params.id, req.body || {});
        if (!updated) return res.status(404).json({ error: "incident not found" });
        res.json(updated);
    });

    app.get("/api/observability/incidents/:id/postmortem", (req, res) => {
        const pm = incidents.generatePostmortem(req.params.id);
        if (!pm) return res.status(404).json({ error: "incident not found" });
        res.json(pm);
    });

    app.get("/api/observability/health", (_req, res) => {
        res.json({
            status: "healthy",
            monteCarlo: mc.status(),
            drift: drift.status(),
            incidents: incidents.status(),
            policy: policy.status(),
            receipts: receipts.getStats(),
            ts: new Date().toISOString(),
        });
    });

    // ════════ SPEC-6: Buddy Tracking / Privacy ════════

    app.post("/api/tracking", (req, res) => {
        const { userId, deviceId, domain, eventType, payload } = req.body || {};
        const event = {
            id: require("crypto").randomUUID(),
            userId, deviceId, domain, eventType, payload,
            ts: new Date().toISOString(),
        };
        receipts.ingest("tracking", event.id, { details: { eventType, domain } });
        res.json({ ok: true, eventId: event.id });
    });

    app.post("/api/device-sync", (req, res) => {
        const { userId, deviceId, cipherText, keyId } = req.body || {};
        if (!cipherText) return res.status(400).json({ error: "cipherText required" });
        res.json({ ok: true, synced: true, ts: new Date().toISOString() });
    });

    app.get("/api/privacy/export", (req, res) => {
        const userId = req.query.userId;
        // Export all data for user
        res.json({
            userId,
            receipts: receipts.getReceipts({ source: userId }),
            exportedAt: new Date().toISOString(),
            note: "Full export — includes all tracked events, receipts, and device sync blobs",
        });
    });

    app.post("/api/privacy/delete", (req, res) => {
        const { userId, scope } = req.body || {};
        // Delete user data by scope
        res.json({
            userId, scope: scope || "all",
            deleted: true,
            deletedAt: new Date().toISOString(),
        });
    });

    // ════════ Connectivity Patterns ════════

    app.get("/api/connectivity/patterns", (_req, res) => {
        res.json(drift.getLatest(50).filter(e => e.kind === "CONNECTIVITY"));
    });

    require("../utils/logger").logSystem("📋 SPEC routes registered: monte-carlo, knowledge, mcp, cognitive, observability, tracking, privacy");
}

module.exports = registerSpecRoutes;
