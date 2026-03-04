/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

const ROOT = path.join(__dirname, '..', '..');
const COLAB_PLAN_PATH = path.join(ROOT, 'configs', 'resources', 'colab-pro-plus-orchestration.yaml');
const EMBEDDING_CATALOG_PATH = path.join(ROOT, 'configs', 'resources', 'vector-embedding-catalog.yaml');
const LIQUID_FABRIC_PATH = path.join(ROOT, 'configs', 'resources', 'liquid-unified-fabric.yaml');
const PLATFORM_BLUEPRINT_PATH = path.join(ROOT, 'configs', 'resources', 'developer-platform-blueprint.yaml');

function loadYaml(filePath) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function createDeterministicReceipt(input) {
    const payload = JSON.stringify(input);
    return crypto.createHash('sha256').update(payload).digest('hex');
}

function tryExec(command) {
    try {
        return execSync(command, {
            cwd: ROOT,
            stdio: ['ignore', 'pipe', 'ignore'],
            timeout: 1500,
        }).toString().trim();
    } catch {
        return null;
    }
}

function parseLines(output) {
    if (!output) return [];
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function rankWorkersForQueue(queue, queueWeight, workers, queuePressure = {}) {
    return workers
        .filter((worker) => (worker.queues || []).includes(queue))
        .map((worker) => {
            const capacity = Number(worker.max_concurrency || 1);
            const pressure = Number(queuePressure[queue] || 0);
            const score = (queueWeight * capacity) - pressure;
            return {
                workerId: worker.id,
                role: worker.role,
                tier: worker.tier,
                score: Number(score.toFixed(4)),
            };
        })
        .sort((a, b) => b.score - a.score);
}

class UnifiedEnterpriseAutonomyService {
    constructor(opts = {}) {
        this.colabPlanPath = opts.colabPlanPath || COLAB_PLAN_PATH;
        this.embeddingCatalogPath = opts.embeddingCatalogPath || EMBEDDING_CATALOG_PATH;
        this.liquidFabricPath = opts.liquidFabricPath || LIQUID_FABRIC_PATH;
        this.platformBlueprintPath = opts.platformBlueprintPath || PLATFORM_BLUEPRINT_PATH;

        this.colabPlan = loadYaml(this.colabPlanPath);
        this.embeddingCatalog = loadYaml(this.embeddingCatalogPath);
        this.liquidFabric = loadYaml(this.liquidFabricPath);
        this.platformBlueprint = loadYaml(this.platformBlueprintPath);

        this.startedAt = null;
        this.lastDispatch = null;
        this.lastProjection = null;
        this.telemetryCache = {
            sourceOfTruth: null,
            projectionHygiene: null,
            refreshedAt: 0,
            ttlMs: 30000,
        };
    }

    start() {
        this.startedAt = new Date().toISOString();
        logger.logSystem('∞ UnifiedEnterpriseAutonomyService: STARTED');
        return this.getHealth();
    }

    stop() {
        logger.logSystem('∞ UnifiedEnterpriseAutonomyService: STOPPED');
    }

    getNodeResponsibilities() {
        return (this.colabPlan.workers || []).map((worker) => ({
            node: worker.id,
            role: worker.role,
            responsibilities: worker.responsibilities || [],
            queues: worker.queues || [],
            maxConcurrency: worker.max_concurrency || 1,
        }));
    }

    buildEmbeddingPlan() {
        const collections = this.embeddingCatalog.collections || [];
        const includePatterns = this.embeddingCatalog.include_patterns || [];

        return {
            profile: this.embeddingCatalog.ingestion_profile || 'default',
            includePatterns,
            collections: collections.map((collection) => ({
                name: collection.name,
                query: collection.query,
                metadata: collection.metadata || {},
                deterministicReceipt: createDeterministicReceipt({
                    name: collection.name,
                    query: collection.query,
                    metadata: collection.metadata || {},
                }),
            })),
        };
    }

    dispatch(queuePressure = {}) {
        const queueWeights = this.colabPlan.scheduling?.queue_weights || {};
        const workers = this.colabPlan.workers || [];
        const assignments = Object.entries(queueWeights).map(([queue, weight]) => {
            const candidates = rankWorkersForQueue(queue, Number(weight || 0), workers, queuePressure);
            return {
                queue,
                selectedWorker: candidates[0]?.workerId || null,
                candidates,
                deterministicReceipt: createDeterministicReceipt({ queue, candidates }),
            };
        });

        this.lastDispatch = {
            at: new Date().toISOString(),
            queuePressure,
            assignments,
        };

        return this.lastDispatch;
    }

    getCachedTelemetry() {
        const now = Date.now();
        const stale = now - this.telemetryCache.refreshedAt > this.telemetryCache.ttlMs;
        if (!this.telemetryCache.sourceOfTruth || !this.telemetryCache.projectionHygiene || stale) {
            this.telemetryCache.sourceOfTruth = this.getSourceOfTruthStatus();
            this.telemetryCache.projectionHygiene = this.scanProjectionNoise();
            this.telemetryCache.refreshedAt = now;
        }

        return {
            sourceOfTruth: this.telemetryCache.sourceOfTruth,
            projectionHygiene: this.telemetryCache.projectionHygiene,
        };
    }

    buildDeveloperPlatformBlueprint() {
        const flow = this.platformBlueprint.onboarding_flow || [];
        const capabilities = this.platformBlueprint.platform_capabilities || {};

        return {
            generatedAt: new Date().toISOString(),
            mission: this.platformBlueprint.platform_mission,
            entrypoint: this.platformBlueprint.entrypoint || {},
            onboarding: {
                stageCount: flow.length,
                stages: flow,
            },
            capabilities,
            deterministicReceipt: createDeterministicReceipt({
                flow,
                capabilities,
                mission: this.platformBlueprint.platform_mission,
            }),
        };
    }

    buildSystemProjectionSnapshot() {
        const now = new Date().toISOString();
        const queueWeights = this.colabPlan.scheduling?.queue_weights || {};
        const activeQueues = Object.keys(queueWeights);
        const fabric = this.liquidFabric.service_topology || {};
        const platformBlueprint = this.buildDeveloperPlatformBlueprint();

        const { sourceOfTruth, projectionHygiene } = this.getCachedTelemetry();

        const snapshot = {
            generatedAt: now,
            runtimeMode: this.liquidFabric.runtime_mode || 'unified-liquid-fabric',
            topology: {
                paradigm: fabric.paradigm || 'unified-runtime',
                planes: fabric.planes || [],
                activeQueueCount: activeQueues.length,
            },
            orchestration: {
                conductor: 'HeadyConductor',
                cloudConductor: 'HeadyCloudConductor',
                swarmRuntime: 'HeadySwarm',
                workerRuntime: 'HeadyBees',
                deterministicScheduling: this.colabPlan.mode || 'deterministic',
            },
            templateInjection: {
                vectorWorkspaceCollections: (this.embeddingCatalog.collections || []).map((entry) => entry.name),
                includePatterns: this.embeddingCatalog.include_patterns || [],
                projectionHealth: projectionHygiene.clean ? 'aligned' : 'degraded',
            },
            liveMusic: {
                enabled: this.liquidFabric.ableton_live?.enabled === true,
                bridge: this.liquidFabric.ableton_live?.bridge,
                transport: this.liquidFabric.ableton_live?.transport,
                targetLatencyMs: this.liquidFabric.ableton_live?.target_latency_ms,
            },
            resourcePolicy: {
                cloudOnlyProjection: this.liquidFabric.enterprise_controls?.cloud_only_projection === true,
                localResourceTargetPercent: this.liquidFabric.enterprise_controls?.local_resource_target_percent ?? 5,
                maxSnapshotStalenessMs: this.liquidFabric.instantaneous_transfer?.max_snapshot_staleness_ms ?? 1000,
                preferredTransports: this.liquidFabric.instantaneous_transfer?.preferred_transports || [],
            },
            healthContracts: this.liquidFabric.enterprise_controls?.require_health_paths || [],
            sourceOfTruthPolicy: this.liquidFabric.source_of_truth || {},
            projectionHygienePolicy: this.liquidFabric.projection_hygiene || {},
            sourceOfTruth,
            projectionHygiene,
            developerPlatform: platformBlueprint,
            deterministicReceipt: createDeterministicReceipt({
                queueWeights,
                fabric,
                generatedAt: now,
                sourceOfTruth: sourceOfTruth.sourceOfTruth,
                hygieneClean: projectionHygiene.clean,
                platformBlueprintReceipt: platformBlueprint.deterministicReceipt,
            }),
        };

        this.lastProjection = snapshot;
        return snapshot;
    }

    scanProjectionNoise() {
        const trackedFiles = parseLines(tryExec('git ls-files'));

        const policy = this.liquidFabric.projection_hygiene || {};
        const allowlistedServiceWorkers = policy.allowlisted_service_workers || [];

        const serviceWorkerFiles = trackedFiles.filter((file) => {
            const lower = file.toLowerCase();
            if (allowlistedServiceWorkers.includes(file)) return false;
            return lower.endsWith('sw.js') || lower.includes('service-worker');
        });

        const forbiddenRuntimeFiles = trackedFiles.filter((file) => {
            const lower = file.toLowerCase();
            return lower.endsWith('.bak') || lower.endsWith('.log') || lower.endsWith('.jsonl') || lower.endsWith('server.pid');
        });

        return {
            trackedFileCount: trackedFiles.length,
            forbiddenRuntimeFiles,
            serviceWorkerFiles,
            recommendRemoval: [...forbiddenRuntimeFiles, ...serviceWorkerFiles],
            clean: forbiddenRuntimeFiles.length === 0,
        };
    }

    getSourceOfTruthStatus() {
        const branch = tryExec('git rev-parse --abbrev-ref HEAD');
        const commit = tryExec('git rev-parse HEAD');
        const remotes = parseLines(tryExec('git remote -v')).map((line) => {
            const [name, url, type] = line.split(/\s+/);
            return { name, url, type: (type || '').replace(/[()]/g, '') };
        });

        const policy = this.liquidFabric.source_of_truth || {};
        const originFetch = remotes.find((remote) => remote.name === 'origin' && remote.type === 'fetch');
        const sourceOfTruth = originFetch ? originFetch.url : null;
        const repoPolicyAligned = policy.provider === 'github'
            ? Boolean(sourceOfTruth && sourceOfTruth.includes('github.com'))
            : Boolean(sourceOfTruth);

        return {
            branch,
            commit,
            sourceOfTruth,
            remotes,
            policy,
            repoPolicyAligned,
        };
    }

    getHealth() {
        const { sourceOfTruth, projectionHygiene } = this.getCachedTelemetry();
        const onboardingStages = this.platformBlueprint.onboarding_flow || [];

        return {
            ok: true,
            service: 'unified-enterprise-autonomy',
            startedAt: this.startedAt,
            workerCount: (this.colabPlan.workers || []).length,
            queueCount: Object.keys(this.colabPlan.scheduling?.queue_weights || {}).length,
            embeddingCollections: (this.embeddingCatalog.collections || []).length,
            topologyPlanes: (this.liquidFabric.service_topology?.planes || []).length,
            onboardingStages: onboardingStages.length,
            determinism: this.colabPlan.determinism || {},
            sourceOfTruth,
            projectionHygiene,
            lastDispatchAt: this.lastDispatch?.at || null,
            lastProjectionAt: this.lastProjection?.generatedAt || null,
        };
    }
}

function registerUnifiedEnterpriseAutonomyRoutes(app, service = new UnifiedEnterpriseAutonomyService()) {
    service.start();

    app.get('/api/unified-autonomy/health', (_req, res) => {
        res.json(service.getHealth());
    });

    app.get('/api/unified-autonomy/nodes', (_req, res) => {
        res.json({ ok: true, nodes: service.getNodeResponsibilities() });
    });

    app.get('/api/unified-autonomy/embedding-plan', (_req, res) => {
        res.json({ ok: true, embeddingPlan: service.buildEmbeddingPlan() });
    });

    app.post('/api/unified-autonomy/dispatch', (req, res) => {
        const queuePressure = req.body?.queuePressure || {};
        res.json({ ok: true, dispatch: service.dispatch(queuePressure) });
    });

    app.get('/api/unified-autonomy/system-projection', (_req, res) => {
        res.json({ ok: true, projection: service.buildSystemProjectionSnapshot() });
    });

    app.get('/api/unified-autonomy/source-of-truth', (_req, res) => {
        res.json({ ok: true, sourceOfTruth: service.getSourceOfTruthStatus() });
    });

    app.get('/api/unified-autonomy/projection-hygiene', (_req, res) => {
        res.json({ ok: true, hygiene: service.scanProjectionNoise() });
    });

    app.get('/api/unified-autonomy/platform-blueprint', (_req, res) => {
        res.json({ ok: true, blueprint: service.buildDeveloperPlatformBlueprint() });
    });

    logger.logNodeActivity(
        'CONDUCTOR',
        '    → Endpoints: /api/unified-autonomy/health, /nodes, /embedding-plan, /dispatch, /system-projection, /source-of-truth, /projection-hygiene, /platform-blueprint',
    );

    return service;
}

module.exports = {
    UnifiedEnterpriseAutonomyService,
    registerUnifiedEnterpriseAutonomyRoutes,
    rankWorkersForQueue,
    createDeterministicReceipt,
};
