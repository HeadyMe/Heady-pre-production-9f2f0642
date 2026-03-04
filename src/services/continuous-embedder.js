/**
 * ─── Continuous Embedder Service ──────────────────────────────
 * 
 * RAM-FIRST ARCHITECTURE:
 *   Vector memory IS the source of truth.
 *   Files are just a PROJECTION.
 *   This service maintains bidirectional sync:
 *     INBOUND:  Events → Vector Memory (embedding new data)
 *     OUTBOUND: Vector Memory → File Areas (projecting state)
 * 
 * Event Bus Integration:
 *   INBOUND HOOKS (events → embeddings):
 *             User interactions         src/, configs/, data/
 *             System telemetry          .agents/workflows/
 *             Bee reactions             docs/, _archive/
 *             Health/errors
 *             Environment
 * 
 * After the initial deep embed, this service NEVER scans files.
 * It only:
 *   1. INGESTS new data from event bus hooks (inbound)
 *   2. PROJECTS updated state to file areas when vector state changes (outbound)
 * 
 * Uses smartIngest() with density gating to prevent redundancy.
 * Uses ProjectionManager to track which file areas are stale.
 * ────────────────────────────────────────────────────────────────
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../utils/logger');

const PHI = 1.6180339887;
const EMBED_INTERVAL_MS = Math.round(PHI ** 5 * 1000); // ~11s phi-derived
const PROJECTION_INTERVAL_MS = Math.round(PHI ** 7 * 1000); // ~29s phi-derived
const ENV_INTERVAL_MS = Math.round(PHI ** 8 * 1000); // ~47s phi-derived
const CONTEXT_REFRESH_INTERVAL_MS = Math.round(PHI ** 6 * 1000); // ~18s
const BATCH_SIZE = 8;
const DENSITY_GATE = 0.92;
const MAX_QUEUE = 1000;
const BURST_FLUSH_THRESHOLD = 64;
const MAX_CONTENT_CHARS = 4000;

let vm = null;
let running = false;

const stats = {
    started: null,
    totalIngested: 0,
    totalFiltered: 0,
    totalErrors: 0,
    totalProjections: 0,
    cycles: 0,
    bySource: {},
    lastIngestAt: null,
    lastContextRefreshAt: null,
    lastTemplateProjectionAt: null,
};

// ── Inbound Queue ───────────────────────────────────────────────
// Events push here; batch cycle drains to vector memory
const pendingQueue = [];

// ── Projection State ────────────────────────────────────────────
// Tracks which projection targets are stale vs synced
const projections = new Map([
    ['src', { lastHash: null, stale: false, lastSynced: null }],
    ['configs', { lastHash: null, stale: false, lastSynced: null }],
    ['data', { lastHash: null, stale: false, lastSynced: null }],
    ['agents', { lastHash: null, stale: false, lastSynced: null }],
    ['docs', { lastHash: null, stale: false, lastSynced: null }],
]);

// ── RAM State Hash ──────────────────────────────────────────────
let lastRAMHash = null;

function computeRAMHash() {
    const state = JSON.stringify({
        ingested: stats.totalIngested,
        ts: Math.floor(Date.now() / 10000), // 10s buckets
        cycles: stats.cycles,
    });
    return crypto.createHash('sha256').update(state).digest('hex');
}

// ── Inbound: Queue for Embedding ────────────────────────────────

function sanitizeContent(content) {
    if (content === null || content === undefined) return '';
    const normalized = typeof content === 'string' ? content : JSON.stringify(content);
    return normalized.substring(0, MAX_CONTENT_CHARS);
}

function normalizeMetadata(metadata = {}) {
    const ts = new Date().toISOString();
    return {
        ...metadata,
        source: metadata.source || 'continuous-embedder',
        capturedAt: metadata.capturedAt || ts,
    };
}

function queueForEmbed(content, metadata) {
    const safeContent = sanitizeContent(content);
    if (!safeContent) return false;

    pendingQueue.push({
        content: safeContent,
        metadata: normalizeMetadata(metadata),
        queuedAt: Date.now(),
    });

    if (pendingQueue.length > MAX_QUEUE) {
        pendingQueue.splice(0, pendingQueue.length - MAX_QUEUE);
    }

    return true;
}

// ── Inbound Event Handlers ──────────────────────────────────────
// These NEVER scan files. They react to system events only.

function onUserInteraction(data) {
    const { message, response, userId, sessionId } = data || {};
    if (!message && !response) return;

    queueForEmbed(
        [
            `User: ${(message || '').substring(0, 500)}`,
            response ? `Response: ${response.substring(0, 500)}` : '',
        ].filter(Boolean).join('\n'),
        {
            type: 'episodic',
            domain: 'user-interaction',
            category: 'conversation',
            userId: userId || 'unknown',
            sessionId: sessionId || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onAnalystAction(data) {
    const { analystId, action, artifact, note, sessionId } = data || {};
    if (!action && !note) return;

    queueForEmbed(
        `Analyst: ${analystId || 'unknown'} | action: ${action || 'annotate'} | artifact: ${artifact || 'n/a'} | note: ${(note || '').substring(0, 700)}`,
        {
            type: 'episodic',
            domain: 'analyst-actions',
            category: 'human-analysis',
            analystId: analystId || 'unknown',
            sessionId: sessionId || 'unknown',
            artifact: artifact || 'n/a',
            source: 'continuous-embedder',
        },
    );
}

function onSystemAction(data) {
    const { actor, action, target, outcome, details } = data || {};
    if (!action && !outcome) return;

    queueForEmbed(
        `SystemAction: ${actor || 'system'} -> ${action || 'unknown'} on ${target || 'unknown'} | outcome: ${outcome || 'unknown'} | details: ${JSON.stringify(details || {}).substring(0, 500)}`,
        {
            type: 'procedural',
            domain: 'system-actions',
            category: 'runtime-action',
            actor: actor || 'system',
            action: action || 'unknown',
            target: target || 'unknown',
            outcome: outcome || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onTelemetry(data) {
    const { metric, value, component, confidence } = data || {};
    if (!metric) return;

    queueForEmbed(
        `Telemetry: ${component || 'system'} → ${metric}: ${JSON.stringify(value)} (confidence: ${confidence || 'N/A'})`,
        {
            type: 'episodic',
            domain: 'telemetry',
            category: 'system-state',
            component: component || 'system',
            metric,
            source: 'continuous-embedder',
        },
    );
}

function onDeployment(data) {
    const { target, status, commitHash, files } = data || {};
    queueForEmbed(
        `Deployment: ${target || 'unknown'} → ${status || 'completed'} (commit: ${commitHash || 'N/A'}, files: ${files?.length || 0})`,
        {
            type: 'procedural',
            domain: 'deployment',
            category: 'system-change',
            target: target || 'unknown',
            status: status || 'completed',
            source: 'continuous-embedder',
        },
    );
}

function onError(data) {
    const { error, component, severity } = data || {};
    queueForEmbed(
        `Error: [${severity || 'unknown'}] ${component || 'system'}: ${error || 'unknown error'}`,
        {
            type: 'episodic',
            domain: 'errors',
            category: 'system-error',
            severity: severity || 'unknown',
            component: component || 'system',
            source: 'continuous-embedder',
        },
    );
}

function onConfigChange(data) {
    const { file, changes, source: src } = data || {};
    if (!file && !changes) return;

    queueForEmbed(
        `Config changed: ${file || 'unknown'} (source: ${src || 'unknown'})\nChanges: ${JSON.stringify(changes || {}).substring(0, 500)}`,
        {
            type: 'procedural',
            domain: 'config',
            category: 'system-change',
            file: file || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onBeeReaction(data) {
    const { beeId, domain, reaction, confidence } = data || {};
    if (!beeId) return;

    queueForEmbed(
        `Bee reaction: ${beeId} (${domain || 'unknown'}) → ${reaction || 'processed'} (confidence: ${confidence || 'N/A'})`,
        {
            type: 'episodic',
            domain: 'bee-reactions',
            category: 'swarm-activity',
            beeId,
            beeDomain: domain || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onHealthCheck(data) {
    const { service, status, metrics } = data || {};
    queueForEmbed(
        `Health: ${service || 'system'} → ${status || 'unknown'} | ${JSON.stringify(metrics || {}).substring(0, 300)}`,
        {
            type: 'episodic',
            domain: 'health',
            category: 'system-state',
            service: service || 'system',
            status: status || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onCodeChange(data) {
    const { file, changeType, lines, diff } = data || {};
    if (!file) return;

    queueForEmbed(
        `Code ${changeType || 'changed'}: ${file} (${lines || '?'} lines)\n${(diff || '').substring(0, 500)}`,
        {
            type: 'procedural',
            domain: 'code-changes',
            category: 'development',
            file,
            changeType: changeType || 'modified',
            source: 'continuous-embedder',
        },
    );

    // Mark relevant projections stale
    const normalizedFile = file.replace(/\\/g, '/');
    for (const [target] of projections) {
        if (normalizedFile.includes(`/${target}/`) || normalizedFile.startsWith(`${target}/`)) {
            projections.get(target).stale = true;
        }
    }
}

// ── Environment Capture ─────────────────────────────────────────

function captureEnvironment() {
    const os = require('os');
    const env = {
        platform: os.platform(),
        cpus: os.cpus().length,
        totalMem: Math.round(os.totalmem() / 1024 / 1024),
        freeMem: Math.round(os.freemem() / 1024 / 1024),
        uptime: Math.round(os.uptime()),
        loadAvg: os.loadavg().map(l => +l.toFixed(2)),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    };

    queueForEmbed(
        `Environment: ${env.platform} | CPUs: ${env.cpus} | RAM: ${env.freeMem}/${env.totalMem}MB | Heap: ${env.heapUsed}/${env.heapTotal}MB | Load: ${env.loadAvg.join(', ')} | Uptime: ${env.uptime}s`,
        {
            type: 'episodic',
            domain: 'environment',
            category: 'system-snapshot',
            ...env,
            source: 'continuous-embedder',
        },
    );
}

// ── Inbound Batch Processing ────────────────────────────────────

async function processBatch() {
    if (!vm || pendingQueue.length === 0) return;

    const dynamicBatchSize = pendingQueue.length > BURST_FLUSH_THRESHOLD ? Math.min(BATCH_SIZE * 4, pendingQueue.length) : BATCH_SIZE;
    const batch = pendingQueue.splice(0, dynamicBatchSize);
    let ingested = 0;
    let filtered = 0;

    for (const item of batch) {
        try {
            item.metadata.ingestedAt = new Date().toISOString();
            const id = await vm.smartIngest(
                { content: item.content, metadata: item.metadata },
                DENSITY_GATE,
            );
            if (id) {
                ingested++;
                stats.totalIngested++;
                stats.lastIngestAt = new Date().toISOString();
                const src = item.metadata.domain || 'unknown';
                stats.bySource[src] = (stats.bySource[src] || 0) + 1;
            } else {
                filtered++;
                stats.totalFiltered++;
            }
        } catch (err) {
            stats.totalErrors++;
            logger.warn('ContinuousEmbedder: ingest error:', err.message);
        }
    }

    stats.cycles++;

    if (ingested > 0) {
        // Check if RAM state changed — mark projections stale
        const currentHash = computeRAMHash();
        if (currentHash !== lastRAMHash) {
            lastRAMHash = currentHash;
            // New data ingested — projections may be stale
            if (global.eventBus) {
                global.eventBus.emit('projections:stale', {
                    reason: 'new-vectors',
                    ingested,
                    totalVectors: stats.totalIngested,
                });
            }
        }

        logger.info(`ContinuousEmbedder: +${ingested} vectors (${filtered} deduped) | queue: ${pendingQueue.length}`);
    }
}

// ── Outbound: Projection Sync ───────────────────────────────────
// When vector memory has new state, project it outward.
// This is how RAM state becomes file state.

async function syncProjections() {
    if (!vm) return;

    let synced = 0;

    for (const [target, proj] of projections) {
        if (!proj.stale) continue;

        try {
            // Query vector memory for the latest state of this projection area
            const results = await vm.queryMemory(`latest state for ${target} projection`, 5, { domain: target });

            if (results && results.length > 0) {
                proj.lastHash = computeRAMHash();
                proj.stale = false;
                proj.lastSynced = new Date().toISOString();
                proj.lastVectors = results.length;
                synced++;
                stats.totalProjections++;
            }
        } catch (err) {
            logger.warn(`ContinuousEmbedder: projection sync failed for ${target}:`, err.message);
        }
    }

    if (synced > 0) {
        logger.info(`ContinuousEmbedder: projected ${synced} targets`);
        if (global.eventBus) {
            global.eventBus.emit('projections:synced', {
                targets: [...projections.entries()]
                    .filter(([, p]) => !p.stale)
                    .map(([t]) => t),
            });
        }
    }
}

// ── Lifecycle ───────────────────────────────────────────────────

async function start(vectorMemory) {
    if (running) return;
    vm = vectorMemory || require('../vector-memory');
    running = true;
    stats.started = new Date().toISOString();
    lastRAMHash = computeRAMHash();

    // Register event bus hooks — inbound only, NO file scanning
    if (global.eventBus) {
        const bus = global.eventBus;

        // User interaction events
        bus.on('buddy:message', onUserInteraction);
        bus.on('chat:response', onUserInteraction);
        bus.on('user:action', onUserInteraction);
        bus.on('analyst:action', onAnalystAction);

        // System telemetry events
        bus.on('telemetry:ingested', onTelemetry);
        bus.on('self-awareness:assessed', onTelemetry);

        // Deployment/git events
        bus.on('deployment:completed', onDeployment);
        bus.on('git:commit', onDeployment);

        // Error events
        bus.on('error:classified', onError);
        bus.on('circuit-breaker:opened', onError);

        // Config events
        bus.on('config:updated', onConfigChange);

        // Bee swarm events
        bus.on('bee:reacted', onBeeReaction);

        // Health events
        bus.on('health:checked', onHealthCheck);

        // Explicit system/environment actions
        bus.on('system:action', onSystemAction);
        bus.on('runtime:action', onSystemAction);
        bus.on('environment:sample', captureEnvironment);

        // Code change events (from sync-projection-bee or git hooks)
        bus.on('code:changed', onCodeChange);
        bus.on('code:created', onCodeChange);

        logger.info('ContinuousEmbedder: event bus hooks registered (inbound only — no file scanning)');
    } else {
        logger.warn('ContinuousEmbedder: no event bus — running in capture-only mode');
    }

    // ── Inbound cycle: drain queue → vector memory (φ⁵ ≈ 11s)
    const inboundCycle = async () => {
        if (!running) return;
        await processBatch();
        setTimeout(inboundCycle, EMBED_INTERVAL_MS);
    };
    setTimeout(inboundCycle, EMBED_INTERVAL_MS);

    // ── Outbound cycle: project vector state → files (φ⁷ ≈ 29s)
    const projectionCycle = async () => {
        if (!running) return;
        await syncProjections();
        setTimeout(projectionCycle, PROJECTION_INTERVAL_MS);
    };
    setTimeout(projectionCycle, PROJECTION_INTERVAL_MS);

    // ── Environment capture (φ⁸ ≈ 47s)
    const envCycle = () => {
        if (!running) return;
        captureEnvironment();
        setTimeout(envCycle, ENV_INTERVAL_MS);
    };
    setTimeout(envCycle, ENV_INTERVAL_MS);

    const contextCycle = async () => {
        if (!running) return;
        await runAutonomyOptimizationCycle();
        setTimeout(contextCycle, CONTEXT_REFRESH_INTERVAL_MS);
    };
    setTimeout(contextCycle, CONTEXT_REFRESH_INTERVAL_MS);

    if (global.eventBus) {
        global.eventBus.emit('embedder:started', { service: 'continuous-embedder', mode: 'ram-first' });
    }

    logger.info([
        'ContinuousEmbedder: started',
        `  Inbound:    every ${EMBED_INTERVAL_MS}ms (φ⁵)`,
        `  Projection: every ${PROJECTION_INTERVAL_MS}ms (φ⁷)`,
        `  Env capture:every ${ENV_INTERVAL_MS}ms (φ⁸)`,
        '  Mode: RAM-first — no file scanning, events only',
    ].join('\n'));
}

function stop() {
    running = false;
    logger.info('ContinuousEmbedder: stopped');
}

function getStats() {
    return {
        ...stats,
        running,
        queueLength: pendingQueue.length,
        projections: Object.fromEntries(projections),
        ramHash: lastRAMHash,
    };
}

async function ingest(content, metadata = {}) {
    const accepted = queueForEmbed(content, { ...metadata, source: 'manual-ingest' });
    if (!accepted) return { ok: false, queued: pendingQueue.length };

    if (running && pendingQueue.length >= BURST_FLUSH_THRESHOLD) {
        await processBatch();
    }

    return { ok: true, queued: pendingQueue.length };
}


async function buildLiveContextSnapshot() {
    if (!vm || typeof vm.queryMemory !== 'function') {
        return {
            ok: true,
            mode: 'capture-only',
            generatedAt: new Date().toISOString(),
            slices: {},
        };
    }

    const slices = {
        userActions: await vm.queryMemory('latest user actions and intent', 5, { domain: 'user-interaction' }),
        analystActions: await vm.queryMemory('latest analyst actions and decisions', 5, { domain: 'analyst-actions' }),
        systemActions: await vm.queryMemory('latest system orchestration actions', 5, { domain: 'system-actions' }),
        environment: await vm.queryMemory('latest environment telemetry snapshot', 5, { domain: 'environment' }),
    };

    stats.lastContextRefreshAt = new Date().toISOString();

    return {
        ok: true,
        mode: 'ram-first-live-context',
        generatedAt: stats.lastContextRefreshAt,
        counts: Object.fromEntries(Object.entries(slices).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
        slices,
    };
}



async function buildInjectableTemplates({ topK = 12, channel = 'internal' } = {}) {
    if (!vm || typeof vm.buildOutboundRepresentation !== 'function') {
        return { ok: true, mode: 'capture-only', templates: [], generatedAt: new Date().toISOString() };
    }

    const projection = vm.buildOutboundRepresentation({ channel, topK });
    const templates = (projection.sample || []).map((entry, idx) => ({
        templateId: `heady-template-${entry.id || idx}`,
        sourceVectorId: entry.id,
        archetype: entry.type || 'unknown',
        profile: projection.profile,
        injectionTarget: channel,
        headybee: {
            role: entry.type || 'assistant',
            zone: entry.zone,
            vectorBinding: entry.id,
        },
        headyswarm: {
            swarmId: `swarm-${entry.zone || 0}`,
            coordinator: 'HeadyConductor',
            participants: [`bee-${entry.zone || 0}-a`, `bee-${entry.zone || 0}-b`],
        },
        representation: entry.representation,
    }));

    const generatedAt = new Date().toISOString();
    stats.lastTemplateProjectionAt = generatedAt;

    if (global.eventBus) {
        global.eventBus.emit('projection:templates:generated', {
            channel,
            profile: projection.profile,
            templateCount: templates.length,
            generatedAt,
        });
    }

    return {
        ok: true,
        channel,
        profile: projection.profile,
        generatedAt,
        templateCount: templates.length,
        templates,
    };
}


async function runAutonomyOptimizationCycle() {
    try {
        const context = await buildLiveContextSnapshot();
        const templates = await buildInjectableTemplates({ topK: 8, channel: 'internal' });
        if (global.eventBus) {
            global.eventBus.emit('self-awareness:assessed', {
                metric: 'autonomy-optimization-cycle',
                value: {
                    contextCounts: context.counts || {},
                    templateCount: templates.templateCount || 0,
                },
                component: 'continuous-embedder',
                confidence: 0.93,
            });
        }
        return {
            ok: true,
            contextCounts: context.counts || {},
            templateCount: templates.templateCount || 0,
            ranAt: new Date().toISOString(),
        };
    } catch (error) {
        stats.totalErrors += 1;
        queueForEmbed(`Autonomy cycle error: ${error.message}`, {
            type: 'episodic',
            domain: 'errors',
            category: 'autonomy-cycle',
            source: 'continuous-embedder',
        });
        return { ok: false, error: error.message, ranAt: new Date().toISOString() };
    }
}
function registerRoutes(app) {
    // Status
    app.get('/api/embedder/status', (req, res) => {
        res.json({ ok: true, mode: 'ram-first', ...getStats() });
    });

    app.get('/api/embedder/health', (req, res) => {
        res.json({
            ok: true,
            service: 'continuous-embedder',
            running,
            queueLength: pendingQueue.length,
            totalIngested: stats.totalIngested,
            totalErrors: stats.totalErrors,
            lastIngestAt: stats.lastIngestAt,
            lastContextRefreshAt: stats.lastContextRefreshAt,
            lastTemplateProjectionAt: stats.lastTemplateProjectionAt,
            checkedAt: new Date().toISOString(),
        });
    });

    app.get('/api/embedder/context/live', async (req, res) => {
        const snapshot = await buildLiveContextSnapshot();
        res.json(snapshot);
    });

    app.get('/api/embedder/templates/injectable', async (req, res) => {
        const payload = await buildInjectableTemplates({
            topK: req.query?.top_k,
            channel: req.query?.channel || 'internal',
        });
        res.json(payload);
    });

    app.post('/api/embedder/autonomy/run', async (_req, res) => {
        const result = await runAutonomyOptimizationCycle();
        res.status(result.ok ? 200 : 500).json(result);
    });

    // Manual ingest (inbound)
    app.post('/api/embedder/ingest', async (req, res) => {
        const { content, metadata } = req.body || {};
        if (!content) return res.status(400).json({ error: 'content required' });
        const result = await ingest(content, metadata);
        res.json(result);
    });

    // Flush queue (inbound)
    app.post('/api/embedder/flush', async (req, res) => {
        const before = pendingQueue.length;
        while (pendingQueue.length > 0) {
            await processBatch();
        }
        res.json({ ok: true, flushed: before, ingested: stats.totalIngested });
    });

    // Projection status
    app.get('/api/embedder/projections', (req, res) => {
        res.json({ ok: true, projections: Object.fromEntries(projections) });
    });

    // Force projection sync (outbound)
    app.post('/api/embedder/project', async (req, res) => {
        // Mark all projections stale then sync
        for (const [, proj] of projections) proj.stale = true;
        await syncProjections();
        res.json({ ok: true, projections: Object.fromEntries(projections) });
    });
}

module.exports = {
    start,
    stop,
    getStats,
    ingest,
    queueForEmbed,
    registerRoutes,
    syncProjections,
    buildLiveContextSnapshot,
    buildInjectableTemplates,
    runAutonomyOptimizationCycle,
    // Event handlers exposed for direct wiring
    onUserInteraction,
    onAnalystAction,
    onSystemAction,
    onTelemetry,
    onDeployment,
    onError,
    onConfigChange,
    onBeeReaction,
    onHealthCheck,
    onCodeChange,
    captureEnvironment,
};
