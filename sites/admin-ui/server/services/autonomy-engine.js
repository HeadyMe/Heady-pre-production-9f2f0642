import fs from 'fs-extra';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '..', 'data');
const STATE_FILE = join(DATA_DIR, 'autonomy-state.json');
const AUDIT_FILE = join(DATA_DIR, 'autonomy-audit.jsonl');
const PROJECTION_FILE = join(DATA_DIR, 'monorepo-projection.json');

const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(200);

const PRIORITY_WEIGHT = { critical: 4, high: 3, balanced: 2, low: 1 };
const TICK_INTERVAL_MS = 4000;


const ALLOWED_PRIORITY = new Set(['critical', 'high', 'balanced', 'low']);
const MAX_CONCEPT_TEXT = 4000;

const VECTOR_STORE_LIMIT = 20000;
const MAX_VECTOR_CONTENT = 16000;
const DEFAULT_QUERY_LIMIT = 10;
const PROJECTION_HISTORY_LIMIT = 300;

const UNIFIED_FABRIC_PROFILE = {
    paradigm: 'unified-liquid-microservice-fabric',
    noFrontendBackendBoundary: true,
    dynamicSurfaces: ['heady-ui-apps', 'connectors', 'services'],
    conductors: ['HeadyConductor', 'HeadyCloudConductor'],
    swarm: ['HeadySwarm', 'HeadyBees'],
};

const NODE_RESPONSIBILITIES = [
    {
        nodeId: 'colab-1',
        role: 'instant-responder',
        primary: ['interactive retrieval', 'streaming response assembly', 'low-latency tool calls'],
        tools: ['vector-query', 'response-synthesizer', 'event-stream'],
        skills: ['intent-routing', 'context-fusion', 'latency-guard'],
    },
    {
        nodeId: 'colab-2',
        role: 'builder',
        primary: ['connector generation', 'template injection', 'artifact synthesis'],
        tools: ['codegen', 'schema-mapper', 'deployment-planner'],
        skills: ['orchestration', 'integration', 'verification'],
    },
    {
        nodeId: 'colab-3',
        role: 'learner',
        primary: ['background embedding', 'pattern extraction', 'continuous optimization'],
        tools: ['embedding-worker', 'analytics', 'drift-detector'],
        skills: ['self-healing', 'self-tuning', 'knowledge-refresh'],
    },
];

export class AutonomyValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AutonomyValidationError';
        this.statusCode = 400;
    }
}

let loopHandle = null;
let tickInFlight = false;

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
        },
        resources: {
            colabProPlusMemberships: 3,
            gpuNodes: createColabNodes(),
            cloudProjection: {
                strategy: 'cloud-only-projection',
                localUsageTargetPct: 3,
                instantaneousTransport: 'event-stream',
            },
        },
        orchestration: {
            profile: UNIFIED_FABRIC_PROFILE,
            templateInjection: {
                sourceWorkspace: '3d-vector-workspace',
                targets: ['headybees', 'headyswarm'],
                status: 'armed',
            },
            abletonBridge: {
                mode: 'live-performance',
                status: 'ready',
            },
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
            deadLetters: [],
        },
        runtime: {
            activeConnectors: [],
            injections: [],
            lastProjectionCommit: null,
            recentConceptFingerprints: [],
            nodeAssignments: [],
            projectionHistory: [],
            determinism: { lastStateHash: null, consistencyScore: 1 },
        },
        vectorWorkspace: {
            dimensions: 3,
            storeLimit: VECTOR_STORE_LIMIT,
            documents: [],
            updatedAt: nowIso(),
        },
        templateIntelligence: {
            templates: {
                'headybees/default': { success: 0, failure: 0, score: 0.9 },
                'headybees/reasoner': { success: 0, failure: 0, score: 0.9 },
                'headyswarm/orchestrator': { success: 0, failure: 0, score: 0.9 },
                'headyswarm/healer': { success: 0, failure: 0, score: 0.9 },
            },
            recommendations: [],
            learningLog: [],
            updatedAt: nowIso(),
        },
        audit: {
            latestSeq: 0,
            immutableLog: AUDIT_FILE,
            lastHash: null,
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
    const state = await fs.readJson(STATE_FILE);
    return ensureStateShape(state);
}


function ensureStateShape(state) {
    if (!state.resources.cloudProjection) {
        state.resources.cloudProjection = {
            strategy: 'cloud-only-projection',
            localUsageTargetPct: 3,
            instantaneousTransport: 'event-stream',
        };
    }
    if (!state.orchestration) {
        state.orchestration = {
            profile: UNIFIED_FABRIC_PROFILE,
            templateInjection: {
                sourceWorkspace: '3d-vector-workspace',
                targets: ['headybees', 'headyswarm'],
                status: 'armed',
            },
            abletonBridge: {
                mode: 'live-performance',
                status: 'ready',
            },
        };
    }
    if (!state.queues.deadLetters) state.queues.deadLetters = [];
    if (!state.runtime.nodeAssignments) state.runtime.nodeAssignments = [];
    if (!state.runtime.projectionHistory) state.runtime.projectionHistory = [];
    if (!state.runtime.determinism) state.runtime.determinism = { lastStateHash: null, consistencyScore: 1 };
    if (!state.vectorWorkspace) state.vectorWorkspace = { dimensions: 3, storeLimit: VECTOR_STORE_LIMIT, documents: [], updatedAt: nowIso() };
    if (!state.templateIntelligence) {
        state.templateIntelligence = {
            templates: {
                'headybees/default': { success: 0, failure: 0, score: 0.9 },
                'headybees/reasoner': { success: 0, failure: 0, score: 0.9 },
                'headyswarm/orchestrator': { success: 0, failure: 0, score: 0.9 },
                'headyswarm/healer': { success: 0, failure: 0, score: 0.9 },
            },
            recommendations: [],
            learningLog: [],
            updatedAt: nowIso(),
        };
    }
    if (!state.audit.lastHash) state.audit.lastHash = null;
    return state;
}

function computeStateDigest(state) {
    const snapshot = {
        system: state.system,
        queues: {
            pending: state.queues.pendingConcepts.length,
            connector: state.queues.connectorBuilds.length,
            learning: state.queues.backgroundLearning.length,
            deadLetters: state.queues.deadLetters.length,
        },
        runtime: {
            lastProjectionCommit: state.runtime.lastProjectionCommit,
            nodeAssignments: state.runtime.nodeAssignments,
        },
        vectorWorkspace: {
            documents: state.vectorWorkspace.documents.length,
            updatedAt: state.vectorWorkspace.updatedAt,
        },
        audit: {
            latestSeq: state.audit.latestSeq,
            lastHash: state.audit.lastHash,
        },
    };
    return hashLine(snapshot);
}


async function writeState(state) {
    state.system.lastUpdated = nowIso();
    const digest = computeStateDigest(state);
    state.runtime.determinism.lastStateHash = digest;
    await fs.writeJson(STATE_FILE, state, { spaces: 2 });
    return state;
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
        prevHash: state.audit.lastHash || null,
    };
    const event = { ...base, hash: hashLine(base) };
    state.audit.lastHash = event.hash;
    await fs.appendFile(AUDIT_FILE, `${JSON.stringify(event)}\n`);
    realtimeBus.emit('audit', event);
    return event;
}

function conceptFingerprint(text, priority) {
    return hashLine({ text, priority }).slice(0, 16);
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


function addLearningEvent(state, type, details) {
    const event = { id: `learn-${Date.now()}`, type, details, at: nowIso() };
    state.templateIntelligence.learningLog.unshift(event);
    if (state.templateIntelligence.learningLog.length > 1000) state.templateIntelligence.learningLog.length = 1000;
    state.templateIntelligence.updatedAt = nowIso();
    return event;
}

function registerTemplateOutcome(state, templates, ok, reason = null) {
    for (const template of templates) {
        if (!state.templateIntelligence.templates[template]) {
            state.templateIntelligence.templates[template] = { success: 0, failure: 0, score: 0.5 };
        }
        const record = state.templateIntelligence.templates[template];
        if (ok) record.success += 1;
        else record.failure += 1;
        const total = Math.max(record.success + record.failure, 1);
        record.score = Number((record.success / total).toFixed(4));
    }

    if (!ok && reason) {
        const rec = `Investigate failure pattern: ${reason}`;
        state.templateIntelligence.recommendations.unshift({ recommendation: rec, at: nowIso() });
        if (state.templateIntelligence.recommendations.length > 300) state.templateIntelligence.recommendations.length = 300;
    }
}

function selectTemplatesForConcept(state, concept) {
    const priority = concept.priority || 'balanced';
    if (priority === 'critical' || priority === 'high') {
        return ['headybees/reasoner', 'headyswarm/orchestrator', 'headyswarm/healer'];
    }
    return ['headybees/default', 'headyswarm/orchestrator'];
}

function injectTemplates(state, concept) {
    const injection = {
        id: `inject-${Date.now()}`,
        conceptId: concept.id,
        templates: selectTemplatesForConcept(state, concept),
        vector: concept.vector,
        status: 'applied',
        at: nowIso(),
    };
    state.runtime.injections.unshift(injection);
    if (state.runtime.injections.length > 200) state.runtime.injections.length = 200;
    return injection;
}

async function updateMonorepoProjection(state) {
    const transferReadiness = Number((1 - Math.min(0.92, state.resources.gpuNodes.reduce((sum, node) => sum + node.load, 0) / state.resources.gpuNodes.length)).toFixed(3));
    const projection = {
        generatedAt: nowIso(),
        sourceOfTruth: 'github-monorepo',
        vectorSpace: '3d',
        modules: [
            { name: 'heady-unified-fabric', version: 'active', status: 'running' },
            { name: 'headyconductor', version: 'active', status: 'running' },
            { name: 'headycloudconductor', version: 'active', status: 'running' },
            { name: 'headybees-template', version: 'active', status: 'ready' },
            { name: 'headyswarm-template', version: 'active', status: 'ready' },
            { name: 'vector-audit-trail', version: 'active', status: 'immutable' },
            { name: 'autonomy-background-loop', version: 'active', status: 'running' },
            { name: 'ableton-live-bridge', version: 'active', status: state.orchestration.abletonBridge.status },
        ],
        runtime: {
            alive: state.system.alive,
            liquid: state.system.mode === 'liquid',
            unifiedFabric: state.orchestration.profile.paradigm,
            noFrontendBackendBoundary: state.orchestration.profile.noFrontendBackendBoundary,
            cloudOnlyProjection: state.resources.cloudProjection.strategy,
            instantaneousTransferReadiness: transferReadiness,
            selfAwareScore: state.system.selfAwareScore,
            selfHealingScore: state.system.selfHealingScore,
            orchestrationScore: state.system.orchestrationScore,
            pendingConcepts: state.queues.pendingConcepts.length,
            connectorBacklog: state.queues.connectorBuilds.length,
            healthScore: Number(((state.system.selfHealingScore + state.system.orchestrationScore + state.system.selfAwareScore) / 3).toFixed(2)),
        },
        templates: state.templateIntelligence.templates,
        orchestration: state.orchestration,
    };

    await fs.writeJson(PROJECTION_FILE, projection, { spaces: 2 });
    state.runtime.lastProjectionCommit = projection.generatedAt;
    state.runtime.projectionHistory.unshift({
        at: projection.generatedAt,
        healthScore: projection.runtime.healthScore,
        pendingConcepts: projection.runtime.pendingConcepts,
        connectorBacklog: projection.runtime.connectorBacklog,
    });
    if (state.runtime.projectionHistory.length > PROJECTION_HISTORY_LIMIT) state.runtime.projectionHistory.length = PROJECTION_HISTORY_LIMIT;
    realtimeBus.emit('projection', projection);
    return projection;
}


function embedText3D(text) {
    const src = String(text || '');
    const hash = crypto.createHash('sha256').update(src).digest();
    const x = Number((((hash[0] << 8) + hash[1]) / 65535).toFixed(6));
    const y = Number((((hash[2] << 8) + hash[3]) / 65535).toFixed(6));
    const z = Number((((hash[4] << 8) + hash[5]) / 65535).toFixed(6));
    return [x, y, z];
}

function distance3D(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function trimVectorStore(state) {
    if (state.vectorWorkspace.documents.length > VECTOR_STORE_LIMIT) {
        state.vectorWorkspace.documents.length = VECTOR_STORE_LIMIT;
    }
    state.vectorWorkspace.updatedAt = nowIso();
}

function validateVectorContent(content) {
    const clean = String(content || '').trim();
    if (!clean) throw new AutonomyValidationError('Vector document content is required');
    if (clean.length > MAX_VECTOR_CONTENT) throw new AutonomyValidationError(`Vector content exceeds ${MAX_VECTOR_CONTENT} characters`);
    return clean;
}

function planNodeAssignments(state) {
    const pending = state.queues.pendingConcepts.length;
    const background = state.queues.backgroundLearning.length;
    const interactivePressure = clamp(pending / 20, 0.1, 1);
    const backgroundPressure = clamp(background / 80, 0.05, 1);

    const assignments = NODE_RESPONSIBILITIES.map((node, idx) => {
        const gpuNode = state.resources.gpuNodes[idx];
        const capacity = idx === 0
            ? clamp(0.75 - gpuNode.load * 0.4 + interactivePressure * 0.2, 0.2, 1)
            : idx === 1
                ? clamp(0.6 - gpuNode.load * 0.35 + pending / 30, 0.2, 1)
                : clamp(0.7 - gpuNode.load * 0.3 + backgroundPressure * 0.25, 0.2, 1);

        return {
            nodeId: node.nodeId,
            role: node.role,
            capacity: Number(capacity.toFixed(3)),
            primary: node.primary,
            tools: node.tools,
            skills: node.skills,
            assignedMode: idx === 0 ? 'interaction' : idx === 1 ? 'build' : 'background',
            updatedAt: nowIso(),
        };
    });

    state.runtime.nodeAssignments = assignments;
    return assignments;
}

function pruneQueues(state) {
    if (state.queues.connectorBuilds.length > 1000) state.queues.connectorBuilds.length = 1000;
    if (state.queues.backgroundLearning.length > 1000) state.queues.backgroundLearning.length = 1000;
    if (state.queues.musicSessions.length > 200) state.queues.musicSessions.length = 200;
    if (state.queues.deadLetters.length > 500) state.queues.deadLetters.length = 500;
    if (state.runtime.recentConceptFingerprints.length > 500) state.runtime.recentConceptFingerprints.length = 500;
}


function validateConceptInput(text, priority) {
    const clean = String(text || '').trim();
    if (!clean) throw new AutonomyValidationError('Concept text is required');
    if (clean.length > MAX_CONCEPT_TEXT) throw new AutonomyValidationError(`Concept text exceeds ${MAX_CONCEPT_TEXT} characters`);
    if (!ALLOWED_PRIORITY.has(priority)) throw new AutonomyValidationError('Priority must be one of: critical, high, balanced, low');
    return clean;
}

function validateMusicInput(user, bpm, key) {
    const cleanUser = String(user || '').trim();
    if (!cleanUser) throw new AutonomyValidationError('user is required');
    const parsedBpm = Number(bpm);
    if (!Number.isFinite(parsedBpm) || parsedBpm < 40 || parsedBpm > 240) {
        throw new AutonomyValidationError('bpm must be between 40 and 240');
    }
    const cleanKey = String(key || '').trim();
    if (!cleanKey || cleanKey.length > 30) throw new AutonomyValidationError('key is required and must be <= 30 chars');
    return { cleanUser, parsedBpm, cleanKey };
}

export async function getAutonomyState() {
    return readState();
}

export async function ingestConcept({ text, priority = 'balanced' }) {
    const state = await readState();
    const cleanText = validateConceptInput(text, priority);
    const fingerprint = conceptFingerprint(cleanText, priority);
    if (state.runtime.recentConceptFingerprints.includes(fingerprint)) {
        throw new AutonomyValidationError('Duplicate concept detected recently; submit a materially different concept');
    }

    const concept = vectorizeConcept(cleanText, priority);
    state.runtime.recentConceptFingerprints.unshift(fingerprint);

    state.queues.pendingConcepts.push(concept);
    prioritizeConcepts(state.queues.pendingConcepts);
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
    if (tickInFlight) {
        return { skipped: true, reason: 'tick_in_flight' };
    }

    tickInFlight = true;
    const started = Date.now();

    try {
        const state = await readState();
        const throughput = estimateAvailableThroughput(state);
        const processed = [];

        for (let i = 0; i < throughput && state.queues.pendingConcepts.length > 0; i += 1) {
            const concept = state.queues.pendingConcepts.shift();
            try {
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
                registerTemplateOutcome(state, injection.templates, true);
                addLearningEvent(state, 'template.success', { conceptId: concept.id, templates: injection.templates });
                await appendAudit(state, 'concept.implemented', { conceptId: concept.id, trigger, connectorId: connector.id, templates: injection.templates });
            } catch (err) {
                state.queues.deadLetters.unshift({
                    id: `dead-${Date.now()}-${i}`,
                    conceptId: concept?.id || 'unknown',
                    reason: err.message,
                    at: nowIso(),
                });
                registerTemplateOutcome(state, selectTemplatesForConcept(state, concept || {}), false, err.message);
                addLearningEvent(state, 'template.failure', { conceptId: concept?.id || 'unknown', error: err.message });
                await appendAudit(state, 'concept.failed', { conceptId: concept?.id || 'unknown', trigger, error: err.message });
            }
        }

        runSelfHealing(state);
        rebalanceLiquidRuntime(state);
        planNodeAssignments(state);
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
    } finally {
        tickInFlight = false;
    }
}

export async function createAbletonSession({ user, bpm = 120, key = 'C Minor' }) {
    const state = await readState();
    const { cleanUser, parsedBpm, cleanKey } = validateMusicInput(user, bpm, key);
    const session = {
        id: `ableton-${Date.now()}`,
        user: cleanUser,
        bpm: parsedBpm,
        key: cleanKey,
        status: 'scheduled',
        collaborativeAgents: ['bee-reason', 'swarm-orchestrator'],
        createdAt: nowIso(),
    };

    state.queues.musicSessions.unshift(session);
    await appendAudit(state, 'music.session.created', { sessionId: session.id, user: cleanUser, bpm: parsedBpm, key: cleanKey });
    pruneQueues(state);
    await writeState(state);
    realtimeBus.emit('state', state);
    return session;
}

export async function getAuditEvents(limit = 100) {
    await ensureData();
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
        .slice(-limit)
        .reverse();
}

export async function getMonorepoProjection() {
    await ensureData();
    return fs.readJson(PROJECTION_FILE);
}


export async function upsertVectorDocument({ sourceId, content, tags = [], kind = 'project' }) {
    const state = await readState();
    const cleanContent = validateVectorContent(content);
    const cleanSource = String(sourceId || '').trim();
    if (!cleanSource) throw new AutonomyValidationError('sourceId is required');

    const vector = embedText3D(cleanContent);
    const id = `vec-${Date.now()}`;
    const doc = {
        id,
        sourceId: cleanSource,
        kind,
        tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
        vector,
        content: cleanContent,
        createdAt: nowIso(),
        updatedAt: nowIso(),
    };

    state.vectorWorkspace.documents.unshift(doc);
    trimVectorStore(state);
    await appendAudit(state, 'vector.upserted', { id, sourceId: cleanSource, kind });
    await writeState(state);
    return doc;
}

export async function queryVectorWorkspace({ query, limit = DEFAULT_QUERY_LIMIT, kind }) {
    const state = await readState();
    const cleanQuery = validateVectorContent(query);
    const queryVec = embedText3D(cleanQuery);
    const max = clamp(Number(limit) || DEFAULT_QUERY_LIMIT, 1, 100);

    const docs = state.vectorWorkspace.documents
        .filter(doc => !kind || doc.kind === kind)
        .map(doc => ({ ...doc, distance: Number(distance3D(queryVec, doc.vector).toFixed(6)) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, max);

    return { queryVector: queryVec, total: docs.length, docs };
}

export async function embedProjectSnapshot({ projectName = 'heady-project', files = [] }) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new AutonomyValidationError('files array is required for project embedding');
    }

    const created = [];
    for (const file of files.slice(0, 500)) {
        const sourceId = `${projectName}:${file.path || 'unknown'}`;
        const content = String(file.content || '').slice(0, MAX_VECTOR_CONTENT);
        const doc = await upsertVectorDocument({
            sourceId,
            content,
            kind: 'project',
            tags: ['snapshot', projectName],
        });
        created.push(doc.id);
    }

    const state = await readState();
    await appendAudit(state, 'project.snapshot.embedded', { projectName, embedded: created.length });
    await writeState(state);

    return { projectName, embedded: created.length, ids: created };
}

export async function getNodeResponsibilities() {
    const state = await readState();
    const assignments = state.runtime.nodeAssignments.length ? state.runtime.nodeAssignments : planNodeAssignments(state);
    await writeState(state);
    return {
        colabMemberships: state.resources.colabProPlusMemberships,
        gpuNodes: state.resources.gpuNodes,
        responsibilities: NODE_RESPONSIBILITIES,
        currentAssignments: assignments,
    };
}


export async function embedRepositoryFromDisk({ rootPath, projectName = 'heady-project', limit = 800 }) {
    const cleanRoot = String(rootPath || '').trim();
    if (!cleanRoot) throw new AutonomyValidationError('rootPath is required');

    const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.next', '.turbo']);
    const files = [];

    async function walk(dir) {
        if (files.length >= limit) return;
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (files.length >= limit) return;
            if (ignored.has(entry.name)) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
                continue;
            }
            const ext = entry.name.split('.').pop()?.toLowerCase() || '';
            if (!['js', 'jsx', 'ts', 'tsx', 'md', 'json', 'yml', 'yaml', 'txt', 'css', 'html'].includes(ext)) continue;
            const content = await fs.readFile(full, 'utf8').catch(() => '');
            if (!content) continue;
            files.push({ path: full.replace(cleanRoot + '/', ''), content: content.slice(0, MAX_VECTOR_CONTENT) });
        }
    }

    await walk(cleanRoot);
    return embedProjectSnapshot({ projectName, files });
}

export async function getTemplateIntelligence() {
    const state = await readState();
    return state.templateIntelligence;
}


export async function getDeterminismReport(limit = 50) {
    const state = await readState();
    const currentHash = computeStateDigest(state);
    const expected = state.runtime.determinism.lastStateHash;
    const consistent = !expected || expected === currentHash;
    if (!consistent) {
        state.runtime.determinism.consistencyScore = Number(clamp(state.runtime.determinism.consistencyScore - 0.1, 0, 1).toFixed(4));
        await writeState(state);
    }
    const recentTicks = (state.runtime.projectionHistory || []).slice(0, Math.min(limit, 200));
    return {
        consistent,
        currentHash,
        storedHash: expected,
        auditTailHash: state.audit.lastHash,
        consistencyScore: state.runtime.determinism.consistencyScore,
        latestSeq: state.audit.latestSeq,
        latestProof: state.audit.lastHash || null,
        recentTicks,
    };
}

export async function getAutonomyRuntimeStatus() {
    const state = await readState();
    return {
        alive: state.system.alive,
        mode: state.system.mode,
        loopActive: Boolean(loopHandle),
        tickInFlight,
        tickIntervalMs: TICK_INTERVAL_MS,
        tickCounter: state.system.tickCounter,
        lastTickMs: state.system.lastTickMs,
        pendingConcepts: state.queues.pendingConcepts.length,
        connectorBacklog: state.queues.connectorBuilds.length,
        deadLetters: state.queues.deadLetters.length,
        auditTailHash: state.audit.lastHash,
        healthScore: Number(((state.system.selfHealingScore + state.system.orchestrationScore + state.system.selfAwareScore) / 3).toFixed(2)),
    };
}

export async function getAutonomyDiagnostics() {
    const state = await readState();
    return {
        queueDepth: {
            pendingConcepts: state.queues.pendingConcepts.length,
            connectorBuilds: state.queues.connectorBuilds.length,
            backgroundLearning: state.queues.backgroundLearning.length,
            musicSessions: state.queues.musicSessions.length,
            deadLetters: state.queues.deadLetters.length,
            embeddingTasks: state.queues.backgroundLearning.length,
        },
        gpuNodes: state.resources.gpuNodes,
        recentInjections: state.runtime.injections.slice(0, 10),
        recentDeadLetters: state.queues.deadLetters.slice(0, 10),
        vectorWorkspace: {
            dimensions: state.vectorWorkspace.dimensions,
            documents: state.vectorWorkspace.documents.length,
            updatedAt: state.vectorWorkspace.updatedAt,
        },
        templateIntelligence: {
            templates: state.templateIntelligence.templates,
            recommendationCount: state.templateIntelligence.recommendations.length,
            lastRecommendation: state.templateIntelligence.recommendations[0] || null,
        },
        projectionHistory: state.runtime.projectionHistory.slice(0, 20),
        determinism: state.runtime.determinism,
        audit: {
            latestSeq: state.audit.latestSeq,
            lastHash: state.audit.lastHash,
        },
    };
}

export function startAutonomyLoop() {
    if (loopHandle) return false;
    loopHandle = setInterval(async () => {
        try { await runAutonomyTick('background-loop'); }
        catch (e) { realtimeBus.emit('error', { ts: nowIso(), message: e.message }); }
    }, TICK_INTERVAL_MS);
    return true;
}

export function stopAutonomyLoop() {
    if (!loopHandle) return false;
    clearInterval(loopHandle);
    loopHandle = null;
    return true;
}


export async function refreshAutonomyProjection() {
    const state = await readState();
    const projection = await updateMonorepoProjection(state);
    await writeState(state);
    return projection;
}

// ── V6: Template Registry CRUD ─────────────────────────────────────────

export async function getTemplateRegistry() {
    const state = await readState();
    const tpl = state.templateIntelligence || {};
    const templates = Object.entries(tpl.templates || {}).map(([id, t]) => ({
        id, ...t,
        situations: t.situations || [],
        tools: t.tools || [],
        skills: t.skills || [],
        qualityScore: t.qualityScore ?? 0,
        latencyScore: t.latencyScore ?? 0,
        reliabilityScore: t.reliabilityScore ?? 0,
    }));
    const situationIndex = {};
    for (const t of templates) {
        for (const s of t.situations) {
            (situationIndex[s] = situationIndex[s] || []).push(t.id);
        }
    }
    return { templates, situationIndex, total: templates.length };
}

export async function registerTemplate(opts = {}) {
    if (!opts.id || typeof opts.id !== 'string') throw new AutonomyValidationError('template id is required');
    if (!opts.name) throw new AutonomyValidationError('template name is required');
    const state = await readState();
    const entry = {
        name: opts.name,
        templateType: opts.templateType || 'generic',
        situations: Array.isArray(opts.situations) ? opts.situations : [],
        tools: Array.isArray(opts.tools) ? opts.tools : [],
        skills: Array.isArray(opts.skills) ? opts.skills : [],
        qualityScore: Number(opts.qualityScore || 0),
        latencyScore: Number(opts.latencyScore || 0),
        reliabilityScore: Number(opts.reliabilityScore || 0),
        successes: 0, failures: 0,
        registeredAt: nowIso(),
    };
    state.templateIntelligence.templates[opts.id] = entry;
    await appendAudit(state, 'template_registered', { templateId: opts.id });
    await writeState(state);
    return { id: opts.id, ...entry };
}

export async function validateTemplateRegistry() {
    const state = await readState();
    const tpl = state.templateIntelligence || {};
    return Object.entries(tpl.templates || {}).map(([id, t]) => {
        const issues = [];
        if (!t.name) issues.push('missing name');
        if (!(t.situations || []).length) issues.push('no situations mapped');
        const score = (t.qualityScore || 0) + (t.latencyScore || 0) + (t.reliabilityScore || 0);
        if (score < 0.5) issues.push('aggregate scores below threshold');
        return { id, valid: issues.length === 0, issues };
    });
}

export async function recommendTemplateForSituation({ situation }) {
    if (!situation) throw new AutonomyValidationError('situation is required');
    const normalized = String(situation).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const registry = await getTemplateRegistry();
    const directMatch = registry.situationIndex[normalized];
    let recommended = null;
    if (directMatch && directMatch.length) {
        const best = registry.templates
            .filter(t => directMatch.includes(t.id))
            .sort((a, b) => (b.qualityScore + b.reliabilityScore) - (a.qualityScore + a.reliabilityScore));
        recommended = best[0] || null;
    }
    if (!recommended) {
        const fuzzy = registry.templates.filter(t =>
            t.situations.some(s => s.includes(normalized) || normalized.includes(s)));
        if (fuzzy.length) recommended = fuzzy.sort((a, b) => (b.qualityScore + b.reliabilityScore) - (a.qualityScore + a.reliabilityScore))[0];
    }
    return { situation: normalized, recommended, matchType: directMatch ? 'exact' : (recommended ? 'fuzzy' : 'none') };
}

export async function runTemplateOptimizationCycle({ predictedSituations = [] } = {}) {
    const registry = await getTemplateRegistry();
    const predictions = predictedSituations.map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    const covered = [];
    const uncovered = [];
    for (const s of predictions) {
        const match = registry.situationIndex[s];
        if (match && match.length) covered.push({ situation: s, templates: match });
        else uncovered.push(s);
    }
    return { predictedSituations: predictions, coverage: { covered: covered.length, uncovered: uncovered.length, total: predictions.length }, coveredSituations: covered, uncoveredSituations: uncovered };
}

export async function getTemplateCoverageForecast(limit = 20) {
    const state = await readState();
    const tpl = state.templateIntelligence || {};
    const allSituations = new Set();
    Object.values(tpl.templates || {}).forEach(t => (t.situations || []).forEach(s => allSituations.add(s)));
    const predictions = Array.from(allSituations).slice(0, limit);
    return runTemplateOptimizationCycle({ predictedSituations: predictions });
}

export async function getTemplateReadinessMatrix(limit = 20) {
    const registry = await getTemplateRegistry();
    const rows = registry.templates.slice(0, limit).map(t => ({
        id: t.id, name: t.name,
        quality: t.qualityScore, latency: t.latencyScore, reliability: t.reliabilityScore,
        composite: Number(((t.qualityScore + t.latencyScore + t.reliabilityScore) / 3).toFixed(4)),
        situations: t.situations.length, tools: t.tools.length,
    }));
    const avgComposite = rows.length ? rows.reduce((s, r) => s + r.composite, 0) / rows.length : 0;
    return { total: registry.total, rows, avgComposite: Number(avgComposite.toFixed(4)), coverageRate: Number((rows.filter(r => r.composite > 0.5).length / Math.max(1, rows.length)).toFixed(4)) };
}

// ── V6: Digital Presence ────────────────────────────────────────────────

export async function getDigitalPresenceReport() {
    const state = await readState();
    const configFiles = ['autonomy-state.json', 'monorepo-projection.json'].map(f => {
        const p = join(DATA_DIR, f);
        return { file: f, exists: fs.existsSync(p), sizeMb: fs.existsSync(p) ? Number((fs.statSync(p).size / 1048576).toFixed(3)) : 0 };
    });
    const staleSignals = [];
    if (state.system.lastTickMs && (Date.now() - state.system.lastTickMs > 600000)) staleSignals.push('tick_stale_10m');
    if (state.queues.deadLetters.length > 20) staleSignals.push('dead_letter_overflow');
    const projectionHash = computeStateDigest(state);
    return {
        configInspection: configFiles,
        staleSignals,
        projectionIntegrity: { consistent: staleSignals.length === 0, hash: projectionHash },
        digitalPresence: [
            { channel: 'unified-service-fabric', status: 'active' },
            { channel: 'projected-ui-surfaces', status: 'active' },
            { channel: 'vector-workspace', status: state.vectorWorkspace.documents.length > 0 ? 'active' : 'empty' },
            { channel: 'live-ableton-bridge', status: state.orchestration?.abletonBridge?.status || 'ready' },
        ],
    };
}

// ── V6: Maintenance Operations ──────────────────────────────────────────

export async function getMaintenanceOpsPlan() {
    const state = await readState();
    const actions = [
        { id: 'sweep-dead-letters', description: 'Clear stale dead letters', count: state.queues.deadLetters.length },
        { id: 'trim-vector-store', description: 'Trim vector store if over limit', count: state.vectorWorkspace.documents.length },
        { id: 'prune-audit-tail', description: 'Prune old audit entries', count: state.audit.latestSeq },
    ];
    if (state.queues.backgroundLearning.length > 50) actions.push({ id: 'drain-learning-queue', description: 'Drain oversized learning queue', count: state.queues.backgroundLearning.length });
    return { actions, generatedAt: nowIso() };
}

export async function runMaintenanceSweep({ removeStaleFiles = false } = {}) {
    const state = await readState();
    const deadBefore = state.queues.deadLetters.length;
    if (removeStaleFiles) state.queues.deadLetters = [];
    pruneQueues(state);
    trimVectorStore(state);
    await writeState(state);
    return { removedTempFiles: removeStaleFiles ? deadBefore : 0, prunedQueues: true, vectorStoreTrimmed: true, ts: nowIso() };
}

// ── V6: Hardening Cycles ────────────────────────────────────────────────

export async function runAutonomyHardeningCycle({ removeStaleFiles = false } = {}) {
    await runMaintenanceSweep({ removeStaleFiles });
    const forecast = await getTemplateCoverageForecast(20);
    const digitalPresence = (await getDigitalPresenceReport()).digitalPresence;
    const readiness = await getTemplateReadinessMatrix(20);
    const state = await readState();
    await appendAudit(state, 'hardening_cycle', { ts: nowIso() });
    await writeState(state);
    return { predictedSituations: forecast.predictedSituations, digitalPresence, readiness, hardenedAt: nowIso() };
}

// ── V6: Unified Operating Model ─────────────────────────────────────────

export async function getUnifiedOperatingModel() {
    const state = await readState();
    const avgLoad = state.resources.gpuNodes.reduce((sum, node) => sum + node.load, 0) / state.resources.gpuNodes.length;
    return {
        colab: { memberships: state.resources.colabProPlusMemberships, gpuNodes: state.resources.gpuNodes },
        serviceFabric: {
            ...state.orchestration.profile,
            cloudProjection: state.resources.cloudProjection,
            instantaneousTransferScore: Number((1 - Math.min(0.95, avgLoad)).toFixed(4)),
            orchestrationPlane: {
                templateInjection: state.orchestration.templateInjection,
                abletonBridge: state.orchestration.abletonBridge,
            },
        },
        vectorWorkspace: { dimensions: state.vectorWorkspace.dimensions, documentCount: state.vectorWorkspace.documents.length },
        templateCount: Object.keys(state.templateIntelligence.templates).length,
        queues: { pending: state.queues.pendingConcepts.length, dead: state.queues.deadLetters.length },
        healthScore: Number(((state.system.selfHealingScore + state.system.orchestrationScore + state.system.selfAwareScore) / 3).toFixed(2)),
        mode: state.system.mode,
        lastTick: state.system.lastTickMs,
    };
}

// ── V6: Headyswarm Tasks (stub) ─────────────────────────────────────────

export async function getHeadyswarmTasks() {
    const state = await readState();
    return state.queues.pendingConcepts.map((c, i) => ({ id: `task-${i}`, text: c.text, priority: c.priority, status: 'pending' }));
}

export async function triggerHeadyswarmResearch(topic) {
    if (!topic) throw new AutonomyValidationError('topic is required');
    return ingestConcept({ text: `[RESEARCH] ${topic}`, priority: 'high' });
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
