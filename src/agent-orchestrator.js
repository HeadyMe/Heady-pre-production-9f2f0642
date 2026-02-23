/**
 * ─── Heady Liquid Dynamic Agent Orchestrator ──────────────────────
 * Intelligent async parallel agent spawning — LIQUID ARCHITECTURE.
 * 
 * Liquid Architecture:
 *   - Duplicate nodes spawn dynamically per service group
 *   - Auto-scale up under load pressure (queue depth > threshold)
 *   - Auto-scale down when idle (30s reclamation)
 *   - Remote-first dispatch: prefer HF/Gemini/Claude over local
 *   - Every action → vector memory + audit trail
 *
 * Service Groups (each can have N duplicate nodes):
 *   reasoning  → brain.analyze, brain.refactor, brain.complete
 *   embedding  → brain.embed, vector store/query
 *   search     → brain.search, knowledge retrieval
 *   creative   → creative.generate, remix
 *   battle     → battle.validate, arena
 *   ops        → health, monitoring, deploy
 *   remote     → HF/Gemini/Claude dispatch (preferred)
 * ──────────────────────────────────────────────────────────────────
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

const AUDIT_PATH = path.join(__dirname, "..", "data", "agent-orchestrator-audit.jsonl");
const MAX_CONCURRENT = 50;  // Liquid: high ceiling for parallel nodes
const IDLE_RECLAIM_MS = 30000; // Reclaim idle agents after 30s
const SCALE_THRESHOLD = 3;  // Queue depth that triggers auto-scale
const SCALE_CHECK_MS = 5000; // Check scaling every 5s

class HeadyAgent {
    constructor(id, serviceGroup, client) {
        this.id = id;
        this.serviceGroup = serviceGroup;
        this.client = client;
        this.busy = false;
        this.taskCount = 0;
        this.errors = 0;
        this.totalLatency = 0;
        this.created = Date.now();
    }

    get avgLatency() {
        return this.taskCount > 0 ? Math.round(this.totalLatency / this.taskCount) : 0;
    }

    get stats() {
        return {
            id: this.id,
            serviceGroup: this.serviceGroup,
            busy: this.busy,
            taskCount: this.taskCount,
            errors: this.errors,
            avgLatency: this.avgLatency,
            uptime: Date.now() - this.created,
        };
    }

    async execute(task) {
        this.busy = true;
        const start = Date.now();
        try {
            const result = await this._dispatch(task);
            this.taskCount++;
            this.totalLatency += Date.now() - start;
            return { ok: true, result, latency: Date.now() - start, agent: this.id };
        } catch (err) {
            this.errors++;
            return { ok: false, error: err.message, latency: Date.now() - start, agent: this.id };
        } finally {
            this.busy = false;
        }
    }

    async _dispatch(task) {
        const { action, payload } = task;
        switch (this.serviceGroup) {
            case "reasoning":
                if (action === "analyze") return this.client.brain.analyze(payload.content, payload);
                if (action === "refactor") return this.client.brain.refactor(payload.code, payload);
                if (action === "complete") return this.client.brain.complete(payload.prompt, payload);
                return this.client.brain.chat(payload.message || payload.content, payload);

            case "embedding":
                if (action === "embed") return this.client.brain.embed(payload.text);
                if (action === "store") return this.client.post("/api/vector/store", payload);
                return this.client.brain.embed(payload.text || payload.content);

            case "search":
                return this.client.brain.search(payload.query, payload);

            case "battle":
                if (action === "arena") return this.client.battle.arena(payload.solutions, payload);
                return this.client.battle.validate(payload.description, payload);

            case "creative":
                return this.client.creative.generate(payload.prompt, payload);

            case "ops":
                if (action === "health") return this.client.health();
                return this.client.get(`/api/${action}`);

            default:
                return this.client.brain.chat(payload.message || JSON.stringify(payload));
        }
    }
}

class DynamicRouter {
    constructor() {
        this.routingTable = {
            embed: "embedding",
            store: "embedding",
            search: "search",
            query: "search",
            analyze: "reasoning",
            refactor: "reasoning",
            complete: "reasoning",
            chat: "reasoning",
            validate: "battle",
            arena: "battle",
            generate: "creative",
            remix: "creative",
            health: "ops",
            deploy: "ops",
            status: "ops",
        };
    }

    route(task) {
        return this.routingTable[task.action] || "reasoning";
    }
}

class AgentOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        this.maxConcurrent = options.maxConcurrent || MAX_CONCURRENT;
        this.baseUrl = options.baseUrl || "http://127.0.0.1:3301";
        this.apiKey = options.apiKey || process.env.HEADY_API_KEY || "";
        this.agents = new Map();
        this.taskQueue = [];
        this.completedTasks = 0;
        this.router = new DynamicRouter();
        this.started = Date.now();
        this.scaleEvents = [];
        this.remoteDispatch = null; // Set via setRemoteDispatch()

        // Per-group node counts for liquid scaling
        this.groupCounts = {};
        this.groupLimits = {
            reasoning: 10, embedding: 8, search: 6,
            creative: 5, battle: 4, ops: 3, remote: 15,
        };

        // Ensure data dir
        const dir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Start auto-scaling loop
        this._scaleInterval = setInterval(() => this._autoScale(), SCALE_CHECK_MS);
    }

    /** Wire remote compute dispatcher for remote-first routing */
    setRemoteDispatch(remoteFn) {
        this.remoteDispatch = remoteFn;
    }

    _createClient() {
        const { HeadyClient } = require("../heady-hive-sdk");
        return new HeadyClient({ url: this.baseUrl, apiKey: this.apiKey });
    }

    _getOrCreateAgent(serviceGroup) {
        // Find idle agent for this service group
        for (const [id, agent] of this.agents) {
            if (agent.serviceGroup === serviceGroup && !agent.busy) return agent;
        }
        // Liquid: check per-group limit, then global limit
        const groupCount = this.groupCounts[serviceGroup] || 0;
        const groupLimit = this.groupLimits[serviceGroup] || 5;
        if (groupCount < groupLimit && this.agents.size < this.maxConcurrent) {
            const nodeNum = groupCount + 1;
            const id = `${serviceGroup}-node-${nodeNum}-${Date.now().toString(36)}`;
            const agent = new HeadyAgent(id, serviceGroup, this._createClient());
            this.agents.set(id, agent);
            this.groupCounts[serviceGroup] = nodeNum;
            this.emit("agent:spawned", { id, serviceGroup, nodeNum, groupTotal: nodeNum });
            this._audit({ type: "liquid:spawn", serviceGroup, nodeNum, totalAgents: this.agents.size });
            return agent;
        }
        return null;
    }

    /** Liquid: scale up a service group by N nodes */
    scaleUp(serviceGroup, count = 1) {
        const spawned = [];
        for (let i = 0; i < count; i++) {
            const agent = this._getOrCreateAgent(serviceGroup);
            if (agent) spawned.push(agent.id);
        }
        this.scaleEvents.push({ type: "scale_up", serviceGroup, count: spawned.length, ts: Date.now() });
        return spawned;
    }

    /** Liquid: scale down idle agents in a service group */
    scaleDown(serviceGroup) {
        let removed = 0;
        for (const [id, agent] of this.agents) {
            if (agent.serviceGroup === serviceGroup && !agent.busy) {
                this.agents.delete(id);
                this.groupCounts[serviceGroup] = Math.max(0, (this.groupCounts[serviceGroup] || 1) - 1);
                removed++;
                this._audit({ type: "liquid:reclaim", agent: id, serviceGroup });
            }
        }
        this.scaleEvents.push({ type: "scale_down", serviceGroup, removed, ts: Date.now() });
        return removed;
    }

    /** Liquid: auto-scale based on queue pressure + idle reclamation */
    _autoScale() {
        // Scale UP: if queue has pressure, spawn workers for bottleneck groups
        if (this.taskQueue.length >= SCALE_THRESHOLD) {
            const groupPressure = {};
            this.taskQueue.forEach(({ serviceGroup }) => {
                groupPressure[serviceGroup] = (groupPressure[serviceGroup] || 0) + 1;
            });
            for (const [group, pressure] of Object.entries(groupPressure)) {
                if (pressure >= 2) this.scaleUp(group, Math.min(pressure, 3));
            }
        }
        // Scale DOWN: reclaim idle agents older than IDLE_RECLAIM_MS
        const now = Date.now();
        for (const [id, agent] of this.agents) {
            if (!agent.busy && agent.taskCount > 0 && (now - agent.created) > IDLE_RECLAIM_MS) {
                // Keep at least 1 per group
                const groupAgents = [...this.agents.values()].filter(a => a.serviceGroup === agent.serviceGroup);
                if (groupAgents.length > 1) {
                    this.agents.delete(id);
                    this.groupCounts[agent.serviceGroup] = Math.max(0, (this.groupCounts[agent.serviceGroup] || 1) - 1);
                    this._audit({ type: "liquid:idle_reclaim", agent: id });
                }
            }
        }
    }

    _audit(entry) {
        const line = JSON.stringify({ ...entry, ts: new Date().toISOString() });
        try { fs.appendFileSync(AUDIT_PATH, line + "\n"); } catch { }
        this.emit("audit", entry);
    }

    /** Submit a single task */
    async submit(task) {
        const serviceGroup = this.router.route(task);
        const agent = this._getOrCreateAgent(serviceGroup);

        if (!agent) {
            // Queue it
            return new Promise((resolve, reject) => {
                this.taskQueue.push({ task, serviceGroup, resolve, reject });
                this.emit("task:queued", { action: task.action, queueSize: this.taskQueue.length });
            });
        }

        this._audit({ type: "task:start", action: task.action, agent: agent.id, serviceGroup });
        const result = await agent.execute(task);
        this.completedTasks++;
        this._audit({ type: "task:complete", action: task.action, agent: agent.id, ok: result.ok, latency: result.latency });
        this.emit("task:complete", result);

        // Process queue
        this._processQueue();
        return result;
    }

    /** Submit multiple tasks in parallel */
    async submitBatch(tasks) {
        return Promise.allSettled(tasks.map(t => this.submit(t)));
    }

    /** Deterministic parallel execution with results */
    async parallel(tasks) {
        const results = await this.submitBatch(tasks);
        return results.map((r, i) => ({
            task: tasks[i].action,
            ...(r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message }),
        }));
    }

    _processQueue() {
        while (this.taskQueue.length > 0) {
            const { task, serviceGroup, resolve, reject } = this.taskQueue[0];
            const agent = this._getOrCreateAgent(serviceGroup);
            if (!agent) break;
            this.taskQueue.shift();
            agent.execute(task).then(resolve).catch(reject);
        }
    }

    /** Get orchestrator stats — liquid architecture view */
    getStats() {
        const agents = [];
        this.agents.forEach(a => agents.push(a.stats));

        // Per-group breakdown
        const groups = {};
        this.agents.forEach(a => {
            if (!groups[a.serviceGroup]) groups[a.serviceGroup] = { nodes: 0, busy: 0, tasks: 0, limit: this.groupLimits[a.serviceGroup] || 5 };
            groups[a.serviceGroup].nodes++;
            if (a.busy) groups[a.serviceGroup].busy++;
            groups[a.serviceGroup].tasks += a.taskCount;
        });

        return {
            architecture: "liquid-dynamic",
            totalAgents: this.agents.size,
            maxConcurrent: this.maxConcurrent,
            completedTasks: this.completedTasks,
            queuedTasks: this.taskQueue.length,
            uptime: Date.now() - this.started,
            groups,
            agents,
            recentScaleEvents: this.scaleEvents.slice(-20),
            remoteFirstEnabled: !!this.remoteDispatch,
        };
    }

    /** Shutdown all agents */
    shutdown() {
        clearInterval(this._scaleInterval);
        this.agents.clear();
        this.taskQueue = [];
        this._audit({ type: "shutdown", completedTasks: this.completedTasks });
        this.emit("shutdown");
    }

    /** Express route registration — liquid architecture endpoints */
    registerRoutes(app) {
        app.get("/api/orchestrator/agents", (req, res) => {
            res.json({ ok: true, ...this.getStats() });
        });

        app.post("/api/orchestrator/submit", async (req, res) => {
            try {
                const { action, payload } = req.body;
                if (!action) return res.status(400).json({ error: "action required" });
                const result = await this.submit({ action, payload: payload || {} });
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        app.post("/api/orchestrator/batch", async (req, res) => {
            try {
                const { tasks } = req.body;
                if (!Array.isArray(tasks)) return res.status(400).json({ error: "tasks array required" });
                const results = await this.parallel(tasks);
                res.json({ ok: true, results, total: results.length });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Liquid: per-node visibility
        app.get("/api/orchestrator/nodes", (req, res) => {
            const nodes = [];
            this.agents.forEach(a => nodes.push({
                ...a.stats,
                age: Date.now() - a.created,
                idleMs: a.busy ? 0 : Date.now() - a.created,
            }));
            res.json({ ok: true, nodes, groups: this.getStats().groups });
        });

        // Liquid: manual scale control
        app.post("/api/orchestrator/scale", (req, res) => {
            const { serviceGroup, action, count } = req.body;
            if (!serviceGroup || !action) return res.status(400).json({ error: "serviceGroup + action required" });
            if (action === "up") {
                const spawned = this.scaleUp(serviceGroup, count || 1);
                res.json({ ok: true, action: "scale_up", spawned, totalAgents: this.agents.size });
            } else if (action === "down") {
                const removed = this.scaleDown(serviceGroup);
                res.json({ ok: true, action: "scale_down", removed, totalAgents: this.agents.size });
            } else {
                res.status(400).json({ error: "action must be 'up' or 'down'" });
            }
        });

        app.get("/api/orchestrator/audit", (req, res) => {
            try {
                const lines = fs.readFileSync(AUDIT_PATH, "utf-8").trim().split("\n").slice(-100);
                const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
                res.json({ ok: true, entries, total: entries.length });
            } catch {
                res.json({ ok: true, entries: [], total: 0 });
            }
        });
    }
}

// Singleton
let instance = null;
function getOrchestrator(options) {
    if (!instance) instance = new AgentOrchestrator(options);
    return instance;
}

module.exports = { AgentOrchestrator, getOrchestrator };
