/**
 * ═══ HeadyBee — Autonomous Worker Agent ═══
 *
 * A single bee in the HeadySwarm. Models real bee behavior:
 *   - Forages (executes tasks via HeadyGateway)
 *   - Returns nectar (AI results) to the honeycomb
 *   - Performs waggle dance (signals quality to recruit others)
 *   - Has energy (prevents overwork, recovers during idle)
 *   - Has a role (forager, scout, nurse, guard)
 *
 * Bees are managed by HeadySwarm but operate autonomously.
 */

const EventEmitter = require("events");

const ROLES = {
    forager: { desc: "Executes AI tasks, brings back nectar", energyCost: 10, skills: ["chat", "decompose"] },
    scout: { desc: "Discovers new task opportunities", energyCost: 15, skills: ["analyze", "discover"] },
    nurse: { desc: "Maintains hive health, cleans data", energyCost: 5, skills: ["maintain", "verify"] },
    guard: { desc: "Security and integrity checks", energyCost: 8, skills: ["security", "audit"] },
};

const MAX_ENERGY = 100;
const ENERGY_RECOVERY_RATE = 5; // per idle cycle
const MIN_FORAGE_ENERGY = 15;

class HeadyBee extends EventEmitter {
    /**
     * @param {Object} opts
     * @param {Object} opts.gateway - HeadyGateway instance for AI calls
     * @param {string} [opts.role="forager"] - Bee role
     * @param {string} [opts.id] - Unique bee ID
     */
    constructor(opts = {}) {
        super();
        this.id = opts.id || `bee-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
        this.gateway = opts.gateway;
        this.role = opts.role || "forager";
        this.roleConfig = ROLES[this.role] || ROLES.forager;

        // State
        this.energy = MAX_ENERGY;
        this.busy = false;
        this.alive = true;
        this.currentTask = null;

        // Lifetime stats
        this.stats = {
            tasksCompleted: 0,
            tasksFailed: 0,
            totalForageTimeMs: 0,
            nectarCollected: 0, // total response chars brought back
            avgLatencyMs: 0,
            bestTask: null,
            worstTask: null,
            born: new Date().toISOString(),
        };
    }

    /**
     * Forage — execute a task through the HeadyGateway.
     * This is the core work loop of a bee.
     *
     * @param {Object} task - { id, name, prompt, system, category, priority }
     * @returns {Object} nectar - { ok, response, latency, quality, task }
     */
    async forage(task) {
        if (!this.alive) return { ok: false, error: "bee-dead", beeId: this.id };
        if (this.energy < MIN_FORAGE_ENERGY) return { ok: false, error: "low-energy", energy: this.energy, beeId: this.id };
        if (this.busy) return { ok: false, error: "busy", beeId: this.id };
        if (!this.gateway) return { ok: false, error: "no-gateway", beeId: this.id };

        this.busy = true;
        this.currentTask = task;
        this.energy -= this.roleConfig.energyCost;

        const startMs = Date.now();
        let nectar;

        try {
            // The actual AI work — through the liquid gateway
            const result = await this.gateway.chat(task.prompt, {
                system: task.system || `You are a Heady AI assistant performing a ${task.category} task. Be concise, actionable, and specific.`,
                priority: task.priority || "medium",
                temperature: task.temperature || 0.7,
                maxTokens: task.maxTokens || 1024,
            });

            const latencyMs = Date.now() - startMs;
            const responseLen = (result.response || "").length;

            // Score nectar quality (0-100) based on response richness
            const quality = this._scoreNectar(result, latencyMs, responseLen);

            nectar = {
                ok: result.ok !== false,
                beeId: this.id,
                role: this.role,
                taskId: task.id,
                taskName: task.name,
                category: task.category,
                response: result.response,
                engine: result.engine,
                model: result.model,
                latencyMs,
                quality,
                cached: result.cached || false,
                ts: new Date().toISOString(),
            };

            // Update stats
            this.stats.tasksCompleted++;
            this.stats.totalForageTimeMs += latencyMs;
            this.stats.nectarCollected += responseLen;
            this.stats.avgLatencyMs = Math.round(this.stats.totalForageTimeMs / this.stats.tasksCompleted);

            if (!this.stats.bestTask || quality > (this.stats.bestTask.quality || 0)) {
                this.stats.bestTask = { id: task.id, name: task.name, quality };
            }

            // Waggle dance — signal to the swarm about this nectar
            this.emit("waggle", {
                beeId: this.id,
                taskCategory: task.category,
                quality,
                latencyMs,
                responseLen,
            });

            this.emit("nectar", nectar);

        } catch (err) {
            const latencyMs = Date.now() - startMs;
            this.stats.tasksFailed++;

            nectar = {
                ok: false,
                beeId: this.id,
                role: this.role,
                taskId: task.id,
                taskName: task.name,
                category: task.category,
                error: err.message,
                latencyMs,
                quality: 0,
                absorbed: true, // errors are always absorbed as learnings
                ts: new Date().toISOString(),
            };

            if (!this.stats.worstTask || err.message.length > 0) {
                this.stats.worstTask = { id: task.id, name: task.name, error: err.message };
            }

            this.emit("error-absorbed", { beeId: this.id, task: task.name, error: err.message });
        }

        this.busy = false;
        this.currentTask = null;
        return nectar;
    }

    /**
     * Score nectar quality (0-100).
     * Based on: response length, latency, whether it was cached, and content signals.
     */
    _scoreNectar(result, latencyMs, responseLen) {
        let score = 50; // baseline

        // Length scoring (longer = richer, up to a point)
        if (responseLen > 500) score += 15;
        else if (responseLen > 200) score += 10;
        else if (responseLen > 50) score += 5;
        else score -= 10; // suspiciously short

        // Latency scoring (faster = better)
        if (latencyMs < 1000) score += 10;
        else if (latencyMs < 3000) score += 5;
        else if (latencyMs > 10000) score -= 10;

        // Cache penalty (cached results less valuable for learning)
        if (result.cached) score -= 15;

        // Success bonus
        if (result.ok !== false) score += 10;

        // Content quality signals
        const resp = (result.response || "").toLowerCase();
        if (resp.includes("recommend") || resp.includes("suggest") || resp.includes("should")) score += 5;
        if (resp.includes("error") && resp.includes("fix")) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    /** Recover energy during idle time. */
    rest() {
        if (this.busy) return;
        this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_RECOVERY_RATE);
    }

    /** Check if bee can forage. */
    canForage() {
        return this.alive && !this.busy && this.energy >= MIN_FORAGE_ENERGY;
    }

    /** Get bee status snapshot. */
    status() {
        return {
            id: this.id,
            role: this.role,
            energy: this.energy,
            maxEnergy: MAX_ENERGY,
            busy: this.busy,
            alive: this.alive,
            currentTask: this.currentTask?.name || null,
            stats: { ...this.stats },
        };
    }

    /** Retire this bee. */
    retire() {
        this.alive = false;
        this.busy = false;
        this.emit("retired", { beeId: this.id, stats: this.stats });
    }
}

module.exports = HeadyBee;
module.exports.ROLES = ROLES;
module.exports.MAX_ENERGY = MAX_ENERGY;
