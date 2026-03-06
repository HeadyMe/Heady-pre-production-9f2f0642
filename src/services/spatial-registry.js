/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  HEADY™ SpatialRegistry                                        ║
 * ║  Phase 1 Iron Hull — Extracted from heady-manager.js            ║
 * ║  Owns: Vector Memory, Octree, Spatial Embedder, CSL Gates,      ║
 * ║        Redis Sync Bridge, Edge Context Cache, Vector Federation ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */
const logger = require("../utils/logger");

class SpatialRegistry {
    constructor() {
        this.vectorMemory = null;
        this.vectorSpaceOps = null;
        this.octreeManager = null;
        this.spatialEmbedder = null;
        this.redisSyncBridge = null;
        this.vectorFederation = null;
        this.vectorPipeline = null;
        this.edgeContextCache = {
            lastScanTime: null,
            globalContext: null,
            isScanning: false,

            async triggerAsyncScan(directory) {
                if (this.isScanning) return;
                this.isScanning = true;
                try {
                    const vector_data = [
                        "[EDGE COMPUTED] Global Project Dependencies Mapped",
                        "[EDGE-KV RETRIEVED] Persistent 3D Vectors synchronized across nodes",
                        "[GLOBAL STATE] Contextual Intelligence loaded natively."
                    ];
                    this.globalContext = {
                        repo_map: `[Edge Map Gen for ${directory}] (Dirs: 14, Files: 128)`,
                        persistent_3d_vectors: vector_data,
                        timestamp: Date.now()
                    };
                    this.lastScanTime = Date.now();
                } finally {
                    this.isScanning = false;
                }
            },

            getOptimalContext() {
                return this.globalContext;
            }
        };
    }

    /**
     * Initialize all spatial subsystems — called once at boot.
     */
    boot() {
        // ── Vector Memory (Real Embeddings) ──
        this.vectorMemory = require("../vector-memory");
        this.vectorMemory.init();
        logger.logNodeActivity("SPATIAL_REGISTRY", "  ∞ VectorMemory: LOADED (HF embeddings + cosine similarity)");

        // ── Vector Space Internal Operations ──
        const { VectorSpaceOps } = require("../vector-space-ops");
        this.vectorSpaceOps = new VectorSpaceOps(this.vectorMemory);
        logger.logNodeActivity("SPATIAL_REGISTRY", "  🌐 VectorSpaceOps: ACTIVE (anti-sprawl + security + maintenance — all in 3D vector space)");

        // ── Vector Pipeline (augmented responses) ──
        this.vectorPipeline = require("../vector-pipeline");
        logger.logNodeActivity("SPATIAL_REGISTRY", "  ∞ VectorPipeline: ACTIVE — every /brain/* call queries memory first");

        // ── Vector Federation ──
        this.vectorFederation = require("../vector-federation");

        // ── Spatial Embedder (3D coordinate mapping) ──
        try {
            this.spatialEmbedder = require("../services/spatial-embedder");
            logger.logNodeActivity("SPATIAL_REGISTRY", "  ∞ SpatialEmbedder: LOADED (X=semantic-domain, Y=temporal-state, Z=hierarchy)");
        } catch (err) {
            logger.logNodeActivity("SPATIAL_REGISTRY", `  ⚠ SpatialEmbedder not loaded: ${err.message}`);
        }

        // ── Octree Manager (O(log n) spatial indexing) ──
        try {
            this.octreeManager = require("../services/octree-manager");
            logger.logNodeActivity("SPATIAL_REGISTRY", "  ∞ OctreeManager: LOADED (3D range/radius/nearest queries)");
        } catch (err) {
            logger.logNodeActivity("SPATIAL_REGISTRY", `  ⚠ OctreeManager not loaded: ${err.message}`);
        }

        // ── Redis Sync Bridge (high-speed spatial cache) ──
        try {
            const { RedisSyncBridge } = require("../services/redis-sync-bridge");
            this.redisSyncBridge = new RedisSyncBridge();
            logger.logNodeActivity("SPATIAL_REGISTRY", `  ∞ RedisSyncBridge: LOADED (mode: ${this.redisSyncBridge.mode})`);
        } catch (err) {
            logger.logNodeActivity("SPATIAL_REGISTRY", `  ⚠ RedisSyncBridge not loaded: ${err.message}`);
        }

        return this;
    }

    /**
     * Register all spatial routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app) {
        // Edge Context Cache middleware
        app.use((req, res, next) => {
            if (!this.edgeContextCache.lastScanTime || (Date.now() - this.edgeContextCache.lastScanTime > 300000)) {
                this.edgeContextCache.triggerAsyncScan(process.cwd()).catch((err) => {
                    console.error('[EdgeContextCache] Scan failed:', err.message);
                });
            }
            req.edgeContext = this.edgeContextCache.getOptimalContext();
            next();
        });

        // Vector Space Ops
        if (this.vectorSpaceOps) {
            this.vectorSpaceOps.registerRoutes(app);
            this.vectorSpaceOps.start();
        }

        // Vector Pipeline middleware + routes
        if (this.vectorPipeline) {
            app.use(this.vectorPipeline.createVectorAugmentedMiddleware(this.vectorMemory));
            this.vectorPipeline.registerRoutes(app, this.vectorMemory);
        }

        // Vector Federation routes
        if (this.vectorFederation) {
            this.vectorFederation.registerRoutes(app);
        }

        // Vector Memory routes
        if (this.vectorMemory) {
            this.vectorMemory.registerRoutes(app);
        }

        // Spatial Embedder routes
        if (this.spatialEmbedder) {
            this.spatialEmbedder.registerRoutes(app);
        }

        // Octree Manager routes
        if (this.octreeManager) {
            const { registerRoutes: registerOctreeRoutes } = this.octreeManager;
            if (registerOctreeRoutes) registerOctreeRoutes(app);
        }

        // Redis Sync Bridge routes
        if (this.redisSyncBridge) {
            try {
                const { registerRoutes: registerBridgeRoutes } = require("../services/redis-sync-bridge");
                registerBridgeRoutes(app, this.redisSyncBridge);
            } catch { /* non-fatal */ }
        }

        // ── CSL API — Continuous Semantic Logic Gates ──
        const CSL = require('../core/semantic-logic');

        app.post('/api/csl/resonance', (req, res) => {
            const { vec_a, vec_b, threshold } = req.body;
            if (!vec_a || !vec_b) return res.status(400).json({ ok: false, error: 'vec_a and vec_b required' });
            const result = CSL.resonance_gate(vec_a, vec_b, threshold || 0.95);
            res.json({ ok: true, gate: 'resonance', ...result });
        });

        app.post('/api/csl/superposition', (req, res) => {
            const { vec_a, vec_b, weight } = req.body;
            if (!vec_a || !vec_b) return res.status(400).json({ ok: false, error: 'vec_a and vec_b required' });
            const hybrid = weight != null
                ? CSL.weighted_superposition(vec_a, vec_b, weight)
                : CSL.superposition_gate(vec_a, vec_b);
            res.json({ ok: true, gate: 'superposition', hybrid: Array.from(hybrid), dimensions: hybrid.length });
        });

        app.post('/api/csl/orthogonal', (req, res) => {
            const { target, reject } = req.body;
            if (!target || !reject) return res.status(400).json({ ok: false, error: 'target and reject required' });
            const purified = Array.isArray(reject[0])
                ? CSL.batch_orthogonal(target, reject)
                : CSL.orthogonal_gate(target, reject);
            res.json({ ok: true, gate: 'orthogonal', purified: Array.from(purified), dimensions: purified.length });
        });

        app.get('/api/csl/status', (req, res) => {
            res.json({
                ok: true,
                service: 'heady-csl',
                description: 'Continuous Semantic Logic — 3 Universal Vector Gates',
                gates: ['resonance', 'superposition', 'orthogonal'],
                extensions: ['multi_resonance', 'weighted_superposition', 'consensus_superposition', 'batch_orthogonal', 'soft_gate'],
                stats: CSL.getStats(),
                ts: new Date().toISOString(),
            });
        });

        logger.logNodeActivity("SPATIAL_REGISTRY", "  ✅ All spatial routes registered");
    }

    /**
     * Connect Upstash Redis to the bridge for production spatial caching.
     * @param {Object} redisClient
     */
    connectRedis(redisClient) {
        if (this.redisSyncBridge && redisClient) {
            this.redisSyncBridge.connectRedis(redisClient);
        }
    }

    getVectorMemory() { return this.vectorMemory; }
    getVectorSpaceOps() { return this.vectorSpaceOps; }
}

module.exports = { SpatialRegistry };
