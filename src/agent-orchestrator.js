/**
 * ─── Heady Liquid Dynamic Agent Orchestrator ──────────────────────
 *
 * NOW ACTUALLY USED:
 *   - ALL /brain/* requests route through orchestrator.submit()
 *   - Local dispatch mode: calls handler functions in-process, no self-HTTP
 *   - Agents spawn on demand per service group
 *   - Tasks get tracked, scaled, and reclaimed
 *
 * HeadySupervisors (each service group can have N duplicate nodes):
 *   reasoning  → brain.chat, brain.analyze, brain.complete
 *   embedding  → brain.embed, vector store/query
 *   search     → brain.search, knowledge retrieval
 *   creative   → creative.generate, remix
 *   battle     → battle.validate, arena
 *   ops        → health, monitoring, deploy
 * ──────────────────────────────────────────────────────────────────
 */

const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");

const AUDIT_PATH = path.join(__dirname, "..", "data", "agent-orchestrator-audit.jsonl");
const PHI = 1.6180339887;
const MIN_CONCURRENT = 150;  // MINIMUM supervisors running at all times
const MAX_CONCURRENT = 500;  // Ceiling
const IDLE_RECLAIM_MS = Math.round(PHI ** 6 * 1000); // φ⁶ ≈ 17,944ms
const SCALE_THRESHOLD = 3;
const SCALE_CHECK_MS = Math.round(PHI ** 4 * 1000);  // φ⁴ ≈ 6,854ms

class HeadySupervisor {
    constructor(id, serviceGroup) {
        this.id = id;
        this.serviceGroup = serviceGroup;
        this.busy = false;
        this.taskCount = 0;
        this.errors = 0;
        this.totalLatency = 0;
        this.lastActive = Date.now();
        this.created = Date.now();
    }

    get avgLatency() {
        return this.taskCount > 0 ? Math.round(this.totalLatency / this.taskCount) : 0;
    }

    get supervisorStats() {
        return {
            id: this.id,
            serviceGroup: this.serviceGroup,
            busy: this.busy,
            taskCount: this.taskCount,
            errors: this.errors,
            avgLatency: this.avgLatency,
            uptime: Date.now() - this.created,
            lastActive: this.lastActive,
            idleSince: this.busy ? null : Date.now() - this.lastActive,
        };
    }
}

// ─── HeadyConductor (federated routing) ────────────────────────────
const { getConductor } = require("./heady-conductor");

class AgentOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        this.minConcurrent = options.minConcurrent || MIN_CONCURRENT;
        this.maxConcurrent = options.maxConcurrent || MAX_CONCURRENT;
        this.supervisors = new Map();
        this.taskQueue = [];
        this.completedTasks = 0;
        this.failedTasks = 0;
        this.conductor = getConductor();
        this.router = this.conductor; // backward compat: this.router.routeSync()
        this.started = Date.now();
        this.scaleEvents = [];
        this.taskHistory = []; // Keep last 100 completed tasks

        // LOCAL DISPATCH: registered handler functions for in-process calls
        this.handlers = new Map();

        // Per-group node counts for liquid scaling
        this.groupCounts = {};
        this.groupLimits = {
            reasoning: 40, embedding: 30, search: 25,
            creative: 25, battle: 15, ops: 15,
        };

        // Ensure data dir
        const dir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        // Start auto-scaling loop
        this._scaleInterval = setInterval(() => this._autoScale(), SCALE_CHECK_MS);

        // Pre-spawn minimum supervisors across all service groups
        this._ensureMinimum();
    }

    /**
     * Ensure minimum supervisors are always running.
     * Distributes MIN_CONCURRENT across all service groups proportionally.
     * FORCE-CREATES new supervisors (doesn't reuse idle ones).
     */
    _ensureMinimum() {
        const currentTotal = this.supervisors.size;
        const needed = Math.max(0, this.minConcurrent - currentTotal);
        if (needed <= 0) return;

        const groups = Object.keys(this.groupLimits);
        const totalLimits = Object.values(this.groupLimits).reduce((a, b) => a + b, 0);
        let spawned = 0;

        for (const group of groups) {
            const groupTarget = Math.ceil((this.groupLimits[group] / totalLimits) * needed);
            const groupLimit = this.groupLimits[group] || 5;

            for (let i = 0; i < groupTarget && spawned < needed; i++) {
                const groupCount = this.groupCounts[group] || 0;
                if (groupCount >= groupLimit || this.supervisors.size >= this.maxConcurrent) break;

                const nodeNum = groupCount + 1;
                const id = `${group}-node-${nodeNum}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
                const supervisor = new HeadySupervisor(id, group);
                this.supervisors.set(id, supervisor);
                this.groupCounts[group] = nodeNum;
                this.emit("supervisor:spawned", { id, serviceGroup: group, nodeNum });
                spawned++;
            }
        }

        this._audit({ type: "minimum:enforced", minConcurrent: this.minConcurrent, spawned, total: this.supervisors.size });
        console.log(`  ∞ Orchestrator: MIN_CONCURRENT enforced — ${this.supervisors.size} HeadySupervisors active (min ${this.minConcurrent})`);
    }

    /**
     * Register a local handler function for an action.
     * This is how brain routes wire into the orchestrator WITHOUT self-HTTP.
     *
     * @param {string} action - e.g., "chat", "analyze", "embed", "search"
     * @param {Function} handler - async (payload) => result
     */
    registerHandler(action, handler) {
        this.handlers.set(action, handler);
        console.log(`  ∞ Orchestrator: handler registered for '${action}'`);
    }

    _getOrCreateSupervisor(serviceGroup) {
        // Find idle agent for this service group
        for (const [id, agent] of this.supervisors) {
            if (agent.serviceGroup === serviceGroup && !agent.busy) return agent; // HeadySupervisor
        }
        // Liquid: check per-group limit, then global limit
        const groupCount = this.groupCounts[serviceGroup] || 0;
        const groupLimit = this.groupLimits[serviceGroup] || 5;
        if (groupCount < groupLimit && this.supervisors.size < this.maxConcurrent) {
            const nodeNum = groupCount + 1;
            const id = `${serviceGroup}-node-${nodeNum}-${Date.now().toString(36)}`;
            const supervisor = new HeadySupervisor(id, serviceGroup);
            this.supervisors.set(id, supervisor);
            this.groupCounts[serviceGroup] = nodeNum;
            this.emit("supervisor:spawned", { id, serviceGroup, nodeNum, groupTotal: nodeNum });
            this._audit({ type: "liquid:spawn", serviceGroup, nodeNum, totalSupervisors: this.supervisors.size });
            return supervisor;
        }
        return null;
    }

    /** Scale up a service group by N nodes */
    scaleUp(serviceGroup, count = 1) {
        const spawned = [];
        for (let i = 0; i < count; i++) {
            const agent = this._getOrCreateSupervisor(serviceGroup);
            if (agent) spawned.push(agent.id);
        }
        this.scaleEvents.push({ type: "scale_up", serviceGroup, count: spawned.length, ts: Date.now() });
        return spawned;
    }

    /** Scale down idle agents in a service group */
    scaleDown(serviceGroup) {
        let removed = 0;
        for (const [id, agent] of this.supervisors) {
            if (agent.serviceGroup === serviceGroup && !agent.busy) {
                this.supervisors.delete(id);
                this.groupCounts[serviceGroup] = Math.max(0, (this.groupCounts[serviceGroup] || 1) - 1);
                removed++;
                this._audit({ type: "liquid:reclaim", agent: id, serviceGroup });
            }
        }
        this.scaleEvents.push({ type: "scale_down", serviceGroup, removed, ts: Date.now() });
        return removed;
    }

    /** Auto-scale based on queue pressure + idle reclamation */
    _autoScale() {
        // Scale UP under pressure
        if (this.taskQueue.length >= SCALE_THRESHOLD) {
            const groupPressure = {};
            this.taskQueue.forEach(({ serviceGroup }) => {
                groupPressure[serviceGroup] = (groupPressure[serviceGroup] || 0) + 1;
            });
            for (const [group, pressure] of Object.entries(groupPressure)) {
                if (pressure >= 2) this.scaleUp(group, Math.min(pressure, 3));
            }
        }
        // Scale DOWN idle supervisors — but NEVER below MIN_CONCURRENT
        const now = Date.now();
        if (this.supervisors.size > this.minConcurrent) {
            for (const [id, supervisor] of this.supervisors) {
                if (this.supervisors.size <= this.minConcurrent) break; // Never go below minimum
                if (!supervisor.busy && supervisor.taskCount > 0 && (now - supervisor.lastActive) > IDLE_RECLAIM_MS) {
                    const groupSupervisors = [...this.supervisors.values()].filter(a => a.serviceGroup === supervisor.serviceGroup);
                    if (groupSupervisors.length > 1) {
                        this.supervisors.delete(id);
                        this.groupCounts[supervisor.serviceGroup] = Math.max(0, (this.groupCounts[supervisor.serviceGroup] || 1) - 1);
                        this._audit({ type: "liquid:idle_reclaim", supervisor: id, idle_ms: now - supervisor.lastActive });
                    }
                }
            }
        }
        // Re-enforce minimum if somehow below
        if (this.supervisors.size < this.minConcurrent) {
            this._ensureMinimum();
        }
    }

    _audit(entry) {
        const line = JSON.stringify({ ...entry, ts: new Date().toISOString() });
        try { fs.appendFileSync(AUDIT_PATH, line + "\n"); } catch { }
        this.emit("audit", entry);
    }

    /**
     * Attach vector memory for memory-first scanning.
     * RULE: Before ANY task dispatch, scan persistent memory for context.
     */
    setVectorMemory(vectorMem) {
        this.vectorMem = vectorMem;
        console.log("  ∞ Orchestrator: vector memory attached (memory-first scanning ACTIVE)");
    }

    /**
     * ═══ HeadyValidator — Pre-Action Protocol ═══════════════════════════
     * ALWAYS runs BEFORE any task dispatch. Cannot be skipped.
     *
     * Checklist:
     *   1. Validate handler exists (HeadyRegistry)
     *   2. Enforce MIN_CONCURRENT (150 HeadySupervisors active)
     *   3. Scan HeadyMemory for relevant context
     *   4. Check HeadyPatterns for known optimizations
     *   5. Audit the validation result
     *
     * @param {Object} task - { action, payload }
     * @returns {Object} - { valid, context, patterns, supervisorCount }
     */
    async _headyValidator(task) {
        const validation = {
            action: task.action,
            ts: Date.now(),
            checks: {},
        };

        // ── 1. REGISTRY CHECK: Is this action registered? ──
        const handlerExists = this.handlers.has(task.action);
        validation.checks.registry = { pass: handlerExists, handler: task.action };

        // ── 2. MIN-CONCURRENT ENFORCEMENT: 150 supervisors minimum ──
        const supervisorCount = this.supervisors.size;
        const minOk = supervisorCount >= this.minConcurrent;
        if (!minOk) {
            this._ensureMinimum();
        }
        validation.checks.minConcurrent = {
            pass: true, // always pass because we enforce it
            count: this.supervisors.size,
            minimum: this.minConcurrent,
            enforced: !minOk,
        };

        // ── 3. MEMORY SCAN: Query HeadyMemory for context ──
        let memoryContext = null;
        const payload = task.payload || {};
        const queryText = payload.message || payload.content || payload.text ||
            payload.query || payload.code || payload.prompt || "";

        if (this.vectorMem && queryText && queryText.length >= 5) {
            try {
                const memories = await this.vectorMem.queryMemory(queryText, 3);
                const relevant = memories.filter(m => m.score > 0.3);
                if (relevant.length > 0) {
                    memoryContext = relevant.map(m => m.content).join("\n---\n");
                    // Inject retrieved context into payload
                    const prefix = `[HeadyBrain Context — ${relevant.length} memories]\n${memoryContext}\n[End Context]\n\n`;
                    if (payload.message) payload.message = prefix + payload.message;
                    else if (payload.content) payload.content = prefix + payload.content;
                    else if (payload.text) payload.text = prefix + payload.text;
                    else if (payload.prompt) payload.prompt = prefix + payload.prompt;
                }
                validation.checks.memory = { pass: true, matches: relevant.length, queryLength: queryText.length };
            } catch (memErr) {
                validation.checks.memory = { pass: false, error: memErr.message };
            }
        } else {
            validation.checks.memory = { pass: true, skipped: !queryText || queryText.length < 5 };
        }

        // ── 4. PATTERN CHECK: Known optimization opportunities ──
        const knownPatterns = {
            chat: { optimization: "stream-first", note: "prefer streaming for chat" },
            analyze: { optimization: "batch-friendly", note: "can batch multiple analyses" },
            embed: { optimization: "cache-embeddings", note: "cache identical text embeddings" },
            search: { optimization: "zone-first", note: "use 3D spatial zone for locality" },
        };
        validation.checks.patterns = {
            pass: true,
            matched: knownPatterns[task.action] || null,
        };

        // ── 5. AUDIT ──
        this._audit({ type: "validator:pre-action", ...validation });

        return {
            valid: handlerExists,
            context: memoryContext,
            patterns: knownPatterns[task.action] || null,
            supervisorCount: this.supervisors.size,
            validation,
        };
    }

    /**
     * Submit a task — the primary entry point.
     * ENFORCES: HeadyValidator → dispatch → store result
     */
    async submit(task) {
        // ═══ HeadyValidator: ALWAYS runs first ═══
        const preCheck = await this._headyValidator(task);

        const serviceGroup = this.conductor.routeSync(task);
        const supervisor = this._getOrCreateSupervisor(serviceGroup);

        if (!supervisor) {
            // Queue it
            return new Promise((resolve, reject) => {
                this.taskQueue.push({ task, serviceGroup, resolve, reject });
                this.emit("task:queued", { action: task.action, queueSize: this.taskQueue.length });
            });
        }

        const start = Date.now();
        supervisor.busy = true;
        this._audit({ type: "task:start", action: task.action, supervisor: supervisor.id, serviceGroup, validated: preCheck.valid });

        try {
            const payload = task.payload || {};
            const queryText = payload.message || payload.content || payload.text || payload.query || payload.code || payload.prompt || "";
            // Memory scan already done by _headyValidator() — context injected into payload

            let result;
            const handler = this.handlers.get(task.action);
            if (handler) {
                // LOCAL DISPATCH: call the registered handler function directly
                result = await handler(payload);
            } else {
                throw new Error(`No handler registered for action '${task.action}'`);
            }

            supervisor.taskCount++;
            supervisor.totalLatency += Date.now() - start;
            supervisor.lastActive = Date.now();
            supervisor.busy = false;
            this.completedTasks++;

            // ── MEMORY-STORE: Save the result in vector memory ──
            if (this.vectorMem && queryText && result) {
                try {
                    const responseText = typeof result === "string" ? result :
                        result.response || result.result || JSON.stringify(result).substring(0, 500);
                    if (responseText && responseText.length > 10) {
                        await this.vectorMem.ingestMemory({
                            content: `Q: ${queryText.substring(0, 500)}\nA: ${String(responseText).substring(0, 1000)}`,
                            metadata: { type: "orchestrator_qa", action: task.action, supervisor: supervisor.id },
                        });
                    }
                } catch { }
            }

            const taskRecord = {
                ok: true,
                action: task.action,
                result,
                latency: Date.now() - start,
                supervisor: supervisor.id,
                serviceGroup,
                memoryScanned: !!preCheck.context,
                validated: preCheck.valid,
            };

            this._audit({ type: "task:complete", action: task.action, supervisor: supervisor.id, latency: taskRecord.latency });
            this.taskHistory.push({ ...taskRecord, ts: Date.now() });
            if (this.taskHistory.length > 100) this.taskHistory = this.taskHistory.slice(-100);
            this.emit("task:complete", taskRecord);

            this._processQueue();
            return taskRecord;
        } catch (err) {
            supervisor.errors++;
            supervisor.busy = false;
            supervisor.lastActive = Date.now();
            this.failedTasks++;
            this._audit({ type: "task:error", action: task.action, supervisor: supervisor.id, error: err.message });
            this._processQueue();
            return { ok: false, error: err.message, latency: Date.now() - start, supervisor: supervisor.id };
        }
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
            this.submit(task).then(resolve).catch(reject);
        }
    }

    /** Orchestrator stats — liquid architecture view */
    getStats() {
        const supervisors = [];
        this.supervisors.forEach(a => supervisors.push(a.supervisorStats));

        const groups = {};
        this.supervisors.forEach(a => {
            if (!groups[a.serviceGroup]) groups[a.serviceGroup] = { nodes: 0, busy: 0, tasks: 0, errors: 0, limit: this.groupLimits[a.serviceGroup] || 5 };
            groups[a.serviceGroup].nodes++;
            if (a.busy) groups[a.serviceGroup].busy++;
            groups[a.serviceGroup].tasks += a.taskCount;
            groups[a.serviceGroup].errors += a.errors;
        });

        return {
            architecture: "liquid-dynamic",
            totalSupervisors: this.supervisors.size,
            maxConcurrent: this.maxConcurrent,
            completedTasks: this.completedTasks,
            failedTasks: this.failedTasks,
            queuedTasks: this.taskQueue.length,
            handlersRegistered: [...this.handlers.keys()],
            uptime: Date.now() - this.started,
            groups,
            supervisors,
            recentScaleEvents: this.scaleEvents.slice(-20),
            recentTasks: this.taskHistory.slice(-10).map(t => ({
                action: t.action, ok: t.ok, latency: t.latency, agent: t.agent, serviceGroup: t.serviceGroup,
            })),
        };
    }

    shutdown() {
        clearInterval(this._scaleInterval);
        this.supervisors.clear();
        this.taskQueue = [];
        this._audit({ type: "shutdown", completedTasks: this.completedTasks });
        this.emit("shutdown");
    }

    /** Express routes */
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

        app.get("/api/orchestrator/nodes", (req, res) => {
            const nodes = [];
            this.supervisors.forEach(a => nodes.push({
                ...a.supervisorStats,
                age: Date.now() - a.created,
            }));
            res.json({ ok: true, nodes, groups: this.getStats().groups });
        });

        app.post("/api/orchestrator/scale", (req, res) => {
            const { serviceGroup, action, count } = req.body;
            if (!serviceGroup || !action) return res.status(400).json({ error: "serviceGroup + action required" });
            if (action === "up") {
                const spawned = this.scaleUp(serviceGroup, count || 1);
                res.json({ ok: true, action: "scale_up", spawned, totalSupervisors: this.supervisors.size });
            } else if (action === "down") {
                const removed = this.scaleDown(serviceGroup);
                res.json({ ok: true, action: "scale_down", removed, totalSupervisors: this.supervisors.size });
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
