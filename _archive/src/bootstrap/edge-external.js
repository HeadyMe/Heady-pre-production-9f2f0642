/**
 * Edge Proxy and External Integration Routes
 * Cloudflare Edge proxy status + ChatGPT Business + Introspection + Principles.
 *
 * Extracted from heady-manager.js for modularity (Phase 2 God Class decomposition).
 */
const fs = require('fs');
const logger = require('../utils/logger');

const EDGE_PROXY_URL = process.env.HEADY_EDGE_PROXY_URL || 'https://heady-edge-proxy.emailheadyconnection.workers.dev';

function registerEdgeAndExternalRoutes(app, deps = {}) {
    const { selfAwareness } = deps;

    // Edge Proxy Status
    app.get("/api/edge/status", async (_req, res) => {
        try {
            const [healthRes, detRes] = await Promise.allSettled([
                fetch(`${EDGE_PROXY_URL}/v1/health`, { signal: AbortSignal.timeout(3000) }),
                fetch(`${EDGE_PROXY_URL}/v1/determinism`, { signal: AbortSignal.timeout(3000) }),
            ]);

            const health = healthRes.status === 'fulfilled' ? await healthRes.value.json() : { error: 'unreachable' };
            const determinism = detRes.status === 'fulfilled' ? await detRes.value.json() : { error: 'unreachable' };

            res.json({
                ok: true, service: 'heady-edge-proxy', edge_url: EDGE_PROXY_URL,
                health, determinism: determinism.determinism || determinism,
                ts: new Date().toISOString(),
            });
        } catch (err) {
            res.status(503).json({ ok: false, error: 'Edge proxy unreachable', message: err.message });
        }
    });

    // ChatGPT Business Plan Integration
    app.get("/api/openai/business", (_req, res) => {
        res.json({
            ok: true, plan: "business",
            org_id: process.env.OPENAI_ORG_ID || "not_configured",
            workspace_id: process.env.OPENAI_WORKSPACE_ID || "not_configured",
            seats: (process.env.OPENAI_BUSINESS_SEATS || "").split(",").filter(Boolean),
            capabilities: { codex_cli: process.env.OPENAI_CODEX_ENABLED === "true", connectors: process.env.OPENAI_CONNECTORS_ENABLED === "true", github_connector: process.env.OPENAI_GITHUB_CONNECTOR === "true", gpt_builder: true, custom_apps: true },
            api_headers: { "OpenAI-Organization": process.env.OPENAI_ORG_ID, "OpenAI-Project": process.env.OPENAI_WORKSPACE_ID },
            domain_verification: { domain: "headysystems.com", status: "verified" },
            models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini", "dall-e-3"],
        });
    });

    // Self-Awareness Endpoints
    if (selfAwareness) {
        try {
            selfAwareness.startBrandingMonitor();
            app.get('/api/introspection', (_req, res) => res.json(selfAwareness.getSystemIntrospection()));
            app.get('/api/branding', (_req, res) => res.json(selfAwareness.getBrandingReport()));
            logger.logNodeActivity("CONDUCTOR", "  ∞ Branding Monitor: STARTED");
        } catch (err) {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ Branding routes not loaded: ${err.message}`);
        }
    }

    // Heady Principles
    try {
        const hp = require('../heady-principles');
        app.get('/api/principles', (_req, res) => res.json({
            node: 'heady-principles',
            role: 'Mathematical foundation — base-13, log42, golden ratio',
            constants: { PHI: hp.PHI, PHI_INV: hp.PHI_INV, PHI_PCT: hp.PHI_PCT, BASE: hp.BASE, LOG_BASE: hp.LOG_BASE, HEADY_UNIT: hp.HEADY_UNIT, HEADY_CYCLE: hp.HEADY_CYCLE },
            designTokens: hp.designTokens(8),
            capacity: hp.capacityParams('medium'),
            thresholds: hp.phiThresholds(8),
            fibonacci: hp.FIB.slice(0, 13),
        }));
        logger.logNodeActivity("CONDUCTOR", `  ∞ Heady Principles: /api/principles (φ=${hp.PHI.toFixed(3)})`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Principles not loaded: ${err.message}`);
    }

    // Models API
    try {
        const modelsApiRouter = require('../routes/models-api');
        app.use('/api', modelsApiRouter);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Models router not loaded: ${err.message}`);
    }
}

module.exports = { registerEdgeAndExternalRoutes };
