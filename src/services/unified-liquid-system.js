/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const {
    UnifiedEnterpriseAutonomyService,
    createDeterministicReceipt,
} = require('./unified-enterprise-autonomy');
const {
    readRegistry,
    readOptimizationPolicy,
    selectTemplatesForSituation,
} = require('./headybee-template-registry');

function hashPayload(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function buildTemplateInjectionMap({ registry, policy, situations }) {
    return situations.map((situation) => {
        const selected = selectTemplatesForSituation(
            registry,
            situation,
            policy.defaults?.templatesPerSituation || 2,
            policy,
        );

        return {
            situation,
            templates: selected.map((template) => ({
                id: template.id,
                zone: template.zone,
                nodes: template.nodes,
                headyswarmTasks: template.headyswarmTasks,
                bees: template.bees || [],
                deterministicReceipt: createDeterministicReceipt({
                    situation,
                    templateId: template.id,
                    zone: template.zone,
                    nodes: template.nodes,
                }),
            })),
        };
    });
}

class UnifiedLiquidSystemService {
    constructor() {
        this.startedAt = null;
        this.unifiedAutonomy = new UnifiedEnterpriseAutonomyService();
    }

    start() {
        this.startedAt = new Date().toISOString();
        this.unifiedAutonomy.start();
        logger.logSystem('∞ UnifiedLiquidSystemService: STARTED');
    }

    getProjection() {
        const registry = readRegistry();
        const policy = readOptimizationPolicy();
        const embeddingPlan = this.unifiedAutonomy.buildEmbeddingPlan();
        const dispatch = this.unifiedAutonomy.dispatch({
            'instant-projection': 0.02,
            'ableton-live-control': 0.03,
        });

        const injectionMap = buildTemplateInjectionMap({
            registry,
            policy,
            situations: registry.predictedSituations || [],
        });

        const colabWorkers = this.unifiedAutonomy.getNodeResponsibilities();
        const queueCount = dispatch.assignments.length;

        const projection = {
            ok: true,
            generatedAt: new Date().toISOString(),
            paradigm: {
                model: 'liquid-unified-architecture',
                splitFrontendBackend: false,
                capabilitySurface: 'single-unified-service-plane',
            },
            orchestration: {
                conductor: 'HeadyConductor',
                cloudConductor: 'HeadyCloudConductor',
                swarm: 'HeadySwarm',
                bees: 'HeadyBee',
                queueCount,
            },
            realtime: {
                instantaneousAction: {
                    enabled: true,
                    transport: ['websocket', 'midi-ump', 'vector-event-bus'],
                },
                abletonLive: {
                    enabled: true,
                    controlPath: 'ableton-remote-script/HeadyBuddy',
                    healthEndpoint: '/api/unified-liquid-system/health/ableton-live',
                },
            },
            compute: {
                colabProPlusPlans: 3,
                workers: colabWorkers,
                gpuPolicy: 'vector-embedding-priority-then-low-latency-routing',
                cloudOnlyProjection: {
                    enabled: true,
                    localResourceUsageTarget: 'near-zero',
                },
            },
            templateInjection: {
                workspace: '3d-vector-workspace',
                injectionTargets: ['headybee', 'headyswarm'],
                scenarios: injectionMap,
            },
            embeddings: embeddingPlan,
            dispatch,
        };

        return {
            ...projection,
            projectionHash: hashPayload(projection),
        };
    }

    getHealth() {
        const projection = this.getProjection();
        return {
            ok: true,
            service: 'unified-liquid-system',
            startedAt: this.startedAt,
            scenarios: projection.templateInjection.scenarios.length,
            workers: projection.compute.workers.length,
            projectionHash: projection.projectionHash,
        };
    }
}

function registerUnifiedLiquidSystemRoutes(app, service = new UnifiedLiquidSystemService()) {
    service.start();

    app.get('/api/unified-liquid-system/health', (_req, res) => {
        res.json(service.getHealth());
    });

    app.get('/api/unified-liquid-system/projection', (_req, res) => {
        res.json(service.getProjection());
    });

    app.get('/api/unified-liquid-system/health/ableton-live', (_req, res) => {
        const projection = service.getProjection();
        res.json({
            ok: true,
            integration: projection.realtime.abletonLive,
            deterministicReceipt: createDeterministicReceipt(projection.realtime.abletonLive),
        });
    });

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/unified-liquid-system/health, /projection, /health/ableton-live');
    return service;
}

module.exports = {
    UnifiedLiquidSystemService,
    registerUnifiedLiquidSystemRoutes,
    buildTemplateInjectionMap,
};
