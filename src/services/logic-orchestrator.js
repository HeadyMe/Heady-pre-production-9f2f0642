/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ LogicOrchestrator                                       ║
 * ║  Phase 1 Iron Hull — Extracted from heady-manager.js             ║
 * ║  Owns: Buddy Core, Conductor, Agent Orchestrator, Pipeline,      ║
 * ║        Self-Awareness, Auto-Heal, Secret Rotation, Engines       ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const logger = require("../utils/logger");
const { EventEmitter } = require('events');

class LogicOrchestrator extends EventEmitter {
    constructor() {
        super();
        this.buddy = null;
        this.conductor = null;
        this.orchestrator = null;
        this.pipeline = null;
        this.selfAwareness = null;
        this.autoHeal = null;
        this.secretRotation = null;
        this.watchdog = null;
        this.engines = null;
        this.improvementScheduler = null;
        this.authEngine = null;
        this.corrections = null;
        this.deepResearch = null;
    }

    /**
     * Boot all logic/orchestration subsystems.
     * @param {Object} opts - { vectorMemory, eventBus, projectRoot, PORT }
     */
    boot(opts) {
        const { vectorMemory, eventBus, projectRoot, PORT } = opts;

        // ── Self-Awareness Telemetry ──
        try {
            this.selfAwareness = require('../self-awareness');
            this.selfAwareness.startSelfAwareness();
            logger.logNodeActivity("LOGIC_ORCH", "  ∞ Self-Awareness: LOADED");
        } catch (err) {
            logger.logNodeActivity("LOGIC_ORCH", `  ⚠ Self-Awareness not loaded: ${err.message}`);
        }

        // ── HeadyCorrections ──
        this.corrections = require("../corrections");
        this.corrections.init();
        logger.logNodeActivity("LOGIC_ORCH", "  ∞ HeadyCorrections: LOADED");

        // ── Agent Orchestrator ──
        const { getOrchestrator } = require("../agent-orchestrator");
        this.orchestrator = getOrchestrator({
            baseUrl: process.env.HEADY_MANAGER_URL || "https://manager.headysystems.com",
            apiKey: process.env.HEADY_API_KEY
        });
        this.orchestrator.setVectorMemory(vectorMemory);
        this.orchestrator.on("supervisor:spawned", (d) =>
            logger.logNodeActivity("LOGIC_ORCH", `  ∞ HeadySupervisor spawned: ${d.id} (${d.serviceGroup})`)
        );
        logger.logNodeActivity("LOGIC_ORCH", "  ∞ AgentOrchestrator: LOADED");

        // ── HeadyConductor — Federated Liquid Routing ──
        const { getConductor } = require("../heady-conductor");
        const { SecretRotation } = require("../security/secret-rotation");
        const { AutoHeal } = require("../resilience/auto-heal");

        this.conductor = getConductor();
        this.secretRotation = new SecretRotation();
        this.autoHeal = new AutoHeal(this.conductor);

        // Auto-Heal loop (5m)
        setInterval(() => this.autoHeal.check(), 60000 * 5);

        // Daily Secret Audit
        setInterval(() => {
            const report = this.secretRotation.audit();
            if (report.expired.length > 0 || report.warning.length > 0) {
                logger.logNodeActivity("LOGIC_ORCH", `[SECURITY] Secret Audit: ${report.expired.length} expired, ${report.warning.length} warnings. Score: ${report.score}`);
            }
        }, 1000 * 60 * 60 * 24);

        const initialAudit = this.secretRotation.audit();
        logger.logNodeActivity("LOGIC_ORCH", `  ∞ Secret Rotation: INITIALIZED (Score: ${initialAudit.score})`);
        this.autoHeal.check();
        logger.logNodeActivity("LOGIC_ORCH", "  ∞ Auto-Heal Resilience: ACTIVE");

        this.conductor.setOrchestrator(this.orchestrator);
        this.conductor.setVectorMemory(vectorMemory);

        // ── Buddy Core ──
        const { getBuddy } = require("../orchestration/buddy-core");
        const { BuddyWatchdog } = require("../orchestration/buddy-watchdog");

        this.buddy = getBuddy();
        this.buddy.setConductor(this.conductor);
        this.buddy.setVectorMemory(vectorMemory);

        // Wire Redis to Buddy
        try {
            const redisHealth = require("../routes/redis-health");
            if (redisHealth.getClient && redisHealth.getClient()) {
                this.buddy.setRedis(redisHealth.getClient());
            }
        } catch { /* Redis not available */ }

        logger.logNodeActivity("LOGIC_ORCH", `  🎼 Buddy Core: LOADED (ID: ${this.buddy.identity.id})`);
        logger.logNodeActivity("LOGIC_ORCH", `  🎼 Buddy MCP Tools: ${this.buddy.listMCPTools().length} tools registered`);

        // ── Buddy Watchdog ──
        this.watchdog = new BuddyWatchdog(this.buddy);
        this.watchdog.start();
        this.watchdog.on("restart", (data) =>
            logger.logNodeActivity("WATCHDOG", `  🐕 Buddy RESTARTED — Reason: ${data.reason} (#${data.restartCount})`)
        );
        this.watchdog.on("hallucination", (data) =>
            logger.logNodeActivity("WATCHDOG", `  🐕 HALLUCINATION: ${data.pattern}`)
        );
        this.watchdog.on("memory-alert", (data) =>
            logger.logNodeActivity("WATCHDOG", `  🐕 Memory growth: +${data.growthMB.toFixed(1)}MB`)
        );
        logger.logNodeActivity("LOGIC_ORCH", "  🐕 Buddy Watchdog: ACTIVE");

        // ── Engine Wiring ──
        const { wireEngines } = require("../bootstrap/engine-wiring");
        const { loadRegistry } = require("../routes/registry");
        this.engines = wireEngines(null, {
            pipeline: null,
            loadRegistry,
            eventBus,
            projectRoot,
            PORT,
        });

        // ── Deep Research ──
        try {
            const { DeepResearchEngine } = require("../deep-research");
            const HeadyGateway = require("../../heady-hive-sdk/lib/gateway");
            const gateway = new HeadyGateway();
            this.deepResearch = new DeepResearchEngine(gateway);
            this.buddy.registerMCPTool("deep_research", {
                description: "Multi-provider deep research with consensus scoring",
                category: "research",
                inputSchema: { type: "object", properties: { query: { type: "string" }, depth: { type: "string" } }, required: ["query"] },
                handler: async (input) => this.deepResearch.research(input.query, { depth: input.depth || "deep" }),
            });
            logger.logNodeActivity("LOGIC_ORCH", "  🔬 Deep Research Engine: WIRED");
        } catch (err) {
            logger.logNodeActivity("LOGIC_ORCH", `  ⚠ Deep Research not loaded: ${err.message}`);
        }

        return this;
    }

    /**
     * Register all orchestration routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app) {
        // Corrections
        if (this.corrections) this.corrections.registerRoutes(app);

        // Orchestrator
        if (this.orchestrator) this.orchestrator.registerRoutes(app);

        // Conductor
        if (this.conductor) this.conductor.registerRoutes(app);

        // Buddy
        if (this.buddy) this.buddy.registerRoutes(app);

        // Watchdog
        if (this.watchdog) this.watchdog.registerRoutes(app);

        // Deep Research routes
        if (this.deepResearch) {
            app.post("/api/buddy/deep-research", async (req, res) => {
                try {
                    const { query, providers, depth, maxWaitMs } = req.body || {};
                    if (!query) return res.status(400).json({ ok: false, error: "query is required" });
                    const result = await this.deepResearch.research(query, { providers, depth, maxWaitMs });
                    res.json(result);
                } catch (err) {
                    res.status(500).json({ ok: false, error: err.message });
                }
            });
            app.get("/api/buddy/deep-research/stats", (req, res) => {
                res.json({ ok: true, ...this.deepResearch.getStats() });
            });
        }

        // Self-Awareness endpoints
        if (this.selfAwareness) {
            try {
                this.selfAwareness.startBrandingMonitor();
                app.get('/api/introspection', (req, res) => res.json(this.selfAwareness.getSystemIntrospection()));
                app.get('/api/branding', (req, res) => res.json(this.selfAwareness.getBrandingReport()));
                logger.logNodeActivity("LOGIC_ORCH", "  ∞ Branding Monitor: STARTED");
            } catch (err) {
                logger.logNodeActivity("LOGIC_ORCH", `  ⚠ Branding routes not loaded: ${err.message}`);
            }
        }

        // Heady Principles
        try {
            const hp = require('../heady-principles');
            app.get('/api/principles', (req, res) => res.json({
                node: 'heady-principles',
                role: 'Mathematical foundation — base-13, log42, golden ratio',
                constants: { PHI: hp.PHI, PHI_INV: hp.PHI_INV, PHI_PCT: hp.PHI_PCT, BASE: hp.BASE, LOG_BASE: hp.LOG_BASE, HEADY_UNIT: hp.HEADY_UNIT, HEADY_CYCLE: hp.HEADY_CYCLE },
                designTokens: hp.designTokens(8),
                capacity: hp.capacityParams('medium'),
                thresholds: hp.phiThresholds(8),
                fibonacci: hp.FIB.slice(0, 13),
            }));
            logger.logNodeActivity("LOGIC_ORCH", `  ∞ Heady Principles: LOADED (φ=${hp.PHI.toFixed(3)})`);
        } catch (err) {
            logger.logNodeActivity("LOGIC_ORCH", `  ⚠ Heady Principles not loaded: ${err.message}`);
        }

        logger.logNodeActivity("LOGIC_ORCH", "  ✅ All logic/orchestration routes registered");
    }

    getBuddy() { return this.buddy; }
    getConductor() { return this.conductor; }
    getOrchestrator() { return this.orchestrator; }
    getEngines() { return this.engines; }
    getSelfAwareness() { return this.selfAwareness; }
}

module.exports = { LogicOrchestrator };
