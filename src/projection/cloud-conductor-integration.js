/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */

'use strict';

/**
 * cloud-conductor-integration.js — Cloud Run Service for the Projection System
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Production Cloud Run service definition that runs the Autonomous Projection
 * System. Integrates Pub/Sub push subscriptions to trigger projection bees
 * in real-time based on topic events.
 *
 * Architecture:
 *   Cloud Run (this service)
 *     ├── Express HTTP server
 *     │     ├── POST /pubsub/push  — Pub/Sub push endpoint
 *     │     ├── GET  /health       — Cloud Run health check
 *     │     └── GET  /status       — Full projection status
 *     │
 *     ├── ProjectionSwarm (all 6 bees + PHI scheduling)
 *     ├── ProjectionManager (data store / snapshot cache)
 *     └── HeadyConductor (routing brain)
 *
 * Pub/Sub Topic → Bee Mapping:
 *   heady-vector-updates     → vector-projection
 *   heady-config-changes     → config-projection
 *   heady-health-events      → health-projection
 *   heady-telemetry-stream   → telemetry-projection
 *   heady-task-events        → task-projection
 *   heady-topology-changes   → topology-projection
 *
 * Environment:
 *   GOOGLE_CLOUD_PROJECT         — GCP project ID
 *   PUBSUB_SUBSCRIPTION_PREFIX   — Prefix for subscription names
 *   CLOUD_RUN_SERVICE_URL        — This service's URL (for health callbacks)
 *   PORT                         — Port to listen on (default 8080)
 *
 * Exports:
 *   createCloudConductorService(config) → Express app (fully wired)
 *
 * Patent: PPA #3 — Agentic Intelligence Network (AIN)
 */

const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger').child('cloud-conductor');
const { onShutdown, installShutdownHooks } = require('../lifecycle/graceful-shutdown');
const { ProjectionSwarm } = require('./projection-swarm');
const { integrateConductor } = require('./conductor-integration');
const { broadcastUpdate, bindToProjectionSource, closeAll: closeAllSSE } = require('./projection-sse');

// ─── Golden Ratio ────────────────────────────────────────────────────────────
const PHI = 1.6180339887;

// ─── Audit Trail ────────────────────────────────────────────────────────────
const AUDIT_PATH = path.join(__dirname, '..', '..', 'data', 'cloud-conductor-audit.jsonl');

// ─── Pub/Sub Topic → Bee Domain Mapping ──────────────────────────────────────
const PUBSUB_TOPIC_MAP = {
    'heady-vector-updates':   'vector-projection',
    'heady-config-changes':   'config-projection',
    'heady-health-events':    'health-projection',
    'heady-telemetry-stream': 'telemetry-projection',
    'heady-task-events':      'task-projection',
    'heady-topology-changes': 'topology-projection',
};

// ─── Cloud Run Startup Config Defaults ───────────────────────────────────────
const DEFAULT_CONFIG = {
    port: parseInt(process.env.PORT || '8080', 10),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
    subscriptionPrefix: process.env.PUBSUB_SUBSCRIPTION_PREFIX || 'heady-projection-',
    serviceUrl: process.env.CLOUD_RUN_SERVICE_URL || '',
    maxMessageAge: Math.round(PHI * PHI * 60000), // ~2.618 minutes in ms
};

// ─── Audit Helper ────────────────────────────────────────────────────────────
function _auditWrite(record) {
    try {
        const dir = path.dirname(AUDIT_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const line = JSON.stringify({ ...record, _ts: new Date().toISOString() }) + '\n';
        fs.appendFileSync(AUDIT_PATH, line, 'utf8');
    } catch (_) {}
}

// ─── Pub/Sub Message Decoder ─────────────────────────────────────────────────

/**
 * Decode a Pub/Sub push message payload.
 * Cloud Run Pub/Sub push messages arrive as:
 *   { message: { data: "<base64>", attributes: {}, messageId: "...", publishTime: "..." }, subscription: "..." }
 */
function _decodePubSubMessage(body) {
    if (!body || !body.message) {
        throw new Error('Invalid Pub/Sub push format: missing message field');
    }

    const { message, subscription } = body;
    const { data, attributes, messageId, publishTime } = message;

    let decoded = null;
    if (data) {
        try {
            const raw = Buffer.from(data, 'base64').toString('utf8');
            decoded = JSON.parse(raw);
        } catch (_) {
            // Non-JSON payload — use raw string
            decoded = Buffer.from(data, 'base64').toString('utf8');
        }
    }

    return {
        messageId,
        publishTime,
        subscription,
        attributes: attributes || {},
        data: decoded,
        rawData: data,
    };
}

/**
 * Extract the topic name from a subscription path.
 * e.g. "projects/my-project/subscriptions/heady-projection-health-events-sub"
 *      → "heady-health-events"
 */
function _topicFromSubscription(subscription, prefix) {
    if (!subscription) return null;
    // Subscriptions are named: <prefix><topic>-sub
    const parts = subscription.split('/');
    const subName = parts[parts.length - 1]; // last segment
    // Strip prefix and -sub suffix
    let topic = subName;
    if (prefix && topic.startsWith(prefix)) {
        topic = topic.slice(prefix.length);
    }
    if (topic.endsWith('-sub')) {
        topic = topic.slice(0, -4);
    }
    return topic;
}

// ─── Message Age Check ────────────────────────────────────────────────────────

function _isMessageTooOld(publishTime, maxAgeMs) {
    if (!publishTime) return false;
    const published = new Date(publishTime).getTime();
    if (isNaN(published)) return false;
    return (Date.now() - published) > maxAgeMs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// createCloudConductorService — Factory for the Cloud Run Express App
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create and configure the Cloud Run service Express app.
 *
 * @param {object} [config]           - Optional config overrides
 * @param {number} [config.port]
 * @param {string} [config.projectId]
 * @param {string} [config.subscriptionPrefix]
 * @param {string} [config.serviceUrl]
 * @param {object} [config.projectionManager] - Injection for testing
 * @param {object} [config.projectionSwarm]   - Injection for testing
 * @param {object} [config.conductor]         - Injection for testing
 * @returns {object} Express app (call app.listen() to start)
 */
function createCloudConductorService(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    let express;
    try { express = require('express'); } catch (err) {
        throw new Error('[CloudConductor] express package is required');
    }

    const app = express();
    app.use(express.json({ limit: '10mb' }));

    // Track service state
    let _swarm = cfg.projectionSwarm || null;
    let _manager = cfg.projectionManager || null;
    let _conductor = cfg.conductor || null;
    let _started = false;
    let _startedAt = null;
    let _pubsubMessagesProcessed = 0;
    let _pubsubErrors = 0;
    let _server = null;

    // ── Lazy initialization of swarm + manager + conductor ────────────────────
    function _getSwarm() {
        if (!_swarm) {
            _swarm = new ProjectionSwarm({ autoScale: true, maxConcurrency: 8 });
        }
        return _swarm;
    }

    function _getManager() {
        if (!_manager) {
            // Lazy load ProjectionManager — may not exist in all environments
            try {
                const { ProjectionManager } = require('./projection-manager');
                _manager = new ProjectionManager();
            } catch (_) {
                // Minimal shim for environments without projection-manager
                _manager = {
                    getStatus: () => ({ shim: true }),
                    getAllProjections: () => ({}),
                    getProjection: () => null,
                };
            }
        }
        return _manager;
    }

    function _getConductor() {
        if (!_conductor) {
            try {
                const HeadyConductor = require('../heady-conductor');
                _conductor = new (HeadyConductor.HeadyConductor || HeadyConductor)();
            } catch (_) {
                // Minimal conductor shim
                const { EventEmitter } = require('events');
                _conductor = new EventEmitter();
                _conductor.route = async (task) => ({ serviceGroup: 'projection', weight: 0.45 });
                _conductor.getStatus = () => ({ shim: true });
            }
        }
        return _conductor;
    }

    // ── Service Boot ──────────────────────────────────────────────────────────

    async function _boot() {
        if (_started) return;
        _started = true;
        _startedAt = Date.now();

        const swarm = _getSwarm();
        const manager = _getManager();
        const conductor = _getConductor();

        logger.info({
            projectId: cfg.projectId,
            subscriptionPrefix: cfg.subscriptionPrefix,
            serviceUrl: cfg.serviceUrl,
        }, '[CloudConductor] Booting');

        // Load projection bees
        _loadProjectionBees(swarm);

        // Wire conductor integration (routes + health + SSE)
        const integration = integrateConductor(conductor, manager, swarm);
        app.use('/api/projections', integration.router);

        // Bind SSE to swarm events
        bindToProjectionSource(swarm);

        // Start the swarm
        swarm.start();

        // Register shutdown hooks
        onShutdown('cloud-conductor-swarm', async () => {
            logger.info('[CloudConductor] SIGTERM received — draining');
            closeAllSSE();
            await swarm.stop();
            if (_server) {
                await new Promise(resolve => _server.close(resolve));
            }
        });

        _auditWrite({
            event: 'cloud-conductor:booted',
            projectId: cfg.projectId,
            bees: swarm.bees.size,
        });

        logger.info({ bees: swarm.bees.size }, '[CloudConductor] Boot complete');
    }

    // ── Load Projection Bees ──────────────────────────────────────────────────

    function _loadProjectionBees(swarm) {
        // Attempt to load each bee module — fail gracefully if not available
        const beeModules = [
            { path: './health-bee',     domain: 'health-projection',    priority: 0.95 },
            { path: './config-bee',     domain: 'config-projection',    priority: 0.90 },
            { path: './telemetry-bee',  domain: 'telemetry-projection', priority: 0.75 },
            { path: './vector-bee',     domain: 'vector-projection',    priority: 0.70 },
            { path: './task-bee',       domain: 'task-projection',      priority: 0.65 },
            { path: './topology-bee',   domain: 'topology-projection',  priority: 0.60 },
        ];

        for (const def of beeModules) {
            try {
                const mod = require(def.path);
                swarm.addBee({
                    domain: def.domain,
                    priority: def.priority,
                    workers: mod.workers || [_makeNopWorker(def.domain)],
                    description: mod.description || def.domain,
                });
                logger.debug({ domain: def.domain }, '[CloudConductor] Bee loaded');
            } catch (err) {
                // Bee module not available — register a stub so swarm is aware of it
                logger.warn({ domain: def.domain, err: err.message },
                    '[CloudConductor] Bee module not found — registering stub');
                swarm.addBee({
                    domain: def.domain,
                    priority: def.priority,
                    workers: [_makeNopWorker(def.domain)],
                    description: `Stub for ${def.domain}`,
                    _stub: true,
                });
            }
        }
    }

    function _makeNopWorker(domain) {
        return async (ctx) => ({
            domain,
            ok: true,
            stub: true,
            ts: new Date().toISOString(),
        });
    }

    // ═══ HTTP ENDPOINTS ═══════════════════════════════════════════════════════

    // ── POST /pubsub/push — Pub/Sub push subscription handler ─────────────────
    app.post('/pubsub/push', async (req, res) => {
        const receiveTime = Date.now();

        try {
            const msg = _decodePubSubMessage(req.body);

            // Determine which topic this subscription is for
            const topic = _topicFromSubscription(msg.subscription, cfg.subscriptionPrefix);

            // Reject stale messages (Cloud Run may deliver old messages during restarts)
            if (_isMessageTooOld(msg.publishTime, cfg.maxMessageAge)) {
                logger.warn({ topic, messageId: msg.messageId, publishTime: msg.publishTime },
                    '[CloudConductor] Stale Pub/Sub message rejected');
                // Return 200 to acknowledge (prevent redelivery of stale msg)
                return res.status(200).json({ ok: true, acked: true, reason: 'stale' });
            }

            const beeDomain = PUBSUB_TOPIC_MAP[topic];

            if (!beeDomain) {
                logger.warn({ topic, subscription: msg.subscription },
                    '[CloudConductor] Unknown Pub/Sub topic — ignoring');
                return res.status(200).json({ ok: true, acked: true, reason: 'unknown-topic' });
            }

            logger.debug({ topic, beeDomain, messageId: msg.messageId },
                '[CloudConductor] Pub/Sub message received');

            _pubsubMessagesProcessed++;

            // Trigger the corresponding projection bee
            const swarm = _getSwarm();
            const result = await swarm.blast(beeDomain).catch(err => ({
                ok: false,
                error: err.message,
                domain: beeDomain,
            }));

            // Broadcast to SSE clients
            broadcastUpdate(beeDomain, {
                topic,
                messageId: msg.messageId,
                data: msg.data,
                blast: result,
                ts: new Date().toISOString(),
            });

            _auditWrite({
                event: 'pubsub:processed',
                topic,
                beeDomain,
                messageId: msg.messageId,
                ok: result.ok !== false,
                latencyMs: Date.now() - receiveTime,
            });

            // Must return 200 to acknowledge the Pub/Sub message
            res.status(200).json({
                ok: true,
                acked: true,
                topic,
                beeDomain,
                result,
            });

        } catch (err) {
            _pubsubErrors++;
            logger.error({ err: err.message }, '[CloudConductor] Pub/Sub push error');
            _auditWrite({ event: 'pubsub:error', error: err.message });

            // Return 200 — returning 4xx/5xx causes Pub/Sub to redeliver
            res.status(200).json({ ok: false, acked: true, error: err.message });
        }
    });

    // ── GET /health — Cloud Run health check ──────────────────────────────────
    app.get('/health', (req, res) => {
        const swarm = _getSwarm();
        const swarmStatus = swarm.getStatus();

        const healthy = swarm._running && !swarm._paused;

        const body = {
            ok: healthy,
            status: healthy ? 'HEALTHY' : 'DEGRADED',
            service: 'heady-projection-cloud-conductor',
            version: process.env.K_REVISION || '1',
            started: _started,
            startedAt: _startedAt,
            uptime: _startedAt ? Date.now() - _startedAt : 0,
            swarm: {
                running: swarmStatus.running,
                paused: swarmStatus.paused,
                beeCount: swarmStatus.beeCount,
                activeTasks: swarmStatus.telemetry?.activeTasks || 0,
                errorRate: swarmStatus.telemetry?.totalRuns > 0
                    ? +(swarmStatus.telemetry.totalErrors / swarmStatus.telemetry.totalRuns).toFixed(4)
                    : 0,
            },
            pubsub: {
                processed: _pubsubMessagesProcessed,
                errors: _pubsubErrors,
                topicMap: Object.keys(PUBSUB_TOPIC_MAP),
            },
            ts: new Date().toISOString(),
        };

        // Cloud Run considers any 2xx as healthy
        res.status(healthy ? 200 : 200).json(body);
    });

    // ── GET /status — Full projection status ──────────────────────────────────
    app.get('/status', (req, res) => {
        try {
            const swarm = _getSwarm();
            const manager = _getManager();
            const conductor = _getConductor();

            res.json({
                ok: true,
                service: 'heady-projection-cloud-conductor',
                environment: {
                    projectId: cfg.projectId,
                    subscriptionPrefix: cfg.subscriptionPrefix,
                    serviceUrl: cfg.serviceUrl,
                    revision: process.env.K_REVISION || '',
                    region: process.env.CLOUD_RUN_REGION || '',
                },
                swarm: swarm.getStatus(),
                schedule: swarm.getSchedule(),
                manager: manager.getStatus ? manager.getStatus() : { shim: true },
                conductor: conductor.getStatus ? conductor.getStatus() : { shim: true },
                pubsub: {
                    processed: _pubsubMessagesProcessed,
                    errors: _pubsubErrors,
                    topicMap: PUBSUB_TOPIC_MAP,
                },
                ts: new Date().toISOString(),
            });
        } catch (err) {
            logger.error({ err: err.message }, 'GET /status error');
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── POST /control/blast — Manually trigger all bees ───────────────────────
    app.post('/control/blast', async (req, res) => {
        try {
            const swarm = _getSwarm();
            const result = await swarm.blastAll();
            _auditWrite({ event: 'control:blast-all', result });
            res.json({ ok: true, result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── POST /control/blast/:domain — Manually trigger a specific bee ─────────
    app.post('/control/blast/:domain', async (req, res) => {
        try {
            const { domain } = req.params;
            const swarm = _getSwarm();
            const result = await swarm.blast(domain);
            _auditWrite({ event: 'control:blast', domain, result });
            res.json({ ok: true, domain, result });
        } catch (err) {
            res.status(500).json({ ok: false, error: err.message });
        }
    });

    // ── POST /control/pause ───────────────────────────────────────────────────
    app.post('/control/pause', (req, res) => {
        _getSwarm().pause();
        res.json({ ok: true, action: 'paused', ts: new Date().toISOString() });
    });

    // ── POST /control/resume ──────────────────────────────────────────────────
    app.post('/control/resume', (req, res) => {
        _getSwarm().resume();
        res.json({ ok: true, action: 'resumed', ts: new Date().toISOString() });
    });

    // ── 404 fallthrough ───────────────────────────────────────────────────────
    app.use((req, res) => {
        res.status(404).json({ ok: false, error: `Not found: ${req.method} ${req.path}` });
    });

    // ── Error handler ─────────────────────────────────────────────────────────
    app.use((err, req, res, next) => {
        logger.error({ err: err.message, path: req.path }, '[CloudConductor] Unhandled error');
        res.status(500).json({ ok: false, error: err.message });
    });

    // ── start() — Boot the service and begin listening ────────────────────────
    app.start = async function() {
        await _boot();

        return new Promise((resolve, reject) => {
            _server = app.listen(cfg.port, '0.0.0.0', (err) => {
                if (err) return reject(err);
                logger.info({
                    port: cfg.port,
                    projectId: cfg.projectId,
                    topics: Object.keys(PUBSUB_TOPIC_MAP).length,
                }, '[CloudConductor] Listening — ready to receive Pub/Sub messages');
                _auditWrite({
                    event: 'cloud-conductor:listening',
                    port: cfg.port,
                    projectId: cfg.projectId,
                });
                resolve(_server);
            });

            _server.on('error', reject);
        });
    };

    // ── Expose internals for testing ──────────────────────────────────────────
    app._getSwarm = _getSwarm;
    app._getManager = _getManager;
    app._getConductor = _getConductor;
    app._cfg = cfg;
    app.PUBSUB_TOPIC_MAP = PUBSUB_TOPIC_MAP;

    return app;
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────
// When this file is executed directly (node cloud-conductor-integration.js),
// it bootstraps the Cloud Run service.

if (require.main === module) {
    installShutdownHooks();

    const app = createCloudConductorService();
    app.start().then(server => {
        logger.info(`[CloudConductor] Service started on port ${server.address()?.port}`);
    }).catch(err => {
        logger.error({ err: err.message }, '[CloudConductor] Fatal startup error');
        process.exit(1);
    });
}

// ─── Module Exports ──────────────────────────────────────────────────────────
module.exports = {
    createCloudConductorService,
    PUBSUB_TOPIC_MAP,
    DEFAULT_CONFIG,
};
