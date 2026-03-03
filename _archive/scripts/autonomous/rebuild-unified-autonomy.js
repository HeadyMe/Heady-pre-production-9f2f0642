#!/usr/bin/env node
/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * rebuild-unified-autonomy.js — Validates the merged unified autonomy topology.
 */

const path = require('path');
const {
    UnifiedEnterpriseAutonomyService,
    calculateUnifiedHealthSignals,
} = require('../../src/services/unified-enterprise-autonomy');
const { LiquidUnifiedRuntime } = require('../../src/services/liquid-unified-runtime');

const LINE = '━'.repeat(60);

function header(label) {
    console.log(`\n${LINE}`);
    console.log(`  ${label}`);
    console.log(LINE);
}

function check(label, pass) {
    const mark = pass ? '✅' : '❌';
    console.log(`  ${mark}  ${label}`);
    return pass;
}

// ─── Main ───
(function main() {
    let exitCode = 0;

    header('1. UnifiedEnterpriseAutonomyService — Health Signals');
    const service = new UnifiedEnterpriseAutonomyService();
    const signals = calculateUnifiedHealthSignals(service.colabPlan);
    const signalEntries = Object.entries(signals);
    signalEntries.forEach(([name, pass]) => {
        if (!check(name, pass)) exitCode = 1;
    });
    console.log(`  → ${signalEntries.filter(([, v]) => v).length}/${signalEntries.length} green`);

    header('2. Unified Topology');
    const topology = service.buildUnifiedTopology();
    check('topology loaded', Boolean(topology.profile));
    check(`components: ${topology.microserviceCount}`, topology.microserviceCount > 0);
    check(`paradigm: ${topology.paradigm.architecture_model}`, topology.paradigm.architecture_model === 'liquid-unified-microservices');
    check('no frontend/backend split', topology.paradigm.frontend_backend_split === false);
    check('cloud-only execution', topology.paradigm.cloud_only_execution === true);
    check('monorepo source of truth', topology.paradigm.monorepo_source_of_truth === true);

    header('3. Cloud Projection Plan');
    const cloud = service.buildCloudProjectionPlan();
    check('cloud-only execution enforced', cloud.cloudOnlyExecution);
    check(`workers: ${cloud.workers.length}`, cloud.workers.length > 0);
    check('all workers healthy', cloud.projectionHealthy);

    header('4. Readiness Report');
    const readiness = service.buildReadinessReport();
    check(`overall: ${readiness.ok ? 'READY' : 'DEGRADED'}`, true);
    check(`components: ${readiness.componentReadiness.length}`, readiness.componentReadiness.length > 0);
    check(`required failures: ${readiness.requiredFailures.length}`, true);
    check(`template injection: ${readiness.templateInjection.status}`, readiness.templateInjection.status === 'ready');
    check(`liquid architecture: ${readiness.liquidUnifiedArchitecture.status}`, readiness.liquidUnifiedArchitecture.status === 'unified');
    check(`complexity: ${readiness.systemicComplexity.status}`, readiness.systemicComplexity.status === 'acceptable');

    header('5. System Projection');
    const projection = service.buildSystemProjection();
    check(`architecture: ${projection.architectureModel}`, projection.architectureModel === 'liquid-unified-microservices');
    check(`status: ${projection.projectionStatus}`, true);
    check(`active queues: ${projection.activeQueues.length}`, projection.activeQueues.length > 0);
    check(`receipt: ${projection.deterministicReceipt.slice(0, 16)}…`, projection.deterministicReceipt.length === 64);

    header('6. Liquid Unified Runtime');
    const runtime = new LiquidUnifiedRuntime();
    const rStatus = runtime.runtimeStatus();
    check(`capabilities: ${rStatus.capabilities.length}`, rStatus.capabilities.length > 0);
    check(`mode: ${rStatus.mode}`, rStatus.mode === 'unified-autonomous-liquid-runtime');
    const snapshot = runtime.getUnifiedProjectionSnapshot();
    check('projection snapshot ok', snapshot.ok);

    header('7. Repository Integrity');
    const integrity = service.scanRepositoryIntegrity();
    check(`violations: ${integrity.violations.length}`, true);
    check(`monorepo: ${integrity.monorepoSourceOfTruth}`, integrity.monorepoSourceOfTruth);

    header('8. Template Injection Plan');
    const injection = service.buildTemplateInjectionPlan();
    check('injection ok', injection.ok);
    check(`workspace: ${injection.workspace}`, injection.workspace === '3d-vector-memory');
    check(`feeds: ${injection.vectorWorkspaceFeeds.length}`, injection.vectorWorkspaceFeeds.length > 0);
    check(`routes: ${injection.templateInjectionRoutes.length}`, injection.templateInjectionRoutes.length > 0);

    console.log(`\n${LINE}`);
    console.log(exitCode === 0
        ? '  ✅  ALL CHECKS PASSED — unified autonomy topology fully merged'
        : '  ❌  SOME CHECKS FAILED — see above');
    console.log(LINE);

    process.exit(exitCode);
})();
