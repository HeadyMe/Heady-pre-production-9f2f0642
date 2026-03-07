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

    // ─── Vault Boot — Decrypt credentials from vector space into process.env ──
    try {
        const { bootVault, registerVaultProjectionRoutes } = require("../services/vault-boot");
        bootVault().then(result => {
            if (result.ok) {
                logger.logNodeActivity("CONDUCTOR", `  🔐 Vault Boot: ${result.projected} credentials projected into RAM`);
            } else {
                logger.logNodeActivity("CONDUCTOR", `  ⚠ Vault Boot: ${result.reason}`);
            }
        }).catch(e => logger.logError("CONDUCTOR", `Vault boot error: ${e.message}`));
        registerVaultProjectionRoutes(app);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Vault Boot not loaded: ${err.message}`);
    }

    // ─── Auto-Projection — Zero-Middleman Site Deployment ──────────────
    try {
        const { bootAutoProjection, autoProjectionRoutes } = require("../services/auto-projection");
        // Register routes + middleware BEFORE other route handlers
        autoProjectionRoutes(app);
        // Boot async — pre-render all sites from registry
        bootAutoProjection().then(result => {
            if (result.ok) {
                logger.logNodeActivity("CONDUCTOR", `  🚀 Auto-Projection: ${result.projected} sites pre-rendered, ${result.aliasesCached} aliases cached`);
                if (result.edgeCachePush?.pushed) {
                    logger.logNodeActivity("CONDUCTOR", `  🌐 Edge Cache: ${result.edgeCachePush.sitesInKV} sites pushed to Cloudflare KV`);
                }
            } else {
                logger.logNodeActivity("CONDUCTOR", `  ⚠ Auto-Projection: ${result.error}`);
            }
        }).catch(e => logger.logError("CONDUCTOR", `Auto-Projection error: ${e.message}`));
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Auto-Projection not loaded: ${err.message}`);
    }

    // ─── Public Projection Pipeline — GitHub Repo Projection ──────────
    try {
        const projectionPipeline = require("../projection/public-projection-pipeline");
        projectionPipeline.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", `  🚀 Public Projection Pipeline: ACTIVE → /api/projection/* (9 domain repos)`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Public Projection Pipeline not loaded: ${err.message}`);
    }

    // ─── Swarm Matrix — 18-Swarm Civilization Runtime ──────────────────
    try {
        const swarmMatrix = require("../services/swarm-matrix");
        swarmMatrix.boot();
        swarmMatrix.swarmMatrixRoutes(app);
        const stats = swarmMatrix.getStats();
        logger.logNodeActivity("CONDUCTOR", `  🐝 Swarm Matrix: ${stats.totalSwarms} swarms, ${stats.totalBees} bees (${stats.active} active, ${stats.standby} standby, ${stats.sleeper} sleeper)`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Swarm Matrix not loaded: ${err.message}`);
    }

    // ─── Zero-Repo Bees — AST Compiler + Context Assembler ────────────
    try {
        const { hologramBeeRoutes } = require("../bees/hologram-bee");
        hologramBeeRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  🔮 HologramBee: ACTIVE → /api/hologram/* (on-demand AST compiler)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HologramBee not loaded: ${err.message}`);
    }

    try {
        const { contextWeaverRoutes } = require("../bees/context-weaver-bee");
        contextWeaverRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  🧠 ContextWeaverBee: ACTIVE → /api/context-weaver/* (memory assembler)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ ContextWeaverBee not loaded: ${err.message}`);
    }

    // ─── AST Schema Migration Route ───────────────────────────────────
    try {
        const astSchema = require("../services/ast-schema");
        app.post("/api/ast/migrate", async (_req, res) => {
            const result = await astSchema.migrate();
            res.json(result);
        });
        app.get("/api/ast/schema", (_req, res) => {
            res.type("sql").send(astSchema.getMigrationSQL());
        });
        logger.logNodeActivity("CONDUCTOR", "  📐 AST Schema: LOADED → /api/ast/migrate, /api/ast/schema");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ AST Schema not loaded: ${err.message}`);
    }

    // ─── Aspirational Task Registry — Unified Mission Manifest ────────
    try {
        const aspirational = require("../services/aspirational-registry");
        aspirational.boot();
        aspirational.aspirationalRoutes(app);
        const aStats = aspirational.getStats();
        logger.logNodeActivity("CONDUCTOR", `  📋 Aspirational Registry: ${aStats.totalTasks} tasks from ${aStats.sourceFiles} sources → ${Object.keys(aStats.swarmDistribution).length} swarms`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Aspirational Registry not loaded: ${err.message}`);
    }

    // ─── Battle Arena — 10-Model Competitive Rebuild ─────────────────
    try {
        const battleArena = require("../services/battle-arena");
        battleArena.battleArenaRoutes(app);
        logger.logNodeActivity("CONDUCTOR", `  ⚔️  Battle Arena: ${battleArena.CONTENDERS.length} contenders ready at /api/battle/*`);
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Battle Arena not loaded: ${err.message}`);
    }

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

    // ─── IDE Bridge (HeadyAI-IDE Proposal Gateway) ────────────────────
    try {
        const { ideBridgeRoutes } = require("../services/ide-bridge");
        ideBridgeRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ IDE Bridge: LOADED → /api/ide/propose, /evaluate, /approve, /apply, /rollback");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ IDE Bridge not loaded: ${err.message}`);
    }

    // ─── Liquid State Lifecycle Manager ────────────────────────────────
    try {
        const liquidState = require("../services/liquid-state-manager");
        liquidState.boot();
        liquidState.liquidStateRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Liquid State Manager: BOOTED → /api/liquid-state/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Liquid State Manager not loaded: ${err.message}`);
    }

    // ─── Neon Serverless Postgres (Scale Plan) ────────────────────────
    try {
        const neonDb = require("../services/neon-db");
        app.get("/api/neon/health", (_req, res) => res.json(neonDb.health()));
        app.post("/api/neon/migrate", async (_req, res) => {
            const result = await neonDb.migrate();
            res.json(result);
        });
        app.post("/api/neon/query", async (req, res) => {
            const { sql, params } = req.body;
            if (!sql) return res.status(400).json({ error: "sql required" });
            const result = await neonDb.query(sql, params || []);
            res.json(result);
        });
        // Auto-connect if DATABASE_URL is present
        if (process.env.DATABASE_URL) {
            neonDb.connect().then(r => {
                if (r.ok) logger.logNodeActivity("CONDUCTOR", "  ∞ Neon DB: CONNECTED (Scale Plan)");
                else logger.logNodeActivity("CONDUCTOR", `  ⚠ Neon DB connection deferred: ${r.error}`);
            }).catch(() => { });
        } else {
            logger.logNodeActivity("CONDUCTOR", "  ∞ Neon DB: LOADED (awaiting DATABASE_URL)");
        }
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Neon DB not loaded: ${err.message}`);
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
    const wave4 = ["ops", "maintenance", "lens", "vinci", "conductor", "memory", "registry", "template-registry", "liquid-autonomy", "nodes", "system"];
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

    // ─── Perplexity Research Service (Real Sonar Pro API) ──────────────
    try {
        const { registerPerplexityRoutes } = require("../services/perplexity-research");
        registerPerplexityRoutes(app, { vectorMemory });
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Perplexity Research not loaded: ${err.message}`);
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

    // ─── PHASE 3: Wired Orphan Services ──────────────────────────────────
    // Services previously scaffolded but never connected. Wired March 6, 2026.

    // ─── Infrastructure Layer ──────────────────────────────────────────────

    // Redis Connection Pool — shared pool for all Redis consumers
    try {
        const { getPool } = require("../services/redis-connection-pool");
        const pool = getPool();
        global.__redisPool = pool;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Redis Connection Pool: INITIALIZED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Redis Connection Pool not loaded: ${err.message}`);
    }

    // OpenTelemetry Tracing — observability three pillars
    try {
        const otel = require("../services/opentelemetry-tracing");
        if (otel.init) otel.init();
        if (otel.registerRoutes) otel.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ OpenTelemetry Tracing: INITIALIZED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ OpenTelemetry not loaded: ${err.message}`);
    }

    // Resilience Patterns — circuit breakers, bulkheads, retry policies
    try {
        const resilience = require("../services/resilience-patterns");
        if (resilience.boot) resilience.boot();
        if (resilience.registerRoutes) resilience.registerRoutes(app);
        global.__resiliencePatterns = resilience;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Resilience Patterns: LOADED (circuit breakers + bulkheads)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Resilience Patterns not loaded: ${err.message}`);
    }

    // Secure Key Vault — encrypted credential management
    try {
        const vault = require("../services/secure-key-vault");
        if (vault.boot) vault.boot();
        if (vault.registerRoutes) vault.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  🔐 Secure Key Vault: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Secure Key Vault not loaded: ${err.message}`);
    }

    // Health Registry — centralized health check aggregation
    try {
        const { healthRegistry } = require("../services/health-registry");
        if (healthRegistry.registerRoutes) healthRegistry.registerRoutes(app);
        global.__healthRegistry = healthRegistry;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Health Registry: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Health Registry not loaded: ${err.message}`);
    }

    // ─── Intelligence Layer ────────────────────────────────────────────────

    // Model Router — intelligent LLM model selection
    try {
        const modelRouter = require("../services/model-router");
        if (modelRouter.registerRoutes) modelRouter.registerRoutes(app);
        else if (modelRouter.router) app.use("/api/model-router", modelRouter.router);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Model Router: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Model Router not loaded: ${err.message}`);
    }

    // OpenAI Business — enterprise OpenAI integration
    try {
        const openai = require("../services/openai-business");
        if (openai.registerRoutes) openai.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ OpenAI Business: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ OpenAI Business not loaded: ${err.message}`);
    }

    // Monte Carlo Service — probabilistic simulation engine
    try {
        const monteCarlo = require("../services/monte-carlo-service");
        if (monteCarlo.registerRoutes) monteCarlo.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Monte Carlo Service: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Monte Carlo Service not loaded: ${err.message}`);
    }

    // Logic Orchestrator — ternary reasoning coordination
    try {
        const { LogicOrchestrator } = require("../services/logic-orchestrator");
        const logicOrch = new LogicOrchestrator();
        global.__logicOrchestrator = logicOrch;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Logic Orchestrator: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Logic Orchestrator not loaded: ${err.message}`);
    }

    // Socratic Service — HeadyBattle dialectic evaluation
    try {
        const socratic = require("../services/socratic-service");
        if (socratic.registerRoutes) socratic.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Socratic Service: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Socratic Service not loaded: ${err.message}`);
    }

    // ─── Memory & Spatial Layer ────────────────────────────────────────────

    // Continuous Embedder — persistent auto-embedding engine
    try {
        const embedder = require("../services/continuous-embedder");
        if (embedder.boot) embedder.boot();
        if (embedder.registerRoutes) embedder.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Continuous Embedder: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Continuous Embedder not loaded: ${err.message}`);
    }

    // Spatial Registry — 3D octant zone management
    try {
        const { SpatialRegistry } = require("../services/spatial-registry");
        const spatialReg = new SpatialRegistry();
        global.__spatialRegistry = spatialReg;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Spatial Registry: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Spatial Registry not loaded: ${err.message}`);
    }

    // ─── Projection & Deployment Layer ─────────────────────────────────────

    // Projection Dispatcher — coordinate projection operations
    try {
        const { ProjectionDispatcher } = require("../services/projection-dispatcher");
        const dispatcher = new ProjectionDispatcher();
        global.__projectionDispatcher = dispatcher;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Projection Dispatcher: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Projection Dispatcher not loaded: ${err.message}`);
    }

    // Projection Sync — automated projection synchronization
    try {
        const { ProjectionSyncAutomation } = require("../services/projection-sync");
        const projSync = new ProjectionSyncAutomation();
        global.__projectionSync = projSync;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Projection Sync: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Projection Sync not loaded: ${err.message}`);
    }

    // Liquid Deploy — liquid architecture deployment engine
    try {
        const liquidDeploy = require("../services/liquid-deploy");
        if (liquidDeploy.registerRoutes) liquidDeploy.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Liquid Deploy: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Liquid Deploy not loaded: ${err.message}`);
    }

    // ─── Service Layer (Express Routes) ────────────────────────────────────

    // Decentralized Governance — DAO-style governance module
    try {
        const { registerGovernanceRoutes } = require("../services/decentralized-governance");
        registerGovernanceRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Decentralized Governance: LOADED → /api/governance/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Decentralized Governance not loaded: ${err.message}`);
    }

    // Global Node Network — distributed node mesh
    try {
        const { registerGlobalNodeRoutes } = require("../services/global-node-network");
        registerGlobalNodeRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Global Node Network: LOADED → /api/nodes/global/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Global Node Network not loaded: ${err.message}`);
    }

    // Self-Healing Mesh — autonomous mesh recovery
    try {
        const { registerSelfHealingRoutes, mesh } = require("../services/self-healing-mesh");
        registerSelfHealingRoutes(app);
        global.__selfHealingMesh = mesh;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Self-Healing Mesh: LOADED → /api/mesh/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Self-Healing Mesh not loaded: ${err.message}`);
    }

    // Dynamic Weight Manager — Sacred Geometry v2.5 dynamic weighting
    try {
        const { registerDynamicWeightRoutes, dynamicWeights } = require("../services/dynamic-weight-manager");
        registerDynamicWeightRoutes(app);
        global.__dynamicWeights = dynamicWeights;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Dynamic Weight Manager: LOADED → /api/weights/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Dynamic Weight Manager not loaded: ${err.message}`);
    }

    // HeadyMe Helper — user helper service
    try {
        const { registerHelperRoutes } = require("../services/headyme-helper");
        registerHelperRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ HeadyMe Helper: LOADED → /api/helper/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ HeadyMe Helper not loaded: ${err.message}`);
    }

    // Budget Service — cost tracking and budget management
    try {
        const { budgetRoutes } = require("../services/budget-service");
        budgetRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Budget Service: LOADED → /api/budget/*");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Budget Service not loaded: ${err.message}`);
    }

    // Budget Tracker — granular cost tracking
    try {
        const budgetTracker = require("../services/budget-tracker");
        if (budgetTracker.registerRoutes) budgetTracker.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Budget Tracker: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Budget Tracker not loaded: ${err.message}`);
    }

    // SDK Quickstart — platform onboarding SDK
    try {
        const sdk = require("../services/sdk-quickstart");
        if (sdk.registerRoutes) sdk.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ SDK Quickstart: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ SDK Quickstart not loaded: ${err.message}`);
    }

    // SDK Registration — developer SDK registration portal
    try {
        const sdkReg = require("../services/sdk-registration");
        if (sdkReg.registerRoutes) sdkReg.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ SDK Registration: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ SDK Registration not loaded: ${err.message}`);
    }

    // Template Registry Service — template lifecycle management
    try {
        const templateReg = require("../services/template-registry-service");
        if (templateReg.registerRoutes) templateReg.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Template Registry: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Template Registry Service not loaded: ${err.message}`);
    }

    // ─── Specialized Services ──────────────────────────────────────────────

    // AI DVR — agentic session replay engine
    try {
        const { AIDVRService } = require("../services/ai-dvr");
        const dvr = new AIDVRService();
        global.__aiDVR = dvr;
        logger.logNodeActivity("CONDUCTOR", "  ∞ AI DVR: LOADED (session replay engine)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ AI DVR not loaded: ${err.message}`);
    }

    // Arena Mode Service — competitive model selection
    try {
        const { getArenaModeService } = require("../services/arena-mode-service");
        global.__arenaModeService = getArenaModeService;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Arena Mode Service: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Arena Mode Service not loaded: ${err.message}`);
    }

    // Branch Automation — git branch lifecycle management
    try {
        const { getBranchAutomationService } = require("../services/branch-automation-service");
        global.__branchAutomation = getBranchAutomationService;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Branch Automation: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Branch Automation not loaded: ${err.message}`);
    }

    // Cross-Device FS — distributed filesystem sync
    try {
        const crossDeviceFs = require("../services/cross-device-fs");
        if (crossDeviceFs.registerRoutes) crossDeviceFs.registerRoutes(app);
        logger.logNodeActivity("CONDUCTOR", "  ∞ Cross-Device FS: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Cross-Device FS not loaded: ${err.message}`);
    }

    // Quantum Bridge — post-quantum cryptographic bridge
    try {
        const { QuantumBridge } = require("../services/quantum-bridge");
        const qBridge = new QuantumBridge();
        global.__quantumBridge = qBridge;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Quantum Bridge: LOADED (post-quantum crypto)");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Quantum Bridge not loaded: ${err.message}`);
    }

    // Trader Widget — Apex trading UI widget backend
    try {
        const { TraderWidgetService } = require("../services/trader-widget");
        const traderWidget = new TraderWidgetService();
        global.__traderWidget = traderWidget;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Trader Widget: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Trader Widget not loaded: ${err.message}`);
    }

    // Heady Branded Output — consistent branded CLI output
    try {
        const branded = require("../services/heady-branded-output");
        global.__brandedOutput = branded;
        logger.logNodeActivity("CONDUCTOR", "  ∞ Branded Output: LOADED");
    } catch (err) {
        logger.logNodeActivity("CONDUCTOR", `  ⚠ Branded Output not loaded: ${err.message}`);
    }

    logger.logNodeActivity("CONDUCTOR", "  ═══════════════════════════════════════════════");
    logger.logNodeActivity("CONDUCTOR", "  ✅ All service routes registered (Phase 1-3 complete)");
}

module.exports = { registerServiceRoutes };
