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

    logger.logNodeActivity('CONDUCTOR', '    → Endpoints: /api/unified-autonomy/health, /nodes, /embedding-plan, /dispatch');

    return service;
}

module.exports = {
    UnifiedEnterpriseAutonomyService,
    registerUnifiedEnterpriseAutonomyRoutes,
    rankWorkersForQueue,
    createDeterministicReceipt,
};
