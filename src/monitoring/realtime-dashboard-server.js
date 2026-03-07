'use strict';

/**
 * Real-Time Monitoring Dashboard — WebSocket Server
 * 
 * Inspired by Perplexity Computer's parallel agent UI:
 * - Live agent status broadcasting via WebSocket
 * - Parallel task tracking with step-by-step progress
 * - Bee swarm visualization feed
 * - Circuit breaker state monitoring
 * - Pipeline stage progress tracking
 */

const { EventEmitter } = require('events');

class RealtimeDashboardServer extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.port = opts.port || 9090;
        this.clients = new Set();
        this.agentStates = new Map();
        this.taskQueue = [];
        this.metrics = {
            connected: 0,
            messagesSent: 0,
            agentUpdates: 0,
            startedAt: Date.now(),
        };
    }

    /**
     * Register a new agent for monitoring.
     */
    registerAgent(agentId, metadata = {}) {
        this.agentStates.set(agentId, {
            id: agentId,
            status: 'idle',
            currentTask: null,
            progress: 0,
            steps: [],
            startedAt: null,
            lastUpdate: Date.now(),
            ...metadata,
        });
        this._broadcast('agent:registered', { agentId, metadata });
    }

    /**
     * Update an agent's status — broadcasts to all connected clients.
     */
    updateAgent(agentId, update) {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        Object.assign(state, update, { lastUpdate: Date.now() });
        this.metrics.agentUpdates++;
        this._broadcast('agent:updated', { agentId, state });
        this.emit('agent:change', agentId, state);
    }

    /**
     * Add a step to an agent's task progress (like Perplexity's step-by-step display).
     */
    addStep(agentId, step) {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        const stepObj = {
            id: `step-${Date.now()}`,
            label: step.label,
            status: step.status || 'running', // pending | running | done | error
            detail: step.detail || '',
            startedAt: Date.now(),
            completedAt: null,
        };

        state.steps.push(stepObj);
        state.progress = state.steps.filter(s => s.status === 'done').length / Math.max(state.steps.length, 1);
        state.lastUpdate = Date.now();

        this._broadcast('agent:step', { agentId, step: stepObj, progress: state.progress });
        return stepObj.id;
    }

    /**
     * Complete a step (transitions from running → done).
     */
    completeStep(agentId, stepId, result = {}) {
        const state = this.agentStates.get(agentId);
        if (!state) return;

        const step = state.steps.find(s => s.id === stepId);
        if (step) {
            step.status = 'done';
            step.completedAt = Date.now();
            step.result = result;
        }

        state.progress = state.steps.filter(s => s.status === 'done').length / Math.max(state.steps.length, 1);
        this._broadcast('agent:step:complete', { agentId, stepId, progress: state.progress });
    }

    /**
     * Report circuit breaker state changes.
     */
    reportCircuitBreaker(name, cbState) {
        this._broadcast('circuit-breaker:update', {
            name,
            state: cbState.state,
            failures: cbState.failures,
            successes: cbState.successes,
            lastFailure: cbState.lastFailure,
            timestamp: Date.now(),
        });
    }

    /**
     * Report pipeline stage progress.
     */
    reportPipeline(pipelineId, stages) {
        this._broadcast('pipeline:update', {
            pipelineId,
            stages: stages.map((s, i) => ({
                index: i,
                name: s.name,
                status: s.status, // pending | running | done | error | skipped
                duration: s.duration || null,
            })),
            timestamp: Date.now(),
        });
    }

    /**
     * Report bee swarm status.
     */
    reportBeeSwarm(bees) {
        this._broadcast('swarm:update', {
            activeBees: bees.filter(b => b.status === 'active').length,
            totalBees: bees.length,
            bees: bees.map(b => ({
                domain: b.domain,
                status: b.status,
                currentTask: b.currentTask || null,
                throughput: b.throughput || 0,
            })),
            timestamp: Date.now(),
        });
    }

    /**
     * Get full system snapshot for initial client sync.
     */
    getSnapshot() {
        return {
            agents: Object.fromEntries(this.agentStates),
            metrics: {
                ...this.metrics,
                uptime: Date.now() - this.metrics.startedAt,
            },
            timestamp: Date.now(),
        };
    }

    /**
     * Broadcast a message to all connected WebSocket clients.
     */
    _broadcast(event, data) {
        const message = JSON.stringify({ event, data, ts: Date.now() });
        this.metrics.messagesSent++;
        for (const client of this.clients) {
            try {
                client.send(message);
            } catch (e) {
                this.clients.delete(client);
            }
        }
    }

    /**
     * Handle new WebSocket connection.
     */
    handleConnection(ws) {
        this.clients.add(ws);
        this.metrics.connected = this.clients.size;

        // Send full snapshot on connect
        ws.send(JSON.stringify({
            event: 'snapshot',
            data: this.getSnapshot(),
            ts: Date.now(),
        }));

        ws.on('close', () => {
            this.clients.delete(ws);
            this.metrics.connected = this.clients.size;
        });
    }
}

let _dashboard = null;
function getDashboardServer(opts) {
    if (!_dashboard) _dashboard = new RealtimeDashboardServer(opts);
    return _dashboard;
}

module.exports = { RealtimeDashboardServer, getDashboardServer };
