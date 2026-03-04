/**
 * ─── Continuous Embedder Service ──────────────────────────────
 * 
 * RAM-FIRST ARCHITECTURE:
 *   Vector memory IS the source of truth.
 *   Files in src/, configs/, etc. are PROJECTIONS — derived state.
 *   
 *   Flow:
 *     Events → Vector Memory (ingest) → Projections (outbound)
 *                    ↑                         ↓
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
const BATCH_SIZE = 8;
const DENSITY_GATE = 0.92;

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

function queueForEmbed(content, metadata) {
    pendingQueue.push({ content, metadata, queuedAt: Date.now() });
    if (pendingQueue.length > 500) {
        pendingQueue.splice(0, pendingQueue.length - 500);
    }
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
            target,
            commitHash,
            source: 'continuous-embedder',
        },
    );

    // Mark all projections stale after a deploy
    for (const [, proj] of projections) proj.stale = true;
}

function onError(data) {
    const { error, component, severity, stack } = data || {};
    queueForEmbed(
        `Error [${severity || 'unknown'}]: ${component || 'system'} → ${error || 'unknown'}${stack ? '\n' + stack.substring(0, 300) : ''}`,
        {
            type: 'episodic',
            domain: 'errors',
            category: 'incident',
            component,
            severity: severity || 'unknown',
            source: 'continuous-embedder',
        },
    );
}

function onConfigChange(data) {
    const { filePath, diff, changedBy } = data || {};
    if (!filePath) return;

    let content = `Config changed: ${filePath}`;
    if (diff) content += `\n${diff.substring(0, 500)}`;

    queueForEmbed(content, {
        type: 'procedural',
        domain: 'governance',
        category: 'config-change',
        filePath,
        changedBy: changedBy || 'system',
        source: 'continuous-embedder',
    });

    projections.get('configs').stale = true;
}

function onBeeReaction(data) {
    const { bee, action, result, duration } = data || {};
    queueForEmbed(
        `Bee: ${bee || 'unknown'} → ${action || 'work'} (${duration || 0}ms): ${JSON.stringify(result || {}).substring(0, 400)}`,
        {
            type: 'procedural',
            domain: 'swarm',
            category: 'bee-work',
            bee,
            action,
            durationMs: duration,
            source: 'continuous-embedder',
        },
    );
}

function onHealthCheck(data) {
    const { status, components, uptime } = data || {};
    queueForEmbed(
        `Health: ${status || 'unknown'} | uptime: ${uptime || 0}s | components: ${JSON.stringify(components || {}).substring(0, 400)}`,
        {
            type: 'episodic',
            domain: 'health',
            category: 'system-health',
            status,
            source: 'continuous-embedder',
        },
    );
}

function onCodeChange(data) {
    const { filePath, changeType, content: code, author } = data || {};
    if (!filePath) return;

    // Ingest the actual change into vector memory
    queueForEmbed(
        `Code ${changeType || 'modified'}: ${filePath}\n${(code || '').substring(0, 1000)}`,
        {
            type: 'procedural',
            domain: 'codebase',
            category: 'code-change',
            filePath,
            changeType: changeType || 'modified',
            author: author || 'system',
            source: 'continuous-embedder',
        },
    );

    // Mark appropriate projection stale
    if (filePath.startsWith('src/')) projections.get('src').stale = true;
    if (filePath.startsWith('configs/')) projections.get('configs').stale = true;
    if (filePath.startsWith('.agents/')) projections.get('agents').stale = true;
    if (filePath.startsWith('docs/')) projections.get('docs').stale = true;
}

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

    const batch = pendingQueue.splice(0, BATCH_SIZE);
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
            const results = await vm.queryMemory({
                query: `latest state for ${target} projection`,
                topK: 5,
                metadata: { domain: target },
            });

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

function ingest(content, metadata = {}) {
    queueForEmbed(content, { ...metadata, source: 'manual-ingest' });
}

function registerRoutes(app) {
    // Status
    app.get('/api/embedder/status', (req, res) => {
        res.json({ ok: true, mode: 'ram-first', ...getStats() });
    });

    // Manual ingest (inbound)
    app.post('/api/embedder/ingest', (req, res) => {
        const { content, metadata } = req.body || {};
        if (!content) return res.status(400).json({ error: 'content required' });
        ingest(content, metadata);
        res.json({ ok: true, queued: pendingQueue.length });
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
    // Event handlers exposed for direct wiring
    onUserInteraction,
    onTelemetry,
    onDeployment,
    onError,
    onConfigChange,
    onBeeReaction,
    onHealthCheck,
    onCodeChange,
    captureEnvironment,
};
