import assert from 'assert';
import fs from 'fs-extra';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import {
    getAutonomyState,
    ingestConcept,
    runAutonomyTick,
    createAbletonSession,
    getAuditEvents,
    getMonorepoProjection,
    getAutonomyRuntimeStatus,
    getAutonomyDiagnostics,
    getNodeResponsibilities,
    upsertVectorDocument,
    queryVectorWorkspace,
    getTemplateIntelligence,
    embedRepositoryFromDisk,
    getDeterminismReport,
    getUnifiedOperatingModel,
    getTemplateRegistry,
    registerTemplate,
    validateTemplateRegistry,
    recommendTemplateForSituation,
    runTemplateOptimizationCycle,
    getTemplateCoverageForecast,
    getTemplateReadinessMatrix,
    getDigitalPresenceReport,
    runAutonomyHardeningCycle,
    getMaintenanceOpsPlan,
    runMaintenanceSweep,
    startAutonomyLoop,
    stopAutonomyLoop,
    AutonomyValidationError,
} from '../services/autonomy-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, '..', 'data');

async function resetFiles() {
    await fs.remove(join(dataDir, 'autonomy-state.json'));
    await fs.remove(join(dataDir, 'autonomy-audit.jsonl'));
    await fs.remove(join(dataDir, 'monorepo-projection.json'));
}

async function main() {
    stopAutonomyLoop();
    await resetFiles();

    const initial = await getAutonomyState();
    assert.equal(initial.resources.colabProPlusMemberships, 3);
    assert.equal(initial.system.vectorSpace, '3d');


    let threw = false;
    try {
        await ingestConcept({ text: '', priority: 'critical' });
    } catch (err) {
        threw = err instanceof AutonomyValidationError;
    }
    assert.equal(threw, true);

    await ingestConcept({ text: 'Critical orchestration hardening', priority: 'critical' });
    await ingestConcept({ text: 'Low priority cleanup', priority: 'low' });

    let duplicateThrew = false;
    try {
        await ingestConcept({ text: 'Critical orchestration hardening', priority: 'critical' });
    } catch (err) {
        duplicateThrew = err instanceof AutonomyValidationError;
    }
    assert.equal(duplicateThrew, true);


    const tick = await runAutonomyTick('test');
    assert.ok(!tick.skipped);
    assert.ok(tick.processed >= 1);

    const runtime = await getAutonomyRuntimeStatus();
    assert.ok(runtime.tickCounter >= 1);


    const vec = await upsertVectorDocument({ sourceId: 'repo:file1', content: 'heady liquid architecture and orchestration map', kind: 'project', tags: ['heady'] });
    assert.ok(Array.isArray(vec.vector) && vec.vector.length === 3);

    const q = await queryVectorWorkspace({ query: 'liquid architecture map', limit: 5 });
    assert.ok(q.total >= 1);

    const nodes = await getNodeResponsibilities();
    assert.equal(nodes.colabMemberships, 3);
    assert.equal(nodes.currentAssignments.length, 3);


    const tpl = await getTemplateIntelligence();
    assert.ok(tpl.templates['headyswarm/orchestrator']);

    const registered = await registerTemplate({
        id: 'headybees/incident-response',
        name: 'Incident Response Template',
        templateType: 'headybee',
        situations: ['incident-response', 'high-priority-alert'],
        tools: ['vector-query', 'event-stream'],
        skills: ['self-healing', 'verification'],
        qualityScore: 0.92,
        latencyScore: 0.81,
        reliabilityScore: 0.95,
    });
    assert.equal(registered.id, 'headybees/incident-response');

    const registry = await getTemplateRegistry();
    assert.ok(Array.isArray(registry.templates) && registry.templates.length >= 1);
    assert.ok(Array.isArray(registry.situationIndex['incident-response']));

    const validation = await validateTemplateRegistry();
    assert.ok(Array.isArray(validation) && validation.length >= 1);

    const recommendation = await recommendTemplateForSituation({ situation: 'incident response' });
    assert.equal(recommendation.situation, 'incident-response');
    assert.ok(recommendation.recommended);

    const optimization = await runTemplateOptimizationCycle({ predictedSituations: ['incident response', 'complex reasoning'] });
    assert.ok(optimization.coverage.covered >= 1);

    const coverageForecast = await getTemplateCoverageForecast(10);
    assert.ok(Array.isArray(coverageForecast.predictedSituations));
    assert.ok(typeof coverageForecast.coverage.covered === 'number');

    const readiness = await getTemplateReadinessMatrix(10);
    assert.ok(typeof readiness.coverageRate === 'number');
    assert.ok(Array.isArray(readiness.rows));

    const maintenancePlan = await getMaintenanceOpsPlan();
    assert.ok(Array.isArray(maintenancePlan.actions) && maintenancePlan.actions.length >= 3);

    const maintenanceRun = await runMaintenanceSweep({ removeStaleFiles: false });
    assert.ok(typeof maintenanceRun.removedTempFiles === 'number');

    const hardening = await runAutonomyHardeningCycle({ removeStaleFiles: false });
    assert.ok(Array.isArray(hardening.predictedSituations));
    assert.ok(Array.isArray(hardening.digitalPresence));
    assert.ok(Array.isArray(hardening.readiness.rows));

    const digitalPresenceReport = await getDigitalPresenceReport();
    assert.ok(Array.isArray(digitalPresenceReport.configInspection));
    assert.ok(typeof digitalPresenceReport.projectionIntegrity.consistent === 'boolean');

    let embedRepoFailed = false;
    try {
        await embedRepositoryFromDisk({ rootPath: '/definitely/missing/path', projectName: 'x' });
    } catch (err) {
        embedRepoFailed = true;
    }
    assert.equal(embedRepoFailed, true);


    const determinism = await getDeterminismReport(5);
    assert.ok(determinism.latestProof === null || typeof determinism.latestProof === 'string');
    assert.ok(Array.isArray(determinism.recentTicks));


    const unified = await getUnifiedOperatingModel();
    assert.equal(unified.colab.memberships, 3);
    assert.equal(unified.vectorWorkspace.dimensions, 3);
    assert.equal(unified.serviceFabric.noFrontendBackendBoundary, true);
    assert.equal(unified.serviceFabric.orchestrationPlane.templateInjection.sourceWorkspace, '3d-vector-workspace');

    const projection = await getMonorepoProjection();
    assert.equal(projection.runtime.noFrontendBackendBoundary, true);
    assert.equal(projection.runtime.unifiedFabric, 'unified-liquid-microservice-fabric');

    const digital = await getDigitalPresenceReport();
    assert.ok(digital.digitalPresence.some(channel => channel.channel === 'unified-service-fabric'));

    const diagnostics = await getAutonomyDiagnostics();
    assert.ok(typeof diagnostics.audit.lastHash === 'string' || diagnostics.audit.lastHash === null);
    assert.ok(typeof diagnostics.queueDepth.deadLetters === 'number');
    assert.ok(typeof diagnostics.queueDepth.embeddingTasks === 'number');


    const audit = await getAuditEvents(10);
    assert.ok(audit.length >= 2);
    assert.ok(audit.every(evt => Boolean(evt.hash)));


    let musicThrew = false;
    try {
        await createAbletonSession({ user: 'dj', bpm: 500, key: 'C' });
    } catch (err) {
        musicThrew = err instanceof AutonomyValidationError;
    }
    assert.equal(musicThrew, true);

    const started = startAutonomyLoop();
    assert.equal(started, true);
    const startedAgain = startAutonomyLoop();
    assert.equal(startedAgain, false);
    const stopped = stopAutonomyLoop();
    assert.equal(stopped, true);

    console.log('autonomy-engine tests passed');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
