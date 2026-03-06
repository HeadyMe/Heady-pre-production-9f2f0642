const {
    readPolicy,
    isOwnerInitiated,
    enforceHeadyForAntigravityOperation,
    getHealthStatus,
} = require('../src/services/antigravity-heady-runtime');

describe('antigravity heady runtime', () => {
    test('loads policy with enforced gateway/workspace settings', () => {
        const policy = readPolicy();
        expect(policy.enforce.gateway).toBe('heady');
        expect(policy.enforce.workspaceMode).toBe('3d-vector');
    });

    test('owner initiated antigravity operation is enforced through heady', () => {
        const plan = enforceHeadyForAntigravityOperation({
            initiatedBy: 'owner',
            source: 'antigravity',
            task: 'deploy',
            situation: 'autonomous-deploy',
        });

        expect(plan.enforced).toBe(true);
        expect(plan.gateway).toBe('heady');
        expect(plan.vectorWorkspace.dimensions).toBe(3);
        expect(plan.selectedTemplates.length).toBeGreaterThan(0);
    });

    test('non-owner or non-antigravity does not hard-enforce', () => {
        const plan = enforceHeadyForAntigravityOperation({
            initiatedBy: 'external-user',
            source: 'api',
            task: 'deploy',
            situation: 'autonomous-deploy',
        });

        expect(isOwnerInitiated('external-user')).toBe(false);
        expect(plan.enforced).toBe(false);
    });

    test('health status exposes api endpoint', () => {
        const health = getHealthStatus();
        expect(health.endpoint).toBe('/api/antigravity/health');
        expect(health.status).toBe('healthy');
    });
});
