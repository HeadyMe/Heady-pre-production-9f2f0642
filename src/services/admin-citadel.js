/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Omni-Optic Admin Command Citadel — Backend Service
 *
 * Governs the multi-agent swarm through:
 * - Real-time DAG tracing via OpenTelemetry (OTel) spans
 * - Interception Queue for high-risk agent operations
 * - God-Mode terminal for natural language agent directives
 * - MCP Armory: visual RBAC for agent↔tool bindings
 */

'use strict';

const EventEmitter = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Trace Span Store (OTel-Compatible) ──────────────────────────────────────
class TraceStore {
    constructor(maxTraces = 5000) {
        this._traces = new Map();  // traceId → { spans[], metadata }
        this._maxTraces = maxTraces;
    }

    /**
     * Ingest an OTel-compatible span.
     */
    ingestSpan(span) {
        const traceId = span.traceId || crypto.randomBytes(16).toString('hex');
        if (!this._traces.has(traceId)) {
            this._traces.set(traceId, {
                traceId,
                spans: [],
                startTime: span.startTime || Date.now(),
                status: 'active',
                metadata: span.metadata || {},
            });
        }

        const trace = this._traces.get(traceId);
        trace.spans.push({
            spanId: span.spanId || crypto.randomBytes(8).toString('hex'),
            parentSpanId: span.parentSpanId || null,
            name: span.name,
            service: span.service || 'unknown',
            startTime: span.startTime || Date.now(),
            endTime: span.endTime || null,
            duration: span.duration || null,
            status: span.status || 'ok', // 'ok', 'error', 'hallucinating'
            attributes: span.attributes || {},
            events: span.events || [],
        });

        // Bound traces
        if (this._traces.size > this._maxTraces) {
            const oldest = [...this._traces.keys()][0];
            this._traces.delete(oldest);
        }

        return { traceId, spanCount: trace.spans.length };
    }

    /**
     * Get a full trace by ID — for AI DVR replay.
     */
    getTrace(traceId) {
        return this._traces.get(traceId) || null;
    }

    /**
     * Build a DAG from a trace's spans.
     */
    buildDAG(traceId) {
        const trace = this._traces.get(traceId);
        if (!trace) return null;

        const nodes = [];
        const edges = [];
        const spanMap = new Map();

        for (const span of trace.spans) {
            spanMap.set(span.spanId, span);
            nodes.push({
                id: span.spanId,
                label: span.name,
                service: span.service,
                status: span.status,
                duration: span.duration,
                metrics: span.attributes,
            });

            if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
                edges.push({
                    source: span.parentSpanId,
                    target: span.spanId,
                    label: `${span.duration || '?'}ms`,
                });
            }
        }

        return { traceId, nodes, edges, spanCount: trace.spans.length };
    }

    /**
     * Search traces by attributes.
     */
    search(query) {
        const results = [];
        for (const [traceId, trace] of this._traces) {
            const match = trace.spans.some(s =>
                s.name.includes(query) ||
                s.service.includes(query) ||
                s.status === query ||
                JSON.stringify(s.attributes).includes(query)
            );
            if (match) {
                results.push({
                    traceId,
                    spanCount: trace.spans.length,
                    startTime: trace.startTime,
                    status: trace.status,
                    services: [...new Set(trace.spans.map(s => s.service))],
                });
            }
            if (results.length >= 50) break;
        }
        return results;
    }

    getStats() {
        return {
            totalTraces: this._traces.size,
            totalSpans: [...this._traces.values()].reduce((sum, t) => sum + t.spans.length, 0),
            errorTraces: [...this._traces.values()].filter(t => t.spans.some(s => s.status === 'error')).length,
            hallucinatingTraces: [...this._traces.values()].filter(t => t.spans.some(s => s.status === 'hallucinating')).length,
        };
    }
}

// ─── Interception Queue ──────────────────────────────────────────────────────
class InterceptionQueue extends EventEmitter {
    constructor() {
        super();
        this._queue = [];
        this._history = [];
        this._stats = { intercepted: 0, approved: 0, vetoed: 0, overridden: 0 };
    }

    /**
     * Intercept a high-risk operation.
     */
    intercept(operation) {
        const entry = {
            id: `intercept-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            operation,
            agent: operation.agent || 'unknown',
            riskLevel: operation.riskLevel || 'high',
            createdAt: new Date().toISOString(),
            status: 'pending',
            resolution: null,
        };

        this._queue.push(entry);
        this._stats.intercepted++;
        this.emit('intercepted', entry);
        return entry;
    }

    /**
     * Admin resolves an interception: approve, veto, or override.
     */
    resolve(interceptId, action, overrideDirective) {
        const idx = this._queue.findIndex(e => e.id === interceptId);
        if (idx === -1) return null;

        const entry = this._queue.splice(idx, 1)[0];
        entry.status = action; // 'approved', 'vetoed', 'overridden'
        entry.resolvedAt = new Date().toISOString();
        entry.resolution = {
            action,
            directive: overrideDirective || null,
        };

        this._stats[action === 'approved' ? 'approved' : action === 'vetoed' ? 'vetoed' : 'overridden']++;
        this._history.push(entry);
        if (this._history.length > 500) this._history = this._history.slice(-250);

        this.emit('resolved', entry);
        return entry;
    }

    getPending() { return this._queue; }
    getHistory(n = 20) { return this._history.slice(-n); }
    getStats() { return { ...this._stats, queueLength: this._queue.length }; }
}

// ─── MCP Armory (Agent ↔ Tool RBAC) ──────────────────────────────────────────
class MCPArmory {
    constructor() {
        this._bindings = new Map(); // agentId → Set(toolNames)
        this._revocations = [];     // Audit trail
    }

    /**
     * Grant an agent access to an MCP tool.
     */
    grant(agentId, toolName) {
        if (!this._bindings.has(agentId)) this._bindings.set(agentId, new Set());
        this._bindings.get(agentId).add(toolName);
        return true;
    }

    /**
     * Revoke an agent's access to an MCP tool (instant — mid-thought revocation).
     */
    revoke(agentId, toolName) {
        const tools = this._bindings.get(agentId);
        if (!tools) return false;
        const removed = tools.delete(toolName);
        if (removed) {
            this._revocations.push({
                agentId, toolName,
                revokedAt: new Date().toISOString(),
            });
        }
        return removed;
    }

    /**
     * Check if an agent has access to a tool.
     */
    isAuthorized(agentId, toolName) {
        const tools = this._bindings.get(agentId);
        return tools ? tools.has(toolName) : false;
    }

    /**
     * Get full RBAC matrix.
     */
    getMatrix() {
        const matrix = [];
        for (const [agentId, tools] of this._bindings) {
            matrix.push({ agentId, tools: [...tools] });
        }
        return matrix;
    }

    getRevocationHistory() { return this._revocations.slice(-50); }
}

// ─── Admin Citadel Service ───────────────────────────────────────────────────
class AdminCitadelService extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.traceStore = new TraceStore(opts.maxTraces || 5000);
        this.interceptionQueue = new InterceptionQueue();
        this.mcpArmory = new MCPArmory();
        this._godModeLog = [];
    }

    /**
     * God-Mode Terminal: natural language directive to override agent context.
     */
    executeGodModeDirective(directive, targetAgent) {
        const entry = {
            id: `god-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
            directive,
            targetAgent: targetAgent || 'all',
            executedAt: new Date().toISOString(),
            status: 'executed',
        };

        this._godModeLog.push(entry);
        if (this._godModeLog.length > 200) this._godModeLog = this._godModeLog.slice(-100);

        this.emit('god_mode', entry);
        return entry;
    }

    /**
     * Register all Citadel routes.
     */
    registerRoutes(app) {
        // ── Trace Store ──
        app.post('/api/v2/citadel/traces/ingest', (req, res) => {
            const result = this.traceStore.ingestSpan(req.body);
            res.json({ ok: true, ...result });
        });

        app.get('/api/v2/citadel/traces/:traceId', (req, res) => {
            const trace = this.traceStore.getTrace(req.params.traceId);
            if (!trace) return res.status(404).json({ error: 'Trace not found' });
            res.json({ ok: true, ...trace });
        });

        app.get('/api/v2/citadel/traces/:traceId/dag', (req, res) => {
            const dag = this.traceStore.buildDAG(req.params.traceId);
            if (!dag) return res.status(404).json({ error: 'Trace not found' });
            res.json({ ok: true, ...dag });
        });

        app.get('/api/v2/citadel/traces/search', (req, res) => {
            const results = this.traceStore.search(req.query.q || '');
            res.json({ ok: true, results });
        });

        app.get('/api/v2/citadel/traces/stats', (req, res) => {
            res.json({ ok: true, ...this.traceStore.getStats() });
        });

        // ── Interception Queue ──
        app.get('/api/v2/citadel/intercept/pending', (req, res) => {
            res.json({ ok: true, queue: this.interceptionQueue.getPending() });
        });

        app.post('/api/v2/citadel/intercept', (req, res) => {
            const entry = this.interceptionQueue.intercept(req.body);
            res.json({ ok: true, ...entry });
        });

        app.post('/api/v2/citadel/intercept/:id/resolve', (req, res) => {
            const { action, directive } = req.body;
            if (!['approved', 'vetoed', 'overridden'].includes(action)) {
                return res.status(400).json({ error: 'action must be approved, vetoed, or overridden' });
            }
            const result = this.interceptionQueue.resolve(req.params.id, action, directive);
            if (!result) return res.status(404).json({ error: 'Interception not found' });
            res.json({ ok: true, ...result });
        });

        app.get('/api/v2/citadel/intercept/history', (req, res) => {
            res.json({ ok: true, history: this.interceptionQueue.getHistory() });
        });

        app.get('/api/v2/citadel/intercept/stats', (req, res) => {
            res.json({ ok: true, ...this.interceptionQueue.getStats() });
        });

        // ── MCP Armory (RBAC) ──
        app.get('/api/v2/citadel/armory/matrix', (req, res) => {
            res.json({ ok: true, matrix: this.mcpArmory.getMatrix() });
        });

        app.post('/api/v2/citadel/armory/grant', (req, res) => {
            const { agentId, toolName } = req.body;
            if (!agentId || !toolName) return res.status(400).json({ error: 'agentId and toolName required' });
            this.mcpArmory.grant(agentId, toolName);
            res.json({ ok: true, granted: true, agentId, toolName });
        });

        app.post('/api/v2/citadel/armory/revoke', (req, res) => {
            const { agentId, toolName } = req.body;
            if (!agentId || !toolName) return res.status(400).json({ error: 'agentId and toolName required' });
            const revoked = this.mcpArmory.revoke(agentId, toolName);
            res.json({ ok: true, revoked, agentId, toolName });
        });

        app.get('/api/v2/citadel/armory/check', (req, res) => {
            const { agentId, toolName } = req.query;
            res.json({ ok: true, authorized: this.mcpArmory.isAuthorized(agentId, toolName) });
        });

        app.get('/api/v2/citadel/armory/revocations', (req, res) => {
            res.json({ ok: true, revocations: this.mcpArmory.getRevocationHistory() });
        });

        // ── God-Mode Terminal ──
        app.post('/api/v2/citadel/god-mode', (req, res) => {
            const { directive, targetAgent } = req.body;
            if (!directive) return res.status(400).json({ error: 'directive required' });
            const result = this.executeGodModeDirective(directive, targetAgent);
            res.json({ ok: true, ...result });
        });

        app.get('/api/v2/citadel/god-mode/log', (req, res) => {
            res.json({ ok: true, log: this._godModeLog.slice(-20) });
        });
    }
}

module.exports = { AdminCitadelService, TraceStore, InterceptionQueue, MCPArmory };
