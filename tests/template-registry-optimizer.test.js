const {
    buildRegistrySnapshot,
    validateRegistry,
    evaluateScenarioCoverage,
    createProjectionState,
} = require('../src/template-registry-optimizer');

describe('template-registry-optimizer', () => {
    const templates = [
        { name: 'site-builder', zone: 0, priority: 0.85 },
        { name: 'code-processor', zone: 1, priority: 0.8 },
        { name: 'config-injector', zone: 2, priority: 0.75 },
        { name: 'api-handler', zone: 3, priority: 0.8 },
        { name: 'agent-spawner', zone: 4, priority: 0.9 },
        { name: 'pipeline-runner', zone: 5, priority: 0.85 },
        { name: 'data-transformer', zone: 6, priority: 0.75 },
        { name: 'infra-deployer', zone: 7, priority: 0.9 },
    ];

    const beeDomains = [
        { domain: 'deployment' },
        { domain: 'error-sentinel' },
        { domain: 'sync-projection' },
        { domain: 'vector-templates' },
        { domain: 'templates' },
        { domain: 'documentation' },
        { domain: 'security' },
        { domain: 'validation' },
        { domain: 'memory' },
        { domain: 'monitoring' },
        { domain: 'sites' },
        { domain: 'github' },
        { domain: 'maintenance' },
    ];

    test('validates full zone coverage successfully', () => {
        const snapshot = buildRegistrySnapshot({ templates, beeDomains });
        const result = validateRegistry(snapshot);

        expect(result.valid).toBe(true);
        expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    });

    test('returns coverage per scenario', () => {
        const snapshot = buildRegistrySnapshot({ templates, beeDomains });
        const coverage = evaluateScenarioCoverage(snapshot);

        expect(coverage.length).toBeGreaterThan(0);
        expect(coverage.every((item) => typeof item.coverageScore === 'number')).toBe(true);
        expect(coverage.some((item) => item.healthy)).toBe(true);
    });

    test('creates projection state with summary', () => {
        const snapshot = buildRegistrySnapshot({ templates, beeDomains });
        const validation = validateRegistry(snapshot);
        const coverage = evaluateScenarioCoverage(snapshot);
        const projection = createProjectionState(snapshot, coverage, validation);

        expect(projection.snapshot.templateCount).toBe(8);
        expect(projection.coverageSummary.totalScenarios).toBe(coverage.length);
        expect(projection.validation.valid).toBe(true);
    });
});
