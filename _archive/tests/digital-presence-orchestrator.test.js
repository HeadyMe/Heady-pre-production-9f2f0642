const { DigitalPresenceOrchestratorService, deterministicReceipt } = require('../src/services/digital-presence-orchestrator');

describe('digital presence orchestrator', () => {
    test('deterministicReceipt stable for same payload', () => {
        const a = deterministicReceipt({ k: 'v' });
        const b = deterministicReceipt({ k: 'v' });
        expect(a).toBe(b);
        expect(a).toHaveLength(64);
    });

    test('recommendTemplateAndWorkflow returns recommendation + workflows', () => {
        const service = new DigitalPresenceOrchestratorService();
        const result = service.recommendTemplateAndWorkflow({ scenario: 'incident response and projection sync', tags: ['incident', 'sync'] });
        expect(result.recommendation.top).toBeTruthy();
        expect(Array.isArray(result.workflows)).toBe(true);
        expect(result.receipt).toHaveLength(64);
    });

    test('projection status returns deterministic coverage', () => {
        const service = new DigitalPresenceOrchestratorService();
        const status = service.getProjectionStatus();
        expect(status).toHaveProperty('coverage');
        expect(status.receipt).toHaveLength(64);
    });

    test('scenario coverage report returns deterministic scenario summary', () => {
        const service = new DigitalPresenceOrchestratorService();
        const coverage = service.evaluateTemplateCoverage();
        expect(coverage.total).toBeGreaterThan(0);
        expect(coverage.healthy).toBeGreaterThanOrEqual(0);
        expect(coverage.receipt).toHaveLength(64);
    });

    test('swarm task plan generated from coverage and dispatch', () => {
        const service = new DigitalPresenceOrchestratorService();
        const swarmPlan = service.buildSwarmTaskPlan({});
        expect(Array.isArray(swarmPlan.tasks)).toBe(true);
        expect(swarmPlan.receipt).toHaveLength(64);
    });

    test('unified system projection includes runtime, cloud execution, and deterministic receipt', () => {
        const service = new DigitalPresenceOrchestratorService();
        const projection = service.buildUnifiedSystemProjection({ scenario: 'live ableton performance' });

        expect(projection.ok).toBe(true);
        expect(projection.runtime.serviceModel).toContain('no-frontend-backend-split');
        expect(projection.cloudOnlyExecution.localResourceUsage).toBe('minimal-projection-only');
        expect(projection.receipt).toHaveLength(64);
    });

    test('maintenance plan returns stale metadata', () => {
        const service = new DigitalPresenceOrchestratorService();
        const plan = service.getMaintenancePlan([
            'cloudflare/unused-worker.js',
            'configs/infrastructure/cloud/cmd-center-cloudflared.yaml',
            'docs/readme.md',
        ]);
        expect(plan).toHaveProperty('staleCount');
        expect(plan.receipt).toHaveLength(64);
    });
});
