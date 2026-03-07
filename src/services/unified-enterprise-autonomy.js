/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const yaml = require('../core/heady-yaml');
const logger = require('../utils/logger');
const { extractEnterpriseTasksFromArchitecture } = require('../bees/input-task-extractor');
const embedder = require('./continuous-embedder');

const ROOT = path.join(__dirname, '..', '..');
const COLAB_PLAN_PATH = path.join(ROOT, 'configs', 'resources', 'colab-pro-plus-orchestration.yaml');
const EMBEDDING_CATALOG_PATH = path.join(ROOT, 'configs', 'resources', 'vector-embedding-catalog.yaml');
const LIQUID_FABRIC_PATH = path.join(ROOT, 'configs', 'resources', 'liquid-unified-fabric.yaml');
const PLATFORM_BLUEPRINT_PATH = path.join(ROOT, 'configs', 'resources', 'developer-platform-blueprint.yaml');
const DUAL_PIPELINE_BLUEPRINT_PATH = path.join(ROOT, 'configs', 'resources', 'liquid-dual-pipeline-blueprint.yaml');

const STALE_FILE_PATTERNS = [
    '.bak', '.tmp', '.temp', '.old', '.orig', '.pid', '.log', '.jsonl',
    '.backup', '.bak.', '.dump', '.sql', '.sqlite', '.db',
];
// Scan EVERYWHERE stale files can accumulate — not just 4 dirs
const STALE_SCAN_DIRECTORIES = [
    'data', 'logs', 'tmp', '.cache',
    '_archive',                        // 1.1GB / 44k files — must be scanned
    'public',                          // stale build artifacts
    'scripts',                         // orphan temp scripts
    'build', 'dist', 'coverage',       // build artifacts that slip through
];
const STALE_MIN_AGE_HOURS = 24;
const ORPHAN_FILE_PATTERNS = [
    'server.pid', '.autoflow.pid', '.heady-ai.pid', '.headybuddy.pid',
    'heady-manager.pid', 'python-worker.pid', 'admin-ui.pid',
    'npm-debug.log', 'test.txt',
];


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


function walkDirectorySafe(baseDir, collected = [], maxDepth = 10, depth = 0) {
    if (!fs.existsSync(baseDir) || depth > maxDepth) return collected;

    let entries;
    try {
        entries = fs.readdirSync(baseDir, { withFileTypes: true });
    } catch {
        return collected; // permission denied, etc.
    }

    for (const entry of entries) {
        const fullPath = path.join(baseDir, entry.name);
        const relPath = path.relative(ROOT, fullPath).replace(/\\/g, '/');
        if (relPath.startsWith('.git/') || relPath.startsWith('node_modules/')) continue;
        // Skip heady-antigravity-app node_modules within _archive too
        if (relPath.includes('node_modules/')) continue;

        if (entry.isDirectory()) {
            walkDirectorySafe(fullPath, collected, maxDepth, depth + 1);
        } else {
            collected.push({ fullPath, relPath });
        }
    }

    return collected;
}

function isLikelyStaleProjectionFile(relPath, ageHours) {
    const lower = relPath.toLowerCase();
    const basename = path.basename(lower);

    // Match by file extension pattern — catches stale files ANYWHERE
    const staleByPattern = STALE_FILE_PATTERNS.some((pattern) => lower.endsWith(pattern));

    // Match known orphan filenames at any location
    const isOrphanFile = ORPHAN_FILE_PATTERNS.some((p) => basename === p.toLowerCase());

    // Match by age + known accumulation directories
    const staleByAgeAndLocation = ageHours >= STALE_MIN_AGE_HOURS && (
        lower.startsWith('data/') ||
        lower.startsWith('tmp/') ||
        lower.startsWith('logs/') ||
        lower.startsWith('.cache/') ||
        lower.startsWith('_archive/') ||
        lower.startsWith('build/') ||
        lower.startsWith('dist/') ||
        lower.startsWith('coverage/')
    );

    // _archive files older than 48h with stale patterns are always candidates
    const archiveStale = lower.startsWith('_archive/') && ageHours >= 48 && staleByPattern;

    return staleByPattern || isOrphanFile || staleByAgeAndLocation || archiveStale;
}

class UnifiedEnterpriseAutonomyService {
    constructor(opts = {}) {
        this.colabPlanPath = opts.colabPlanPath || COLAB_PLAN_PATH;
        this.embeddingCatalogPath = opts.embeddingCatalogPath || EMBEDDING_CATALOG_PATH;
        this.liquidFabricPath = opts.liquidFabricPath || LIQUID_FABRIC_PATH;
        this.platformBlueprintPath = opts.platformBlueprintPath || PLATFORM_BLUEPRINT_PATH;
        this.dualPipelineBlueprintPath = opts.dualPipelineBlueprintPath || DUAL_PIPELINE_BLUEPRINT_PATH;

        this.colabPlan = loadYaml(this.colabPlanPath);
        this.embeddingCatalog = loadYaml(this.embeddingCatalogPath);
        this.liquidFabric = loadYaml(this.liquidFabricPath);
        this.platformBlueprint = loadYaml(this.platformBlueprintPath);
        this.dualPipelineBlueprint = loadYaml(this.dualPipelineBlueprintPath);

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
        const contextFabric = this.getAlwaysOnContextStatus();
        const liquidArchitecture = this.buildLiquidArchitectureDirective();

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
                contextReceipt: contextFabric.deterministicReceipt,
                liquidReceipt: liquidArchitecture.deterministicReceipt,
            }),
        };
    }

    buildEnterpriseImprovementBacklog(architectureText = '') {
        const extracted = extractEnterpriseTasksFromArchitecture(architectureText);
        const baseline = [
            { text: 'Purge credential-bearing files from git history using git filter-repo/BFG and rotate exposed secrets immediately', enterpriseTrack: 'security-hardening', impact: 'high', source: 'baseline', category: 'security', priority: 1.0 },
            { text: 'Consolidate duplicated HCFullPipeline PowerShell scripts into one parameterized deterministic build orchestrator', enterpriseTrack: 'delivery-automation', impact: 'high', source: 'baseline', category: 'dev', priority: 0.9 },
            { text: 'Standardize health endpoints for all services and wire edge circuit-breaker checks to those paths', enterpriseTrack: 'observability', impact: 'high', source: 'baseline', category: 'ops', priority: 0.9 },
            { text: 'Enforce structured pino logging across routes and orchestration to support low-latency incident triage', enterpriseTrack: 'observability', impact: 'medium', source: 'baseline', category: 'ops', priority: 0.8 },
            { text: 'Continuously embed user actions, analyst decisions, system actions, and environmental snapshots into vector memory with freshness SLO monitoring', enterpriseTrack: 'platform-foundation', impact: 'high', source: 'baseline', category: 'ops', priority: 1.0 },
            { text: 'Expose context coverage endpoints and fail-safe keep-alive embedding so autonomy always has current project context', enterpriseTrack: 'reliability-performance', impact: 'high', source: 'baseline', category: 'ops', priority: 0.95 },
            { text: 'Continuously optimize liquid template projections from 3D vector space and deprecate stale projection targets', enterpriseTrack: 'experience-delivery', impact: 'high', source: 'baseline', category: 'dev', priority: 0.95 },
            { text: 'Generate and enforce safe cleanup plans for stale local generated artifacts and unused projection surfaces', enterpriseTrack: 'reliability-performance', impact: 'medium', source: 'baseline', category: 'ops', priority: 0.85 },
            { text: 'Implement cross-device widget task synchronization with persistent personal storage and 3D vector workspace parity checks', enterpriseTrack: 'platform-foundation', impact: 'high', source: 'baseline', category: 'ops', priority: 0.96 },
            { text: 'Instrument auth and onboarding stages with deterministic completion telemetry and provider-level observability', enterpriseTrack: 'experience-delivery', impact: 'high', source: 'baseline', category: 'dev', priority: 0.9 },
            { text: 'Provision dedicated full-throttle admin trigger lane with GodBee resource profile and recursive AST auto-correction schema', enterpriseTrack: 'delivery-automation', impact: 'high', source: 'baseline', category: 'dev', priority: 0.98 },
            { text: 'Run autonomous heartbeat swarms for hourly TesterBee and nightly PrunerBee with safe cleanup enforcement', enterpriseTrack: 'reliability-performance', impact: 'high', source: 'baseline', category: 'ops', priority: 0.94 },
        ];

        const merged = [...baseline, ...extracted.tasks];
        const deduped = new Map();
        for (const task of merged) {
            const key = task.text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
            if (!deduped.has(key)) deduped.set(key, task);
        }

        const tasks = [...deduped.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0));
        const byTrack = tasks.reduce((acc, task) => { acc[task.enterpriseTrack || 'platform-foundation'] = (acc[task.enterpriseTrack || 'platform-foundation'] || 0) + 1; return acc; }, {});

        return {
            generatedAt: new Date().toISOString(),
            totalTasks: tasks.length,
            byTrack,
            tasks,
            deterministicReceipt: createDeterministicReceipt({ byTrack, tasks: tasks.map((t) => t.text) }),
        };
    }

    getAlwaysOnContextStatus() {
        const coverage = embedder.getContextCoverage();
        const stats = embedder.getStats();
        return {
            generatedAt: new Date().toISOString(),
            mode: 'always-on-context-fabric',
            coverage,
            queueLength: stats.queueLength,
            totalIngested: stats.totalIngested,
            keepAliveEvents: stats.keepAliveEvents,
            bySource: stats.bySource,
            deterministicReceipt: createDeterministicReceipt({ coverage, queueLength: stats.queueLength, totalIngested: stats.totalIngested, keepAliveEvents: stats.keepAliveEvents }),
        };
    }

    getDeviceSyncFabricStatus() {
        const deviceSync = embedder.getCrossDeviceSyncStatus();
        const authOnboarding = embedder.getAuthOnboardingStatus();
        return {
            generatedAt: new Date().toISOString(),
            mode: 'cross-device-sync-fabric',
            deviceSync,
            authOnboarding,
            deterministicReceipt: createDeterministicReceipt({ deviceSyncHealthy: deviceSync.healthy, authStageCount: authOnboarding.stageCount, pendingTasks: deviceSync.pendingTasks }),
        };
    }

    getLivingSystemStatus() {
        const alive = embedder.buildAliveSystemStatus();
        const selfHealPlan = embedder.buildSelfHealPlan();
        return {
            generatedAt: new Date().toISOString(),
            mode: 'unified-living-intelligence-system',
            alive,
            selfHealPlan,
            autonomyDirective: alive.healthy ? 'maintain-max-autonomy-and-proactive-optimization' : 'prioritize-self-heal-then-resume-max-autonomy',
            deterministicReceipt: createDeterministicReceipt({ vitalityScore: alive.vitalityScore, healthy: alive.healthy, selfHealActions: selfHealPlan.actionCount }),
        };
    }

    buildLiquidArchitectureDirective() {
        const optimization = embedder.buildProjectionOptimizationStatus();
        const cleanup = embedder.buildCleanupPlan();
        return {
            generatedAt: new Date().toISOString(),
            paradigm: 'unified-liquid-runtime',
            architecture: {
                split: 'eliminated-frontend-backend-boundary',
                projectionEngine: 'template-injection-from-3d-vector-space',
                projectionStrategy: 'demand-driven-dynamic-projections',
                staleProjectionPolicy: 'auto-detect-and-retire',
            },
            directives: [
                'Treat interfaces and services as a single liquid runtime graph.',
                'Inject templates from vector-state into desired projections at request time.',
                'Track projection reads/writes to eliminate stale and unused projection surfaces.',
                'Use cleanup plans in safe mode before any destructive operations.',
            ],
            projectionOptimization: optimization,
            cleanupPlan: cleanup,
            deterministicReceipt: createDeterministicReceipt({ optimization, cleanupCount: cleanup.candidates.length }),
        };
    }

    buildGodModePipelineStatus(trigger = {}) {
        const userPipeline = this.dualPipelineBlueprint.user_pipeline || {};
        const recursiveAttempts = Math.min(Number(trigger.recursiveAttempts || 1), Number(userPipeline.governance?.max_rewrite_attempts || 12));
        return {
            generatedAt: new Date().toISOString(),
            lane: userPipeline.name || 'heady-auto-pipeline-god-mode',
            triggerTopic: userPipeline.trigger_topic || 'heady-admin-triggers',
            bypassTopic: userPipeline.bypass_topic || 'heady-swarm-tasks',
            actor: trigger.actor || 'owner',
            triggerType: trigger.type || 'admin-command',
            command: trigger.command || 'optimize-liquid-projection',
            sandbox: userPipeline.sandbox_profile || {},
            governance: {
                evaluator: userPipeline.governance?.evaluator || 'perfect-governance',
                conflictResolution: userPipeline.governance?.conflict_resolution || 'recursive-ast-self-correction',
                recursiveAttempts,
                maxAttempts: userPipeline.governance?.max_rewrite_attempts || 12,
                autoSuccess: true,
            },
            projection: userPipeline.projection || {},
            deterministicReceipt: createDeterministicReceipt({ actor: trigger.actor || 'owner', triggerType: trigger.type || 'admin-command', command: trigger.command || 'optimize-liquid-projection', recursiveAttempts, lane: userPipeline.name || 'heady-auto-pipeline-god-mode' }),
        };
    }

    buildAutonomousHeartbeatStatus() {
        const heartbeat = this.dualPipelineBlueprint.heartbeat_pipeline || {};
        const taskDefs = heartbeat.tasks || [];
        const alive = embedder.buildAliveSystemStatus();
        const selfHealPlan = embedder.buildSelfHealPlan();
        const tasks = taskDefs.map((task) => ({
            id: task.id,
            swarm: task.swarm,
            schedule: (heartbeat.schedule || {})[task.swarm] || null,
            patchOnFailure: task.patch_on_failure === true,
            patchEngine: task.patch_engine || null,
        }));
        return {
            generatedAt: new Date().toISOString(),
            lane: heartbeat.name || 'autonomous-heartbeat',
            scheduler: heartbeat.scheduler || 'google-cloud-scheduler',
            topic: heartbeat.topic || 'heady-swarm-tasks',
            tasks,
            runtimeHealth: { vitalityScore: alive.vitalityScore, selfHealActions: selfHealPlan.actionCount, healthy: alive.healthy },
            deterministicReceipt: createDeterministicReceipt({ lane: heartbeat.name || 'autonomous-heartbeat', taskIds: tasks.map((t) => t.id), vitalityScore: alive.vitalityScore, selfHealActions: selfHealPlan.actionCount }),
        };
    }

    buildAbletonBridgeStatus() {
        const ableton = this.dualPipelineBlueprint.ableton_sysex || {};
        return {
            generatedAt: new Date().toISOString(),
            enabled: true,
            manufacturerId: ableton.manufacturer_id ?? 125,
            receiver: ableton.receiver || 'max-for-live-js',
            commands: ableton.commands || [],
            deterministicReceipt: createDeterministicReceipt({ manufacturerId: ableton.manufacturer_id ?? 125, commandIds: (ableton.commands || []).map((c) => c.id) }),
        };
    }

    buildSystemProjectionSnapshot() {
        const now = new Date().toISOString();
        const queueWeights = this.colabPlan.scheduling?.queue_weights || {};
        const activeQueues = Object.keys(queueWeights);
        const fabric = this.liquidFabric.service_topology || {};
        const platformBlueprint = this.buildDeveloperPlatformBlueprint();
        const onboardingContract = this.buildOnboardingContract();
        const contextFabric = this.getAlwaysOnContextStatus();
        const syncFabric = this.getDeviceSyncFabricStatus();
        const livingSystem = this.getLivingSystemStatus();
        const godModePipeline = this.buildGodModePipelineStatus();
        const autonomousHeartbeat = this.buildAutonomousHeartbeatStatus();
        const abletonBridge = this.buildAbletonBridgeStatus();
        const liquidArchitecture = this.buildLiquidArchitectureDirective();

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
            contextFabric,
            syncFabric,
            livingSystem,
            godModePipeline,
            autonomousHeartbeat,
            abletonBridge,
            liquidArchitecture,
            deterministicReceipt: createDeterministicReceipt({
                queueWeights,
                fabric,
                generatedAt: now,
                sourceOfTruth: sourceOfTruth.sourceOfTruth,
                hygieneClean: projectionHygiene.clean,
                platformBlueprintReceipt: platformBlueprint.deterministicReceipt,
                onboardingReceipt: onboardingContract.deterministicReceipt,
                contextReceipt: contextFabric.deterministicReceipt,
                syncReceipt: syncFabric.deterministicReceipt,
                livingReceipt: livingSystem.deterministicReceipt,
                godModeReceipt: godModePipeline.deterministicReceipt,
                heartbeatReceipt: autonomousHeartbeat.deterministicReceipt,
                abletonReceipt: abletonBridge.deterministicReceipt,
                liquidReceipt: liquidArchitecture.deterministicReceipt,
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
        let totalSizeBytes = 0;

        // Scan all configured directories
        for (const dir of STALE_SCAN_DIRECTORIES) {
            const fullDir = path.join(ROOT, dir);
            const files = walkDirectorySafe(fullDir);
            for (const file of files) {
                let stat;
                try { stat = fs.statSync(file.fullPath); } catch { continue; }
                const ageHours = (now - stat.mtimeMs) / (1000 * 60 * 60);
                if (!isLikelyStaleProjectionFile(file.relPath, ageHours)) continue;

                totalSizeBytes += stat.size;
                candidates.push({
                    path: file.relPath,
                    tracked: tracked.has(file.relPath),
                    ageHours: +ageHours.toFixed(1),
                    sizeBytes: stat.size,
                    reason: tracked.has(file.relPath) ? 'tracked-runtime-artifact' : 'stale-local-projection',
                });
            }
        }

        // Also scan repo root for orphan files (*.pid, *.log, test.txt etc)
        try {
            const rootEntries = fs.readdirSync(ROOT, { withFileTypes: true });
            for (const entry of rootEntries) {
                if (!entry.isFile()) continue;
                const relPath = entry.name;
                if (relPath.startsWith('.')) continue; // skip dotfiles
                let stat;
                try { stat = fs.statSync(path.join(ROOT, relPath)); } catch { continue; }
                const ageHours = (now - stat.mtimeMs) / (1000 * 60 * 60);
                if (isLikelyStaleProjectionFile(relPath, ageHours)) {
                    totalSizeBytes += stat.size;
                    candidates.push({
                        path: relPath,
                        tracked: tracked.has(relPath),
                        ageHours: +ageHours.toFixed(1),
                        sizeBytes: stat.size,
                        reason: 'root-orphan-file',
                    });
                }
            }
        } catch { /* root scan failed — non-fatal */ }

        const trackedCandidates = candidates.filter((c) => c.tracked);
        const localCandidates = candidates.filter((c) => !c.tracked);

        // Sort by size descending — clean biggest first
        candidates.sort((a, b) => b.sizeBytes - a.sizeBytes);

        return {
            generatedAt: new Date().toISOString(),
            candidateCount: candidates.length,
            trackedCandidates: trackedCandidates.length,
            localCandidates: localCandidates.length,
            totalSizeBytes,
            totalSizeMB: +(totalSizeBytes / (1024 * 1024)).toFixed(2),
            candidates,
        };
    }

    applyProjectionCleanup({ includeTracked = false, limit = 50 } = {}) {
        const plan = this.buildProjectionCleanupPlan();
        const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 50));
        const selected = plan.candidates
            .filter((candidate) => includeTracked || !candidate.tracked)
            .slice(0, safeLimit);

        const removed = [];
        const errors = [];
        let freedBytes = 0;

        for (const candidate of selected) {
            try {
                const target = path.join(ROOT, candidate.path);
                if (fs.existsSync(target) && fs.statSync(target).isFile()) {
                    freedBytes += candidate.sizeBytes;
                    fs.unlinkSync(target);
                    removed.push(candidate.path);
                }
            } catch (error) {
                errors.push({ path: candidate.path, error: error.message });
            }
        }

        // Clean empty directories left behind
        const emptiedDirs = this._pruneEmptyDirectories();

        return {
            ok: errors.length === 0,
            dryRunCandidates: plan.candidateCount,
            totalSizeMB: plan.totalSizeMB,
            selected: selected.length,
            removed,
            freedBytes,
            freedMB: +(freedBytes / (1024 * 1024)).toFixed(2),
            emptiedDirs,
            errors,
            includeTracked,
            limit: safeLimit,
            executedAt: new Date().toISOString(),
        };
    }

    /**
     * Prune empty directories that were left behind after file cleanup.
     */
    _pruneEmptyDirectories() {
        const pruned = [];
        const dirsToCheck = STALE_SCAN_DIRECTORIES.map((d) => path.join(ROOT, d));

        for (const baseDir of dirsToCheck) {
            if (!fs.existsSync(baseDir)) continue;
            this._pruneEmptyDirsRecursive(baseDir, pruned);
        }

        return pruned;
    }

    _pruneEmptyDirsRecursive(dir, pruned) {
        if (!fs.existsSync(dir)) return;
        let entries;
        try { entries = fs.readdirSync(dir); } catch { return; }

        // Recurse into subdirs first
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            try {
                if (fs.statSync(fullPath).isDirectory()) {
                    this._pruneEmptyDirsRecursive(fullPath, pruned);
                }
            } catch { /* skip */ }
        }

        // Re-read after pruning children
        try {
            const remaining = fs.readdirSync(dir);
            if (remaining.length === 0) {
                const relPath = path.relative(ROOT, dir);
                // Don't prune the top-level scan dirs themselves
                if (!STALE_SCAN_DIRECTORIES.includes(relPath)) {
                    fs.rmdirSync(dir);
                    pruned.push(relPath);
                }
            }
        } catch { /* skip */ }
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


    /**
     * Self-healing cycle. Now DEFAULTS to applying cleanup when stale files exist,
     * because maintenance wasn't running when applyCleanup defaulted to false.
     */
    runSelfHealingCycle({ applyCleanup = 'auto', cleanupLimit = 200 } = {}) {
        const hygiene = this.scanProjectionNoise();
        const cleanupPlan = this.buildProjectionCleanupPlan();
        const onboardingValidation = this.validateOnboardingAndAuthFlow();
        const directives = this.buildAlternateParadigmDirectives();

        // AUTO mode: apply cleanup when candidates exist
        const shouldCleanup = applyCleanup === 'auto'
            ? cleanupPlan.candidateCount > 0
            : applyCleanup === true;

        let cleanup = { ok: true, selected: 0, removed: [], freedMB: 0 };
        if (shouldCleanup) {
            cleanup = this.applyProjectionCleanup({ includeTracked: false, limit: cleanupLimit });
            logger.info(`HeadyMaid: cleaned ${cleanup.removed.length} stale files (${cleanup.freedMB}MB freed)`);
        }

        this.lastSelfHealing = new Date().toISOString();

        return {
            ok: hygiene.clean && onboardingValidation.ok && cleanup.ok,
            ranAt: this.lastSelfHealing,
            autoCleanupTriggered: shouldCleanup,
            hygiene,
            cleanupPlan: {
                candidateCount: cleanupPlan.candidateCount,
                totalSizeMB: cleanupPlan.totalSizeMB,
            },
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
            dualPipelineMode: this.dualPipelineBlueprint.mode || 'full-throttle-auto-success',
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

    app.post('/api/unified-autonomy/enterprise-backlog', (req, res) => {
        const architectureText = req.body?.architectureText || '';
        res.json({ ok: true, backlog: service.buildEnterpriseImprovementBacklog(architectureText) });
    });

    app.get('/api/unified-autonomy/context-fabric', (_req, res) => {
        res.json({ ok: true, contextFabric: service.getAlwaysOnContextStatus() });
    });

    app.get('/api/unified-autonomy/device-sync-fabric', (_req, res) => {
        res.json({ ok: true, syncFabric: service.getDeviceSyncFabricStatus() });
    });

    app.get('/api/unified-autonomy/liquid-architecture', (_req, res) => {
        res.json({ ok: true, liquidArchitecture: service.buildLiquidArchitectureDirective() });
    });

    app.get('/api/unified-autonomy/living-system', (_req, res) => {
        res.json({ ok: true, livingSystem: service.getLivingSystemStatus() });
    });

    app.get('/api/unified-autonomy/god-mode-pipeline', (req, res) => {
        res.json({ ok: true, godModePipeline: service.buildGodModePipelineStatus(req.query || {}) });
    });

    app.get('/api/unified-autonomy/autonomous-heartbeat', (_req, res) => {
        res.json({ ok: true, autonomousHeartbeat: service.buildAutonomousHeartbeatStatus() });
    });

    app.get('/api/unified-autonomy/ableton-bridge', (_req, res) => {
        res.json({ ok: true, abletonBridge: service.buildAbletonBridgeStatus() });
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
