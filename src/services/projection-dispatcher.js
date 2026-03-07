/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ ProjectionDispatcher                                     ║
 * ║  Phase 1 Iron Hull — Extracted from heady-manager.js              ║
 * ║  Owns: Projection Engine, Domain Router, Site Renderer,           ║
 * ║        Bee Swarm, Digital Presence, Layer Management,             ║
 * ║        Deployment Targets (Cloud Run, HF Spaces, Edge)            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const logger = require("../utils/logger");
const { EventEmitter } = require('events');

const LAYERS = {
    "local": { name: "Local Dev", endpoint: "https://headyme.com" },
    "cloud-me": { name: "Cloud HeadyMe", endpoint: "https://headyme.com" },
    "cloud-sys": { name: "Cloud HeadySystems", endpoint: "https://headyme.com" },
    "cloud-conn": { name: "Cloud HeadyConnection", endpoint: "https://headyme.com" },
    "hf-liquid": { name: "HF Space Liquid Node", endpoint: "https://headyme-heady-hf-liquid-node.hf.space" },
    "hybrid": { name: "Hybrid", endpoint: "https://headyme.com" }
};

class ProjectionDispatcher extends EventEmitter {
    constructor() {
        super();
        this.activeLayer = "local";
        this.projectionEngine = null;
        this.projectionGovernance = null;
        this.domainRouter = null;
        this.uiRegistry = null;
        this.llmRouter = null;
        this.autonomousScheduler = null;
        this.swarmIgnition = null;
        this.beeTemplateRegistry = null;
        this.swarmConsensus = null;
        this.digitalPresence = null;
        this.beeRegistry = null;
        this.buddySystem = null;
        this.vectorServe = null;
    }

    /**
     * Boot all projection/dispatch subsystems.
     * @param {Object} opts - { vectorMemory, eventBus }
     */
    boot(opts) {
        const { vectorMemory, eventBus } = opts;

        // ── Bee Swarm Discovery ──
        try {
            this.beeRegistry = require("../bees/registry");
            const beeCount = this.beeRegistry.discover();
            logger.logNodeActivity("PROJ_DISPATCH", `  🐝 Bee Swarm: ${beeCount} bees discovered`);
            const domains = this.beeRegistry.listDomains();
            const highPriority = domains.filter(d => d.priority >= 0.9).map(d => d.domain);
            logger.logNodeActivity("PROJ_DISPATCH", `    → High priority (≥0.9): ${highPriority.join(", ")}`);
            if (eventBus) eventBus.emit('bee_swarm:discovered', { count: beeCount, highPriority });
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Bee Swarm: discovery failed — ${err.message}`);
        }

        // ── Projection Engine ──
        try {
            this.projectionEngine = require("../services/projection-engine");
            logger.logNodeActivity("PROJ_DISPATCH", "  📡 Projection Engine: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Projection Engine not loaded: ${err.message}`);
        }

        // ── Projection Governance ──
        try {
            this.projectionGovernance = require("../services/projection-governance");
            logger.logNodeActivity("PROJ_DISPATCH", "  ⚖️  Projection Governance: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Projection Governance not loaded: ${err.message}`);
        }

        // ── Domain Router ──
        try {
            this.domainRouter = require("../services/domain-router");
            logger.logNodeActivity("PROJ_DISPATCH", "  🌍 Domain Router: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Domain Router not loaded: ${err.message}`);
        }

        // ── UI Registry ──
        try {
            this.uiRegistry = require("../services/ui-registry");
            logger.logNodeActivity("PROJ_DISPATCH", "  🎨 UI Registry: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ UI Registry not loaded: ${err.message}`);
        }

        // ── LLM Router (Multi-Model Task Routing) ──
        try {
            this.llmRouter = require("../services/llm-router");
            logger.logNodeActivity("PROJ_DISPATCH", "  🧠 LLM Router: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ LLM Router not loaded: ${err.message}`);
        }

        // ── Autonomous Scheduler ──
        try {
            this.autonomousScheduler = require("../services/autonomous-scheduler");
            this.autonomousScheduler.start();
            logger.logNodeActivity("PROJ_DISPATCH", "  ⏰ Autonomous Scheduler: STARTED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Autonomous Scheduler not started: ${err.message}`);
        }

        // ── Swarm Ignition ──
        try {
            this.swarmIgnition = require("../orchestration/swarm-ignition");
            this.swarmIgnition.igniteSwarm({ enablePruner: true, enableTester: true, enableEmbedder: true });
            logger.logNodeActivity("PROJ_DISPATCH", "  🐝 Swarm Ignition: IGNITED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Swarm Ignition not started: ${err.message}`);
        }

        // ── Swarm Consensus ──
        try {
            const { consensus } = require("../orchestration/swarm-consensus");
            this.swarmConsensus = consensus;
            this.swarmConsensus.startStaleCheck();
            logger.logNodeActivity("PROJ_DISPATCH", "  🔒 Swarm Consensus: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Swarm Consensus not loaded: ${err.message}`);
        }

        // ── Digital Presence Orchestrator ──
        try {
            this.digitalPresence = require("../services/digital-presence-orchestrator");
            logger.logNodeActivity("PROJ_DISPATCH", "  ∞ DigitalPresence: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ DigitalPresence not loaded: ${err.message}`);
        }

        // ── Vector-Serve ──
        if (vectorMemory) {
            try {
                const { VectorServe } = require("../vector-serve");
                this.vectorServe = new VectorServe(vectorMemory, logger);
                logger.logNodeActivity("PROJ_DISPATCH", "  🌐 Vector-Serve: LOADED");
            } catch (err) {
                logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Vector-Serve not loaded: ${err.message}`);
            }
        }

        // ── Buddy System ──
        try {
            this.buddySystem = require("../services/buddy-system");
            logger.logNodeActivity("PROJ_DISPATCH", "  ∞ BuddySystem: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ BuddySystem not loaded: ${err.message}`);
        }

        // ── Bee Template Registry ──
        try {
            this.beeTemplateRegistry = require("../bees/headybee-template-registry");
            logger.logNodeActivity("PROJ_DISPATCH", "  📋 Bee Template Registry: LOADED");
        } catch (err) {
            logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Bee Template Registry not loaded: ${err.message}`);
        }

        return this;
    }

    /**
     * Register all projection/dispatch routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app) {
        // Dynamic Site Renderer — Multi-Domain
        const { renderSite, resolveSite } = require("../sites/site-renderer");
        app.use((req, res, next) => {
            if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/_')) return next();
            const hostname = req.hostname || req.headers.host || "";
            if ((hostname.startsWith('manager.') || hostname.startsWith('admin.')) && req.path !== '/') return next();
            const site = resolveSite(hostname);
            if (req.path === '/' || req.path.startsWith('/v/')) {
                try {
                    const html = renderSite(site);
                    return res.send(html);
                } catch (err) {
                    logger.logNodeActivity("PROJ_DISPATCH", `  ⚠ Dynamic Site Render failed for ${hostname}: ${err.message}`);
                    return next();
                }
            }
            next();
        });

        // Projection Engine
        if (this.projectionEngine && this.projectionEngine.projectionRoutes) {
            this.projectionEngine.projectionRoutes(app);
        }

        // Projection Governance
        if (this.projectionGovernance && this.projectionGovernance.governanceRoutes) {
            this.projectionGovernance.governanceRoutes(app);
        }

        // Domain Router
        if (this.domainRouter && this.domainRouter.domainRouterRoutes) {
            this.domainRouter.domainRouterRoutes(app);
        }

        // UI Registry
        if (this.uiRegistry && this.uiRegistry.uiRegistryRoutes) {
            this.uiRegistry.uiRegistryRoutes(app);
        }

        // LLM Router
        if (this.llmRouter && this.llmRouter.llmRouterRoutes) {
            this.llmRouter.llmRouterRoutes(app);
        }

        // Scheduler routes
        if (this.autonomousScheduler && this.autonomousScheduler.schedulerRoutes) {
            this.autonomousScheduler.schedulerRoutes(app);
        }

        // Swarm Ignition
        if (this.swarmIgnition && this.swarmIgnition.swarmIgnitionRoutes) {
            this.swarmIgnition.swarmIgnitionRoutes(app);
        }

        // Bee Template Registry
        if (this.beeTemplateRegistry) {
            const { registerRoutes: registerTemplateRoutes } = this.beeTemplateRegistry;
            if (registerTemplateRoutes) registerTemplateRoutes(app);
        }

        // Swarm Consensus
        if (this.swarmConsensus) {
            try {
                const { registerConsensusRoutes } = require("../orchestration/swarm-consensus");
                registerConsensusRoutes(app);
            } catch { /* non-fatal */ }
        }

        // Digital Presence
        if (this.digitalPresence) {
            const { registerDigitalPresenceOrchestratorRoutes } = this.digitalPresence;
            if (registerDigitalPresenceOrchestratorRoutes) registerDigitalPresenceOrchestratorRoutes(app);
        }

        // Vector-Serve
        if (this.vectorServe) this.vectorServe.wireRoutes(app);

        // Buddy System
        if (this.buddySystem) {
            const { registerRoutes: registerBuddyRoutes } = this.buddySystem;
            if (registerBuddyRoutes) registerBuddyRoutes(app);
        }

        // Layer Management
        app.get("/api/layer", (req, res) => {
            res.json({ active: this.activeLayer, endpoint: LAYERS[this.activeLayer]?.endpoint || "", ts: new Date().toISOString() });
        });

        app.post("/api/layer/switch", (req, res) => {
            const newLayer = req.body.layer;
            if (!LAYERS[newLayer]) return res.status(400).json({ error: "Invalid layer" });
            this.activeLayer = newLayer;
            res.json({ success: true, layer: newLayer, endpoint: LAYERS[newLayer].endpoint, ts: new Date().toISOString() });
        });

        // Edge Proxy Status
        const EDGE_PROXY_URL = process.env.HEADY_EDGE_PROXY_URL || 'https://heady-edge-proxy.emailheadyconnection.workers.dev';
        const fetch = require('../core/heady-fetch');
        app.get("/api/edge/status", async (req, res) => {
            try {
                const [healthRes, detRes] = await Promise.allSettled([
                    fetch(`${EDGE_PROXY_URL}/v1/health`, { signal: AbortSignal.timeout(3000) }),
                    fetch(`${EDGE_PROXY_URL}/v1/determinism`, { signal: AbortSignal.timeout(3000) }),
                ]);
                const health = healthRes.status === 'fulfilled' ? await healthRes.value.json() : { error: 'unreachable' };
                const determinism = detRes.status === 'fulfilled' ? await detRes.value.json() : { error: 'unreachable' };
                res.json({ ok: true, service: 'heady-edge-proxy', edge_url: EDGE_PROXY_URL, health, determinism: determinism.determinism || determinism, ts: new Date().toISOString() });
            } catch (err) {
                res.status(503).json({ ok: false, error: 'Edge proxy unreachable', message: err.message });
            }
        });

        logger.logNodeActivity("PROJ_DISPATCH", "  ✅ All projection/dispatch routes registered");
    }

    getActiveLayer() { return this.activeLayer; }
    getLayers() { return LAYERS; }
}

module.exports = { ProjectionDispatcher };
