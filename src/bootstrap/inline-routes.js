/**
 * ∞ Inline Routes — Phase 8 Bootstrap
 * Extracted from heady-manager.js
 * Health, pulse, layer management, CSL gates, edge proxy, telemetry, principles
 */
const fs = require('fs');
const path = require('path');
const fetch = require('../core/heady-fetch').heady_fetch;

module.exports = function mountInlineRoutes(app, { logger, secretsManager, cfManager, authEngine, _engines }) {
    const structuredLog = require('../structured-logger');

    // Kubernetes liveness probe
    app.get("/healthz", (_req, res) => {
        const mem = process.memoryUsage();
        const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
        const ok = heapUsed < heapTotal * 0.95;
        res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", uptime: Math.round(process.uptime()), heap: `${heapUsed}/${heapTotal}MB`, ts: new Date().toISOString() });
    });

    // A2A Agent Card
    app.get("/.well-known/agent.json", (_req, res) => {
        try { res.json(JSON.parse(fs.readFileSync(path.join(__dirname, "../../public/.well-known/agent.json"), "utf-8"))); }
        catch { res.status(404).json({ error: "Agent card not configured" }); }
    });

    app.get("/api/health", (req, res) => res.json({ status: "ok", service: "heady-manager", timestamp: new Date().toISOString() }));

    // Layer Management
    const LAYERS = {
        "local": { name: "Local Dev", endpoint: "https://headyme.com" },
        "cloud-me": { name: "Cloud HeadyMe", endpoint: "https://headyme.com" },
        "cloud-sys": { name: "Cloud HeadySystems", endpoint: "https://headyme.com" },
        "cloud-conn": { name: "Cloud HeadyConnection", endpoint: "https://headyme.com" },
        "hf-liquid": { name: "HF Space Liquid Node", endpoint: "https://headyme-heady-hf-liquid-node.hf.space" },
        "hybrid": { name: "Hybrid", endpoint: "https://headyme.com" },
    };
    let activeLayer = "local";

    app.get("/api/layer", (req, res) => res.json({ active: activeLayer, endpoint: LAYERS[activeLayer]?.endpoint || "", ts: new Date().toISOString() }));
    app.post("/api/layer/switch", (req, res) => {
        const newLayer = req.body.layer;
        if (!LAYERS[newLayer]) return res.status(400).json({ error: "Invalid layer" });
        activeLayer = newLayer;
        res.json({ success: true, layer: newLayer, endpoint: LAYERS[newLayer].endpoint, ts: new Date().toISOString() });
    });

    // Pulse
    app.get("/api/pulse", (req, res) => {
        res.json({
            ok: true, service: "heady-manager", version: "3.0.0", ts: new Date().toISOString(), status: "active", active_layer: activeLayer,
            secrets: secretsManager ? secretsManager.getSummary() : null,
            cloudflare: cfManager ? { tokenValid: cfManager.isTokenValid() } : null
        });
    });

    // Edge Proxy
    const EDGE_PROXY_URL = process.env.HEADY_EDGE_PROXY_URL || 'https://heady-edge-proxy.emailheadyconnection.workers.dev';
    app.get("/api/edge/status", async (req, res) => {
        try {
            const [healthRes, detRes] = await Promise.allSettled([
                fetch(`${EDGE_PROXY_URL}/v1/health`, { signal: AbortSignal.timeout(3000) }),
                fetch(`${EDGE_PROXY_URL}/v1/determinism`, { signal: AbortSignal.timeout(3000) }),
            ]);
            res.json({
                ok: true, service: 'heady-edge-proxy', edge_url: EDGE_PROXY_URL,
                health: healthRes.status === 'fulfilled' ? await healthRes.value.json() : { error: 'unreachable' },
                determinism: detRes.status === 'fulfilled' ? await detRes.value.json() : { error: 'unreachable' },
                ts: new Date().toISOString()
            });
        } catch (err) { res.status(503).json({ ok: false, error: 'Edge proxy unreachable', message: err.message }); }
    });

    // Telemetry
    app.get("/api/telemetry/recent", (req, res) => res.json({ ok: true, entries: structuredLog.getTelemetry ? structuredLog.getTelemetry(parseInt(req.query.limit) || 50) : [] }));
    app.get("/api/telemetry/stats", (req, res) => res.json({ ok: true, stats: structuredLog.getTelemetryStats ? structuredLog.getTelemetryStats() : {} }));

    // OpenAI Business
    app.get("/api/openai/business", (req, res) => {
        res.json({ ok: true, plan: "business", org_id: process.env.OPENAI_ORG_ID || "not_configured", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"] });
    });

    // CSL Gates
    const CSL = require('../core/semantic-logic');
    app.post('/api/csl/resonance', (req, res) => {
        const { vec_a, vec_b, threshold } = req.body;
        if (!vec_a || !vec_b) return res.status(400).json({ ok: false, error: 'vec_a and vec_b required' });
        res.json({ ok: true, gate: 'resonance', ...CSL.resonance_gate(vec_a, vec_b, threshold || 0.95) });
    });
    app.post('/api/csl/superposition', (req, res) => {
        const { vec_a, vec_b, weight } = req.body;
        if (!vec_a || !vec_b) return res.status(400).json({ ok: false, error: 'vec_a and vec_b required' });
        const hybrid = weight != null ? CSL.weighted_superposition(vec_a, vec_b, weight) : CSL.superposition_gate(vec_a, vec_b);
        res.json({ ok: true, gate: 'superposition', hybrid: Array.from(hybrid), dimensions: hybrid.length });
    });
    app.post('/api/csl/orthogonal', (req, res) => {
        const { target, reject } = req.body;
        if (!target || !reject) return res.status(400).json({ ok: false, error: 'target and reject required' });
        const purified = Array.isArray(reject[0]) ? CSL.batch_orthogonal(target, reject) : CSL.orthogonal_gate(target, reject);
        res.json({ ok: true, gate: 'orthogonal', purified: Array.from(purified), dimensions: purified.length });
    });
    app.get('/api/csl/status', (req, res) => res.json({ ok: true, service: 'heady-csl', gates: ['resonance', 'superposition', 'orthogonal'], stats: CSL.getStats() }));

    // Self-Awareness + Branding + Principles
    try {
        const selfAwareness = require('../self-awareness');
        if (selfAwareness) {
            selfAwareness.startBrandingMonitor();
            app.get('/api/introspection', (req, res) => res.json(selfAwareness.getSystemIntrospection()));
            app.get('/api/branding', (req, res) => res.json(selfAwareness.getBrandingReport()));
        }
    } catch { }

    try {
        const hp = require('../heady-principles');
        app.get('/api/principles', (req, res) => res.json({
            node: 'heady-principles', constants: { PHI: hp.PHI, BASE: hp.BASE, LOG_BASE: hp.LOG_BASE },
            designTokens: hp.designTokens(8), capacity: hp.capacityParams('medium'), fibonacci: hp.FIB.slice(0, 13),
        }));
    } catch { }

    // Sentry error handler + global error handler + 404
    try { const sentry = require('../services/sentry'); app.use(sentry.errorHandler()); } catch { }

    app.use((err, req, res, _next) => {
        const status = err.status || 500;
        logger.logNodeActivity("ERROR_HANDLER", `${req.method} ${req.originalUrl} → ${status}: ${err.message}`);
        res.status(status).json({ ok: false, error: err.message || 'Internal Server Error', status, path: req.originalUrl, timestamp: new Date().toISOString() });
    });

    app.use((req, res) => {
        res.status(404).json({ ok: false, error: 'Not Found', path: req.originalUrl, hint: 'Try GET /api/health', timestamp: new Date().toISOString() });
    });
};
