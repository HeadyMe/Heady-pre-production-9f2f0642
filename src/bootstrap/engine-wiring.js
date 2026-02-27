/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Engine Wiring Bootstrap Module
 * Extracted from heady-manager.js monolith — Phase 2 Liquid Architecture modularization.
 *
 * Initializes all system engines (resource manager, scheduler, diagnostics,
 * monte carlo, pattern engine, story driver, self-critique) with cross-system
 * event wiring. Returns engine references for use by the manager and route registrars.
 */

const logger = require("../utils/logger");

/**
 * Initialize all system engines and wire them together.
 * Each engine is fault-tolerant — failure to load one doesn't block others.
 *
 * @param {Express.Application} app - Express app instance
 * @param {Object} deps - External dependencies from heady-manager
 * @param {Object} deps.pipeline - Pipeline instance (may be null)
 * @param {Function} deps.loadRegistry - Registry loader function
 * @param {EventEmitter} deps.eventBus - Global event bus
 * @param {string} deps.projectRoot - __dirname of the main entry point
 * @param {number} deps.PORT - Manager port
 * @returns {Object} Engine references
 */
function wireEngines(app, deps = {}) {
    const { pipeline, loadRegistry, eventBus, projectRoot, PORT } = deps;

    const engines = {
        resourceManager: null,
        taskScheduler: null,
        resourceDiagnostics: null,
        mcPlanScheduler: null,
        mcGlobal: null,
        patternEngine: null,
        storyDriver: null,
        selfCritiqueEngine: null,
        autoSuccessEngine: null,
        scientistEngine: null,
        qaEngine: null,
    };

    // ─── 1. Resource Manager ──────────────────────────────────────────
    try {
        const { HCResourceManager, registerRoutes: registerResourceRoutes } = require("../hc_resource_manager");
        engines.resourceManager = new HCResourceManager({ pollIntervalMs: 5000 });
        registerResourceRoutes(app, engines.resourceManager);
        engines.resourceManager.start();

        engines.resourceManager.on("resource_event", (event) => {
            if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
                logger.logNodeActivity("CONDUCTOR", `  ⚠ Resource ${event.severity}: ${event.resourceType} at ${event.currentUsagePercent}%`);
            }
        });
        engines.resourceManager.on("escalation_required", (data) => {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ ESCALATION: ${data.event.resourceType} at ${data.event.currentUsagePercent}% — user prompt required`);
        });

        logger.logNodeActivity("CONDUCTOR", "  ∞ Resource Manager: LOADED (polling every 5s)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Resource Manager not loaded: ${err.message}`);

        // Fallback inline resource health endpoint
        const os = require("os");
        app.post("/api/system/production", (req, res) => {
            const expectedAdminToken = process.env.ADMIN_TOKEN || process.env.HEADY_ADMIN_TOKEN || "";
            if (expectedAdminToken) {
                const authHeader = req.headers.authorization || "";
                const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
                const providedToken = req.headers["x-admin-token"] || bearerToken;
                if (providedToken !== expectedAdminToken) {
                    return res.status(401).json({ success: false, error: "Unauthorized" });
                }
            }

            const reg = loadRegistry ? loadRegistry() : {};
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;

            res.json({
                cpu: { currentPercent: 0, cores: os.cpus().length, unit: "%" },
                ram: { currentPercent: Math.round((usedMem / totalMem) * 100), absoluteValue: Math.round(usedMem / 1048576), capacity: Math.round(totalMem / 1048576), unit: "MB" },
                disk: { currentPercent: 0, absoluteValue: 0, capacity: 0, unit: "GB" },
                gpu: null,
                safeMode: false,
                status: "fallback",
                ts: new Date().toISOString(),
            });
        });
    }

    // ─── 2. Task Scheduler ────────────────────────────────────────────
    try {
        const { HCTaskScheduler, registerSchedulerRoutes } = require("../hc_task_scheduler");
        engines.taskScheduler = new HCTaskScheduler();
        registerSchedulerRoutes(app, engines.taskScheduler);

        if (engines.resourceManager) {
            engines.resourceManager.on("mitigation:safe_mode_activated", () => {
                engines.taskScheduler.enterSafeMode();
            });
            engines.resourceManager.on("mitigation:batch_paused", () => {
                engines.taskScheduler.adjustConcurrency("batch", 1);
            });
            engines.resourceManager.on("mitigation:concurrency_lowered", () => {
                engines.taskScheduler.adjustConcurrency("batch", 1);
                engines.taskScheduler.adjustConcurrency("training", 0);
            });
        }

        logger.logNodeActivity("CONDUCTOR", "  ∞ Task Scheduler: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Task Scheduler not loaded: ${err.message}`);
    }

    // ─── 3. Resource Diagnostics ──────────────────────────────────────
    try {
        const { HCResourceDiagnostics, registerDiagnosticRoutes } = require("../hc_resource_diagnostics");
        engines.resourceDiagnostics = new HCResourceDiagnostics({
            resourceManager: engines.resourceManager,
            taskScheduler: engines.taskScheduler,
        });
        registerDiagnosticRoutes(app, engines.resourceDiagnostics);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Resource Diagnostics: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Resource Diagnostics not loaded: ${err.message}`);
    }

    // ─── 4. Monte Carlo Plan Scheduler ────────────────────────────────
    try {
        const { mcPlanScheduler: _mcPS, mcGlobal: _mcG, registerHeadySimsRoutes } = require("../hc_monte_carlo");
        engines.mcPlanScheduler = _mcPS;
        engines.mcGlobal = _mcG;
        registerHeadySimsRoutes(app, engines.mcPlanScheduler, engines.mcGlobal);

        engines.mcPlanScheduler.on("drift:detected", (alert) => {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ MC Drift: ${alert.taskType}/${alert.strategyId} at ${alert.medianMs}ms (target ${alert.targetMs}ms)`);
        });

        if (pipeline) {
            engines.mcGlobal.bind({ pipeline, registry: loadRegistry });
        }

        engines.mcGlobal.startAutoRun();
        engines.mcPlanScheduler.setSpeedMode("on");

        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadySims Plan Scheduler: LOADED (speed_priority mode)");
        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadySims Global: AUTO-RUN started (60s cycles)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadySims not loaded: ${err.message}`);
    }

    // ─── 5. Pattern Recognition Engine ────────────────────────────────
    try {
        const { patternEngine: _pe, registerPatternRoutes } = require("../hc_pattern_engine");
        engines.patternEngine = _pe;
        registerPatternRoutes(app, engines.patternEngine);

        // Wire MC drift alerts into pattern engine
        if (engines.mcPlanScheduler) {
            engines.mcPlanScheduler.on("drift:detected", (alert) => {
                engines.patternEngine.observeLatency(`mc_drift:${alert.taskType}`, alert.medianMs, {
                    strategyId: alert.strategyId, targetMs: alert.targetMs,
                    tags: ["drift", "monte_carlo"],
                });
            });
            engines.mcPlanScheduler.on("result:recorded", (data) => {
                engines.patternEngine.observeLatency(`task:${data.taskType}`, data.actualLatencyMs, {
                    strategyId: data.strategyId, reward: data.reward,
                    tags: ["monte_carlo", "execution"],
                });
            });
        }

        // Wire task scheduler into pattern engine
        if (engines.taskScheduler) {
            engines.taskScheduler.on("task:completed", (task) => {
                const execMs = (task.metrics.completedAt || 0) - (task.metrics.startedAt || 0);
                engines.patternEngine.observeSuccess(`scheduler:${task.type}`, execMs, {
                    tier: task.resourceTier, taskClass: task.taskClass,
                    tags: ["scheduler"],
                });
            });
            engines.taskScheduler.on("task:failed", (task) => {
                engines.patternEngine.observeError(`scheduler:${task.type}`, task.error || "unknown", {
                    tier: task.resourceTier, tags: ["scheduler", "failure"],
                });
            });
        }

        // Wire resource manager into pattern engine
        if (engines.resourceManager) {
            engines.resourceManager.on("resource_event", (event) => {
                if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
                    engines.patternEngine.observe("reliability", `resource:${event.resourceType}`, event.currentUsagePercent, {
                        severity: event.severity, tags: ["resource", event.resourceType],
                    });
                }
            });
        }

        engines.patternEngine.start();
        logger.logNodeActivity("CONDUCTOR", "  ∞ Pattern Engine: LOADED (30s analysis cycles)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Pattern Engine not loaded: ${err.message}`);
    }

    // ─── 6. Story Driver ──────────────────────────────────────────────
    try {
        const { HCStoryDriver, registerStoryRoutes } = require("../hc_story_driver");
        engines.storyDriver = new HCStoryDriver();
        registerStoryRoutes(app, engines.storyDriver);

        if (engines.resourceManager) {
            engines.resourceManager.on("resource_event", (event) => {
                if (event.severity === "WARN_HARD" || event.severity === "CRITICAL") {
                    engines.storyDriver.ingestSystemEvent({
                        type: `RESOURCE_${event.severity}`,
                        refs: {
                            resourceType: event.resourceType,
                            percent: event.currentUsagePercent,
                            mitigation: event.mitigationApplied || "pending",
                        },
                        source: "resource_manager",
                    });
                }
            });
        }

        if (engines.patternEngine) {
            engines.patternEngine.on("pattern:converged", (data) => {
                engines.storyDriver.ingestSystemEvent({
                    type: "PATTERN_CONVERGED",
                    refs: { patternId: data.id, name: data.name },
                    source: "pattern_engine",
                });
            });
            engines.patternEngine.on("anomaly:error_burst", (data) => {
                engines.storyDriver.ingestSystemEvent({
                    type: "ERROR_BURST_DETECTED",
                    refs: { patternId: data.patternId, name: data.name, count: data.count },
                    source: "pattern_engine",
                });
            });
            engines.patternEngine.on("anomaly:correlated_slowdown", (data) => {
                engines.storyDriver.ingestSystemEvent({
                    type: "CORRELATED_SLOWDOWN",
                    refs: { patterns: data.patterns, count: data.count },
                    source: "pattern_engine",
                });
            });
        }

        logger.logNodeActivity("CONDUCTOR", "  ∞ Story Driver: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Story Driver not loaded: ${err.message}`);
    }

    // ─── 7. Self-Critique & Optimization Engine ───────────────────────
    try {
        const { selfCritique, registerSelfCritiqueRoutes } = require("../hc_self_critique");
        engines.selfCritiqueEngine = selfCritique;
        registerSelfCritiqueRoutes(app, engines.selfCritiqueEngine);

        if (engines.mcPlanScheduler) {
            engines.mcPlanScheduler.on("drift:detected", (alert) => {
                engines.selfCritiqueEngine.recordCritique({
                    context: `mc_drift:${alert.taskType}`,
                    weaknesses: [`Latency drift on ${alert.taskType}: ${alert.medianMs}ms vs ${alert.targetMs}ms target`],
                    severity: alert.medianMs > alert.targetMs * 2 ? "critical" : "high",
                    suggestedImprovements: ["Run MC re-optimization", "Check warm pool availability"],
                });
            });
        }

        if (engines.patternEngine) {
            engines.patternEngine.on("improvement:created", (task) => {
                engines.selfCritiqueEngine.recordImprovement({
                    description: task.title || "Pattern improvement task",
                    type: "routing_change",
                    status: "proposed",
                });
            });
        }

        logger.logNodeActivity("CONDUCTOR", "  ∞ Self-Critique Engine: LOADED");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/self/*, /api/pricing/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Self-Critique Engine not loaded: ${err.message}`);
    }

    // ─── 8. Auto-Success Task Engine ──────────────────────────────────
    try {
        const { AutoSuccessEngine, registerAutoSuccessRoutes } = require("../hc_auto_success");
        engines.autoSuccessEngine = new AutoSuccessEngine({
            interval: 16180,
            batchSize: 13,
        });

        engines.autoSuccessEngine.wire({
            patternEngine: engines.patternEngine || null,
            selfCritique: engines.selfCritiqueEngine || null,
            storyDriver: engines.storyDriver || null,
            resourceManager: engines.resourceManager || null,
            eventBus: eventBus,
        });

        registerAutoSuccessRoutes(app, engines.autoSuccessEngine);
        engines.autoSuccessEngine.start();

        try {
            const conductorModule = require("../routes/conductor");
            if (conductorModule.bindAutoSuccess) {
                conductorModule.bindAutoSuccess(engines.autoSuccessEngine);
                logger.logNodeActivity("CONDUCTOR", "    → Auto-Success ↔ Conductor: WIRED");
            }
        } catch { /* conductor bind optional */ }

        logger.logNodeActivity("CONDUCTOR", "  ∞ Auto-Success Engine: LOADED (135 tasks, 9 categories, φ-aligned 16.18s, 13/batch)");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/auto-success/health, /status, /tasks, /history, /force-cycle");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Auto-Success Engine not loaded: ${err.message}`);
    }

    // ─── 9. HeadyScientist ────────────────────────────────────────────
    try {
        const { HeadyScientist, registerScientistRoutes } = require("../hc_scientist");
        engines.scientistEngine = new HeadyScientist({ projectRoot: projectRoot || __dirname });

        engines.scientistEngine.wireEventBus(eventBus);

        if (engines.autoSuccessEngine) {
            engines.scientistEngine.wireAutoSuccess(engines.autoSuccessEngine);
        }

        registerScientistRoutes(app, engines.scientistEngine);
        engines.scientistEngine.start();

        logger.logNodeActivity("CONDUCTOR", "  🔬 HeadyScientist: LOADED (integrity protocol, determinism proof, drift detection)");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/scientist/health, /status, /scan, /proof-chain, /predictions");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyScientist not loaded: ${err.message}`);
    }

    // ─── 10. HeadyQA ──────────────────────────────────────────────────
    try {
        const { HeadyQA, registerQARoutes } = require("../hc_qa");
        engines.qaEngine = new HeadyQA({ projectRoot: projectRoot || __dirname, managerPort: PORT || 3301 });
        registerQARoutes(app, engines.qaEngine);
        engines.qaEngine.startContinuousLoop();
        logger.logNodeActivity("CONDUCTOR", "  ✅ HeadyQA: LOADED (endpoint probes + schema validation + integration smoke tests)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyQA not loaded: ${err.message}`);
    }

    return engines;
}

module.exports = { wireEngines };
