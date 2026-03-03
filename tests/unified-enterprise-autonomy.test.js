const {
    UnifiedEnterpriseAutonomyService,
    rankWorkersForQueue,
    createDeterministicReceipt,
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
});
