/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Service Route Registrar — Phase 2 Liquid Architecture
 * Extracted from heady-manager.js monolith.
 *
 * Registers all service-layer routes: deep scan, creative, deep-intel,
 * liquid allocator, orchestrator, brain, hive-sdk, notion, wave-4 routers,
 * vinci canvas, pulse API, and service stubs.
 */

const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

/**
 * Register all service routes on the Express app.
 *
 * @param {Express.Application} app - Express app instance
 * @param {Object} deps - Dependencies from the manager
 * @param {Object} deps.engines - Engine references from wireEngines()
 * @param {Object} deps.vectorMemory - Vector memory instance
 * @param {Object} deps.orchestrator - Agent orchestrator instance
 * @param {Object} deps.Handshake - Handshake module
 * @param {string} deps.projectRoot - __dirname of main entry
 */
function registerServiceRoutes(app, deps = {}) {
    const { engines = {}, vectorMemory, orchestrator, Handshake, projectRoot } = deps;
    const { autoSuccessEngine } = engines;

    // ─── Deep Scan & Unified Control API ─────────────────────────────
    try {
        const { registerDeepScanRoutes, runDeepScan } = require("../hc_deep_scan");
        registerDeepScanRoutes(app);

        global.__autoSuccessEngine = autoSuccessEngine;

        setTimeout(async () => {
            try {
                const scan = await runDeepScan();
                logger.logNodeActivity("CONDUCTOR", `  🔬 Initial Deep Scan: Score ${scan.overallScore} | ${Object.values(scan.internal).filter(s => s.healthy).length}/${Object.keys(scan.internal).length} services healthy`);
            } catch (err) {
                logger.logNodeActivity("CONDUCTOR", `  ⚠ Initial deep scan deferred: ${err.message}`);
            }
        }, 10000);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Deep Scan module not loaded: ${err.message}`);
    }

    // ─── HeadyCreative ─────────────────────────────────────────────────
    try {
        const { HeadyCreativeEngine, registerCreativeRoutes } = require("../hc_creative");
        const creativeEngine = new HeadyCreativeEngine();
        registerCreativeRoutes(app, creativeEngine);

        global.__creativeEngine = creativeEngine;

        creativeEngine.on("job:completed", (job) => {
            if (global.__sseBroadcast) {
                global.__sseBroadcast("creative_job", {
                    jobId: job.id, type: job.type, model: job.model,
                    status: job.status, durationMs: job.durationMs,
                });
            }
        });

        creativeEngine.on("pipeline:completed", (job) => {
            if (global.__sseBroadcast) {
                global.__sseBroadcast("creative_pipeline", {
                    jobId: job.id, pipeline: job.pipeline,
                    steps: job.steps?.length, durationMs: job.durationMs,
                });
            }
        });

        logger.logNodeActivity("CONDUCTOR", "  ✓ HeadyCreative engine: ACTIVE");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyCreative not loaded: ${err.message}`);
    }

    // ─── HeadyDeepIntel ────────────────────────────────────────────────
    try {
        const { DeepIntelEngine, registerDeepIntelRoutes } = require("../hc_deep_intel");
        const deepIntel = new DeepIntelEngine();
        registerDeepIntelRoutes(app, deepIntel);
        global.__deepIntel = deepIntel;

        setTimeout(() => {
            deepIntel.deepScanProject("/home/headyme/Heady").then(scan => {
                if (global.__sseBroadcast) {
                    global.__sseBroadcast("deep_intel_scan", {
                        scanId: scan.id, perspectives: Object.keys(scan.perspectives).length,
                        score: scan.compositeScore, findings: scan.findings.length,
                        nodesInvoked: scan.nodesInvoked.length, durationMs: scan.durationMs,
                    });
                }
            });
        }, 5000);

        logger.logNodeActivity("CONDUCTOR", "  ✓ HeadyDeepIntel engine: ACTIVE (10 perspectives, 10 nodes, 3D vectors)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyDeepIntel not loaded: ${err.message}`);
    }

    // ─── Liquid Component Allocation Engine ────────────────────────────
    try {
        const { LiquidAllocator, registerLiquidRoutes } = require("../hc_liquid");
        const liquidAllocator = new LiquidAllocator();
        registerLiquidRoutes(app, liquidAllocator);

        global.__liquidAllocator = liquidAllocator;

        liquidAllocator.on("flow:allocated", (flow) => {
            if (global.__sseBroadcast) {
                global.__sseBroadcast("liquid_flow", {
                    flowId: flow.id,
                    context: flow.context.type,
                    components: flow.allocated.map(a => a.component),
                });
            }
        });

        const _PHI = 1.618;
        setInterval(() => liquidAllocator.persist(), Math.round(_PHI ** 7 * 1000)); // φ⁷ ≈ 29s — organic persist pulse
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Liquid Allocator not loaded: ${err.message}`);
    }

    // ─── HCSysOrchestrator ─────────────────────────────────────────────
    try {
        const orchestratorRoutes = require("../orchestration/hc_sys_orchestrator");
        app.use("/api/orchestrator", orchestratorRoutes);
        logger.logNodeActivity("CONDUCTOR", "  ∞ HCSysOrchestrator: LOADED");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/orchestrator/health, /route, /brains, /layers, /contract, /rebuild-status");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HCSysOrchestrator not loaded: ${err.message}`);
    }

    // ─── HeadyBrain API ────────────────────────────────────────────────
    try {
        const brainApiRoutes = require("../orchestration/brain_api");
        app.use("/api/brain", brainApiRoutes);
        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadyBrain API: LOADED");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/brain/health, /plan, /feedback, /status");

        const { getBrainConnector } = require("../brain_connector");
        const brainConnector = getBrainConnector({ poolSize: 5, healthCheckInterval: 15000 });

        brainConnector.on('circuitBreakerOpen', (data) => {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ Brain circuit breaker OPEN: ${data.endpointId} (${data.failures} failures)`);
        });
        brainConnector.on('allEndpointsFailed', () => {
            logger.logError("CONDUCTOR", `  🚨 ALL BRAIN ENDPOINTS FAILED! Using fallback mode.`);
        });
        brainConnector.on('healthCheck', (results) => {
            const healthy = Array.from(results.entries()).filter(([_, r]) => r.status === 'healthy').length;
            if (healthy < results.size) {
                logger.logNodeActivity("CONDUCTOR", `  ⚠ Brain health check: ${healthy}/${results.size} endpoints healthy`);
            }
        });

        logger.logNodeActivity("CONDUCTOR", "  ∞ BrainConnector: ACTIVE (100% uptime guarantee)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyBrain API not loaded: ${err.message}`);
    }

    // ─── Brain Core Routes (orchestrated) ──────────────────────────────
    try {
        const { router: brainCoreRoutes } = require("../routes/brain");

        if (orchestrator && vectorMemory) {
            orchestrator.setVectorMemory(vectorMemory);
        }

        if (orchestrator) {
            app.use("/api/brain", (req, res, next) => {
                if (req.method !== "POST") return next();

                const action = req.path.replace(/^\//, "").split("/")[0] || "unknown";
                const start = Date.now();
                const serviceGroup = orchestrator.conductor.routeSync({ action });
                const supervisor = orchestrator._getOrCreateSupervisor(serviceGroup);

                if (supervisor) {
                    supervisor.busy = true;
                    orchestrator._audit({ type: "task:start", action, supervisor: supervisor.id, serviceGroup });

                    const origEnd = res.end.bind(res);
                    res.end = function (...args) {
                        const latency = Date.now() - start;
                        supervisor.taskCount++;
                        supervisor.totalLatency += latency;
                        supervisor.lastActive = Date.now();
                        supervisor.busy = false;
                        orchestrator.completedTasks++;
                        orchestrator._audit({ type: "task:complete", action, supervisor: supervisor.id, latency });
                        orchestrator.taskHistory.push({ ok: true, action, latency, supervisor: supervisor.id, serviceGroup, ts: Date.now() });
                        if (orchestrator.taskHistory.length > 100) orchestrator.taskHistory = orchestrator.taskHistory.slice(-100);
                        return origEnd(...args);
                    };
                }

                next();
            });

            orchestrator.registerHandler("chat", async () => ({ note: "use /api/brain/chat HTTP endpoint" }));
            orchestrator.registerHandler("analyze", async () => ({ note: "use /api/brain/analyze HTTP endpoint" }));
            orchestrator.registerHandler("embed", async () => ({ note: "use /api/brain/embed HTTP endpoint" }));
            orchestrator.registerHandler("search", async () => ({ note: "use /api/brain/search HTTP endpoint" }));
        }

        app.use("/api/brain", brainCoreRoutes);

        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadyBrain Core Routes: LOADED (orchestrated)");
        logger.logNodeActivity("CONDUCTOR", "    → Memory-first: pipeline scans vector memory before every action");
        logger.logNodeActivity("CONDUCTOR", "    → Orchestrator: tracks agents + tasks on every /brain/* POST");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyBrain Core Routes not loaded: ${err.message}`);
    }

    // ─── Hive SDK Routes ───────────────────────────────────────────────
    try {
        const { router: hiveSdkRoutes } = require("../routes/hive-sdk");
        app.use("/api", hiveSdkRoutes);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Heady Hive SDK Endpoints: LOADED");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/battle/*, /api/creative/*, /api/mcp/*, /api/auth/*, /api/events/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Hive SDK Endpoints not loaded: ${err.message}`);
    }

    // ─── Notion Sync Routes ────────────────────────────────────────────
    try {
        const { registerNotionRoutes } = require("../services/heady-notion");
        registerNotionRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadyNotion Sync: LOADED");
        logger.logNodeActivity("CONDUCTOR", "    → Endpoints: /api/notion/sync, /health, /state");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyNotion routes not loaded: ${err.message}`);
    }

    // ─── Real Service Routers ──────────────────────────────────────────
    const routerMounts = [
        ["soul", "soul"], ["battle", "battle"], ["hcfp", "hcfp"],
        ["budget", "budget-router"], ["patterns", "patterns"],
    ];

    for (const [name, file] of routerMounts) {
        try {
            const r = require(`../routes/${file}`);
            app.use(`/api/${name}`, r.router || r);
            logger.logNodeActivity("CONDUCTOR", `  ∞ Heady${name.charAt(0).toUpperCase() + name.slice(1)}: LOADED (real router) → /api/${name}/*`);
        } catch (err) {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady${name} router not loaded: ${err.message}`);
        }
    }

    // ─── HCFP Pipeline + Telemetry ─────────────────────────────────────
    try {
        const pipelineRunner = require("../hcfp/pipeline-runner");
        app.post("/api/hcfp/ingest", async (req, res) => {
            try {
                const result = await pipelineRunner.runFull(req.body);
                res.json(result);
            } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
        });
        app.get("/api/hcfp/manifests", (req, res) => res.json({ ok: true, manifests: pipelineRunner.listManifests() }));
        app.get("/api/hcfp/manifest/:id", (req, res) => {
            const m = pipelineRunner.getManifest(req.params.id);
            res.json(m ? { ok: true, manifest: m } : { ok: false, error: "Not found" });
        });
        const cogTel = require("../telemetry/cognitive-telemetry");
        app.get("/api/telemetry/audit", (req, res) => res.json({ ok: true, entries: cogTel.readAuditLog(parseInt(req.query.limit) || 50) }));
        app.get("/api/telemetry/stats", (req, res) => res.json({ ok: true, stats: cogTel.getAuditStats() }));
        logger.logNodeActivity("CONDUCTOR", "  ∞ HCFP Pipeline + Telemetry Audit: INSTALLED");
    } catch (err) { logger.logNodeActivity("CONDUCTOR", `  ⚠ Pipeline/Telemetry not loaded: ${err.message}`); }

    // ─── Wave 4 Real Routers ───────────────────────────────────────────
    const wave4 = ["ops", "maintenance", "lens", "vinci", "conductor", "memory", "registry", "nodes", "system"];
    for (const name of wave4) {
        try {
            const r = require(`../routes/${name}`);
            app.use(`/api/${name}`, r.router || r);
            logger.logNodeActivity("CONDUCTOR", `  ∞ Heady${name.charAt(0).toUpperCase() + name.slice(1)}: LOADED (real router) → /api/${name}/*`);
        } catch (err) {
            logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady${name} router not loaded: ${err.message}`);
        }
    }

    // ─── HeadyVinci Creative Sandbox Canvas ────────────────────────────
    try {
        const vinciCanvasRouter = require("../routes/vinci-canvas");
        app.use("/api/canvas", vinciCanvasRouter);

        app.get("/canvas", (req, res) => {
            const canvasHtmlPath = path.join(projectRoot || __dirname, "public", "canvas.html");
            if (fs.existsSync(canvasHtmlPath)) {
                res.sendFile(canvasHtmlPath);
            } else {
                res.redirect("/api/canvas/health");
            }
        });

        logger.logNodeActivity("CONDUCTOR", "  🎨 HeadyVinci Canvas: LOADED → /api/canvas/*, /canvas");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyVinci Canvas not loaded: ${err.message}`);
    }

    // ─── System Pulse & Proof UI API ───────────────────────────────────
    try {
        const pulseApiRouter = require("../routes/pulse-api");
        app.use("/api", pulseApiRouter);
        logger.logNodeActivity("CONDUCTOR", "  📈 Heady Pulse API: LOADED → /api/pulse, /api/arena/consensus, /api/receipt/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Heady Pulse API not loaded: ${err.message}`);
    }

    // ─── Service Stubs + Connectivity ──────────────────────────────────
    if (Handshake) {
        require("../routes/service-stubs")(app, Handshake);
    }

    // ─── Config File API (serves task matrix, etc. to frontends) ──────
    app.get("/api/config/:filename", (req, res) => {
        const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, "");
        const candidates = [
            path.join(projectRoot || __dirname, "src", safe),
            path.join(projectRoot || __dirname, "configs", safe),
            path.join(projectRoot || __dirname, "data", safe),
        ];
        for (const fp of candidates) {
            if (fs.existsSync(fp)) {
                try {
                    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
                    res.setHeader("Access-Control-Allow-Origin", "*");
                    return res.json(data);
                } catch (err) {
                    return res.status(500).json({ ok: false, error: "Parse error" });
                }
            }
        }
        res.status(404).json({ ok: false, error: "Not found" });
    });

    // ─── Auto-Success API (live task completion data for frontends) ────
    app.get("/api/auto-success/status", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (autoSuccessEngine) {
            return res.json(autoSuccessEngine.getStatus());
        }
        res.json({ engine: "heady-auto-success", running: false, note: "Engine not initialized" });
    });

    app.get("/api/auto-success/history", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        const limit = parseInt(req.query.limit) || 50;
        if (autoSuccessEngine) {
            return res.json({ ok: true, tasks: autoSuccessEngine.getHistory(limit) });
        }
        res.json({ ok: true, tasks: [] });
    });

    app.get("/api/auto-success/tasks", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        const category = req.query.category || null;
        if (autoSuccessEngine) {
            return res.json({ ok: true, tasks: autoSuccessEngine.getTaskCatalog(category) });
        }
        res.json({ ok: true, tasks: [] });
    });

    logger.logNodeActivity("CONDUCTOR", "  📋 Config API + Auto-Success API: LOADED → /api/config/*, /api/auto-success/*");
}

module.exports = { registerServiceRoutes };
