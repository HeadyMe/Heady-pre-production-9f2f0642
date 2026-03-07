/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

'use strict';

/**
 * projection-sse.js — SSE Streaming for the Autonomous Projection System
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Provides real-time Server-Sent Events streaming for projection state updates.
 * Clients connect to GET /api/projections/sse and receive push updates as each
 * projection bee completes its cycle.
 *
 * Architecture:
 *   - Express router with SSE stream endpoint
 *   - Client registry with per-client filter (subscribe by projection type)
 *   - Per-client event buffer (max 100 events — FIFO drop oldest on overflow)
 *   - PHI-based heartbeat interval (~24.3s)
 *   - Backpressure detection via response socket drain state
 *   - Version counter for SSE `id:` field (last-event-id support)
 *
 * SSE Event format:
 *   id: <version number>
 *   event: <projection-type>
 *   data: <JSON projection state>
 *
 * Query params:
 *   ?types=health,telemetry     — subscribe to specific projection types
 *   (omit types for all)
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 */

const { EventEmitter } = require('events');

const logger = require('../utils/logger').child('projection-sse');

// ─── Golden Ratio ────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── Heartbeat Interval: PHI * 15000ms ≈ 24,270ms ───────────────────────────
const HEARTBEAT_INTERVAL_MS = Math.round(PHI * 15000);

// ─── Per-client event buffer cap ─────────────────────────────────────────────
const MAX_BUFFER_SIZE = 100;

// ─── Global version counter (monotonic, shared across all clients) ────────────
let _globalVersion = 0;

// ─── SSE Client ──────────────────────────────────────────────────────────────

class SSEClient {
    /**
     * @param {string} id               - Unique client ID
     * @param {object} res              - Express response object
     * @param {string[]} types          - Subscribed projection types (empty = all)
     * @param {number} lastEventId      - Last event ID from client (for replay)
     */
    constructor(id, res, types, lastEventId) {
        this.id = id;
        this.res = res;
        this.types = types;            // [] = all types
        this.lastEventId = lastEventId || 0;
        this.connectedAt = Date.now();
        this.eventsSent = 0;
        this.eventsDropped = 0;
        this.buffer = [];              // Pending events when backpressured
        this._drained = true;          // Backpressure state
        this._heartbeatTimer = null;
        this._alive = true;

        // Detect client disconnect
        res.on('close', () => this._handleClose());
        res.on('finish', () => this._handleClose());

        // Track socket drain for backpressure
        if (res.socket) {
            res.socket.on('drain', () => {
                this._drained = true;
                this._flushBuffer();
            });
        }
    }

    /**
     * Returns true if this client is subscribed to the given projection type.
     */
    subscribesTo(type) {
        if (!this.types || this.types.length === 0) return true;
        return this.types.includes(type);
    }

    /**
     * Send an SSE event to this client.
     * Applies backpressure — buffers if socket is congested, drops oldest if full.
     *
     * @param {number} version  - Global version counter (SSE id:)
     * @param {string} type     - Projection type (SSE event:)
     * @param {object} data     - Projection state (JSON)
     */
    send(version, type, data) {
        if (!this._alive) return;

        const event = _formatSSEEvent(version, type, data);

        if (!this._drained) {
            // Backpressured — buffer
            if (this.buffer.length >= MAX_BUFFER_SIZE) {
                // Drop oldest
                this.buffer.shift();
                this.eventsDropped++;
            }
            this.buffer.push(event);
            return;
        }

        this._writeEvent(event);
    }

    /**
     * Send a heartbeat comment to keep the connection alive.
     */
    sendHeartbeat() {
        if (!this._alive) return;
        try {
            this.res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (err) {
            this._handleClose();
        }
    }

    /**
     * Start the PHI-based heartbeat timer for this client.
     */
    startHeartbeat() {
        this._heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, HEARTBEAT_INTERVAL_MS);
        if (typeof this._heartbeatTimer.unref === 'function') {
            this._heartbeatTimer.unref();
        }
    }

    stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }

    _writeEvent(event) {
        try {
            const ok = this.res.write(event);
            if (!ok) {
                this._drained = false;
            }
            this.eventsSent++;
        } catch (err) {
            this._handleClose();
        }
    }

    _flushBuffer() {
        while (this._drained && this.buffer.length > 0) {
            const event = this.buffer.shift();
            this._writeEvent(event);
        }
    }

    _handleClose() {
        if (!this._alive) return;
        this._alive = false;
        this.stopHeartbeat();
        logger.debug({ clientId: this.id, eventsSent: this.eventsSent },
            '[SSE] Client disconnected');
    }

    get alive() { return this._alive; }

    getStats() {
        return {
            id: this.id,
            types: this.types,
            connectedAt: this.connectedAt,
            connectedMs: Date.now() - this.connectedAt,
            eventsSent: this.eventsSent,
            eventsDropped: this.eventsDropped,
            bufferSize: this.buffer.length,
            alive: this._alive,
            drained: this._drained,
        };
    }
}

// ─── SSE Format Helper ────────────────────────────────────────────────────────

function _formatSSEEvent(version, type, data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
    return `id: ${version}\nevent: ${type}\ndata: ${dataStr}\n\n`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SSEManager — Central client registry and broadcast engine
// ═══════════════════════════════════════════════════════════════════════════════

class SSEManager extends EventEmitter {
    constructor() {
        super();
        /** @type {Map<string, SSEClient>} */
        this._clients = new Map();
        this._cleanupTimer = null;
        this._totalConnections = 0;
        this._totalEventsbroadcast = 0;
    }

    /**
     * Register a new SSE client.
     * @param {object} res      - Express response
     * @param {string[]} types  - Subscribed types
     * @param {number} lastEventId
     */
    addClient(res, types, lastEventId) {
        const id = `sse-${++this._totalConnections}-${Date.now().toString(36)}`;
        const client = new SSEClient(id, res, types, lastEventId);

        this._clients.set(id, client);

        client.startHeartbeat();

        // Remove client on disconnect
        res.on('close', () => {
            this._clients.delete(id);
            this.emit('client:disconnected', { id, total: this._clients.size });
        });

        this.emit('client:connected', { id, types, total: this._clients.size });
        logger.debug({ id, types, total: this._clients.size }, '[SSE] Client connected');

        return id;
    }

    /**
     * Broadcast a projection update to all subscribed clients.
     * @param {string} type  - Projection type
     * @param {object} data  - Projection data
     */
    broadcastUpdate(type, data) {
        if (this._clients.size === 0) return;

        const version = ++_globalVersion;
        let delivered = 0;
        let dead = [];

        for (const [id, client] of this._clients) {
            if (!client.alive) {
                dead.push(id);
                continue;
            }
            if (client.subscribesTo(type)) {
                client.send(version, type, data);
                delivered++;
            }
        }

        // Prune dead clients
        for (const id of dead) {
            this._clients.delete(id);
        }

        this._totalEventsbroadcast++;

        if (delivered > 0) {
            logger.debug({ type, version, delivered }, '[SSE] Broadcast sent');
        }

        return { version, delivered, dead: dead.length };
    }

    /**
     * Returns number of currently connected clients.
     */
    getClientCount() {
        return this._clients.size;
    }

    getStats() {
        const clients = [...this._clients.values()].map(c => c.getStats());
        return {
            connectedClients: this._clients.size,
            totalConnections: this._totalConnections,
            totalEventsbroadcast: this._totalEventsbroadcast,
            globalVersion: _globalVersion,
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
            clients,
        };
    }

    /**
     * Gracefully close all client connections.
     */
    closeAll() {
        for (const client of this._clients.values()) {
            try {
                client.stopHeartbeat();
                client.res.end();
            } catch (_) {}
        }
        this._clients.clear();
        logger.info('[SSE] All clients closed');
    }
}

// ─── Singleton SSE Manager ────────────────────────────────────────────────────
const _sseManager = new SSEManager();

// ═══════════════════════════════════════════════════════════════════════════════
// createSSERouter — Factory for Express SSE endpoint
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an Express router that provides SSE streaming.
 * Mount at /api/projections/sse (or any path).
 *
 * @param {object} projectionManager - ProjectionManager (used for initial state replay)
 * @returns {Express.Router}
 */
function createSSERouter(projectionManager) {
    let express;
    try { express = require('express'); } catch (_) {
        throw new Error('[projection-sse] express is required');
    }

    const router = express.Router();

    /**
     * GET / — Connect to SSE stream
     *
     * Query params:
     *   ?types=health,telemetry   — comma-separated list of projection types
     *   (omit for all types)
     */
    router.get('/', (req, res) => {
        // Parse subscribed types
        const typesParam = req.query.types || '';
        const types = typesParam
            ? typesParam.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
            : [];

        // Last-Event-ID support (reconnection replay)
        const lastEventId = parseInt(req.headers['last-event-id'] || '0', 10) || 0;

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-store');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Flush headers immediately
        if (typeof res.flushHeaders === 'function') res.flushHeaders();

        // Register client
        const clientId = _sseManager.addClient(res, types, lastEventId);

        // Send initial connection event
        res.write(`event: connected\ndata: ${JSON.stringify({
            clientId,
            types,
            heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
            ts: new Date().toISOString(),
        })}\n\n`);

        // Send current state for subscribed types on connect (initial sync)
        if (projectionManager && typeof projectionManager.getAllProjections === 'function') {
            try {
                const all = projectionManager.getAllProjections();
                const projTypes = types.length > 0 ? types : Object.keys(all);
                for (const t of projTypes) {
                    if (all[t]) {
                        const version = ++_globalVersion;
                        res.write(_formatSSEEvent(version, t, all[t]));
                    }
                }
            } catch (_) {}
        }

        logger.info({ clientId, types }, '[SSE] Client connected');
    });

    /**
     * GET /stats — SSE manager stats (non-streaming)
     */
    router.get('/stats', (req, res) => {
        res.json(_sseManager.getStats());
    });

    return router;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public API — bind to ProjectionManager events
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bind SSE broadcasts to a ProjectionManager or ProjectionSwarm instance.
 * Call this after creating the SSE router.
 *
 * @param {EventEmitter} source - ProjectionManager or ProjectionSwarm
 */
function bindToProjectionSource(source) {
    if (!source || typeof source.on !== 'function') return;

    // Projection update events
    source.on('projection:updated', ({ type, data }) => {
        _sseManager.broadcastUpdate(type, data);
    });

    // Bee completion events from swarm
    source.on('bee:complete', ({ domain, ...rest }) => {
        _sseManager.broadcastUpdate(domain, rest);
    });

    // System-level events
    source.on('swarm:pulse', data => {
        _sseManager.broadcastUpdate('swarm-pulse', data);
    });

    source.on('swarm:started', data => {
        _sseManager.broadcastUpdate('system', { event: 'swarm:started', ...data });
    });

    source.on('swarm:stopped', data => {
        _sseManager.broadcastUpdate('system', { event: 'swarm:stopped', ...data });
    });

    logger.info('[SSE] Bound to projection source events');
}

/**
 * Broadcast a projection update to all connected clients.
 * Can be called directly from anywhere in the system.
 *
 * @param {string} type  - Projection type (e.g. 'health', 'telemetry')
 * @param {object} data  - Projection state data
 */
function broadcastUpdate(type, data) {
    return _sseManager.broadcastUpdate(type, data);
}

/**
 * Returns the number of currently connected SSE clients.
 */
function getClientCount() {
    return _sseManager.getClientCount();
}

/**
 * Close all SSE connections (for graceful shutdown).
 */
function closeAll() {
    return _sseManager.closeAll();
}

// ─── Module Exports ──────────────────────────────────────────────────────────
module.exports = {
    createSSERouter,
    broadcastUpdate,
    getClientCount,
    closeAll,
    bindToProjectionSource,
    SSEManager,
    _sseManager,
};
