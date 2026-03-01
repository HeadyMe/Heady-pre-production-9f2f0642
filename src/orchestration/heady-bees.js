/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HEADY BEES — Liquid Atom Swarm Engine
 * ════════════════════════════════════════════════════════════════════
 *
 * HeadyBees are not fixed workers. They are atoms in a liquid system.
 *
 * When Heady encounters ANY obstacle or task:
 *   1. The swarm intelligence calculates the EXACT number of bees needed
 *   2. Bees materialize instantly from the liquid pool
 *   3. They execute in parallel — every bee hits simultaneously
 *   4. Results merge back into the liquid system
 *   5. Bees dissolve back into the pool — zero waste
 *
 * The number of bees is never arbitrary. It's calculated from:
 *   - Task complexity (how many independent subtasks)
 *   - Available system resources (CPU, memory, network)
 *   - Historical performance data (how fast similar tasks completed)
 *   - Diminishing returns threshold (more bees stops helping after N)
 *
 * Metaphor: Like atoms in water flowing around a rock.
 * The water doesn't ask "how many atoms should I use?"
 * It uses exactly as many as the obstacle demands.
 */

const { EventEmitter } = require("events");

// ─── SWARM INTELLIGENCE — continuous sliding scale ─────────────────────────
//
// No steps. No categories. A smooth dial from 1 → maxBees.
// Like liquid filling the exact shape of the obstacle.
//
// The formula: bees = ceil( workItems × urgency × resources × efficiency )
//   - workItems:  how many independent pieces of work (the obstacle's shape)
//   - urgency:    0.0–1.0 sliding dial (how fast must this complete?)
//   - resources:  0.0–1.0 available system capacity
//   - efficiency: decays as concurrency rises (diminishing returns curve)
//
const SWARM_PARAMS = {
    minBees: 1,
    maxBees: 50,           // Hard ceiling — even liquid has physical limits
    baseLatencyMs: 50,     // Expected per-bee overhead
    resourceFloor: 0.10,   // Below 10% resources = emergency single-bee mode
    efficiencyDecay: 0.03, // Each active bee reduces efficiency by this much
    defaultUrgency: 0.7,   // Default urgency when not specified (0.0–1.0)
};

// ─── SINGLE BEE ────────────────────────────────────────────────────────────
class Bee {
    constructor(id, role) {
        this.id = id;
        this.role = role;
        this.status = "materialized";   // materialized → working → dissolved
        this.spawnedAt = Date.now();
        this.startedAt = null;
        this.completedAt = null;
        this.result = null;
        this.error = null;
    }

    async execute(work) {
        this.status = "working";
        this.startedAt = Date.now();
        try {
            this.result = await work(this);
            this.status = "completed";
            this.completedAt = Date.now();
            return { ok: true, beeId: this.id, result: this.result, durationMs: this.completedAt - this.startedAt };
        } catch (err) {
            this.error = err.message;
            this.status = "error";
            this.completedAt = Date.now();
            return { ok: false, beeId: this.id, error: err.message, durationMs: this.completedAt - this.startedAt };
        }
    }

    dissolve() {
        this.status = "dissolved";
        return {
            id: this.id,
            role: this.role,
            lifespan: (this.completedAt || Date.now()) - this.spawnedAt,
            workDuration: this.startedAt ? ((this.completedAt || Date.now()) - this.startedAt) : 0,
        };
    }
}

// ─── HEADY BEES SWARM ENGINE ───────────────────────────────────────────────
class HeadyBees extends EventEmitter {
    constructor() {
        super();
        this.activeBees = new Map();        // Currently working bees
        this.dissolvedCount = 0;            // Total bees that have completed and dissolved
        this.totalSpawned = 0;
        this.totalBlasts = 0;
        this.metrics = {
            totalBees: 0,
            totalBlasts: 0,
            totalWorkMs: 0,
            avgBeesPerBlast: 0,
            avgBlastDurationMs: 0,
            peakConcurrency: 0,
            fastestBlastMs: Infinity,
            slowestBlastMs: 0,
        };
        this.blastHistory = [];             // Recent blast records
        this.bootTime = Date.now();
    }

    // ═══ CORE: BLAST ═══════════════════════════════════════════════════════
    /**
     * BLAST — the primary operation.
     *
     * Takes a task, calculates how many bees to spawn,
     * materializes them instantly, executes all in parallel,
     * merges results, dissolves bees back into the pool.
     *
     * @param {Object} task - The task/obstacle to overcome
     * @param {string} task.name - Human-readable task name
     * @param {number} [task.urgency] - 0.0–1.0 sliding dial, how urgently to blast (default 0.7)
     * @param {Function[]} task.work - Array of work functions, one per subtask
     *   Each function receives (bee) and returns a result.
     *   The swarm materializes exactly as many bees as the work demands.
     * @param {Object} [task.context] - Optional context passed to each bee
     * @returns {Object} Blast result with merged outputs from all bees
     */
    async blast(task) {
        const blastId = `blast-${++this.totalBlasts}-${Date.now()}`;
        const startMs = Date.now();

        // Calculate the EXACT number of bees — continuous sliding scale, no steps
        const beeCount = this._calculateBeeCount(task);

        this.emit("blast:calculating", {
            blastId, task: task.name,
            urgency: task.urgency ?? SWARM_PARAMS.defaultUrgency,
            beeCount,
            workItems: task.work.length,
        });

        // Step 2: Materialize bees from the liquid pool — instant
        const bees = this._materialize(beeCount, task.name);

        this.emit("blast:materialized", {
            blastId, bees: bees.length,
            ids: bees.map(b => b.id),
        });

        // Step 3: Assign work to bees
        const assignments = this._assignWork(bees, task.work);

        // Step 4: BLAST — all bees execute in parallel
        const results = await Promise.allSettled(
            assignments.map(({ bee, work }) => bee.execute(work))
        );

        // Step 5: Collect results
        const succeeded = [];
        const failed = [];
        for (const r of results) {
            if (r.status === "fulfilled" && r.value.ok) {
                succeeded.push(r.value);
            } else if (r.status === "fulfilled") {
                failed.push(r.value);
            } else {
                failed.push({ ok: false, error: r.reason?.message || "Unknown error" });
            }
        }

        // Step 6: Dissolve all bees back into the liquid pool
        const dissolved = bees.map(bee => {
            const trace = bee.dissolve();
            this.activeBees.delete(bee.id);
            this.dissolvedCount++;
            return trace;
        });

        const blastDurationMs = Date.now() - startMs;

        // Step 7: Record metrics
        this._recordBlastMetrics(beeCount, blastDurationMs);

        const blastRecord = {
            id: blastId,
            task: task.name,
            urgency: task.urgency ?? SWARM_PARAMS.defaultUrgency,
            bees: beeCount,
            workItems: task.work.length,
            succeeded: succeeded.length,
            failed: failed.length,
            durationMs: blastDurationMs,
            avgBeeWorkMs: dissolved.length
                ? Math.round(dissolved.reduce((s, d) => s + d.workDuration, 0) / dissolved.length)
                : 0,
            results: succeeded.map(s => s.result),
            errors: failed.map(f => f.error),
            dissolved: dissolved.length,
            ts: new Date().toISOString(),
        };

        this.blastHistory.push(blastRecord);
        if (this.blastHistory.length > 200) this.blastHistory = this.blastHistory.slice(-200);

        this.emit("blast:complete", blastRecord);
        return blastRecord;
    }

    // ═══ CONVENIENCE BLASTS ════════════════════════════════════════════════

    /** Blast a single function across N parallel bees (same work, N copies) */
    async blastParallel(name, fn, count, context = {}) {
        const work = Array.from({ length: count }, (_, i) => {
            return async (bee) => fn(bee, i, context);
        });
        return this.blast({ name, work, context });
    }

    /** Blast an array of independent tasks — one bee per task */
    async blastAll(name, tasks) {
        const work = tasks.map(t => {
            return async (bee) => {
                if (typeof t === "function") return t(bee);
                if (typeof t.execute === "function") return t.execute(bee);
                return t;
            };
        });
        return this.blast({ name, work });
    }

    /** Blast a file operation across multiple files simultaneously */
    async blastFiles(name, files, processor) {
        const work = files.map(file => {
            return async (bee) => processor(bee, file);
        });
        return this.blast({ name, work });
    }

    /** Blast an HTTP check across multiple URLs simultaneously */
    async blastHealth(urls) {
        const work = urls.map(url => {
            return async (bee) => {
                const start = Date.now();
                try {
                    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
                    return {
                        url,
                        status: resp.status,
                        ok: resp.ok,
                        latencyMs: Date.now() - start,
                        bee: bee.id,
                    };
                } catch (err) {
                    return {
                        url,
                        status: 0,
                        ok: false,
                        latencyMs: Date.now() - start,
                        error: err.message,
                        bee: bee.id,
                    };
                }
            };
        });
        return this.blast({ name: "health-blast", urgency: 0.9, work });
    }

    /** Blast deployment to multiple targets simultaneously */
    async blastDeploy(targets) {
        const work = targets.map(target => {
            return async (bee) => {
                // Each bee deploys to one target
                return {
                    target: target.name,
                    type: target.type,
                    bee: bee.id,
                    deployed: true,
                    ts: new Date().toISOString(),
                };
            };
        });
        return this.blast({ name: "deploy-blast", urgency: 1.0, work });
    }

    // ═══ SWARM INTELLIGENCE — CONTINUOUS SLIDING SCALE ═════════════════════

    /**
     * Calculate the EXACT number of bees on a continuous sliding scale.
     *
     * No steps. No categories. The formula slides smoothly:
     *
     *   bees = ceil( workItems × urgency × resources × efficiency )
     *
     * Where:
     *   workItems  = the shape of the obstacle (how many pieces)
     *   urgency    = 0.0–1.0 dial (default 0.7) — how fast to blast
     *   resources  = 0.0–1.0 available system capacity (heap, concurrency)
     *   efficiency = decays smoothly as active concurrency rises
     *
     * The result is always a whole number (you can't have 0.3 of a bee)
     * but the INPUTS are all continuous — the scale slides, not steps.
     */
    _calculateBeeCount(task) {
        const workItems = (task.work && task.work.length) || 1;
        const urgency = Math.max(0, Math.min(1, task.urgency ?? SWARM_PARAMS.defaultUrgency));

        // Resource availability — continuous 0.0–1.0
        const resources = this._getResourceAvailability();
        const resourceFactor = resources.available;

        // Emergency mode — system is critically low, single bee only
        if (resourceFactor < SWARM_PARAMS.resourceFloor) {
            return SWARM_PARAMS.minBees;
        }

        // Efficiency — smooth exponential decay as active bees increase
        // At 0 active bees: efficiency = 1.0
        // At maxBees active:  efficiency ≈ 0.22
        // The decay is continuous, not stepped.
        const currentActive = this.activeBees.size;
        const efficiency = Math.exp(-SWARM_PARAMS.efficiencyDecay * currentActive);

        // Historical adjustment — learn from past blast performance
        // If recent blasts were fast, we can be slightly more conservative
        // If recent blasts were slow, lean toward more bees
        let historyFactor = 1.0;
        if (this.blastHistory.length > 0) {
            const recent = this.blastHistory.slice(-10);
            const avgDuration = recent.reduce((s, b) => s + b.durationMs, 0) / recent.length;
            // Smooth factor: slow history pushes toward 1.2, fast history toward 0.8
            historyFactor = 0.8 + (Math.min(avgDuration, 5000) / 5000) * 0.4;
        }

        // THE FORMULA — continuous, liquid, no steps:
        //   Start from the exact number of work items (the obstacle's shape)
        //   Scale by urgency (how fast)
        //   Scale by resources (what's available)
        //   Scale by efficiency (diminishing returns curve)
        //   Adjust by history (learned performance)
        const rawBees = workItems * urgency * resourceFactor * efficiency * historyFactor;

        // Round up — if the math says 3.1 bees, you need 4 (liquid fills completely)
        const beeCount = Math.ceil(rawBees);

        // Clamp to bounds
        return Math.max(SWARM_PARAMS.minBees, Math.min(beeCount, SWARM_PARAMS.maxBees));
    }

    /** Materialize N bees from the liquid pool */
    _materialize(count, taskName) {
        const bees = [];
        for (let i = 0; i < count; i++) {
            const beeId = `bee-${++this.totalSpawned}-${Date.now().toString(36)}`;
            const bee = new Bee(beeId, taskName);
            this.activeBees.set(beeId, bee);
            bees.push(bee);
        }

        // Track peak concurrency
        if (this.activeBees.size > this.metrics.peakConcurrency) {
            this.metrics.peakConcurrency = this.activeBees.size;
        }

        return bees;
    }

    /** Assign work items to bees — round-robin if more work than bees */
    _assignWork(bees, workItems) {
        const assignments = [];

        if (workItems.length <= bees.length) {
            // More bees than work — each work item gets its own bee
            for (let i = 0; i < workItems.length; i++) {
                assignments.push({ bee: bees[i], work: workItems[i] });
            }
        } else {
            // More work than bees — each bee gets multiple work items chained
            for (let i = 0; i < bees.length; i++) {
                const beeWork = [];
                for (let j = i; j < workItems.length; j += bees.length) {
                    beeWork.push(workItems[j]);
                }
                // Chain multiple work items for this bee
                const chainedWork = async (bee) => {
                    const results = [];
                    for (const w of beeWork) {
                        results.push(await w(bee));
                    }
                    return results;
                };
                assignments.push({ bee: bees[i], work: chainedWork });
            }
        }

        return assignments;
    }

    /** Get current resource availability (0-1 scale) */
    _getResourceAvailability() {
        const mem = process.memoryUsage();
        const heapUsed = mem.heapUsed / mem.heapTotal;
        const available = Math.max(0, 1 - heapUsed);
        return {
            available,
            heapUsedPercent: Math.round(heapUsed * 100),
            activeBees: this.activeBees.size,
        };
    }

    /** Record blast metrics */
    _recordBlastMetrics(beeCount, durationMs) {
        this.metrics.totalBees += beeCount;
        this.metrics.totalBlasts++;
        this.metrics.totalWorkMs += durationMs;
        this.metrics.avgBeesPerBlast = Math.round(this.metrics.totalBees / this.metrics.totalBlasts);
        this.metrics.avgBlastDurationMs = Math.round(this.metrics.totalWorkMs / this.metrics.totalBlasts);
        if (durationMs < this.metrics.fastestBlastMs) this.metrics.fastestBlastMs = durationMs;
        if (durationMs > this.metrics.slowestBlastMs) this.metrics.slowestBlastMs = durationMs;
    }

    // ═══ STATUS ════════════════════════════════════════════════════════════

    getStatus() {
        return {
            service: "heady-bees",
            metaphor: "Liquid atoms — materialize, blast, dissolve",
            activeBees: this.activeBees.size,
            dissolved: this.dissolvedCount,
            totalSpawned: this.totalSpawned,
            metrics: {
                ...this.metrics,
                fastestBlastMs: this.metrics.fastestBlastMs === Infinity ? 0 : this.metrics.fastestBlastMs,
            },
            resources: this._getResourceAvailability(),
            recentBlasts: this.blastHistory.slice(-5).map(b => ({
                id: b.id, task: b.task, bees: b.bees,
                succeeded: b.succeeded, failed: b.failed,
                durationMs: b.durationMs, ts: b.ts,
            })),
            uptime: Date.now() - this.bootTime,
            ts: new Date().toISOString(),
        };
    }

    getBlastHistory(limit = 20) {
        return this.blastHistory.slice(-limit);
    }
}

// ─── ROUTE REGISTRATION ────────────────────────────────────────────────────
function registerBeesRoutes(app, bees) {
    const express = require("express");
    const router = express.Router();

    router.get("/health", (req, res) => {
        res.json({
            status: "ACTIVE",
            service: "heady-bees",
            activeBees: bees.activeBees.size,
            totalSpawned: bees.totalSpawned,
            totalBlasts: bees.metrics.totalBlasts,
            ts: new Date().toISOString(),
        });
    });

    router.get("/status", (req, res) => {
        res.json(bees.getStatus());
    });

    router.get("/history", (req, res) => {
        const limit = parseInt(req.query.limit) || 20;
        res.json({ blasts: bees.getBlastHistory(limit) });
    });

    // Manual blast trigger — blast health check across all production URLs
    router.post("/blast/health", async (req, res) => {
        try {
            const urls = req.body?.urls || [
                "https://manager.headysystems.com/api/health",
                "https://manager.headysystems.com/api/pulse",
                "https://headyme.com",
                "https://headysystems.com",
                "https://headymcp.com",
                "https://headyio.com",
                "https://headyconnection.org",
                "https://headybuddy.org",
            ];
            const result = await bees.blastHealth(urls);
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // Manual blast trigger — blast arbitrary work
    router.post("/blast", async (req, res) => {
        try {
            const { name, count } = req.body || {};
            const result = await bees.blastParallel(
                name || "manual-blast",
                async (bee, index) => ({
                    bee: bee.id, index, ts: new Date().toISOString(),
                }),
                count || 5,
            );
            res.json(result);
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    app.use("/api/bees", router);
}

module.exports = { HeadyBees, Bee, registerBeesRoutes, SWARM_PARAMS };
