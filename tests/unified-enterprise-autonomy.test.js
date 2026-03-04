const {
    UnifiedEnterpriseAutonomyService,
    rankWorkersForQueue,
    createDeterministicReceipt,
} = require('../src/services/unified-enterprise-autonomy');

describe('unified enterprise autonomy service', () => {
    test('rankWorkersForQueue ranks by weighted capacity minus pressure', () => {
        const workers = [
            { id: 'w1', role: 'gpu', tier: 'primary', queues: ['q1'], max_concurrency: 4 },
            { id: 'w2', role: 'cpu', tier: 'secondary', queues: ['q1'], max_concurrency: 2 },
        ];
        const ranked = rankWorkersForQueue('q1', 1, workers, { q1: 0.5 });

        expect(ranked).toHaveLength(2);
        expect(ranked[0].workerId).toBe('w1');
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

    test('onboarding contract includes security bridge requirements', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const onboarding = service.buildOnboardingContract();

        expect(onboarding.entrypoint.domain).toBe('https://headyme.com');
        expect(onboarding.securityBridge.filesystem_access_api).toBe('required');
        expect(onboarding.securityBridge.indexeddb_serialization).toBe('required');
        expect(onboarding.runtimeParadigm.colab_notebooks).toBe(3);
        expect(onboarding.deterministicReceipt).toHaveLength(64);
    });

    test('platform blueprint exposes deterministic onboarding stages', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const blueprint = service.buildDeveloperPlatformBlueprint();

        expect(blueprint.entrypoint.domain).toBe('https://headyme.com');
        expect(blueprint.onboarding.stageCount).toBeGreaterThan(0);
        expect(blueprint.deterministicReceipt).toHaveLength(64);
    });

    test('projection hygiene and source-of-truth metadata are exposed', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const hygiene = service.scanProjectionNoise();
        const sourceOfTruth = service.getSourceOfTruthStatus();

        expect(typeof hygiene.clean).toBe('boolean');
        expect(Array.isArray(hygiene.recommendRemoval)).toBe(true);
        expect(sourceOfTruth).toHaveProperty('branch');
        expect(sourceOfTruth).toHaveProperty('policy');
    });

    test('system projection snapshot includes developer platform blueprint', () => {
        const service = new UnifiedEnterpriseAutonomyService();
        const projection = service.buildSystemProjectionSnapshot();

        expect(projection.runtimeMode).toBe('unified-liquid-fabric');
        expect(projection.topology.paradigm).toBe('no-frontend-backend-split');
        expect(projection.orchestration.swarmRuntime).toBe('HeadySwarm');
        expect(projection.templateInjection.vectorWorkspaceCollections.length).toBeGreaterThan(0);
        expect(projection.liveMusic.enabled).toBe(true);
        expect(projection.sourceOfTruth).toHaveProperty('commit');
        expect(projection.projectionHygiene).toHaveProperty('clean');
        expect(projection.developerPlatform).toHaveProperty('onboarding');
        expect(projection).toHaveProperty('onboardingContract');
        expect(projection.deterministicReceipt).toHaveLength(64);
    });
});
