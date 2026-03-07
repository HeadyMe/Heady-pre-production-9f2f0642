'use strict';
/**
 * Buddy System Service
 * ════════════════════════════════════════════════════════════
 * The continuous, asynchronous shadow agent responsible for:
 *   1. Continuous Ingestion — listens for new data on the pipeline
 *   2. Dimensionality Mapping — assigns 3D coordinates via SpatialEmbedder
 *   3. Spatial Cache Sync — writes to Octree + pushes to Redis cache
 *   4. Predictive Pre-fetching — trajectory-based anticipation
 *
 * Operates entirely in the background. Never blocks the Executor.
 * ════════════════════════════════════════════════════════════
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('../core/heady-yaml');
const { embed, batchEmbed, deterministicReceipt } = require('./spatial-embedder');
const { OctreeManager } = require('./octree-manager');
const { RedisSyncBridge } = require('./redis-sync-bridge');

const CONFIG_PATH = path.resolve(__dirname, '../../configs/services/buddy-system-config.yaml');
const TOPOLOGY_PATH = path.resolve(__dirname, '../../configs/services/sacred-geometry-topology.yaml');

function loadConfig() {
    try { return yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function loadTopology() {
    try { return yaml.load(fs.readFileSync(TOPOLOGY_PATH, 'utf8')); } catch { return {}; }
}

// ── Trajectory Tracker ──────────────────────────────────────
class TrajectoryTracker {
    constructor(smoothing = 0.7, lookaheadSteps = 3) {
        this.smoothing = smoothing;
        this.lookaheadSteps = lookaheadSteps;
        this.history = []; // last N positions
        this.maxHistory = 20;
    }

    /**
     * Record a new position and compute predicted next position.
     * @param {{ x: number, y: number, z: number }} pos
     * @returns {{ x: number, y: number, z: number } | null} predicted position
     */
    record(pos) {
        this.history.push({ ...pos, t: Date.now() });
        if (this.history.length > this.maxHistory) this.history.shift();
        return this.predict();
    }

    predict() {
        if (this.history.length < 2) return null;

        const n = this.history.length;
        const curr = this.history[n - 1];
        const prev = this.history[n - 2];

        // Exponentially smoothed velocity
        let vx = curr.x - prev.x;
        let vy = curr.y - prev.y;
        let vz = curr.z - prev.z;

        if (this.history.length >= 3) {
            const prev2 = this.history[n - 3];
            const vx2 = prev.x - prev2.x;
            const vy2 = prev.y - prev2.y;
            const vz2 = prev.z - prev2.z;
            vx = this.smoothing * vx + (1 - this.smoothing) * vx2;
            vy = this.smoothing * vy + (1 - this.smoothing) * vy2;
            vz = this.smoothing * vz + (1 - this.smoothing) * vz2;
        }

        return {
            x: clamp(curr.x + vx * this.lookaheadSteps, -1, 1),
            y: clamp(curr.y + vy * this.lookaheadSteps, 0, 1),
            z: clamp(curr.z + vz * this.lookaheadSteps, 0, 1),
        };
    }
}

// ── Buddy System ────────────────────────────────────────────
class BuddySystem {
    constructor(config) {
        this.config = config || loadConfig();
        this.topology = loadTopology();
        this.octree = new OctreeManager(this.config.octree);
        this.redisBridge = new RedisSyncBridge(this.config.redis);
        this.tracker = new TrajectoryTracker(
            this.config.prefetch?.trajectory_smoothing || 0.7,
            this.config.prefetch?.trajectory_lookahead_steps || 3,
        );
        this.prefetchRadius = this.config.prefetch?.radius || 0.15;
        this.maxPrefetch = this.config.prefetch?.max_prefetch_items || 64;
        this.decayEnabled = this.config.temporal_decay?.enabled ?? true;
        this.decayLambda = this.config.temporal_decay?.lambda || 0.001;
        this.minRelevance = this.config.temporal_decay?.min_relevance || 0.05;

        this._ingestionCount = 0;
        this._prefetchCount = 0;
        this._running = false;
        this._ingestionQueue = [];
    }

    // ── 1. Continuous Ingestion ─────────────────────────────
    /**
     * Ingest a data payload from the HCFullPipeline.
     * @param {string} id - Unique identifier
     * @param {string} text - Raw content
     * @param {object} [meta] - { filePath, mtime, birthtime, isRealtime }
     * @returns {{ id, coords: {x,y,z}, receipt: string }}
     */
    ingest(id, text, meta = {}) {
        // 2. Dimensionality Mapping
        const coords = embed(text, meta);

        // 3. Spatial Cache Sync → Octree
        const payload = {
            id,
            text: text.slice(0, 2000), // store truncated for cache
            filePath: meta.filePath || '',
            ingested_at: new Date().toISOString(),
        };
        this.octree.insert(id, coords.x, coords.y, coords.z, payload);

        // 3b. Push to Redis cache
        this.redisBridge.pushBlock(id, { ...coords, payload }).catch(() => { });

        this._ingestionCount++;

        // Publish ingestion event
        this.redisBridge.publish('buddy:ingestion', {
            id, x: coords.x, y: coords.y, z: coords.z,
            receipt: coords.receipt,
        }).catch(() => { });

        return { id, coords: { x: coords.x, y: coords.y, z: coords.z }, receipt: coords.receipt };
    }

    /**
     * Batch ingest multiple payloads.
     */
    batchIngest(items) {
        return items.map(({ id, text, meta }) => this.ingest(id, text, meta));
    }

    // ── 4. Predictive Pre-fetching ──────────────────────────
    /**
     * Update the Executor's current position and pre-fetch nearby blocks.
     * @param {{ x, y, z }} executorPosition
     * @returns {{ prefetched: number, predicted: {x,y,z}|null }}
     */
    async updateExecutorPosition(executorPosition) {
        const predicted = this.tracker.record(executorPosition);

        // Fetch blocks around current position
        const currentBlocks = this.octree.radiusQuery(
            executorPosition.x, executorPosition.y, executorPosition.z,
            this.prefetchRadius,
        );

        // Push current context blocks to high-speed cache
        const pushPromises = currentBlocks.slice(0, this.maxPrefetch).map(item =>
            this.redisBridge.pushBlock(item.id, {
                x: item.x, y: item.y, z: item.z,
                payload: item.payload,
                prefetched: true,
            }),
        );

        // If we have a predicted position, also pre-fetch ahead
        if (predicted) {
            const aheadBlocks = this.octree.radiusQuery(
                predicted.x, predicted.y, predicted.z,
                this.prefetchRadius,
            );
            for (const item of aheadBlocks.slice(0, this.maxPrefetch)) {
                pushPromises.push(
                    this.redisBridge.pushBlock(item.id, {
                        x: item.x, y: item.y, z: item.z,
                        payload: item.payload,
                        prefetched: true,
                        predictive: true,
                    }),
                );
            }
        }

        await Promise.all(pushPromises);
        this._prefetchCount += pushPromises.length;

        return { prefetched: pushPromises.length, predicted };
    }

    // ── Temporal Decay ──────────────────────────────────────
    /**
     * Apply temporal decay to all items. Down-rank stale items.
     * @returns {{ pruned: number, total: number }}
     */
    applyTemporalDecay() {
        if (!this.decayEnabled) return { pruned: 0, total: this.octree.size() };

        const now = Date.now();
        const allItems = this.octree.all();
        let pruned = 0;

        for (const item of allItems) {
            if (!item.payload?.ingested_at) continue;
            const ageMs = now - new Date(item.payload.ingested_at).getTime();
            const ageSec = ageMs / 1000;
            const relevance = Math.exp(-this.decayLambda * ageSec);

            if (relevance < this.minRelevance) {
                this.octree.remove(item.id);
                this.redisBridge.removeBlock(item.id).catch(() => { });
                pruned++;
            }
        }

        return { pruned, total: this.octree.size() };
    }

    // ── Nearest Context Retrieval ───────────────────────────
    /**
     * Retrieve nearest context for a given query coordinate.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} [k=5]
     * @returns {Array}
     */
    retrieveContext(x, y, z, k = 5) {
        return this.octree.nearest(x, y, z, k);
    }

    /**
     * Retrieve context for a text query (auto-embeds then searches).
     * @param {string} queryText
     * @param {number} [k=5]
     * @returns {{ coords: {x,y,z}, results: Array, receipt: string }}
     */
    queryContext(queryText, k = 5) {
        const coords = embed(queryText, { isRealtime: true });
        const results = this.octree.nearest(coords.x, coords.y, coords.z, k);
        const receipt = deterministicReceipt({
            query: queryText.slice(0, 200),
            coords: { x: coords.x, y: coords.y, z: coords.z },
            resultCount: results.length,
        });
        return { coords: { x: coords.x, y: coords.y, z: coords.z }, results, receipt };
    }

    // ── System Status ───────────────────────────────────────
    status() {
        return {
            service: 'buddy-system',
            running: this._running,
            octreeStats: this.octree.stats(),
            cacheStats: this.redisBridge.stats(),
            ingestionCount: this._ingestionCount,
            prefetchCount: this._prefetchCount,
            trajectoryHistory: this.tracker.history.length,
            topology: this.topology?.topologies?.tetrahedron?.nodes?.map(n => n.id) || [],
        };
    }

    // ── Lifecycle ───────────────────────────────────────────
    start() { this._running = true; }
    stop() { this._running = false; }
}

// ── Express Route Registration ──────────────────────────────
function registerRoutes(app) {
    const prefix = '/api/buddy-system';
    const buddy = new BuddySystem();
    buddy.start();

    app.get(`${prefix}/health`, (_req, res) => {
        res.json({ status: 'ok', ...buddy.status() });
    });

    app.post(`${prefix}/ingest`, (req, res) => {
        try {
            const { id, text, meta } = req.body || {};
            if (!id || !text) return res.status(400).json({ error: 'id and text required' });
            const result = buddy.ingest(id, text, meta || {});
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/ingest/batch`, (req, res) => {
        try {
            const { items } = req.body || {};
            if (!Array.isArray(items)) return res.status(400).json({ error: 'items (array) required' });
            const results = buddy.batchIngest(items);
            res.json({ ok: true, count: results.length, results });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/query`, (req, res) => {
        try {
            const { text, k } = req.body || {};
            if (!text) return res.status(400).json({ error: 'text required' });
            const result = buddy.queryContext(text, k || 5);
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/executor/position`, async (req, res) => {
        try {
            const { x, y, z } = req.body || {};
            const result = await buddy.updateExecutorPosition({ x: x || 0, y: y || 0, z: z || 0 });
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post(`${prefix}/decay`, (_req, res) => {
        try {
            const result = buddy.applyTemporalDecay();
            res.json({ ok: true, ...result });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get(`${prefix}/status`, (_req, res) => {
        res.json({ ok: true, ...buddy.status() });
    });

    return buddy;
}

// ── Utilities ───────────────────────────────────────────────
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

module.exports = { BuddySystem, TrajectoryTracker, registerRoutes };
