/**
 * Health, Pulse, and Layer Management Routes
 * Kubernetes-style health probes + layer switching + pulse endpoint.
 *
 * Extracted from heady-manager.js for modularity (Phase 2 God Class decomposition).
 */
const fs = require('fs');
const path = require('path');

const LAYERS = {
    "local": { name: "Local Dev", endpoint: "https://headyme.com" },
    "cloud-me": { name: "Cloud HeadyMe", endpoint: "https://headyme.com" },
    "cloud-sys": { name: "Cloud HeadySystems", endpoint: "https://headyme.com" },
    "cloud-conn": { name: "Cloud HeadyConnection", endpoint: "https://headyme.com" },
    "hf-liquid": { name: "HF Space Liquid Node", endpoint: "https://headyme-heady-hf-liquid-node.hf.space" },
    "hybrid": { name: "Hybrid", endpoint: "https://headyme.com" },
};

let activeLayer = "local";

function registerHealthAndLayerRoutes(app, deps = {}) {
    const { secretsManager, cfManager } = deps;

    // Kubernetes-Standard Liveness Probe
    app.get("/healthz", (_req, res) => {
        const mem = process.memoryUsage();
        const heapUsed = Math.round(mem.heapUsed / 1024 / 1024);
        const heapTotal = Math.round(mem.heapTotal / 1024 / 1024);
        const ok = heapUsed < heapTotal * 0.95;
        res.status(ok ? 200 : 503).json({
            status: ok ? "ok" : "degraded",
            uptime: Math.round(process.uptime()),
            heap: `${heapUsed}/${heapTotal}MB`,
            ts: new Date().toISOString(),
        });
    });

    // A2A Agent Card
    app.get("/.well-known/agent.json", (_req, res) => {
        try {
            const card = JSON.parse(fs.readFileSync(path.join(deps.projectRoot || __dirname, "public/.well-known/agent.json"), "utf-8"));
            res.json(card);
        } catch {
            res.status(404).json({ error: "Agent card not configured" });
        }
    });

    app.get("/api/health", (_req, res) => {
        res.json({ status: "ok", service: "heady-manager", timestamp: new Date().toISOString() });
    });

    app.get("/api/pulse", (_req, res) => {
        res.json({
            ok: true,
            service: "heady-manager",
            version: "3.0.0-rc4",
            ts: new Date().toISOString(),
            status: "active",
            active_layer: activeLayer,
            layer_endpoint: LAYERS[activeLayer]?.endpoint || "",
            secrets: secretsManager ? secretsManager.getSummary() : null,
            cloudflare: cfManager ? { tokenValid: cfManager.isTokenValid() } : null,
        });
    });

    // Layer Management
    app.get("/api/layer", (_req, res) => {
        res.json({ active: activeLayer, endpoint: LAYERS[activeLayer]?.endpoint || "", ts: new Date().toISOString() });
    });

    app.post("/api/layer/switch", (req, res) => {
        const newLayer = req.body.layer;
        if (!LAYERS[newLayer]) return res.status(400).json({ error: "Invalid layer" });
        activeLayer = newLayer;
        res.json({ success: true, layer: newLayer, endpoint: LAYERS[newLayer].endpoint, ts: new Date().toISOString() });
    });
}

module.exports = { registerHealthAndLayerRoutes, LAYERS };
