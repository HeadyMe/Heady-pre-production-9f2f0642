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
        this.colabPlanPath = opts.colabPlanPath || COLAB_PLAN_PATH;
        this.embeddingCatalogPath = opts.embeddingCatalogPath || EMBEDDING_CATALOG_PATH;
        this.colabPlan = loadYaml(this.colabPlanPath);
        this.embeddingCatalog = loadYaml(this.embeddingCatalogPath);
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

    getHealth() {
        return {
            ok: true,
            service: 'unified-enterprise-autonomy',
            startedAt: this.startedAt,
            workerCount: (this.colabPlan.workers || []).length,
            queueCount: Object.keys(this.colabPlan.scheduling?.queue_weights || {}).length,
            embeddingCollections: (this.embeddingCatalog.collections || []).length,
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

    app.post('/api/unified-autonomy/dispatch', (req, res) => {
        const queuePressure = req.body?.queuePressure || {};
        res.json({ ok: true, dispatch: service.dispatch(queuePressure) });
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/unified-autonomy/health, /nodes, /embedding-plan, /profile, /live-status, /dispatch');

    return service;
}

module.exports = {
    UnifiedEnterpriseAutonomyService,
    registerUnifiedEnterpriseAutonomyRoutes,
    rankWorkersForQueue,
    createDeterministicReceipt,
    calculateUnifiedHealthSignals,
};
