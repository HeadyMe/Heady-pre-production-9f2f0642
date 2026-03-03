const {
    readRegistry,
    readOptimizationPolicy,
    validateRegistry,
    scoreTemplate,
    selectTemplatesForSituation,
    buildOptimizationReport,
    getHealthStatus,
    getOptimizationState,
} = require('../src/services/headybee-template-registry');

describe('headybee template registry', () => {
    test('registry is valid and covers every predicted situation', () => {
        const registry = readRegistry();
        const validation = validateRegistry(registry);

        expect(validation.valid).toBe(true);
        expect(validation.coverage).toBe(1);
        expect(validation.errors).toHaveLength(0);
    });

    test('registry can select optimized templates for a situation', () => {
        const registry = readRegistry();
        const policy = readOptimizationPolicy();
        const templates = selectTemplatesForSituation(registry, 'incident-response', 2, policy);

        expect(templates.length).toBeGreaterThan(0);
        expect(templates[0].optimizationScore).toBeGreaterThan(0);
    });

    test('scoreTemplate returns weighted score', () => {
        const registry = readRegistry();
        const policy = readOptimizationPolicy();
        const score = scoreTemplate(registry.templates[0], policy);

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
    });

    test('optimization report and health status are generated', () => {
        const report = buildOptimizationReport();
        const health = getHealthStatus();

        expect(report.valid).toBe(true);
        expect(report.topTemplates.length).toBeGreaterThan(0);
        expect(health.endpoint).toBe('/api/headybee-template-registry/health');
    });

    test('optimization state reports source-of-truth and validation hash', () => {
        const state = getOptimizationState();

        expect(state.sourceOfTruth.provider).toBe('github');
        expect(state.validation.registryHash).toMatch(/^[a-f0-9]{64}$/);
        expect(state.validation.valid).toBe(true);
    });
});
