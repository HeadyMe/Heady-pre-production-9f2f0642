const {
    UnifiedEnterpriseAutonomyService,
    rankWorkersForQueue,
    createDeterministicReceipt,
    calculateUnifiedHealthSignals,
} = require('../src/services/unified-enterprise-autonomy');

describe('unified enterprise autonomy service', () => {
    test('rankWorkersForQueue prioritizes score by queue weight and concurrency', () => {
        const ranked = rankWorkersForQueue('q1', 0.9, [
            { id: 'a', role: 'r1', tier: 'primary', max_concurrency: 2, queues: ['q1'] },
            { id: 'b', role: 'r2', tier: 'secondary', max_concurrency: 5, queues: ['q1'] },
        ], { q1: 0.1 });

        expect(ranked[0].workerId).toBe('b');
        expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    });

    test('createDeterministicReceipt is stable for same payload', () => {
        const one = createDeterministicReceipt({ a: 1, b: 'x' });
        const two = createDeterministicReceipt({ a: 1, b: 'x' });
        expect(one).toBe(two);
    });

    test('service dispatch returns deterministic receipts and selected workers', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const dispatch = service.dispatch({ 'user-interaction': 0.01 });

        expect(dispatch.assignments.length).toBeGreaterThan(0);
        expect(dispatch.assignments[0].deterministicReceipt).toHaveLength(64);
        expect(dispatch.assignments.every((assignment) => assignment.selectedWorker)).toBe(true);
    });

    test('embedding plan includes deterministic receipts for collections', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const plan = service.buildEmbeddingPlan();

        expect(plan.collections.length).toBeGreaterThan(0);
        expect(plan.collections.every((entry) => entry.deterministicReceipt.length === 64)).toBe(true);
    });

    test('health signals enforce unified liquid architecture constraints', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const signals = calculateUnifiedHealthSignals(service.colabPlan);

        expect(Object.values(signals).every(Boolean)).toBe(true);
    });

    test('profile exposes projection and ableton live integration intent', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const profile = service.getUnifiedSystemProfile();

        expect(profile.paradigm).toBe('liquid-unified-microservice-fabric');
        expect(profile.explicitFrontendBackendSplit).toBe(false);
        expect(profile.templateInjection.sourceWorkspace).toBe('3d-vector-workspace');
        expect(profile.cloudProjection.cloudOnlyDelivery).toBe(true);
        expect(profile.abletonLive.realtimeMode).toBe(true);
    });

    test('live unified status reports full health score when constraints pass', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const status = service.getLiveUnifiedStatus();

        expect(status.ok).toBe(true);
        expect(status.healthScore).toBe(1);
        expect(status.checks.length).toBeGreaterThan(0);
    });


    test('template injection plan maps vector workspace feeds into HeadyBee/Swarm routes', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const plan = service.buildTemplateInjectionPlan();

        expect(plan.ok).toBe(true);
        expect(plan.workspace).toBe('3d-vector-memory');
        expect(plan.vectorWorkspaceFeeds.length).toBeGreaterThan(0);
        expect(plan.templateInjectionRoutes.length).toBeGreaterThan(0);
        expect(plan.templateInjectionRoutes.every((route) => route.deterministicReceipt.length === 64)).toBe(true);
    });

    test('runtime projection includes cloud-only colab fabric and conductor orchestration', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const projection = service.buildUnifiedRuntimeProjection();

        expect(projection.ok).toBe(true);
        expect(projection.cloudProjectionMode.cloudOnlyProjection).toBe(true);
        expect(projection.orchestration.conductor).toBe('HeadyConductor');
        expect(projection.orchestration.cloudConductor).toBe('HeadyCloudConductor');
        expect(projection.gpuFabric.provider).toBe('colab-pro-plus');
        expect(projection.gpuFabric.subscriptionCount).toBe(3);
        expect(projection.musicRealtimeMode.target).toBe('ableton-live');
    });

    test('unified topology loads component graph and enforces paradigm constraints', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const topology = service.buildUnifiedTopology();

        expect(topology.profile).toBe('heady-unified-autonomy');
        expect(topology.paradigm.architecture_model).toBe('liquid-unified-microservices');
        expect(topology.paradigm.frontend_backend_split).toBe(false);
        expect(topology.paradigm.cloud_only_execution).toBe(true);
        expect(topology.paradigm.monorepo_source_of_truth).toBe(true);
        expect(topology.components.length).toBeGreaterThan(0);
        expect(topology.dependencies.length).toBeGreaterThan(0);
        expect(topology.deterministicReceipt).toHaveLength(64);
    });

    test('cloud projection plan enumerates colab workers with target utilizations', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const cloud = service.buildCloudProjectionPlan();

        expect(cloud.cloudOnlyExecution).toBe(true);
        expect(cloud.workers.length).toBeGreaterThan(0);
        expect(cloud.projectionHealthy).toBe(true);
        expect(cloud.deterministicReceipt).toHaveLength(64);
    });

    test('readiness report returns ok when all required components report healthy', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const readiness = service.buildReadinessReport();

        expect(readiness.profile).toBe('heady-unified-autonomy');
        expect(readiness.componentReadiness.length).toBeGreaterThan(0);
        expect(readiness.templateInjection.status).toBe('ready');
        expect(readiness.liquidUnifiedArchitecture.status).toBe('unified');
        expect(readiness.systemicComplexity.status).toBe('acceptable');
        expect(readiness.deterministicReceipt).toHaveLength(64);
    });

    test('system projection composes topology, dispatch, readiness, and embedding plan', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const projection = service.buildSystemProjection();

        expect(projection.architectureModel).toBe('liquid-unified-microservices');
        expect(projection.cloudOnlyExecution).toBe(true);
        expect(projection.monorepoSourceOfTruth).toBe(true);
        expect(projection.dynamicOutputTargets.length).toBeGreaterThan(0);
        expect(projection.activeQueues.length).toBeGreaterThan(0);
        expect(projection.deterministicReceipt).toHaveLength(64);
    });

    test('repository integrity scan runs without errors', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const integrity = service.scanRepositoryIntegrity();

        expect(integrity.monorepoSourceOfTruth).toBe(true);
        expect(integrity.deterministicReceipt).toHaveLength(64);
        expect(Array.isArray(integrity.violations)).toBe(true);
    });
});
