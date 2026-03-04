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

const STALE_FILE_PATTERNS = [
    '.bak', '.tmp', '.temp', '.old', '.orig', '.pid', '.log', '.jsonl',
];
const STALE_SCAN_DIRECTORIES = ['data', 'logs', 'tmp', '.cache'];
const STALE_MIN_AGE_HOURS = 24;


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


function walkDirectorySafe(baseDir, collected = []) {
    if (!fs.existsSync(baseDir)) return collected;

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.name);
        const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
        if (relPath.startsWith('.git/') || relPath.startsWith('node_modules/')) continue;

        if (entry.isDirectory()) {
            walkDirectorySafe(fullPath, collected);
        } else {
            collected.push({ fullPath, relPath });
        }
    }

    return collected;
}

function isLikelyStaleProjectionFile(relPath, ageHours) {
    const lower = relPath.toLowerCase();
    const staleByPattern = STALE_FILE_PATTERNS.some((pattern) => lower.endsWith(pattern));
    const staleByAgeAndLocation = ageHours >= STALE_MIN_AGE_HOURS && (
        lower.startsWith('data/') ||
        lower.startsWith('tmp/') ||
        lower.startsWith('logs/') ||
        lower.startsWith('.cache/')
    );

    return staleByPattern || staleByAgeAndLocation;
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
        this.lastSelfHealing = null;
        this.telemetryCache = {
            sourceOfTruth: null,
            projectionHygiene: null,
            refreshedAt: 0,
            ttlMs: 30000,
        };
    }

    start() {
        this.startedAt = new Date().toISOString();
        logger.info('∞ UnifiedEnterpriseAutonomyService: STARTED');
        return this.getHealth();
    }

    stop() {
        logger.info('∞ UnifiedEnterpriseAutonomyService: STOPPED');
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

    buildOnboardingContract() {
        const flow = this.platformBlueprint.onboarding_flow || [];
        const bridge = this.platformBlueprint.security_bridge || {};
        const runtimeParadigm = this.platformBlueprint.runtime_paradigm || {};

        return {
            generatedAt: new Date().toISOString(),
            entrypoint: this.platformBlueprint.entrypoint || {},
            auth: flow.find((stage) => stage.id === 'auth-provider-select') || null,
            permissions: flow.find((stage) => stage.id === 'permissions-grant') || null,
            identity: flow.find((stage) => stage.id === 'username-provision') || null,
            install: flow.find((stage) => stage.id === 'one-click-install') || null,
            customization: flow.find((stage) => stage.id === 'intent-customization') || null,
            securityBridge: bridge,
            runtimeParadigm,
            deterministicReceipt: createDeterministicReceipt({
                flow,
                bridge,
                runtimeParadigm,
            }),
        };
    }

    buildDeveloperPlatformBlueprint() {
        const flow = this.platformBlueprint.onboarding_flow || [];
        const capabilities = this.platformBlueprint.platform_capabilities || {};
        const onboardingContract = this.buildOnboardingContract();

        return {
            generatedAt: new Date().toISOString(),
            mission: this.platformBlueprint.platform_mission,
            entrypoint: this.platformBlueprint.entrypoint || {},
            onboarding: {
                stageCount: flow.length,
                stages: flow,
            },
            capabilities,
            onboardingContract,
            deterministicReceipt: createDeterministicReceipt({
                flow,
                capabilities,
                mission: this.platformBlueprint.platform_mission,
                onboardingReceipt: onboardingContract.deterministicReceipt,
            }),
        };
    }

    buildSystemProjectionSnapshot() {
        const now = new Date().toISOString();
        const queueWeights = this.colabPlan.scheduling?.queue_weights || {};
        const activeQueues = Object.keys(queueWeights);
        const fabric = this.liquidFabric.service_topology || {};
        const platformBlueprint = this.buildDeveloperPlatformBlueprint();
        const onboardingContract = this.buildOnboardingContract();

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
            projectionCleanupPlan: this.buildProjectionCleanupPlan(),
            developerPlatform: platformBlueprint,
            onboardingContract,
            deterministicReceipt: createDeterministicReceipt({
                queueWeights,
                fabric,
                generatedAt: now,
                sourceOfTruth: sourceOfTruth.sourceOfTruth,
                hygieneClean: projectionHygiene.clean,
                platformBlueprintReceipt: platformBlueprint.deterministicReceipt,
                onboardingReceipt: onboardingContract.deterministicReceipt,
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

        const cleanupPlan = this.buildProjectionCleanupPlan();

        return {
            trackedFileCount: trackedFiles.length,
            forbiddenRuntimeFiles,
            serviceWorkerFiles,
            cleanupCandidates: cleanupPlan.candidateCount,
            recommendRemoval: [...forbiddenRuntimeFiles, ...serviceWorkerFiles, ...cleanupPlan.candidates.map((c) => c.path)],
            clean: forbiddenRuntimeFiles.length === 0 && cleanupPlan.candidateCount === 0,
        };
    }


    buildProjectionCleanupPlan() {
        const tracked = new Set(parseLines(tryExec('git ls-files')));
        const now = Date.now();
        const candidates = [];

        for (const dir of STALE_SCAN_DIRECTORIES) {
            const fullDir = path.join(ROOT, dir);
            const files = walkDirectorySafe(fullDir);
            for (const file of files) {
                let stat;
                try { stat = fs.statSync(file.fullPath); } catch { continue; }
                const ageHours = (now - stat.mtimeMs) / (1000 * 60 * 60);
                if (!isLikelyStaleProjectionFile(file.relPath, ageHours)) continue;

                candidates.push({
                    path: file.relPath,
                    tracked: tracked.has(file.relPath),
                    ageHours: +ageHours.toFixed(1),
                    sizeBytes: stat.size,
                    reason: tracked.has(file.relPath) ? 'tracked-runtime-artifact' : 'stale-local-projection',
                });
            }
        }

        const trackedCandidates = candidates.filter((c) => c.tracked);
        const localCandidates = candidates.filter((c) => !c.tracked);

        return {
            generatedAt: new Date().toISOString(),
            candidateCount: candidates.length,
            trackedCandidates: trackedCandidates.length,
            localCandidates: localCandidates.length,
            candidates,
        };
    }

    applyProjectionCleanup({ includeTracked = false, limit = 50 } = {}) {
        const plan = this.buildProjectionCleanupPlan();
        const safeLimit = Math.max(1, Math.min(500, Number(limit) || 50));
        const selected = plan.candidates
            .filter((candidate) => includeTracked || !candidate.tracked)
            .slice(0, safeLimit);

        const removed = [];
        const errors = [];

        for (const candidate of selected) {
            try {
                const target = path.join(ROOT, candidate.path);
                if (fs.existsSync(target) && fs.statSync(target).isFile()) {
                    fs.unlinkSync(target);
                    removed.push(candidate.path);
                }
            } catch (error) {
                errors.push({ path: candidate.path, error: error.message });
            }
        }

        return {
            ok: errors.length === 0,
            dryRunCandidates: plan.candidateCount,
            selected: selected.length,
            removed,
            errors,
            includeTracked,
            limit: safeLimit,
            executedAt: new Date().toISOString(),
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



    validateOnboardingAndAuthFlow() {
        const flow = this.platformBlueprint.onboarding_flow || [];
        const securityBridge = this.platformBlueprint.security_bridge || {};
        const requiredStages = [
            'auth-provider-select',
            'permissions-grant',
            'username-provision',
            'one-click-install',
        ];

        const present = new Set(flow.map((stage) => stage.id));
        const missingStages = requiredStages.filter((stage) => !present.has(stage));
        const requiredBridge = ['filesystem_access_api', 'indexeddb_serialization'];
        const missingBridge = requiredBridge.filter((key) => securityBridge[key] !== 'required');

        return {
            ok: missingStages.length === 0 && missingBridge.length === 0,
            missingStages,
            missingBridge,
            requiredStages,
            securityBridge,
            evaluatedAt: new Date().toISOString(),
        };
    }

    buildAlternateParadigmDirectives() {
        const snapshot = this.buildSystemProjectionSnapshot();
        return {
            ok: true,
            paradigm: 'no-frontend-backend-split',
            directives: [
                'Treat vector memory as canonical runtime state.',
                'Generate device UI as template injections from 3D workspace projections.',
                'Route user, analyst, system, and environment signals continuously into autonomous embedder.',
                'Use projection cleanup plan continuously to remove stale local artifacts and runtime noise.',
                'Coordinate headybees/headyswarms via deterministic receipts and health-gated orchestration.',
            ],
            runtimeMode: snapshot.runtimeMode,
            templateCollections: snapshot.templateInjection.vectorWorkspaceCollections,
            generatedAt: new Date().toISOString(),
        };
    }


    runSelfHealingCycle({ applyCleanup = false, cleanupLimit = 50 } = {}) {
        const hygiene = this.scanProjectionNoise();
        const cleanupPlan = this.buildProjectionCleanupPlan();
        const onboardingValidation = this.validateOnboardingAndAuthFlow();
        const directives = this.buildAlternateParadigmDirectives();

        let cleanup = { ok: true, selected: 0, removed: [] };
        if (applyCleanup) {
            cleanup = this.applyProjectionCleanup({ includeTracked: false, limit: cleanupLimit });
        }

        return {
            ok: hygiene.clean && onboardingValidation.ok && cleanup.ok,
            ranAt: new Date().toISOString(),
            hygiene,
            cleanupPlan,
            cleanup,
            onboardingValidation,
            directives,
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
            onboardingSecurityBridge: this.platformBlueprint.security_bridge || {},
            determinism: this.colabPlan.determinism || {},
            sourceOfTruth,
            projectionHygiene,
            onboardingValidation: this.validateOnboardingAndAuthFlow(),
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

    app.get('/api/unified-autonomy/projection-cleanup/plan', (_req, res) => {
        res.json({ ok: true, plan: service.buildProjectionCleanupPlan() });
    });

    app.post('/api/unified-autonomy/projection-cleanup/apply', (req, res) => {
        const includeTracked = req.body?.includeTracked === true;
        const limit = req.body?.limit;
        const result = service.applyProjectionCleanup({ includeTracked, limit });
        res.status(result.ok ? 200 : 500).json(result);
    });

    app.get('/api/unified-autonomy/platform-blueprint', (_req, res) => {
        res.json({ ok: true, blueprint: service.buildDeveloperPlatformBlueprint() });
    });

    app.get('/api/unified-autonomy/onboarding-contract', (_req, res) => {
        res.json({ ok: true, onboarding: service.buildOnboardingContract() });
    });

    app.get('/api/unified-autonomy/onboarding/validate', (_req, res) => {
        res.json(service.validateOnboardingAndAuthFlow());
    });

    app.get('/api/unified-autonomy/directives/alternate-paradigm', (_req, res) => {
        res.json(service.buildAlternateParadigmDirectives());
    });

    app.post('/api/unified-autonomy/self-healing/run', (req, res) => {
        const applyCleanup = req.body?.applyCleanup === true;
        const cleanupLimit = req.body?.cleanupLimit;
        const result = service.runSelfHealingCycle({ applyCleanup, cleanupLimit });
        res.status(result.ok ? 200 : 500).json(result);
    });

    logger.info(
        'CONDUCTOR',
        '    → Endpoints: /api/unified-autonomy/health, /nodes, /embedding-plan, /dispatch, /system-projection, /source-of-truth, /projection-hygiene, /projection-cleanup/plan, /projection-cleanup/apply, /platform-blueprint, /onboarding-contract, /onboarding/validate, /directives/alternate-paradigm, /self-healing/run',
    );

    return service;
}

module.exports = {
    UnifiedEnterpriseAutonomyService,
    registerUnifiedEnterpriseAutonomyRoutes,
    rankWorkersForQueue,
    createDeterministicReceipt,
};
