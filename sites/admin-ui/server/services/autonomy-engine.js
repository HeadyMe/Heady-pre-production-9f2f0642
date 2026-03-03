import fs from 'fs-extra';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = process.env.AUTONOMY_DATA_DIR || join(__dirname, '..', 'data');
const STATE_FILE = join(DATA_DIR, 'autonomy-state.json');
const AUDIT_FILE = join(DATA_DIR, 'autonomy-audit.jsonl');
const PROJECTION_FILE = join(DATA_DIR, 'monorepo-projection.json');
const TICK_INTERVAL_MS = Math.max(1000, parseInt(process.env.AUTONOMY_TICK_INTERVAL_MS || '4000', 10));
const MAX_QUEUE_ITEMS = Math.max(100, parseInt(process.env.AUTONOMY_MAX_QUEUE_ITEMS || '1000', 10));

const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(200);

const PRIORITY_WEIGHT = { critical: 4, high: 3, balanced: 2, low: 1 };

let loopHandle = null;
let tickInFlight = false;
let loopStartedAt = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const nowIso = () => new Date().toISOString();

function hashLine(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function createColabNodes() {
    return Array.from({ length: 3 }).map((_, idx) => ({
        id: `colab-${idx + 1}`,
        gpuGb: 24,
        vramGb: 24,
        status: 'active',
        load: 0.24,
        heartbeat: nowIso(),
        role: idx === 0 ? 'instant-responder' : idx === 1 ? 'builder' : 'learner',
    }));
}

function createInitialState() {
    return {
        system: {
            id: 'heady-autonomy-core',
            mode: 'liquid',
            vectorSpace: '3d',
            alive: true,
            selfAwareScore: 91,
            selfHealingScore: 90,
            orchestrationScore: 92,
            responseTargetMs: 120,
            lastTickMs: 0,
            lastUpdated: nowIso(),
            tickCounter: 0,
            dedupeWindowHashes: [],
        },
        resources: {
            colabProPlusMemberships: 3,
            gpuNodes: createColabNodes(),
        },
        entities: {
            headybees: [
                { id: 'bee-ingest', capability: 'ingest', status: 'online', vector: [0.81, 0.44, 0.64], template: 'headybees/default' },
                { id: 'bee-reason', capability: 'reason', status: 'online', vector: [0.72, 0.77, 0.69], template: 'headybees/reasoner' },
            ],
            headyswarm: [
                { id: 'swarm-orchestrator', capability: 'orchestrate', status: 'online', vector: [0.92, 0.83, 0.89], template: 'headyswarm/orchestrator' },
                { id: 'swarm-healer', capability: 'self-heal', status: 'online', vector: [0.68, 0.79, 0.93], template: 'headyswarm/healer' },
            ],
        },
        queues: {
            pendingConcepts: [],
            backgroundLearning: [],
            connectorBuilds: [],
            musicSessions: [],
        },
        runtime: {
            activeConnectors: [],
            injections: [],
            lastProjectionCommit: null,
            uptimeStartedAt: nowIso(),
            lastError: null,
        },
        audit: {
            latestSeq: 0,
            immutableLog: AUDIT_FILE,
        },
    };
}

async function ensureData() {
    await fs.ensureDir(DATA_DIR);
    if (!(await fs.pathExists(STATE_FILE))) {
        await fs.writeJson(STATE_FILE, createInitialState(), { spaces: 2 });
    }
    if (!(await fs.pathExists(AUDIT_FILE))) {
        await fs.writeFile(AUDIT_FILE, '');
    }
    if (!(await fs.pathExists(PROJECTION_FILE))) {
        await fs.writeJson(PROJECTION_FILE, { generatedAt: nowIso(), modules: [] }, { spaces: 2 });
    }
}

async function readState() {
    await ensureData();
    return fs.readJson(STATE_FILE);
}

async function writeState(state) {
    state.system.lastUpdated = nowIso();
    await fs.writeJson(STATE_FILE, state, { spaces: 2 });
    return state;
}

function validatePriority(priority) {
    return PRIORITY_WEIGHT[priority] ? priority : 'balanced';
}

function normalizeText(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
}

async function appendAudit(state, eventType, payload) {
    state.audit.latestSeq += 1;
    const base = {
        seq: state.audit.latestSeq,
        ts: nowIso(),
        type: eventType,
        payload,
        vectorSpace: '3d',
        compliance: {
            immutable: true,
            traceId: `trace-${state.audit.latestSeq}`,
            policy: 'append-only',
        },
    };
    const event = { ...base, hash: hashLine(base) };
    await fs.appendFile(AUDIT_FILE, `${JSON.stringify(event)}\n`);
    realtimeBus.emit('audit', event);
    return event;
}

function vectorizeConcept(conceptText, priority = 'balanced') {
    const base = conceptText.length || 1;
    return {
        id: `concept-${Date.now()}`,
        text: conceptText,
        priority,
        vector: [
            Number((((base % 97) + 3) / 100).toFixed(2)),
            Number((((base % 83) + 7) / 100).toFixed(2)),
            Number((((base % 71) + 11) / 100).toFixed(2)),
        ],
        createdAt: nowIso(),
        status: 'pending',
    };
}

function prioritizeConcepts(concepts) {
    return concepts.sort((a, b) => (PRIORITY_WEIGHT[b.priority] || 1) - (PRIORITY_WEIGHT[a.priority] || 1) || (a.createdAt > b.createdAt ? 1 : -1));
}

function estimateAvailableThroughput(state) {
    const lowLatencyNode = state.resources.gpuNodes.find(node => node.role === 'instant-responder');
    const avgLoad = state.resources.gpuNodes.reduce((sum, node) => sum + node.load, 0) / state.resources.gpuNodes.length;
    const available = clamp(1 - avgLoad, 0.1, 0.95);
    const extra = lowLatencyNode && lowLatencyNode.load < 0.45 ? 1 : 0;
    return clamp(Math.floor(available * 4) + extra, 1, 6);
}

function runSelfHealing(state) {
    for (const node of state.resources.gpuNodes) {
        if (node.load > 0.9) {
            node.load = 0.67;
            node.status = 'stabilized';
        } else {
            node.status = 'active';
            node.load = clamp(Number((node.load + 0.015).toFixed(3)), 0.08, 0.9);
        }
        node.heartbeat = nowIso();
    }
    state.system.selfHealingScore = clamp(state.system.selfHealingScore + 0.12, 0, 100);
}

function rebalanceLiquidRuntime(state) {
    const avgLoad = state.resources.gpuNodes.reduce((sum, node) => sum + node.load, 0) / state.resources.gpuNodes.length;
    state.resources.gpuNodes.forEach((node, idx) => {
        if (idx === 0) {
            node.role = 'instant-responder';
            node.load = clamp(Number((avgLoad * 0.65).toFixed(3)), 0.08, 0.72);
        } else if (idx === 1) {
            node.role = 'builder';
            node.load = clamp(Number((avgLoad * 1.15).toFixed(3)), 0.1, 0.88);
        } else {
            node.role = 'learner';
            node.load = clamp(Number((avgLoad * 1.2).toFixed(3)), 0.1, 0.9);
        }
    });
    state.system.orchestrationScore = clamp(state.system.orchestrationScore + 0.1, 0, 100);
}

function injectTemplates(state, concept) {
    const injection = {
        id: `inject-${Date.now()}`,
        conceptId: concept.id,
        templates: ['headybees/default', 'headyswarm/orchestrator'],
        vector: concept.vector,
        status: 'applied',
        at: nowIso(),
    };
    state.runtime.injections.unshift(injection);
    if (state.runtime.injections.length > 200) state.runtime.injections.length = 200;
    return injection;
}

async function updateMonorepoProjection(state) {
    const projection = {
        generatedAt: nowIso(),
        sourceOfTruth: 'github-monorepo',
        vectorSpace: '3d',
        modules: [
            { name: 'headybees-template', version: 'active', status: 'ready' },
            { name: 'headyswarm-template', version: 'active', status: 'ready' },
            { name: 'vector-audit-trail', version: 'active', status: 'immutable' },
            { name: 'autonomy-background-loop', version: 'active', status: 'running' },
            { name: 'ableton-live-bridge', version: 'planned', status: 'queued' },
        ],
        runtime: {
            alive: state.system.alive,
            liquid: state.system.mode === 'liquid',
            selfAwareScore: state.system.selfAwareScore,
            selfHealingScore: state.system.selfHealingScore,
            orchestrationScore: state.system.orchestrationScore,
            pendingConcepts: state.queues.pendingConcepts.length,
            tickCounter: state.system.tickCounter,
        },
    };

    await fs.writeJson(PROJECTION_FILE, projection, { spaces: 2 });
    state.runtime.lastProjectionCommit = projection.generatedAt;
    realtimeBus.emit('projection', projection);
    return projection;
}

function pruneQueues(state) {
    if (state.queues.connectorBuilds.length > MAX_QUEUE_ITEMS) state.queues.connectorBuilds.length = MAX_QUEUE_ITEMS;
    if (state.queues.backgroundLearning.length > MAX_QUEUE_ITEMS) state.queues.backgroundLearning.length = MAX_QUEUE_ITEMS;
    if (state.queues.musicSessions.length > Math.floor(MAX_QUEUE_ITEMS / 5)) state.queues.musicSessions.length = Math.floor(MAX_QUEUE_ITEMS / 5);
    if (state.queues.pendingConcepts.length > MAX_QUEUE_ITEMS) state.queues.pendingConcepts.length = MAX_QUEUE_ITEMS;
}

function markRuntimeError(state, message) {
    state.runtime.lastError = { message, at: nowIso() };
}

export async function getAutonomyState() {
    return readState();
}

export async function ingestConcept({ text, priority = 'balanced' }) {
    const state = await readState();
    const normalizedText = normalizeText(text);

    if (!normalizedText) throw new Error('text is required');
    if (normalizedText.length > 4000) throw new Error('text exceeds 4000 characters');

    const resolvedPriority = validatePriority(priority);
    const dedupeHash = hashLine({ text: normalizedText, priority: resolvedPriority });

    if (state.system.dedupeWindowHashes.includes(dedupeHash)) {
        throw new Error('duplicate concept recently ingested');
    }

    const concept = vectorizeConcept(normalizedText, resolvedPriority);
    state.queues.pendingConcepts.push(concept);
    prioritizeConcepts(state.queues.pendingConcepts);

    state.system.dedupeWindowHashes.unshift(dedupeHash);
    if (state.system.dedupeWindowHashes.length > 200) state.system.dedupeWindowHashes.length = 200;

    state.queues.backgroundLearning.unshift({
        id: `learn-${Date.now()}`,
        conceptId: concept.id,
        objective: 'extract reusable success pattern',
        status: 'queued',
        vector: concept.vector,
    });

    const auditEvent = await appendAudit(state, 'concept.ingested', {
        conceptId: concept.id,
        priority: concept.priority,
        vector: concept.vector,
    });

    pruneQueues(state);
    await writeState(state);
    realtimeBus.emit('state', state);
    return { concept, auditEvent };
}

export async function runAutonomyTick(trigger = 'manual') {
    if (tickInFlight) return { skipped: true, reason: 'tick_in_flight' };

    tickInFlight = true;
    const started = Date.now();

    try {
        const state = await readState();
        const throughput = estimateAvailableThroughput(state);
        const processed = [];

        for (let i = 0; i < throughput && state.queues.pendingConcepts.length > 0; i += 1) {
            const concept = state.queues.pendingConcepts.shift();
            concept.status = 'implemented';
            const injection = injectTemplates(state, concept);
            const connector = {
                id: `connector-${Date.now()}-${i}`,
                conceptId: concept.id,
                status: 'generated',
                vector: concept.vector,
                injectionId: injection.id,
                createdAt: nowIso(),
            };
            processed.push(connector);
            state.queues.connectorBuilds.unshift(connector);

            state.system.selfAwareScore = clamp(state.system.selfAwareScore + 0.08, 0, 100);
            await appendAudit(state, 'concept.implemented', { conceptId: concept.id, trigger, connectorId: connector.id });
        }

        runSelfHealing(state);
        rebalanceLiquidRuntime(state);
        pruneQueues(state);

        state.system.tickCounter += 1;
        state.system.lastTickMs = Date.now() - started;
        const projection = await updateMonorepoProjection(state);

        await appendAudit(state, 'tick.completed', {
            trigger,
            processed: processed.length,
            throughput,
            orchestrationScore: state.system.orchestrationScore,
            latencyMs: state.system.lastTickMs,
        });

        await writeState(state);
        realtimeBus.emit('state', state);
        return { state, projection, processed: processed.length, throughput };
    } catch (error) {
        const state = await readState();
        markRuntimeError(state, error.message);
        await writeState(state);
        realtimeBus.emit('error', { ts: nowIso(), message: error.message });
        throw error;
    } finally {
        tickInFlight = false;
    }
}

export async function createAbletonSession({ user, bpm = 120, key = 'C Minor' }) {
    const state = await readState();
    const safeUser = normalizeText(user);
    const safeBpm = clamp(parseInt(bpm, 10) || 120, 40, 260);
    const safeKey = normalizeText(key) || 'C Minor';

    if (!safeUser) throw new Error('user is required');

    const session = {
        id: `ableton-${Date.now()}`,
        user: safeUser,
        bpm: safeBpm,
        key: safeKey,
        status: 'scheduled',
        collaborativeAgents: ['bee-reason', 'swarm-orchestrator'],
        createdAt: nowIso(),
    };

    state.queues.musicSessions.unshift(session);
    await appendAudit(state, 'music.session.created', { sessionId: session.id, user: safeUser, bpm: safeBpm, key: safeKey });
    pruneQueues(state);
    await writeState(state);
    realtimeBus.emit('state', state);
    return session;
}

export async function getAuditEvents(limit = 100) {
    await ensureData();
    const safeLimit = clamp(parseInt(limit, 10) || 100, 1, 1000);
    const raw = await fs.readFile(AUDIT_FILE, 'utf8');
    if (!raw.trim()) return [];
    return raw
        .trim()
        .split('\n')
        .map(line => {
            try { return JSON.parse(line); }
            catch { return null; }
        })
        .filter(Boolean)
        .slice(-safeLimit)
        .reverse();
}

export async function getMonorepoProjection() {
    await ensureData();
    return fs.readJson(PROJECTION_FILE);
}

export async function getAutonomyRuntimeStatus() {
    const state = await readState();
    const uptimeMs = loopStartedAt ? Date.now() - loopStartedAt : 0;
    const avgGpuLoad = state.resources.gpuNodes.reduce((sum, node) => sum + node.load, 0) / state.resources.gpuNodes.length;
    const health = clamp(
        (state.system.selfAwareScore + state.system.selfHealingScore + state.system.orchestrationScore) / 3 - (avgGpuLoad * 20),
        0,
        100,
    );

    return {
        alive: state.system.alive,
        mode: state.system.mode,
        loopActive: Boolean(loopHandle),
        tickInFlight,
        tickIntervalMs: TICK_INTERVAL_MS,
        tickCounter: state.system.tickCounter,
        lastTickMs: state.system.lastTickMs,
        uptimeMs,
        pendingConcepts: state.queues.pendingConcepts.length,
        queueDepth: {
            concepts: state.queues.pendingConcepts.length,
            learning: state.queues.backgroundLearning.length,
            connectors: state.queues.connectorBuilds.length,
            music: state.queues.musicSessions.length,
        },
        avgGpuLoad: Number(avgGpuLoad.toFixed(3)),
        healthScore: Number(health.toFixed(2)),
        lastError: state.runtime.lastError,
    };
}

export async function getAutonomyHealth() {
    const runtime = await getAutonomyRuntimeStatus();
    return {
        ok: runtime.healthScore >= 70 && runtime.lastTickMs <= (TICK_INTERVAL_MS * 2),
        runtime,
    };
}

export function startAutonomyLoop() {
    if (loopHandle) return false;
    loopStartedAt = Date.now();
    loopHandle = setInterval(async () => {
        try {
            await runAutonomyTick('background-loop');
        } catch (e) {
            realtimeBus.emit('error', { ts: nowIso(), message: e.message });
        }
    }, TICK_INTERVAL_MS);

    loopHandle.unref?.();
    runAutonomyTick('startup').catch((e) => realtimeBus.emit('error', { ts: nowIso(), message: e.message }));
    return true;
}

export function stopAutonomyLoop() {
    if (!loopHandle) return false;
    clearInterval(loopHandle);
    loopHandle = null;
    return true;
}

export function subscribeAutonomyEvents(listener) {
    const stateHandler = (state) => listener({ type: 'state', data: state, ts: nowIso() });
    const projectionHandler = (projection) => listener({ type: 'projection', data: projection, ts: nowIso() });
    const auditHandler = (event) => listener({ type: 'audit', data: event, ts: nowIso() });
    const errorHandler = (error) => listener({ type: 'error', data: error, ts: nowIso() });

    realtimeBus.on('state', stateHandler);
    realtimeBus.on('projection', projectionHandler);
    realtimeBus.on('audit', auditHandler);
    realtimeBus.on('error', errorHandler);

    return () => {
        realtimeBus.off('state', stateHandler);
        realtimeBus.off('projection', projectionHandler);
        realtimeBus.off('audit', auditHandler);
        realtimeBus.off('error', errorHandler);
    };
}
