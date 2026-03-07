/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Enterprise Resilience Patterns — Phase 4 System Resilience
 *
 * Implements: Saga/Compensation, Bulkhead Isolation, Event Sourcing,
 * CQRS, Auto-Tuning, Hot/Cold Path Separation, Skill-Based Routing
 */

const { getLogger } = require('./structured-logger');
const logger = getLogger('resilience');
const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════
// 1. SAGA / WORKFLOW COMPENSATION
// ═══════════════════════════════════════════════════════════════

class SagaOrchestrator {
    constructor(name) {
        this.name = name;
        this.steps = [];
        this.completedSteps = [];
        this.state = 'idle'; // idle | running | compensating | completed | failed
    }

    addStep(name, execute, compensate) {
        this.steps.push({ name, execute, compensate });
        return this;
    }

    async run(context = {}) {
        this.state = 'running';
        this.completedSteps = [];
        const sagaId = crypto.randomUUID();
        logger.info('Saga started', { sagaId, saga: this.name, steps: this.steps.length });

        for (const step of this.steps) {
            try {
                const result = await step.execute(context);
                context[step.name] = result;
                this.completedSteps.push(step);
                logger.info('Saga step completed', { sagaId, step: step.name });
            } catch (error) {
                logger.error('Saga step failed — initiating compensation', {
                    sagaId, step: step.name, error: error.message,
                });
                await this._compensate(sagaId, context);
                this.state = 'failed';
                return { success: false, sagaId, failedStep: step.name, error: error.message };
            }
        }

        this.state = 'completed';
        logger.info('Saga completed successfully', { sagaId, saga: this.name });
        return { success: true, sagaId, context };
    }

    async _compensate(sagaId, context) {
        this.state = 'compensating';
        // Compensate in reverse order
        for (let i = this.completedSteps.length - 1; i >= 0; i--) {
            const step = this.completedSteps[i];
            try {
                await step.compensate(context);
                logger.info('Compensation step completed', { sagaId, step: step.name });
            } catch (err) {
                logger.error('Compensation step failed', { sagaId, step: step.name, error: err.message });
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. BULKHEAD ISOLATION
// ═══════════════════════════════════════════════════════════════

class BulkheadIsolation {
    constructor(name, { maxConcurrent = 10, maxQueue = 50, timeoutMs = 30000 } = {}) {
        this.name = name;
        this.maxConcurrent = maxConcurrent;
        this.maxQueue = maxQueue;
        this.timeoutMs = timeoutMs;
        this.active = 0;
        this.queue = [];
        this.stats = { executed: 0, rejected: 0, timedOut: 0, queued: 0 };
    }

    async execute(fn) {
        if (this.active >= this.maxConcurrent) {
            if (this.queue.length >= this.maxQueue) {
                this.stats.rejected++;
                logger.warn('Bulkhead rejected — queue full', { bulkhead: this.name, active: this.active, queued: this.queue.length });
                throw new Error(`Bulkhead ${this.name}: max queue exceeded`);
            }
            return this._enqueue(fn);
        }
        return this._run(fn);
    }

    async _run(fn) {
        this.active++;
        this.stats.executed++;
        const timer = setTimeout(() => {
            this.stats.timedOut++;
            logger.warn('Bulkhead execution timed out', { bulkhead: this.name });
        }, this.timeoutMs);

        try {
            return await fn();
        } finally {
            clearTimeout(timer);
            this.active--;
            this._dequeue();
        }
    }

    _enqueue(fn) {
        this.stats.queued++;
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
        });
    }

    _dequeue() {
        if (this.queue.length > 0 && this.active < this.maxConcurrent) {
            const { fn, resolve, reject } = this.queue.shift();
            this._run(fn).then(resolve).catch(reject);
        }
    }

    getHealth() {
        return { name: this.name, active: this.active, queued: this.queue.length, stats: this.stats };
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. EVENT SOURCING
// ═══════════════════════════════════════════════════════════════

class EventStore {
    constructor(name = 'heady') {
        this.name = name;
        this.events = [];
        this.snapshots = [];
        this.subscribers = new Map();
        this.sequenceNumber = 0;
    }

    append(aggregateId, eventType, payload, metadata = {}) {
        const event = {
            sequenceNumber: ++this.sequenceNumber,
            aggregateId,
            eventType,
            payload,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString(),
                correlationId: metadata.correlationId || crypto.randomUUID(),
            },
        };
        this.events.push(event);
        this._notify(eventType, event);
        logger.debug('Event appended', { eventType, aggregateId, seq: event.sequenceNumber });
        return event;
    }

    getEvents(aggregateId, afterSequence = 0) {
        return this.events.filter(
            e => e.aggregateId === aggregateId && e.sequenceNumber > afterSequence
        );
    }

    getEventsByType(eventType, limit = 100) {
        return this.events.filter(e => e.eventType === eventType).slice(-limit);
    }

    replay(aggregateId, reducer, initialState = {}) {
        const events = this.getEvents(aggregateId);
        return events.reduce((state, event) => reducer(state, event), initialState);
    }

    snapshot(aggregateId, state) {
        this.snapshots.push({
            aggregateId,
            state,
            atSequence: this.sequenceNumber,
            createdAt: new Date().toISOString(),
        });
    }

    getLatestSnapshot(aggregateId) {
        return [...this.snapshots].reverse().find(s => s.aggregateId === aggregateId) || null;
    }

    subscribe(eventType, handler) {
        if (!this.subscribers.has(eventType)) this.subscribers.set(eventType, []);
        this.subscribers.get(eventType).push(handler);
    }

    _notify(eventType, event) {
        const handlers = this.subscribers.get(eventType) || [];
        const wildcardHandlers = this.subscribers.get('*') || [];
        [...handlers, ...wildcardHandlers].forEach(h => {
            try { h(event); } catch (e) { logger.error('Event subscriber error', { error: e.message }); }
        });
    }

    getHealth() {
        return {
            name: this.name,
            totalEvents: this.events.length,
            totalSnapshots: this.snapshots.length,
            currentSequence: this.sequenceNumber,
            subscriberCount: [...this.subscribers.values()].reduce((a, b) => a + b.length, 0),
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// 4. CQRS (Command Query Responsibility Segregation)
// ═══════════════════════════════════════════════════════════════

class CQRSBus {
    constructor(eventStore) {
        this.eventStore = eventStore || new EventStore('cqrs');
        this.commandHandlers = new Map();
        this.queryHandlers = new Map();
        this.readModels = new Map();
        this.stats = { commands: 0, queries: 0 };
    }

    registerCommand(name, handler) {
        this.commandHandlers.set(name, handler);
    }

    registerQuery(name, handler) {
        this.queryHandlers.set(name, handler);
    }

    registerReadModel(name, projector) {
        this.readModels.set(name, { projector, state: {} });
        // Subscribe read model to events
        this.eventStore.subscribe('*', (event) => {
            const model = this.readModels.get(name);
            if (model) {
                model.state = model.projector(model.state, event);
            }
        });
    }

    async executeCommand(name, payload, metadata = {}) {
        const handler = this.commandHandlers.get(name);
        if (!handler) throw new Error(`Unknown command: ${name}`);

        this.stats.commands++;
        const result = await handler(payload, metadata);

        // Record command as event
        this.eventStore.append(
            payload.aggregateId || 'system',
            `command.${name}`,
            { command: name, payload, result },
            metadata
        );

        logger.info('Command executed', { command: name });
        return result;
    }

    async executeQuery(name, params = {}) {
        const handler = this.queryHandlers.get(name);
        if (!handler) throw new Error(`Unknown query: ${name}`);

        this.stats.queries++;
        return handler(params, this.readModels);
    }

    getReadModel(name) {
        return this.readModels.get(name)?.state || null;
    }

    getHealth() {
        return {
            commands: this.stats.commands,
            queries: this.stats.queries,
            registeredCommands: this.commandHandlers.size,
            registeredQueries: this.queryHandlers.size,
            readModels: this.readModels.size,
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// 5. AUTO-TUNING LOOP
// ═══════════════════════════════════════════════════════════════

class AutoTuner {
    constructor(name, { sampleWindowMs = 60000, adjustIntervalMs = 30000 } = {}) {
        this.name = name;
        this.sampleWindowMs = sampleWindowMs;
        this.adjustIntervalMs = adjustIntervalMs;
        this.metrics = [];
        this.thresholds = {};
        this.adjustmentHistory = [];
        this._timer = null;
    }

    defineThreshold(key, { min, max, target, step = 1, current }) {
        this.thresholds[key] = { min, max, target, step, current: current ?? target };
        return this;
    }

    recordMetric(key, value) {
        this.metrics.push({ key, value, timestamp: Date.now() });
        // Keep only recent samples
        const cutoff = Date.now() - this.sampleWindowMs;
        this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    }

    start() {
        this._timer = setInterval(() => this._adjust(), this.adjustIntervalMs);
        logger.info('Auto-tuner started', { tuner: this.name, thresholds: Object.keys(this.thresholds) });
    }

    stop() {
        clearInterval(this._timer);
    }

    _adjust() {
        for (const [key, threshold] of Object.entries(this.thresholds)) {
            const samples = this.metrics.filter(m => m.key === key);
            if (samples.length === 0) continue;

            const avg = samples.reduce((a, b) => a + b.value, 0) / samples.length;
            const oldValue = threshold.current;
            let newValue = oldValue;

            if (avg > threshold.target * 1.1) {
                // Over target: increase threshold
                newValue = Math.min(threshold.max, oldValue + threshold.step);
            } else if (avg < threshold.target * 0.9) {
                // Under target: decrease threshold
                newValue = Math.max(threshold.min, oldValue - threshold.step);
            }

            if (newValue !== oldValue) {
                threshold.current = newValue;
                this.adjustmentHistory.push({
                    key, oldValue, newValue, avgMetric: avg, timestamp: new Date().toISOString(),
                });
                logger.info('Auto-tune adjustment', { tuner: this.name, key, oldValue, newValue, avgMetric: Math.round(avg * 100) / 100 });
            }
        }
    }

    getCurrentThresholds() {
        const result = {};
        for (const [key, t] of Object.entries(this.thresholds)) {
            result[key] = t.current;
        }
        return result;
    }

    getHealth() {
        return {
            name: this.name,
            thresholds: this.getCurrentThresholds(),
            sampleCount: this.metrics.length,
            adjustments: this.adjustmentHistory.length,
            lastAdjustments: this.adjustmentHistory.slice(-5),
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// 6. HOT PATH / COLD PATH SEPARATION
// ═══════════════════════════════════════════════════════════════

class HotColdRouter {
    constructor({ hotThresholdMs = 100, hotCapacity = 1000, coldBatchSize = 50, coldFlushIntervalMs = 5000 } = {}) {
        this.hotThresholdMs = hotThresholdMs;
        this.hotCapacity = hotCapacity;
        this.coldBatchSize = coldBatchSize;
        this.coldFlushIntervalMs = coldFlushIntervalMs;

        this.hotCache = new Map();
        this.coldBuffer = [];
        this.hotHandler = null;
        this.coldHandler = null;
        this.stats = { hotHits: 0, coldHits: 0, coldFlushes: 0, promotions: 0, demotions: 0 };
        this._flushTimer = null;
    }

    setHotHandler(fn) { this.hotHandler = fn; return this; }
    setColdHandler(fn) { this.coldHandler = fn; return this; }

    start() {
        this._flushTimer = setInterval(() => this._flushCold(), this.coldFlushIntervalMs);
        logger.info('Hot/Cold router started');
    }

    stop() {
        clearInterval(this._flushTimer);
        this._flushCold();
    }

    async route(key, data, { latencySensitive = false } = {}) {
        // Hot path: high-frequency, low-latency
        if (latencySensitive || this.hotCache.has(key)) {
            this.stats.hotHits++;
            this.hotCache.set(key, { data, lastAccess: Date.now(), accessCount: (this.hotCache.get(key)?.accessCount || 0) + 1 });
            this._evictHot();
            return this.hotHandler ? this.hotHandler(key, data) : data;
        }

        // Cold path: batch processing
        this.stats.coldHits++;
        this.coldBuffer.push({ key, data, timestamp: Date.now() });

        // Auto-promote frequently accessed cold items
        const coldAccessCount = this.coldBuffer.filter(c => c.key === key).length;
        if (coldAccessCount >= 3) {
            this.stats.promotions++;
            this.hotCache.set(key, { data, lastAccess: Date.now(), accessCount: coldAccessCount });
            logger.debug('Promoted to hot path', { key, accessCount: coldAccessCount });
        }

        if (this.coldBuffer.length >= this.coldBatchSize) {
            await this._flushCold();
        }

        return this.coldHandler ? this.coldHandler(key, data) : data;
    }

    _evictHot() {
        if (this.hotCache.size <= this.hotCapacity) return;
        // Evict least recently used
        let oldest = null;
        let oldestKey = null;
        for (const [key, entry] of this.hotCache) {
            if (!oldest || entry.lastAccess < oldest.lastAccess) {
                oldest = entry;
                oldestKey = key;
            }
        }
        if (oldestKey) {
            this.hotCache.delete(oldestKey);
            this.stats.demotions++;
        }
    }

    async _flushCold() {
        if (this.coldBuffer.length === 0) return;
        const batch = this.coldBuffer.splice(0, this.coldBatchSize);
        this.stats.coldFlushes++;
        if (this.coldHandler) {
            await this.coldHandler('batch', batch);
        }
        logger.debug('Cold path flushed', { batchSize: batch.length });
    }

    getHealth() {
        return {
            hotCacheSize: this.hotCache.size,
            coldBufferSize: this.coldBuffer.length,
            stats: this.stats,
        };
    }
}

// ═══════════════════════════════════════════════════════════════
// 7. SKILL-BASED AGENT ROUTING
// ═══════════════════════════════════════════════════════════════

class SkillBasedRouter {
    constructor() {
        this.agents = new Map(); // agentId → { skills, load, maxLoad, latencyMs }
        this.routingHistory = [];
        this.stats = { routed: 0, rejected: 0, fallbacks: 0 };
    }

    registerAgent(agentId, { skills = [], maxLoad = 100, latencyMs = 0 } = {}) {
        this.agents.set(agentId, {
            skills: new Set(skills),
            load: 0,
            maxLoad,
            latencyMs,
            taskCount: 0,
            lastTask: null,
        });
        logger.info('Agent registered for skill-based routing', { agentId, skills });
    }

    unregisterAgent(agentId) {
        this.agents.delete(agentId);
    }

    route(requiredSkill, { preferLowLatency = false, preferLowLoad = true } = {}) {
        // Filter agents that have the required skill and have capacity
        const candidates = [];
        for (const [id, agent] of this.agents) {
            if (agent.skills.has(requiredSkill) && agent.load < agent.maxLoad) {
                candidates.push({ id, ...agent });
            }
        }

        if (candidates.length === 0) {
            this.stats.rejected++;
            logger.warn('No agent available for skill', { skill: requiredSkill });
            // Fallback: any agent with capacity
            const fallback = [...this.agents.entries()]
                .filter(([, a]) => a.load < a.maxLoad)
                .sort((a, b) => a[1].load - b[1].load)[0];

            if (fallback) {
                this.stats.fallbacks++;
                logger.info('Skill-based routing fallback', { agentId: fallback[0], skill: requiredSkill });
                return this._assign(fallback[0], requiredSkill);
            }
            return null;
        }

        // Sort by load (ascending) then latency (ascending)
        candidates.sort((a, b) => {
            if (preferLowLatency) return a.latencyMs - b.latencyMs || a.load - b.load;
            if (preferLowLoad) return a.load - b.load || a.latencyMs - b.latencyMs;
            return 0;
        });

        return this._assign(candidates[0].id, requiredSkill);
    }

    _assign(agentId, skill) {
        const agent = this.agents.get(agentId);
        if (!agent) return null;
        agent.load++;
        agent.taskCount++;
        agent.lastTask = new Date().toISOString();
        this.stats.routed++;

        const assignment = { agentId, skill, assignedAt: agent.lastTask };
        this.routingHistory.push(assignment);
        if (this.routingHistory.length > 500) this.routingHistory.shift();

        logger.info('Task routed', { agentId, skill, load: agent.load });
        return assignment;
    }

    releaseLoad(agentId) {
        const agent = this.agents.get(agentId);
        if (agent && agent.load > 0) agent.load--;
    }

    getHealth() {
        const agents = {};
        for (const [id, agent] of this.agents) {
            agents[id] = {
                skills: [...agent.skills],
                load: agent.load,
                maxLoad: agent.maxLoad,
                taskCount: agent.taskCount,
            };
        }
        return { agents, stats: this.stats };
    }
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS + ROUTE REGISTRATION
// ═══════════════════════════════════════════════════════════════

// Singleton instances
const eventStore = new EventStore('heady-global');
const cqrsBus = new CQRSBus(eventStore);
const autoTuner = new AutoTuner('heady-system');
const hotColdRouter = new HotColdRouter();
const skillRouter = new SkillBasedRouter();

function registerResilienceRoutes(app) {
    app.get('/api/resilience/health', (req, res) => {
        res.json({
            eventStore: eventStore.getHealth(),
            cqrs: cqrsBus.getHealth(),
            autoTuner: autoTuner.getHealth(),
            hotCold: hotColdRouter.getHealth(),
            skillRouter: skillRouter.getHealth(),
        });
    });

    app.post('/api/resilience/saga/run', async (req, res) => {
        const { name, steps } = req.body || {};
        const saga = new SagaOrchestrator(name || 'api-saga');
        // Steps from request or default demo
        if (!steps?.length) {
            saga.addStep('validate', async (ctx) => ({ validated: true }),
                async (ctx) => { logger.info('Compensating validate'); });
            saga.addStep('execute', async (ctx) => ({ executed: true }),
                async (ctx) => { logger.info('Compensating execute'); });
        }
        const result = await saga.run({});
        res.json(result);
    });

    app.post('/api/resilience/command', async (req, res) => {
        const { command, payload, metadata } = req.body || {};
        try {
            const result = await cqrsBus.executeCommand(command, payload || {}, metadata || {});
            res.json({ success: true, result });
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.get('/api/resilience/events/:aggregateId', (req, res) => {
        const events = eventStore.getEvents(req.params.aggregateId);
        res.json({ aggregateId: req.params.aggregateId, events });
    });

    logger.info('Resilience pattern routes registered',
        { endpoints: ['/api/resilience/health', '/api/resilience/saga/run', '/api/resilience/command', '/api/resilience/events/:id'] });
}

module.exports = {
    SagaOrchestrator,
    BulkheadIsolation,
    EventStore,
    CQRSBus,
    AutoTuner,
    HotColdRouter,
    SkillBasedRouter,
    // Singletons
    eventStore,
    cqrsBus,
    autoTuner,
    hotColdRouter,
    skillRouter,
    registerResilienceRoutes,
};
