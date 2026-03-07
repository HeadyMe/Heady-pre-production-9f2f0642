/**
 * Heady Project - DAG Engine (Directed Acyclic Graph)
 * 
 * Orchestrates multi-agent AI tasks into verifiable, parallel, 
 * and conditional steps. Integrates with Redis for stateful persistence.
 */

const EventEmitter = require('events');
let redisClient = null;

try {
    const { getKV: redis } = require('../core/heady-kv'); // HeadyKV replaces redis
const logger = require("../utils/logger");
    redisClient = redis.createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
    redisClient.on('error', (err) => logger.warn('Redis Cluster not connected. Using in-memory state.'));
    redisClient.connect().catch(() => { });
} catch (e) {
    logger.warn('redis package not found. Using in-memory state fallback.');
}

const inMemoryStore = {};

class DAGEngine extends EventEmitter {
    constructor() {
        super();
        this.graphs = new Map(); // graphId -> definition
        this.activeRuns = new Map(); // runId -> state
    }

    /**
     * Registers a new DAG workflow.
     * @param {string} graphId 
     * @param {Array} nodes [{ id, action, payload, dependsOn: [], conditions: {} }]
     */
    registerGraph(graphId, nodes) {
        this.graphs.set(graphId, nodes);
        logger.logSystem(`[DAG Engine] Registered workflow: ${graphId} with ${nodes.length} nodes.`);
    }

    async saveState(runId, state) {
        if (redisClient && redisClient.isOpen) {
            await redisClient.set(`dag:run:${runId}`, JSON.stringify(state));
        } else {
            inMemoryStore[runId] = state;
        }
    }

    async loadState(runId) {
        if (redisClient && redisClient.isOpen) {
            const data = await redisClient.get(`dag:run:${runId}`);
            return data ? JSON.parse(data) : null;
        }
        return inMemoryStore[runId] || null;
    }

    /**
     * Executes a DAG instance statefully.
     */
    async execute(graphId, initialContext = {}) {
        const nodes = this.graphs.get(graphId);
        if (!nodes) throw new Error(`DAG ${graphId} not found`);

        const runId = `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        let state = {
            runId,
            graphId,
            status: 'running',
            results: {},
            context: { ...initialContext },
            completed: [],
            failed: []
        };

        await this.saveState(runId, state);
        this.emit('run_started', { runId, graphId });

        try {
            let pending = [...nodes];
            while (state.completed.length + state.failed.length < nodes.length) {
                // Find nodes with met dependencies
                const executable = pending.filter(n => {
                    const deps = n.dependsOn || [];
                    return deps.every(d => state.completed.includes(d));
                });

                if (executable.length === 0 && pending.length > 0) {
                    throw new Error(`DAG Execution Stalled: Circular dependency or failed antecedent in ${graphId}`);
                }

                // Execute in parallel mapping
                await Promise.all(executable.map(async (node) => {
                    this.emit('node_started', { runId, nodeId: node.id });

                    try {
                        const conductor = require('../heady-conductor').getConductor();
                        // Route task via conductor
                        const payload = typeof node.payload === 'function' ? node.payload(state.context, state.results) : node.payload;

                        const routeDecision = await conductor.route({
                            action: node.action,
                            payload: payload
                        });

                        // Mock execution layer
                        const result = { success: true, via: routeDecision.serviceGroup, node: node.id, timestamp: Date.now() };
                        state.results[node.id] = result;
                        state.completed.push(node.id);
                        this.emit('node_completed', { runId, nodeId: node.id, result });
                    } catch (error) {
                        state.failed.push(node.id);
                        this.emit('node_failed', { runId, nodeId: node.id, error: error.message });
                        throw error; // Fail fast for DAG
                    }
                }));

                pending = pending.filter(n => !state.completed.includes(n.id) && !state.failed.includes(n.id));
                await this.saveState(runId, state);
            }

            state.status = 'completed';
            await this.saveState(runId, state);
            this.emit('run_completed', { runId, graphId, state });
            return state;

        } catch (error) {
            state.status = 'failed';
            state.error = error.message;
            await this.saveState(runId, state);
            this.emit('run_failed', { runId, error });
            throw error;
        }
    }
}

let _dagEngine = null;
function getDAGEngine() {
    if (!_dagEngine) {
        _dagEngine = new DAGEngine();
    }
    return _dagEngine;
}

module.exports = { DAGEngine, getDAGEngine };
