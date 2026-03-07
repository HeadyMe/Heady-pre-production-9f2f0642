/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Agent-to-Agent (A2A) Protocol — Decentralized Agent Discovery & Communication
 *
 * Implements the A2A protocol for the Heady swarm:
 * - .well-known/agent.json discovery cards
 * - Agent capability advertisement
 * - Inter-agent task delegation via JSON-RPC 2.0
 * - Agent health federation
 */

'use strict';

const EventEmitter = require('events');
const logger = require('../utils/logger');

// ─── Agent Card Schema ───────────────────────────────────────────────────────
function createAgentCard(opts = {}) {
    return {
        schema: 'https://a2a.heady.systems/v1/agent-card',
        name: opts.name || 'heady-agent',
        displayName: opts.displayName || 'Heady Agent',
        version: opts.version || '3.0.0',
        description: opts.description || 'Heady multi-agent orchestration node',
        url: opts.url || 'https://manager.headysystems.com',
        capabilities: {
            streaming: opts.streaming !== false,
            pushNotifications: opts.pushNotifications || false,
            stateTransitionHistory: opts.stateHistory || true,
        },
        skills: opts.skills || [],
        protocols: ['mcp', 'a2a', 'a2ui'],
        authentication: {
            type: opts.authType || 'bearer',
            required: opts.authRequired !== false,
        },
        endpoints: {
            task: '/api/v2/a2a/task',
            status: '/api/v2/a2a/status',
            discovery: '/.well-known/agent.json',
            health: '/health/live',
        },
    };
}

// ─── A2A Protocol Engine ─────────────────────────────────────────────────────
class A2AProtocol extends EventEmitter {
    constructor(opts = {}) {
        super();
        this._agents = new Map();    // Known agents in the mesh
        this._tasks = new Map();     // Active delegated tasks
        this._localCard = createAgentCard(opts);
        this._taskCounter = 0;
        this._stats = { tasksCreated: 0, tasksCompleted: 0, tasksFailed: 0, discoveryRequests: 0 };
    }

    /**
     * Register a known agent in the mesh.
     */
    registerAgent(agentId, card) {
        this._agents.set(agentId, {
            card,
            registeredAt: Date.now(),
            lastSeen: Date.now(),
            status: 'active',
        });
        this.emit('agent_registered', { agentId, card });
        return this;
    }

    /**
     * Discover agents by skill.
     */
    discoverBySkill(skillName) {
        this._stats.discoveryRequests++;
        const matches = [];
        for (const [agentId, entry] of this._agents) {
            if (entry.card.skills && entry.card.skills.some(s =>
                (typeof s === 'string' ? s : s.name) === skillName
            )) {
                matches.push({ agentId, ...entry });
            }
        }
        return matches;
    }

    /**
     * Create a task delegation request (JSON-RPC 2.0 envelope).
     */
    createTask(targetAgentId, params) {
        const taskId = `task-${++this._taskCounter}-${Date.now().toString(36)}`;
        const task = {
            jsonrpc: '2.0',
            method: 'a2a.task.create',
            id: taskId,
            params: {
                target: targetAgentId,
                source: this._localCard.name,
                skill: params.skill,
                input: params.input || {},
                priority: params.priority || 'normal',
                timeout: params.timeout || 30000,
                createdAt: new Date().toISOString(),
            },
            status: 'pending',
            result: null,
        };

        this._tasks.set(taskId, task);
        this._stats.tasksCreated++;
        this.emit('task_created', task);
        return task;
    }

    /**
     * Update task status (called when agent responds).
     */
    updateTask(taskId, status, result) {
        const task = this._tasks.get(taskId);
        if (!task) return null;

        task.status = status;
        task.result = result;
        task.completedAt = new Date().toISOString();

        if (status === 'completed') this._stats.tasksCompleted++;
        if (status === 'failed') this._stats.tasksFailed++;

        this.emit('task_updated', task);
        return task;
    }

    /**
     * Get the local agent's discovery card.
     */
    getLocalCard() {
        return this._localCard;
    }

    /**
     * List all known agents in the mesh.
     */
    listAgents() {
        const agents = [];
        for (const [agentId, entry] of this._agents) {
            agents.push({
                agentId,
                name: entry.card.name,
                displayName: entry.card.displayName,
                status: entry.status,
                skills: entry.card.skills,
                lastSeen: new Date(entry.lastSeen).toISOString(),
            });
        }
        return agents;
    }

    getStats() {
        return {
            ...this._stats,
            knownAgents: this._agents.size,
            activeTasks: [...this._tasks.values()].filter(t => t.status === 'pending').length,
        };
    }

    /**
     * Register HTTP routes.
     */
    registerRoutes(app) {
        // Agent discovery card (standard .well-known path)
        app.get('/.well-known/agent.json', (req, res) => {
            this._stats.discoveryRequests++;
            res.json(this._localCard);
        });

        // List known agents
        app.get('/api/v2/a2a/agents', (req, res) => {
            res.json({ ok: true, agents: this.listAgents() });
        });

        // Register an external agent
        app.post('/api/v2/a2a/register', (req, res) => {
            const { agentId, card } = req.body;
            if (!agentId || !card) return res.status(400).json({ error: 'agentId and card required' });
            this.registerAgent(agentId, card);
            res.json({ ok: true, agentId, registered: true });
        });

        // Discover agents by skill
        app.get('/api/v2/a2a/discover', (req, res) => {
            const skill = req.query.skill;
            if (!skill) return res.status(400).json({ error: 'skill query param required' });
            const matches = this.discoverBySkill(skill);
            res.json({ ok: true, skill, matches });
        });

        // Create a task (delegate to agent)
        app.post('/api/v2/a2a/task', (req, res) => {
            const { targetAgentId, skill, input, priority } = req.body;
            if (!targetAgentId || !skill) return res.status(400).json({ error: 'targetAgentId and skill required' });
            const task = this.createTask(targetAgentId, { skill, input, priority });
            res.json({ ok: true, task });
        });

        // Get task status
        app.get('/api/v2/a2a/task/:taskId', (req, res) => {
            const task = this._tasks.get(req.params.taskId);
            if (!task) return res.status(404).json({ error: 'Task not found' });
            res.json({ ok: true, task });
        });

        // Update task result
        app.patch('/api/v2/a2a/task/:taskId', (req, res) => {
            const { status, result } = req.body;
            const task = this.updateTask(req.params.taskId, status, result);
            if (!task) return res.status(404).json({ error: 'Task not found' });
            res.json({ ok: true, task });
        });

        // Stats
        app.get('/api/v2/a2a/stats', (req, res) => res.json({ ok: true, ...this.getStats() }));
    }
}

module.exports = { A2AProtocol, createAgentCard };
