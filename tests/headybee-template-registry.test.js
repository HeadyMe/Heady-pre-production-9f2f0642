const {
    HeadybeeTemplateRegistryService,
    templateScore,
    deterministicHash,
} = require('../src/services/headybee-template-registry');

describe('headybee template registry service', () => {
    test('templateScore rewards stronger metrics', () => {
        const low = templateScore({ metrics: { quality: 0.7, confidence: 0.7, success_rate: 0.7, usage_count: 10 } });
        const high = templateScore({ metrics: { quality: 0.95, confidence: 0.91, success_rate: 0.93, usage_count: 200 } });
        expect(high).toBeGreaterThan(low);
    });

    test('deterministicHash is stable for same input', () => {
        const a = deterministicHash({ x: 1, y: 'a' });
        const b = deterministicHash({ x: 1, y: 'a' });
        expect(a).toBe(b);
        expect(a).toHaveLength(64);
    });

    test('registry validation passes configured templates', () => {
        const service = new HeadybeeTemplateRegistryService();
        const result = service.validateRegistry();
        expect(result.ok).toBe(true);
        expect(result.violations).toHaveLength(0);
    });

    test('recommend returns top template and receipt', () => {
        const service = new HeadybeeTemplateRegistryService();
        const recommendation = service.recommend({ scenario: 'incident escalation in swarm', tags: ['incident', 'swarm'] });

        expect(recommendation.top).toBeTruthy();
        expect(recommendation.receipt).toHaveLength(64);
        expect(recommendation.ranked.length).toBeGreaterThan(0);
    });
});
