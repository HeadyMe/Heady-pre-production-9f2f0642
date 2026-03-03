#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    enforceHeadyForAntigravityOperation,
    readPolicy,
    getHealthStatus,
} = require('../../src/services/antigravity-heady-runtime');
const { buildOptimizationReport, hashRegistry } = require('../../src/services/headybee-template-registry');

const ROOT = path.join(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'configs', 'services', 'antigravity-heady-runtime-state.json');

function runOnce() {
    const policy = readPolicy();
    const samplePlan = enforceHeadyForAntigravityOperation({
        initiatedBy: 'owner',
        source: 'antigravity',
        task: 'autonomous-runtime-sync',
        situation: 'autonomous-deploy',
        metadata: { initiatedBySystem: true },
    });
    const optimizationReport = buildOptimizationReport();

    const payload = {
        generatedAt: new Date().toISOString(),
        policyVersion: policy.version,
        health: getHealthStatus(),
        enforcedGateway: samplePlan.gateway,
        workspaceMode: samplePlan.workspaceMode,
        autonomousMode: samplePlan.autonomousMode,
        optimizationReportHash: hashRegistry(optimizationReport),
        topTemplates: optimizationReport.topTemplates,
        samplePlan,
    };

    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    process.stdout.write('antigravity-heady-sync: runtime state refreshed\n');
}

if (require.main === module) {
    runOnce();
}

module.exports = { runOnce };
