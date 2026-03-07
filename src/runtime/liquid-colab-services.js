/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Liquid Colab Services ═══════════════════════════════════════════
 *
 * Wires all 14 Liquid Architecture components to operate THROUGH
 * the 3D vector workspace and Colab GPU runtime.
 *
 * Every component action (observe, reason, reflect, allocate) becomes
 * a vector operation:
 *   1. Embed input into 3D space
 *   2. Query relevant memories via zone-first search
 *   3. Link results via graph relationship edges
 *   4. Return context-enriched result
 *
 * Architecture:
 *   LiquidAllocator  →  decides which components to activate
 *   LiquidColabEngine →  executes each component as vector operations
 *   3D Vector Memory  →  all state stored in 8-octant zones
 *   GPUVectorStore    →  GPU-accelerated similarity (Colab)
 * ═════════════════════════════════════════════════════════════════════
 */

const EventEmitter = require("events");
const logger = require("./utils/logger");
const { LiquidAllocator, analyzeContext, calculateAffinity, COMPONENT_REGISTRY, STORAGE_TOPOLOGY, HF_SPACES_TOPOLOGY } = require("./hc_liquid");

// Lazy-load vector memory to avoid circular deps
let _vm = null;
function vm() {
    if (!_vm) {
        _vm = require("./vector-memory");
        _vm.init();
    }
    return _vm;
}

// Lazy-load GPU store
let _gpu = null;
function gpu() {
    if (!_gpu) {
        try {
            const { GPUVectorStore } = require("./colab-runtime");
            _gpu = new GPUVectorStore(384);
        } catch {
            _gpu = { store: () => ({ ok: false }), search: () => [], getStats: () => ({ gpu: false }) };
        }
    }
    return _gpu;
}

// ─── Component Executors ─────────────────────────────────────────────
// Each maps a liquid component to vector workspace operations.

const EXECUTORS = {
    /**
     * LENS: Observe system state, store as differential vector.
     * Input: { source, metric, value, context }
     * Vector op: smartIngest → zone placement → graph link to prior observations
     */
    async lens(input) {
        const content = `[LENS] ${input.source || "system"} | ${input.metric || "observation"}: ${JSON.stringify(input.value)} | ${input.context || ""}`;
        const id = await vm().smartIngest({
            content,
            metadata: { type: "lens-observation", source: input.source, metric: input.metric, component: "lens" },
        }, 0.95);

        // Query for related prior observations
        const related = id ? await vm().queryMemory(`${input.source} ${input.metric}`, 3, { type: "lens-observation" }) : [];

        // Link to most recent related observation
        if (id && related.length > 0 && related[0].id !== id) {
            vm().addRelationship(id, related[0].id, "observed_after", 0.8);
        }

        return {
            component: "lens",
            action: "observe",
            stored: !!id,
            vectorId: id,
            relatedObservations: related.length,
            significance: id ? 0.8 : 0.2,
        };
    },

    /**
     * BRAIN: Reason over vector memory with graph traversal.
     * Input: { query, depth }
     * Vector op: queryWithRelationships → multi-hop graph → enriched results
     */
    async brain(input) {
        const query = input.query || input.prompt || "system reasoning request";
        const depth = input.depth || 5;

        const results = await vm().queryWithRelationships(query, depth, {}, 1);

        // Store the reasoning request itself for future context
        await vm().smartIngest({
            content: `[BRAIN] Reasoning: ${query} → ${results.length} results, top score: ${results[0]?.score?.toFixed(3) || 0}`,
            metadata: { type: "brain-reasoning", component: "brain", query },
        }, 0.90);

        return {
            component: "brain",
            action: "reason",
            results: results.map(r => ({
                content: r.content?.substring(0, 200),
                score: r.score,
                zone: r.zone,
                graphEdges: r.graphEdges || 0,
                relationships: (r.relationships || []).map(rel => ({
                    relation: rel.relation,
                    weight: rel.weight,
                })),
            })),
            totalResults: results.length,
            hybrid: results.some(r => r.hybrid),
        };
    },

    /**
     * SOUL: Reflect on memory quality via importance scoring.
     * Input: { scope } — "all" or "recent"
     * Vector op: computeImportance across vectors → quality report
     */
    async soul(input) {
        const stats = vm().getStats();
        const scope = input.scope || "summary";

        // Run importance analysis on a sample
        const sample = await vm().queryMemory("system health quality reflection", 10);
        const importanceScores = sample.map(s => ({
            id: s.id,
            score: s.score,
            importance: vm().computeImportance(s),
            zone: s.zone,
        }));

        const avgImportance = importanceScores.length > 0
            ? importanceScores.reduce((sum, s) => sum + s.importance, 0) / importanceScores.length
            : 0;

        return {
            component: "soul",
            action: "reflect",
            memoryQuality: {
                avgImportance: +avgImportance.toFixed(4),
                totalVectors: stats.total_vectors,
                zones: stats.spatial.zones,
                zoneHitRate: stats.spatial.zone_hit_rate,
                graphEdges: stats.graph.totalEdges,
            },
            sampleScores: scope === "detailed" ? importanceScores : importanceScores.slice(0, 3),
        };
    },

    /**
     * CONDUCTOR: Orchestrate system state from zone distribution.
     * Vector op: getStats + buildOutboundRepresentation → orchestration view
     */
    async conductor(input) {
        const stats = vm().getStats();
        const projection = vm().buildOutboundRepresentation({
            channel: input.channel || "internal",
            topK: input.topK || 12,
        });

        return {
            component: "conductor",
            action: "orchestrate",
            systemState: {
                totalVectors: stats.total_vectors,
                shards: stats.num_shards,
                zones: stats.spatial.zone_distribution,
                activeZones: projection.active_zones,
                graph: stats.graph,
                embeddingSource: stats.embedding_source,
            },
            projection: {
                profile: projection.profile,
                sampleCount: projection.sample?.length || 0,
            },
            gpu: gpu().getStats(),
        };
    },

    /**
     * BATTLE: Cross-zone competition — query all zones, compare scores.
     * Input: { challenge }
     * Vector op: parallel zone queries → score comparison → winner
     */
    async battle(input) {
        const challenge = input.challenge || input.query || "best solution";
        const zoneResults = [];

        // Query each zone separately
        for (let z = 0; z < 8; z++) {
            const results = await vm().queryMemory(challenge, 2);
            const zoneSpecific = results.filter(r => r.zone === z);
            if (zoneSpecific.length > 0) {
                zoneResults.push({
                    zone: z,
                    topScore: zoneSpecific[0].score,
                    champion: zoneSpecific[0].content?.substring(0, 100),
                    contenders: zoneSpecific.length,
                });
            }
        }

        zoneResults.sort((a, b) => b.topScore - a.topScore);

        return {
            component: "battle",
            action: "compete",
            challenge,
            winner: zoneResults[0] || null,
            zoneCompetition: zoneResults.slice(0, 4),
            totalZonesCompeted: zoneResults.length,
        };
    },

    /**
     * VINCI: Creative pattern detection — find novel vectors.
     * Input: { topic }
     * Vector op: densityGate at LOW threshold → find unique content
     */
    async vinci(input) {
        const topic = input.topic || input.query || "creative patterns";
        const results = await vm().queryMemory(topic, 8);

        // Score for novelty via importance (surprise component)
        const scored = results.map(r => ({
            content: r.content?.substring(0, 150),
            score: r.score,
            zone: r.zone,
            importance: vm().computeImportance(r),
            _3d: r._3d,
        }));

        // Most surprising = most creative
        scored.sort((a, b) => b.importance - a.importance);

        return {
            component: "vinci",
            action: "create",
            topic,
            patterns: scored.slice(0, 5),
            noveltyScore: scored.length > 0 ? +scored[0].importance.toFixed(4) : 0,
        };
    },

    /**
     * PATTERNS: Resilience analysis from zone stats.
     * Vector op: zoneStats + applyDecay analysis
     */
    async patterns(input) {
        const stats = vm().getStats();
        const decayResult = vm().applyDecay(0.15);

        return {
            component: "patterns",
            action: "analyze-resilience",
            resilience: {
                zoneHitRate: stats.spatial.zone_hit_rate,
                expansions: stats.spatial.expansions,
                queries: stats.spatial.queries,
                zoneDistribution: stats.spatial.zone_distribution,
            },
            decay: {
                decayed: decayResult.decayed,
                preserved: decayResult.preserved,
                total: decayResult.total,
            },
        };
    },

    /**
     * NOTION: Knowledge ingestion + graph retrieval.
     * Input: { content, query }
     * Vector op: ingest with relationships → queryWithRelationships
     */
    async notion(input) {
        let storedId = null;
        if (input.content) {
            storedId = await vm().ingestMemory({
                content: input.content,
                metadata: { type: "knowledge", component: "notion", source: input.source || "user" },
            });
        }

        const query = input.query || input.content || "knowledge base";
        const results = await vm().queryWithRelationships(query, 5, { type: "knowledge" }, 1);

        return {
            component: "notion",
            action: input.content ? "ingest-and-query" : "query",
            storedId,
            results: results.map(r => ({
                content: r.content?.substring(0, 200),
                score: r.score,
                graphEdges: r.graphEdges || 0,
                hybrid: r.hybrid,
            })),
            totalKnowledge: results.length,
        };
    },

    /**
     * OPS: Infrastructure health from shard and zone state.
     * Vector op: getStats + persistAllShards
     */
    async ops(input) {
        const stats = vm().getStats();
        if (input.action === "persist") {
            vm().persistAllShards();
        }

        return {
            component: "ops",
            action: "infrastructure",
            health: {
                shards: stats.shards,
                totalVectors: stats.total_vectors,
                embeddingSource: stats.embedding_source,
                remoteEmbeds: stats.remote_embeds,
                localFallbacks: stats.local_fallbacks,
            },
            gpu: gpu().getStats(),
        };
    },

    /**
     * MAINTENANCE: Run autonomous memory maintenance.
     * Vector op: runAutonomousMaintenance → decay + consolidation
     */
    async maintenance(input) {
        const result = await vm().runAutonomousMaintenance({
            decayThreshold: input.decayThreshold || 0.15,
            ltmThreshold: input.ltmThreshold || 0.5,
        });

        return {
            component: "maintenance",
            action: "autonomous-maintenance",
            result,
            autonomousState: vm().getAutonomousState(),
        };
    },

    /**
     * AUTO-SUCCESS: Continuous improvement loop.
     * Vector op: consolidateMemory + importance re-scoring
     */
    async "auto-success"(input) {
        const consolidation = await vm().consolidateMemory(input.ltmThreshold || 0.5);
        const stats = vm().getStats();

        return {
            component: "auto-success",
            action: "improve",
            consolidation,
            memoryHealth: {
                totalVectors: stats.total_vectors,
                graphEdges: stats.graph.totalEdges,
                zoneHitRate: stats.spatial.zone_hit_rate,
            },
        };
    },

    /**
     * STREAM: Real-time 3D projection of memory state.
     * Vector op: buildOutboundRepresentation for live channels
     */
    async stream(input) {
        const projection = vm().buildOutboundRepresentation({
            channel: input.channel || "canvas",
            profile: input.profile || "cartesian",
            topK: input.topK || 12,
        });

        return {
            component: "stream",
            action: "project",
            projection,
        };
    },

    /**
     * BUDDY: Quick-access memory retrieval with user context.
     * Input: { query }
     * Vector op: queryMemory with user-facing context
     */
    async buddy(input) {
        const query = input.query || input.message || "help";
        const results = await vm().queryMemory(query, 5);

        return {
            component: "buddy",
            action: "assist",
            query,
            suggestions: results.map(r => ({
                content: r.content?.substring(0, 200),
                score: r.score,
                zone: r.zone,
            })),
        };
    },

    /**
     * CLOUD: Outbound projection for external APIs.
     * Vector op: buildOutboundRepresentation for external channels
     */
    async cloud(input) {
        const projection = vm().buildOutboundRepresentation({
            channel: input.channel || "public-api",
            profile: input.profile || "spherical",
            topK: input.topK || 12,
        });

        return {
            component: "cloud",
            action: "project-external",
            projection,
        };
    },
};

// ─── Liquid Colab Engine ─────────────────────────────────────────────
class LiquidColabEngine extends EventEmitter {
    constructor() {
        super();
        this.allocator = new LiquidAllocator();
        this.executionLog = [];
        this.totalExecutions = 0;
        this.startedAt = new Date().toISOString();
    }

    /**
     * Execute a component action in vector space.
     * Uses LiquidAllocator to determine optimal components,
     * then runs the corresponding vector executor.
     */
    async execute(componentId, input = {}) {
        const executor = EXECUTORS[componentId];
        if (!executor) {
            return { ok: false, error: `Unknown component: ${componentId}`, available: Object.keys(EXECUTORS) };
        }

        const startMs = Date.now();
        try {
            const result = await executor(input);
            const durationMs = Date.now() - startMs;

            this.totalExecutions++;
            const logEntry = {
                id: `exec-${this.totalExecutions}`,
                component: componentId,
                durationMs,
                ts: new Date().toISOString(),
            };
            this.executionLog.push(logEntry);
            if (this.executionLog.length > 200) this.executionLog.splice(0, this.executionLog.length - 200);

            this.emit("execution:complete", { ...logEntry, result });

            return { ok: true, ...result, durationMs };
        } catch (err) {
            return { ok: false, component: componentId, error: err.message, durationMs: Date.now() - startMs };
        }
    }

    /**
     * Smart execute: let the LiquidAllocator decide which components to use,
     * then execute the top-ranked ones.
     */
    async smartExecute(request = {}) {
        const flow = this.allocator.allocate(request);
        const results = [];

        for (const alloc of flow.allocated) {
            const result = await this.execute(alloc.component, request);
            results.push({ component: alloc.component, affinity: alloc.affinity, result });
        }

        return {
            ok: true,
            flow,
            results,
            totalExecutions: this.totalExecutions,
        };
    }

    /**
     * Get engine health and workspace state.
     */
    getHealth() {
        let memStats;
        try { memStats = vm().getStats(); } catch { memStats = { total_vectors: 0 }; }

        return {
            status: "ACTIVE",
            service: "liquid-colab",
            mode: "vector-native",
            startedAt: this.startedAt,
            totalExecutions: this.totalExecutions,
            components: Object.keys(EXECUTORS).length,
            allocator: {
                totalFlows: this.allocator.totalFlows,
                registeredComponents: Object.keys(COMPONENT_REGISTRY).length,
            },
            workspace: {
                totalVectors: memStats.total_vectors,
                architecture: memStats.architecture || "3d-spatial-sharded",
                zones: memStats.spatial?.zones || 8,
                graph: memStats.graph || { totalEdges: 0 },
            },
            gpu: gpu().getStats(),
            ts: new Date().toISOString(),
        };
    }

    getExecutionLog(limit = 20) {
        return this.executionLog.slice(-limit);
    }
}

// ─── Express Routes ──────────────────────────────────────────────────
function registerLiquidColabRoutes(app, engine = new LiquidColabEngine()) {

    // Health
    app.get("/api/liquid-colab/health", (req, res) => {
        res.json(engine.getHealth());
    });

    // Execute a specific component
    app.post("/api/liquid-colab/execute", async (req, res) => {
        const { component, ...input } = req.body;
        if (!component) {
            return res.status(400).json({ ok: false, error: "component is required", available: Object.keys(EXECUTORS) });
        }
        const result = await engine.execute(component, input);
        res.json(result);
    });

    // Smart execute — let allocator decide
    app.post("/api/liquid-colab/smart", async (req, res) => {
        const result = await engine.smartExecute(req.body);
        res.json(result);
    });

    // Lens shorthand: observe
    app.post("/api/liquid-colab/observe", async (req, res) => {
        const result = await engine.execute("lens", req.body);
        res.json(result);
    });

    // Brain shorthand: reason
    app.post("/api/liquid-colab/reason", async (req, res) => {
        const result = await engine.execute("brain", req.body);
        res.json(result);
    });

    // Soul shorthand: reflect
    app.post("/api/liquid-colab/reflect", async (req, res) => {
        const result = await engine.execute("soul", req.body);
        res.json(result);
    });

    // Workspace state
    app.get("/api/liquid-colab/workspace", (req, res) => {
        try {
            const stats = vm().getStats();
            const projection = vm().buildOutboundRepresentation({
                channel: req.query.channel || "internal",
                topK: parseInt(req.query.topK) || 12,
            });
            res.json({
                ok: true,
                workspace: stats,
                projection,
                allocator: engine.allocator.getState(),
            });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // 3D projection
    app.get("/api/liquid-colab/projection", (req, res) => {
        const projection = vm().buildOutboundRepresentation({
            channel: req.query.channel || "canvas",
            profile: req.query.profile,
            topK: parseInt(req.query.topK) || 12,
        });
        res.json(projection);
    });

    // Execution log
    app.get("/api/liquid-colab/log", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json({ ok: true, log: engine.getExecutionLog(limit), totalExecutions: engine.totalExecutions });
    });

    logger.logSystem("  💧 LiquidColab: LOADED (14 components, vector-native, 3D workspace)");
    logger.logSystem("    → Endpoints: /api/liquid-colab/health, /execute, /smart, /observe, /reason, /reflect, /workspace, /projection, /log");

    return engine;
}

module.exports = {
    LiquidColabEngine,
    registerLiquidColabRoutes,
    EXECUTORS,
};
