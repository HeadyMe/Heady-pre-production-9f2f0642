const {
    UnifiedLiquidSystemService,
    buildTemplateInjectionMap,
} = require('../src/services/unified-liquid-system');
const { readRegistry, readOptimizationPolicy } = require('../src/services/headybee-template-registry');

describe('unified liquid system service', () => {
    test('buildTemplateInjectionMap generates scenario projections', () => {
        const registry = readRegistry();
        const policy = readOptimizationPolicy();
        const map = buildTemplateInjectionMap({
            registry,
            policy,
            situations: ['incident-response', 'digital-presence-launch'],
        });

        expect(map).toHaveLength(2);
        expect(map[0].templates.length).toBeGreaterThan(0);
        expect(map[0].templates[0].deterministicReceipt).toHaveLength(64);
    });

    test('service projection enforces unified service plane and cloud-first projection', () => {
        const service = new UnifiedLiquidSystemService();
        const projection = service.getProjection();

        expect(projection.paradigm.splitFrontendBackend).toBe(false);
        expect(projection.compute.colabProPlusPlans).toBe(3);
        expect(projection.compute.cloudOnlyProjection.enabled).toBe(true);
        expect(projection.templateInjection.scenarios.length).toBeGreaterThan(0);
        expect(projection.projectionHash).toHaveLength(64);
    });
});
