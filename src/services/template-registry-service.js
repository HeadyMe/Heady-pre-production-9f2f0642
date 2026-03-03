/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const EventEmitter = require('events');
const beeRegistry = require('../bees/registry');
const vectorTemplateEngine = require('../vector-template-engine');
const {
    buildRegistrySnapshot,
    validateRegistry,
    evaluateScenarioCoverage,
    createProjectionState,
} = require('../template-registry-optimizer');
const logger = require('../utils/logger');

class TemplateRegistryService extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            enabled: true,
            auditIntervalMs: 30000,
            autoIndexScenarios: true,
            ...config,
        };
        this.isRunning = false;
        this.lastProjection = null;
    }

    async start() {
        if (this.isRunning || !this.config.enabled) return;
        this.isRunning = true;

        await this.runAuditCycle();
        this.auditLoop = setInterval(() => {
            this.runAuditCycle().catch((error) => {
                logger.logError('TemplateRegistryService', 'audit-cycle-failed', error);
            });
        }, this.config.auditIntervalMs);

        this.emit('started');
        logger.logSystem('🧠 Template Registry Service started');
    }

    async stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        clearInterval(this.auditLoop);
        this.emit('stopped');
        logger.logSystem('🛑 Template Registry Service stopped');
    }

    async runAuditCycle() {
        beeRegistry.discover();

        const templates = vectorTemplateEngine.listTemplates();
        const beeDomains = beeRegistry.listDomains();

        const snapshot = buildRegistrySnapshot({ templates, beeDomains });
        const validation = validateRegistry(snapshot);
        const coverage = evaluateScenarioCoverage(snapshot);
        const projection = createProjectionState(snapshot, coverage, validation);

        if (this.config.autoIndexScenarios) {
            await vectorTemplateEngine.indexArtifact(JSON.stringify(projection), 'pipeline-runner', {
                source: 'template-registry-service',
                category: 'template-registry-projection',
            });
        }

        this.lastProjection = projection;
        this.emit('projection-updated', projection);

        logger.logSystem(`🛰️ Template registry projection updated (avg coverage ${projection.coverageSummary.averageCoverage}%)`);
        return projection;
    }

    getStatus() {
        return {
            running: this.isRunning,
            lastProjection: this.lastProjection,
        };
    }
}

let singleton = null;
function getTemplateRegistryService(config = {}) {
    if (!singleton) singleton = new TemplateRegistryService(config);
    return singleton;
}

module.exports = {
    TemplateRegistryService,
    getTemplateRegistryService,
};
