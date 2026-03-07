/**
 * HeadySystems™ — Orchestration Module
 * Central hub for task routing, agent coordination, and workflow management.
 *
 * Replaces monolithic heady-manager.js with modular, pattern-based orchestration.
 * Implements: Saga Compensation, Circuit Breakers, Bulkhead Isolation,
 * Skill-Based Routing, Event Sourcing, CQRS, and Auto-Tuning.
 *
 * @module orchestration
 */

'use strict';

const { EventEmitter } = require('events');

// ═══════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════

const PHI = 1.618033988749895;
const PSI = 0.618033988749895;

const AgentStatus = { IDLE: 'idle', BUSY: 'busy', OVERLOADED: 'overloaded', OFFLINE: 'offline' };
const TaskStatus = { PENDING: 'pending', ASSIGNED: 'assigned', RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed', COMPENSATING: 'compensating' };
const CircuitState = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };

// ═══════════════════════════════════════════════════════════════════
// Circuit Breaker
// ═══════════════════════════════════════════════════════════════════

class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        this.failureThreshold = options.failureThreshold || 5;
        this.resetTimeout = options.resetTimeout || 30000;
        this.halfOpenMax = options.halfOpenMax || 3;
        this.lastFailure = null;
        this._timer = null;
    }

    async execute(fn) {
        if (this.state === CircuitState.OPEN) {
            if (Date.now() - this.lastFailure > this.resetTimeout) {
                this.state = CircuitState.HALF_OPEN;
                this.successCount = 0;
            } else {
                throw new Error(`Circuit ${this.name} is OPEN — request rejected`);
            }
        }

        try {
            const result = await fn();
            this._onSuccess();
            return result;
        } catch (err) {
            this._onFailure();
            throw err;
        }
    }

    _onSuccess() {
        if (this.state === CircuitState.HALF_OPEN) {
            this.successCount++;
            if (this.successCount >= this.halfOpenMax) {
                this.state = CircuitState.CLOSED;
                this.failureCount = 0;
            }
        }
        this.failureCount = 0;
    }

    _onFailure() {
        this.failureCount++;
        this.lastFailure = Date.now();
        if (this.failureCount >= this.failureThreshold) {
            this.state = CircuitState.OPEN;
        }
    }

    getStatus() {
        return { name: this.name, state: this.state, failures: this.failureCount, lastFailure: this.lastFailure };
    }
}

// ═══════════════════════════════════════════════════════════════════
// Bulkhead Isolation
// ═══════════════════════════════════════════════════════════════════

class BulkheadIsolation {
    constructor(name, maxConcurrent = 10) {
        this.name = name;
        this.maxConcurrent = maxConcurrent;
        this.active = 0;
        this.queue = [];
    }

    async execute(fn) {
        if (this.active >= this.maxConcurrent) {
            return new Promise((resolve, reject) => {
                this.queue.push({ fn, resolve, reject });
            });
        }

        this.active++;
        try {
            const result = await fn();
            return result;
        } finally {
            this.active--;
            this._processQueue();
        }
    }

    _processQueue() {
        if (this.queue.length > 0 && this.active < this.maxConcurrent) {
            const { fn, resolve, reject } = this.queue.shift();
            this.active++;
            fn().then(resolve).catch(reject).finally(() => {
                this.active--;
                this._processQueue();
            });
        }
    }

    getStatus() {
        return { name: this.name, active: this.active, max: this.maxConcurrent, queued: this.queue.length };
    }
}

// ═══════════════════════════════════════════════════════════════════
// Saga / Workflow Compensation
// ═══════════════════════════════════════════════════════════════════

class SagaOrchestrator {
    constructor() {
        this.steps = [];
        this.completedSteps = [];
    }

    addStep(name, executeFn, compensateFn) {
        this.steps.push({ name, execute: executeFn, compensate: compensateFn });
        return this;
    }

    async run(context = {}) {
        this.completedSteps = [];

        for (const step of this.steps) {
            try {
                const result = await step.execute(context);
                context[step.name] = result;
                this.completedSteps.push(step);
            } catch (err) {
                // Compensation — unwind in reverse order
                for (const completed of [...this.completedSteps].reverse()) {
                    try {
                        await completed.compensate(context);
                    } catch (compErr) {
                        console.error(`Compensation failed for ${completed.name}:`, compErr.message);
                    }
                }
                throw new Error(`Saga failed at step "${step.name}": ${err.message}`);
            }
        }

        return context;
    }
}

// ═══════════════════════════════════════════════════════════════════
// Event Sourcing
// ═══════════════════════════════════════════════════════════════════

class EventStore extends EventEmitter {
    constructor() {
        super();
        this.events = [];
        this.snapshots = new Map();
    }

    append(streamId, event) {
        const entry = {
            streamId,
            type: event.type,
            data: event.data,
            timestamp: Date.now(),
            sequence: this.events.length,
        };
        this.events.push(entry);
        this.emit('event', entry);
        return entry;
    }

    getStream(streamId) {
        return this.events.filter(e => e.streamId === streamId);
    }

    snapshot(streamId, state) {
        this.snapshots.set(streamId, { state, sequence: this.events.length, timestamp: Date.now() });
    }

    getSnapshot(streamId) {
        return this.snapshots.get(streamId) || null;
    }

    replay(streamId, reducer, initialState = {}) {
        const snap = this.getSnapshot(streamId);
        let state = snap ? { ...snap.state } : { ...initialState };
        const startFrom = snap ? snap.sequence : 0;
        const stream = this.events.filter(e => e.streamId === streamId && e.sequence >= startFrom);
        for (const event of stream) {
            state = reducer(state, event);
        }
        return state;
    }
}

// ═══════════════════════════════════════════════════════════════════
// CQRS Handler
// ═══════════════════════════════════════════════════════════════════

class CQRSHandler {
    constructor(eventStore) {
        this.eventStore = eventStore;
        this.commandHandlers = new Map();
        this.queryHandlers = new Map();
        this.readModels = new Map();
    }

    registerCommand(name, handler) {
        this.commandHandlers.set(name, handler);
    }

    registerQuery(name, handler) {
        this.queryHandlers.set(name, handler);
    }

    async executeCommand(name, payload) {
        const handler = this.commandHandlers.get(name);
        if (!handler) throw new Error(`Unknown command: ${name}`);
        const events = await handler(payload);
        for (const event of events) {
            this.eventStore.append(payload.streamId || 'default', event);
        }
        return events;
    }

    async executeQuery(name, params) {
        const handler = this.queryHandlers.get(name);
        if (!handler) throw new Error(`Unknown query: ${name}`);
        return handler(params, this.readModels);
    }

    updateReadModel(name, data) {
        this.readModels.set(name, data);
    }
}

// ═══════════════════════════════════════════════════════════════════
// Skill-Based Agent Routing
// ═══════════════════════════════════════════════════════════════════

class SkillRouter {
    constructor() {
        this.agents = new Map();
    }

    registerAgent(id, skills = [], maxLoad = 1.0) {
        this.agents.set(id, {
            id,
            skills,
            currentLoad: 0,
            maxLoad,
            status: AgentStatus.IDLE,
            taskCount: 0,
        });
    }

    route(task) {
        const requiredSkills = task.requiredSkills || [task.type];
        let bestAgent = null;
        let bestScore = -Infinity;

        for (const agent of this.agents.values()) {
            if (agent.status === AgentStatus.OFFLINE || agent.status === AgentStatus.OVERLOADED) continue;

            // Skill match score
            const matchedSkills = requiredSkills.filter(s => agent.skills.includes(s));
            if (matchedSkills.length === 0) continue;

            const skillScore = matchedSkills.length / requiredSkills.length;
            const loadScore = 1 - (agent.currentLoad / agent.maxLoad);
            const combinedScore = (skillScore * PHI) + (loadScore * PSI); // φ-weighted

            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestAgent = agent;
            }
        }

        if (!bestAgent) throw new Error(`No agent found for skills: ${requiredSkills.join(', ')}`);

        bestAgent.currentLoad += task.weight || 0.1;
        bestAgent.taskCount++;
        if (bestAgent.currentLoad >= bestAgent.maxLoad) bestAgent.status = AgentStatus.OVERLOADED;
        else if (bestAgent.currentLoad > 0) bestAgent.status = AgentStatus.BUSY;

        return { agentId: bestAgent.id, score: bestScore, matchedSkills: requiredSkills };
    }

    releaseAgent(agentId, weight = 0.1) {
        const agent = this.agents.get(agentId);
        if (!agent) return;
        agent.currentLoad = Math.max(0, agent.currentLoad - weight);
        if (agent.currentLoad === 0) agent.status = AgentStatus.IDLE;
        else if (agent.currentLoad < agent.maxLoad) agent.status = AgentStatus.BUSY;
    }

    getAgentStats() {
        return Array.from(this.agents.values()).map(a => ({
            id: a.id, status: a.status, load: `${(a.currentLoad / a.maxLoad * 100).toFixed(1)}%`, tasks: a.taskCount,
        }));
    }
}

// ═══════════════════════════════════════════════════════════════════
// Auto-Tuning Loop
// ═══════════════════════════════════════════════════════════════════

class AutoTuner {
    constructor(options = {}) {
        this.metrics = { latency: [], throughput: [], errorRate: [] };
        this.params = {
            poolSize: options.poolSize || 10,
            timeout: options.timeout || 5000,
            batchSize: options.batchSize || 50,
            retryDelay: options.retryDelay || 1000,
        };
        this.history = [];
        this.interval = null;
    }

    record(metric, value) {
        if (!this.metrics[metric]) this.metrics[metric] = [];
        this.metrics[metric].push({ value, timestamp: Date.now() });
        // Keep last 1000 observations
        if (this.metrics[metric].length > 1000) this.metrics[metric].shift();
    }

    tune() {
        const avgLatency = this._avg(this.metrics.latency);
        const avgThroughput = this._avg(this.metrics.throughput);
        const avgErrorRate = this._avg(this.metrics.errorRate);

        const prev = { ...this.params };

        // φ-scaled adjustments
        if (avgLatency > 100) this.params.poolSize = Math.ceil(this.params.poolSize * PHI);
        else if (avgLatency < 20 && this.params.poolSize > 5) this.params.poolSize = Math.ceil(this.params.poolSize * PSI);

        if (avgErrorRate > 0.05) this.params.timeout = Math.ceil(this.params.timeout * PHI);
        else if (avgErrorRate < 0.01) this.params.timeout = Math.max(1000, Math.ceil(this.params.timeout * PSI));

        if (avgThroughput > 500) this.params.batchSize = Math.ceil(this.params.batchSize * PHI);
        else if (avgThroughput < 50) this.params.batchSize = Math.max(10, Math.ceil(this.params.batchSize * PSI));

        this.history.push({ timestamp: Date.now(), before: prev, after: { ...this.params }, metrics: { avgLatency, avgThroughput, avgErrorRate } });
        return this.params;
    }

    _avg(arr) {
        if (!arr || arr.length === 0) return 0;
        return arr.reduce((sum, e) => sum + e.value, 0) / arr.length;
    }

    startAutoTune(intervalMs = 60000) {
        this.interval = setInterval(() => this.tune(), intervalMs);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    getParams() { return { ...this.params }; }
    getHistory() { return this.history; }
}

// ═══════════════════════════════════════════════════════════════════
// Hot/Cold Path Separator
// ═══════════════════════════════════════════════════════════════════

class HotColdPathRouter {
    constructor() {
        this.hotPath = [];
        this.coldPath = [];
        this.hotThreshold = 50; // ms latency budget
    }

    route(task) {
        const isHot = task.priority > 0.7 || task.realtime === true;
        if (isHot) {
            this.hotPath.push(task);
            return { path: 'hot', queue: 'priority', latencyBudget: this.hotThreshold };
        } else {
            this.coldPath.push(task);
            return { path: 'cold', queue: 'batch', latencyBudget: 5000 };
        }
    }

    getStats() {
        return { hot: this.hotPath.length, cold: this.coldPath.length };
    }
}

// ═══════════════════════════════════════════════════════════════════
// Main Orchestrator (unified entry point)
// ═══════════════════════════════════════════════════════════════════

class HeadyOrchestrator extends EventEmitter {
    constructor(options = {}) {
        super();
        this.skillRouter = new SkillRouter();
        this.circuitBreakers = new Map();
        this.bulkheads = new Map();
        this.eventStore = new EventStore();
        this.cqrs = new CQRSHandler(this.eventStore);
        this.autoTuner = new AutoTuner(options.tuning || {});
        this.hotCold = new HotColdPathRouter();
        this.taskLog = [];
    }

    registerAgent(id, skills, maxLoad) {
        this.skillRouter.registerAgent(id, skills, maxLoad);
        this.circuitBreakers.set(id, new CircuitBreaker(id));
        this.bulkheads.set(id, new BulkheadIsolation(id, 10));
    }

    async assignTask(task) {
        const startTime = Date.now();

        // 1. Hot/Cold path routing
        const pathInfo = this.hotCold.route(task);

        // 2. Skill-based agent selection
        const routing = this.skillRouter.route(task);

        // 3. Execute through circuit breaker + bulkhead
        const breaker = this.circuitBreakers.get(routing.agentId);
        const bulkhead = this.bulkheads.get(routing.agentId);

        const result = await breaker.execute(() =>
            bulkhead.execute(async () => {
                // Simulate task execution
                return { taskId: task.id, agentId: routing.agentId, path: pathInfo.path, status: TaskStatus.COMPLETED };
            })
        );

        // 4. Event sourcing
        this.eventStore.append('tasks', { type: 'TASK_COMPLETED', data: { ...result, latency: Date.now() - startTime } });

        // 5. Auto-tuner metrics
        this.autoTuner.record('latency', Date.now() - startTime);

        this.taskLog.push(result);
        this.emit('task:completed', result);
        return result;
    }

    createSaga() {
        return new SagaOrchestrator();
    }

    getSystemHealth() {
        return {
            agents: this.skillRouter.getAgentStats(),
            circuits: Array.from(this.circuitBreakers.values()).map(cb => cb.getStatus()),
            bulkheads: Array.from(this.bulkheads.values()).map(bh => bh.getStatus()),
            hotCold: this.hotCold.getStats(),
            tuning: this.autoTuner.getParams(),
            totalTasks: this.taskLog.length,
            eventCount: this.eventStore.events.length,
        };
    }

    shutdown() {
        this.autoTuner.stop();
    }
}

// ═══════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════

module.exports = {
    HeadyOrchestrator,
    CircuitBreaker,
    BulkheadIsolation,
    SagaOrchestrator,
    EventStore,
    CQRSHandler,
    SkillRouter,
    AutoTuner,
    HotColdPathRouter,
    AgentStatus,
    TaskStatus,
    CircuitState,
    PHI,
    PSI,
};
