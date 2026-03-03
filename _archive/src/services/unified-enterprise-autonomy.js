/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('js-yaml');
const logger = require('../utils/logger');

const ROOT = path.join(__dirname, '..', '..');
const COLAB_PLAN_PATH = path.join(ROOT, 'configs', 'resources', 'colab-pro-plus-orchestration.yaml');
const EMBEDDING_CATALOG_PATH = path.join(ROOT, 'configs', 'resources', 'vector-embedding-catalog.yaml');
const EMBEDDING_FABRIC_PATH = path.join(ROOT, 'configs', 'autonomy', 'embedding-fabric.yaml');
const TEMPLATE_MATRIX_PATH = path.join(ROOT, 'configs', 'autonomy', 'headybee-template-matrix.yaml');
const UNIFIED_TOPOLOGY_PATH = path.join(ROOT, 'configs', 'resources', 'unified-autonomy-topology.yaml');

const PROTECTED_WORKER_MARKERS = [
    'cloudflare/heady-edge-proxy/',
    'cloudflare/heady-edge-node/',
    'cloudflare/heady-manager-proxy/',
    'cloudflare/heady-cloudrun-failover/',
    'configs/cloudflare-workers/',
];

function isProtectedWorkerPath(filePath) {
    return PROTECTED_WORKER_MARKERS.some((marker) => filePath.includes(marker));
}

function scanDirectory(rootPath, visitor, options = {}) {
    const ignoreDirs = new Set(options.ignoreDirs || []);

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const abs = path.join(dir, entry.name);
            const rel = path.relative(rootPath, abs) || '.';
            if (entry.isDirectory()) {
                visitor({ abs, rel, dirent: entry });
                if (ignoreDirs.has(entry.name)) continue;
                walk(abs);
                continue;
            }
            visitor({ abs, rel, dirent: entry });
        }
    }

    walk(rootPath);
}

function loadYaml(filePath) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function createDeterministicReceipt(input) {
    const payload = JSON.stringify(input);
    return crypto.createHash('sha256').update(payload).digest('hex');
}


function calculateUnifiedHealthSignals(plan) {
    const model = plan.operating_model || {};
    const injection = plan.template_injection || {};
    const cloudProjection = plan.cloud_projection || {};
    const ableton = plan.ableton_live || {};

    return {
        unifiedFabric: model.paradigm === 'liquid-unified-microservice-fabric',
        noFrontendBackendSplit: model.explicit_frontend_backend_split === false,
        orchestrationDualPlane: Array.isArray(model.orchestration_planes) && model.orchestration_planes.includes('HeadyConductor') && model.orchestration_planes.includes('HeadyCloudConductor'),
        swarmMesh: Array.isArray(model.swarm_layers) && model.swarm_layers.includes('HeadySwarm') && model.swarm_layers.includes('HeadyBees'),
        templateInjectionAutonomous: injection.source_workspace === '3d-vector-workspace' && injection.mode === 'autonomous',
        cloudOnlyProjection: cloudProjection.cloud_only_delivery === true,
        abletonRealtimeControl: ableton.realtime_mode === true && ableton.transport === 'midi2-ump',
    };
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
        this.rootPath = opts.rootPath || ROOT;
        this.colabPlanPath = opts.colabPlanPath || COLAB_PLAN_PATH;
        this.embeddingCatalogPath = opts.embeddingCatalogPath || EMBEDDING_CATALOG_PATH;
        this.embeddingFabricPath = opts.embeddingFabricPath || EMBEDDING_FABRIC_PATH;
        this.templateMatrixPath = opts.templateMatrixPath || TEMPLATE_MATRIX_PATH;
        this.unifiedTopologyPath = opts.unifiedTopologyPath || UNIFIED_TOPOLOGY_PATH;
        this.colabPlan = loadYaml(this.colabPlanPath);
        this.embeddingCatalog = loadYaml(this.embeddingCatalogPath);
        this.embeddingFabric = loadYaml(this.embeddingFabricPath);
        this.templateMatrix = loadYaml(this.templateMatrixPath);
        this.unifiedTopology = loadYaml(this.unifiedTopologyPath);
        this.startedAt = null;
        this.lastDispatch = null;
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

    buildUnifiedTopology() {
        const components = this.unifiedTopology.components || [];
        const dependencies = this.unifiedTopology.dependencies || [];
        const policy = this.unifiedTopology.microservice_policy || {};
        const paradigm = this.unifiedTopology.paradigm || {};
        const projectionPlan = this.unifiedTopology.resource_projection || {};
        const repositoryProjection = this.unifiedTopology.repository_projection || {};
        const governance = this.unifiedTopology.projection_governance || {};

        return {
            profile: this.unifiedTopology.profile || 'heady-unified-autonomy',
            objective: this.unifiedTopology.objective || '',
            paradigm,
            components,
            dependencies,
            policy,
            projectionPlan,
            repositoryProjection,
            governance,
            microserviceCount: components.length,
            deterministicReceipt: createDeterministicReceipt({
                paradigm,
                components: components.map((component) => ({
                    id: component.id,
                    layer: component.layer,
                    required: component.required,
                })),
                dependencies,
                policy,
                projectionPlan,
                governance,
            }),
        };
    }

    scanRepositoryIntegrity() {
        const topology = this.buildUnifiedTopology();
        const policy = topology.repositoryProjection || {};
        const maxViolations = Number(policy.max_reported_violations || 200);
        const violations = [];

        function reportViolation(rule, relPath) {
            if (violations.length >= maxViolations) return;
            violations.push({ rule, path: relPath });
        }

        scanDirectory(this.rootPath, ({ rel, dirent }) => {
            if (rel === '.' || violations.length >= maxViolations) return;
            const normalized = rel.replace(/\\/g, '/');
            const base = path.basename(normalized);

            if (policy.disallow_nested_git_repositories && dirent.isDirectory() && normalized.endsWith('/.git')) {
                reportViolation('nested-git-repository', normalized);
            }
            if (policy.disallow_bak_files && base.endsWith('.bak')) {
                reportViolation('bak-file', normalized);
            }
            if (policy.disallow_cloudflare_service_worker_files
                && !isProtectedWorkerPath(normalized)
                && /^(cloudflare|cloudflare-workers)\//.test(normalized)
                && /(service-worker|sw)\.(js|ts)$/i.test(base)) {
                reportViolation('cloudflare-service-worker-file', normalized);
            }
            if (base.endsWith('.log') || base.endsWith('.jsonl') || base === 'server.pid') {
                reportViolation('runtime-artifact', normalized);
            }
        }, {
            ignoreDirs: ['.git', 'node_modules', '.pnpm-store', 'offline-packages'],
        });

        return {
            ok: violations.length === 0,
            rootPath: this.rootPath,
            monorepoSourceOfTruth: topology.paradigm.monorepo_source_of_truth !== false,
            violations,
            deterministicReceipt: createDeterministicReceipt({
                rootPath: this.rootPath,
                violations,
                monorepoSourceOfTruth: topology.paradigm.monorepo_source_of_truth !== false,
            }),
        };
    }

    buildCloudProjectionPlan(runtimeSignals = {}) {
        const topology = this.buildUnifiedTopology();
        const cloudSignals = runtimeSignals.cloudProjection || {};
        const workerSignals = cloudSignals.workerSignals || {};
        const configuredWorkers = topology.projectionPlan.workers || [];

        const workers = configuredWorkers.map((worker) => {
            const signal = workerSignals[worker.worker_id] || {};
            const gpuUtilization = Number(signal.gpuUtilization ?? worker.target_gpu_utilization ?? 0);
            const vramUtilization = Number(signal.vramUtilization ?? worker.target_vram_utilization ?? 0);
            const healthy = gpuUtilization <= 0.95 && vramUtilization <= 0.95;

            return {
                workerId: worker.worker_id,
                gpuProfile: worker.gpu_profile,
                targetGpuUtilization: Number(worker.target_gpu_utilization || 0),
                targetVramUtilization: Number(worker.target_vram_utilization || 0),
                observedGpuUtilization: Number(gpuUtilization.toFixed(4)),
                observedVramUtilization: Number(vramUtilization.toFixed(4)),
                healthy,
                primaryFocus: worker.primary_focus || [],
            };
        });

        const cloudOnlyExecution = topology.paradigm.cloud_only_execution !== false;
        const projectionHealthy = workers.every((worker) => worker.healthy);

        return {
            cloudOnlyExecution,
            userDeliveryMode: topology.paradigm.user_delivery_mode || 'projected-state-streams',
            workers,
            projectionHealthy,
            deterministicReceipt: createDeterministicReceipt({
                cloudOnlyExecution,
                workers: workers.map((worker) => ({
                    workerId: worker.workerId,
                    observedGpuUtilization: worker.observedGpuUtilization,
                    observedVramUtilization: worker.observedVramUtilization,
                    healthy: worker.healthy,
                })),
            }),
        };
    }

    buildReadinessReport(runtimeSignals = {}) {
        const topology = this.buildUnifiedTopology();
        const serviceHealth = runtimeSignals.serviceHealth || {};
        const templateInjection = runtimeSignals.templateInjection || {};
        const ableton = runtimeSignals.ableton || {};
        const cloudProjection = this.buildCloudProjectionPlan(runtimeSignals);

        const componentReadiness = topology.components.map((component) => {
            const explicit = serviceHealth[component.id];
            const healthy = typeof explicit === 'boolean' ? explicit : !component.required;
            return {
                id: component.id,
                required: Boolean(component.required),
                healthy,
                healthEndpoint: component.health_endpoint,
                status: healthy ? 'ready' : 'missing',
            };
        });

        const requiredFailures = componentReadiness.filter((component) => component.required && !component.healthy);
        const templateInjectionReady = templateInjection.enabled !== false && templateInjection.vectorWorkspaceConnected !== false;
        const abletonReady = ableton.enabled === true ? ableton.sessionActive !== false : true;
        const liquidUnifiedReady = topology.paradigm.frontend_backend_split === false;
        const complexityScore = Number(runtimeSignals.complexityScore ?? 0.25);
        const complexityCeiling = Number(topology.policy.complexity_ceiling ?? 0.35);
        const complexityHealthy = complexityScore <= complexityCeiling;

        return {
            ok: requiredFailures.length === 0
                && templateInjectionReady
                && abletonReady
                && cloudProjection.cloudOnlyExecution
                && cloudProjection.projectionHealthy
                && liquidUnifiedReady
                && complexityHealthy,
            generatedAt: new Date().toISOString(),
            profile: topology.profile,
            microserviceCount: topology.microserviceCount,
            preferredMicroservices: topology.policy.preferred_microservices || null,
            maxMicroservices: topology.policy.max_microservices || null,
            componentReadiness,
            requiredFailures,
            templateInjection: {
                enabled: templateInjection.enabled !== false,
                vectorWorkspaceConnected: templateInjection.vectorWorkspaceConnected !== false,
                status: templateInjectionReady ? 'ready' : 'degraded',
            },
            ableton: {
                enabled: ableton.enabled === true,
                sessionActive: ableton.sessionActive !== false,
                status: abletonReady ? 'ready' : 'degraded',
            },
            liquidUnifiedArchitecture: {
                frontendBackendSplit: topology.paradigm.frontend_backend_split === true,
                status: liquidUnifiedReady ? 'unified' : 'split-detected',
            },
            systemicComplexity: {
                score: complexityScore,
                ceiling: complexityCeiling,
                status: complexityHealthy ? 'acceptable' : 'degraded',
            },
            cloudProjection,
            deterministicReceipt: createDeterministicReceipt({
                componentReadiness: componentReadiness.map((component) => ({
                    id: component.id,
                    healthy: component.healthy,
                    required: component.required,
                })),
                templateInjectionReady,
                abletonReady,
                cloudOnlyExecution: cloudProjection.cloudOnlyExecution,
                projectionHealthy: cloudProjection.projectionHealthy,
                liquidUnifiedReady,
                complexityHealthy,
            }),
        };
    }

    buildSystemProjection(runtimeSignals = {}, queuePressure = {}) {
        const topology = this.buildUnifiedTopology();
        const dispatch = this.dispatch(queuePressure);
        const readiness = this.buildReadinessReport(runtimeSignals);
        const embeddingPlan = this.buildEmbeddingPlan();

        return {
            generatedAt: new Date().toISOString(),
            architectureModel: topology.paradigm.architecture_model || 'liquid-unified-microservices',
            cloudOnlyExecution: topology.paradigm.cloud_only_execution !== false,
            monorepoSourceOfTruth: topology.paradigm.monorepo_source_of_truth !== false,
            dynamicOutputTargets: topology.paradigm.dynamic_output_targets || [],
            activeQueues: dispatch.assignments.filter((assignment) => assignment.selectedWorker).map((assignment) => assignment.queue),
            projectionStatus: readiness.ok ? 'instantaneous-ready' : 'degraded',
            topology,
            dispatch,
            readiness,
            embeddingProfile: embeddingPlan.profile,
            deterministicReceipt: createDeterministicReceipt({
                topology: topology.deterministicReceipt,
                dispatch: dispatch.assignments.map((assignment) => assignment.deterministicReceipt),
                readiness: readiness.deterministicReceipt,
                embeddingProfile: embeddingPlan.profile,
            }),
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

    getUnifiedSystemProfile() {
        const model = this.colabPlan.operating_model || {};
        const injection = this.colabPlan.template_injection || {};
        const cloudProjection = this.colabPlan.cloud_projection || {};
        const ableton = this.colabPlan.ableton_live || {};

        return {
            ok: true,
            paradigm: model.paradigm || 'unspecified',
            explicitFrontendBackendSplit: model.explicit_frontend_backend_split,
            dynamicProducts: model.dynamic_products || [],
            orchestrationPlanes: model.orchestration_planes || [],
            swarmLayers: model.swarm_layers || [],
            templateInjection: {
                sourceWorkspace: injection.source_workspace || null,
                targetLayers: injection.target_layers || [],
                mode: injection.mode || 'manual',
                deterministicReceipts: injection.deterministic_receipts === true,
            },
            cloudProjection: {
                cloudOnlyDelivery: cloudProjection.cloud_only_delivery === true,
                localResourceUsageTargetPercent: cloudProjection.local_resource_usage_target_percent ?? null,
                projectionMode: cloudProjection.projection_mode || null,
            },
            abletonLive: {
                realtimeMode: ableton.realtime_mode === true,
                transport: ableton.transport || null,
                objective: ableton.objective || null,
            },
        };
    }

    getLiveUnifiedStatus() {
        const healthSignals = calculateUnifiedHealthSignals(this.colabPlan);
        const checks = Object.entries(healthSignals).map(([name, pass]) => ({ name, pass }));
        const passingChecks = checks.filter((entry) => entry.pass).length;

        return {
            ok: passingChecks === checks.length,
            healthScore: Number((passingChecks / checks.length).toFixed(4)),
            checks,
            dispatch: this.lastDispatch,
            generatedAt: new Date().toISOString(),
        };
    }

    buildTemplateInjectionPlan() {
        const collections = this.embeddingCatalog.collections || [];
        const situations = this.templateMatrix.situations || [];

        const vectorWorkspaceFeeds = collections.map((collection) => ({
            collection: collection.name,
            query: collection.query,
            metadata: collection.metadata || {},
            deterministicReceipt: createDeterministicReceipt({
                collection: collection.name,
                query: collection.query,
            }),
        }));

        const injectionRoutes = situations.map((situation) => ({
            situationId: situation.id,
            triggerKeywords: situation.keywords || [],
            targetTemplate: situation.preferred_template || this.templateMatrix.default_template,
            orchestrationNode: situation.node,
            headySwarmTask: situation.headyswarm_task,
            workflow: situation.workflow,
            deterministicReceipt: createDeterministicReceipt({
                situationId: situation.id,
                targetTemplate: situation.preferred_template,
                headySwarmTask: situation.headyswarm_task,
            }),
        }));

        return {
            ok: true,
            workspace: '3d-vector-memory',
            vectorWorkspaceFeeds,
            templateInjectionRoutes: injectionRoutes,
            defaultTemplate: this.templateMatrix.default_template || null,
            autonomousCadenceMinutes: (this.embeddingFabric.learning_loops || []).find((loop) => loop.id === 'template-optimization-loop')?.cadence_minutes || null,
        };
    }

    buildUnifiedRuntimeProjection() {
        const subscriptions = this.embeddingFabric.colab?.subscriptions || [];
        const planes = Object.entries(this.embeddingFabric.node_responsibilities || {}).map(([node, details]) => ({
            node,
            capabilities: details.primary_capabilities || [],
            writeTargets: details.writes || [],
        }));

        const totalGpuMemoryGb = subscriptions.reduce((sum, subscription) => {
            return sum + Number(subscription.gpu_memory_gb || 0);
        }, 0);

        return {
            ok: true,
            paradigm: 'liquid-unified-microservice-architecture',
            serviceBoundaries: 'capability-planes',
            deprecatedBoundaries: ['frontend', 'backend'],
            cloudProjectionMode: {
                cloudOnlyProjection: true,
                localResourceUsageProfile: 'minimal-client-projection',
            },
            orchestration: {
                conductor: 'HeadyConductor',
                cloudConductor: 'HeadyCloudConductor',
                swarmLayer: 'HeadySwarm',
                beeLayer: 'HeadyBees',
            },
            capabilityPlanes: planes,
            gpuFabric: {
                provider: 'colab-pro-plus',
                subscriptionCount: subscriptions.length,
                totalGpuMemoryGb,
                subscriptions,
            },
            musicRealtimeMode: {
                enabled: true,
                bridge: 'cloud-midi-sequencer',
                target: 'ableton-live',
            },
            deterministicPolicies: {
                seededRng: Boolean(this.embeddingFabric.orchestration?.use_seeded_rng),
                budgetChecks: Boolean(this.embeddingFabric.orchestration?.enforce_budget_checks),
                deterministicCapture: Boolean(this.embeddingFabric.orchestration?.deterministic_capture_required),
            },
            generatedAt: new Date().toISOString(),
        };
    }

    getHealth() {
        return {
            ok: true,
            service: 'unified-enterprise-autonomy',
            startedAt: this.startedAt,
            workerCount: (this.colabPlan.workers || []).length,
            queueCount: Object.keys(this.colabPlan.scheduling?.queue_weights || {}).length,
            embeddingCollections: (this.embeddingCatalog.collections || []).length,
            templateSituations: (this.templateMatrix.situations || []).length,
            unifiedComponents: (this.unifiedTopology.components || []).length,
            cloudOnlyExecution: this.unifiedTopology.paradigm?.cloud_only_execution !== false,
            frontendBackendSplit: this.unifiedTopology.paradigm?.frontend_backend_split === true,
            monorepoSourceOfTruth: this.unifiedTopology.paradigm?.monorepo_source_of_truth !== false,
            determinism: this.colabPlan.determinism || {},
            lastDispatchAt: this.lastDispatch?.at || null,
            unifiedStatus: this.getLiveUnifiedStatus(),
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

    app.get('/api/unified-autonomy/profile', (_req, res) => {
        res.json({ ok: true, profile: service.getUnifiedSystemProfile() });
    });

    app.get('/api/unified-autonomy/live-status', (_req, res) => {
        res.json({ ok: true, status: service.getLiveUnifiedStatus() });
    });

    app.get('/api/unified-autonomy/template-injection', (_req, res) => {
        res.json(service.buildTemplateInjectionPlan());
    });

    app.get('/api/unified-autonomy/runtime-projection', (_req, res) => {
        res.json(service.buildUnifiedRuntimeProjection());
    });

    app.post('/api/unified-autonomy/dispatch', (req, res) => {
        const queuePressure = req.body?.queuePressure || {};
        res.json({ ok: true, dispatch: service.dispatch(queuePressure) });
    });

    app.get('/api/unified-autonomy/topology', (_req, res) => {
        res.json({ ok: true, topology: service.buildUnifiedTopology() });
    });

    app.get('/api/unified-autonomy/repo-integrity', (_req, res) => {
        res.json({ ok: true, repositoryIntegrity: service.scanRepositoryIntegrity() });
    });

    app.post('/api/unified-autonomy/readiness', (req, res) => {
        const runtimeSignals = req.body?.runtimeSignals || {};
        res.json({ ok: true, readiness: service.buildReadinessReport(runtimeSignals) });
    });

    app.post('/api/unified-autonomy/projection', (req, res) => {
        const runtimeSignals = req.body?.runtimeSignals || {};
        const queuePressure = req.body?.queuePressure || {};
        res.json({ ok: true, projection: service.buildSystemProjection(runtimeSignals, queuePressure) });
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/unified-autonomy/health, /nodes, /embedding-plan, /profile, /live-status, /template-injection, /runtime-projection, /dispatch, /topology, /repo-integrity, /readiness, /projection');

    return service;
}

module.exports = {
    UnifiedEnterpriseAutonomyService,
    registerUnifiedEnterpriseAutonomyRoutes,
    rankWorkersForQueue,
    createDeterministicReceipt,
    calculateUnifiedHealthSignals,
    isProtectedWorkerPath,
};
