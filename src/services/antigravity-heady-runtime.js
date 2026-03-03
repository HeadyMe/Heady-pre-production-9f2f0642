const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const {
    readRegistry,
    readOptimizationPolicy,
    selectTemplatesForSituation,
    validateRegistry,
} = require('./headybee-template-registry');

const ROOT = path.join(__dirname, '..', '..');
const POLICY_PATH = path.join(ROOT, 'configs', 'services', 'antigravity-heady-runtime-policy.json');

function readPolicy(filePath = POLICY_PATH) {
    const policy = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!policy?.enforce?.gateway || !policy?.enforce?.workspaceMode) {
        throw new Error(`Invalid antigravity runtime policy: ${filePath}`);
    }
    return policy;
}

function isOwnerInitiated(initiatedBy, policy = readPolicy()) {
    if (!initiatedBy) return false;
    const normalized = String(initiatedBy).toLowerCase().trim();
    return (policy.ownerAliases || []).map((alias) => alias.toLowerCase()).includes(normalized);
}

function enforceHeadyForAntigravityOperation(input, options = {}) {
    const policy = options.policy || readPolicy();
    const registry = options.registry || readRegistry();
    const optimizationPolicy = options.optimizationPolicy || readOptimizationPolicy();
    const validation = validateRegistry(registry);

    if (!validation.valid) {
        logger.logError('SYSTEM', 'antigravity-runtime-registry-invalid', validation.errors.join('; '));
        throw new Error('HeadyBee registry invalid; antigravity execution cannot proceed safely.');
    }

    const operation = {
        initiatedBy: input?.initiatedBy || 'unknown',
        source: input?.source || 'unknown',
        task: input?.task || 'unspecified',
        situation: input?.situation || 'digital-presence-launch',
        metadata: input?.metadata || {},
    };

    const ownerInitiated = isOwnerInitiated(operation.initiatedBy, policy);
    const fromAntigravity = String(operation.source).toLowerCase() === 'antigravity';

    const templates = selectTemplatesForSituation(registry, operation.situation, 3, optimizationPolicy);

    const plan = {
        enforced: ownerInitiated && fromAntigravity,
        gateway: policy.enforce.gateway,
        workspaceMode: policy.enforce.workspaceMode,
        autonomousMode: policy.enforce.autonomousMode,
        operation,
        selectedTemplates: templates,
        requiredSwarmTasks: policy.defaultSwarmTasks,
        vectorWorkspace: {
            enabled: true,
            dimensions: 3,
            zoneRouting: true,
            instantExecution: true,
        },
    };

    logger.logSystem(`[AntigravityHeadyRuntime] enforced=${plan.enforced} source=${operation.source} situation=${operation.situation} templates=${templates.length}`);
    return plan;
}

function getHealthStatus() {
    const policy = readPolicy();
    return {
        endpoint: policy.healthEndpoint || '/api/antigravity/health',
        status: 'healthy',
        workspaceMode: policy.enforce.workspaceMode,
        gateway: policy.enforce.gateway,
        autonomousMode: policy.enforce.autonomousMode,
    };
}

module.exports = {
    POLICY_PATH,
    readPolicy,
    isOwnerInitiated,
    enforceHeadyForAntigravityOperation,
    getHealthStatus,
};
