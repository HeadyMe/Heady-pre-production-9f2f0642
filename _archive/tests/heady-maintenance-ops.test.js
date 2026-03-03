const {
    readPolicy,
    findRuntimeFileViolations,
    findForbiddenContentReferences,
    runMaintenance,
} = require('../scripts/maintenance/heady-maintenance-ops');

describe('heady maintenance ops', () => {
    test('policy can be loaded', () => {
        const policy = readPolicy();
        expect(policy.version).toBe(1);
        expect(policy.forbiddenRuntimePatterns.length).toBeGreaterThan(0);
    });

    test('runtime file violations detect tracked runtime artifacts', () => {
        const violations = findRuntimeFileViolations([
            'logs/app.log',
            'runtime/server.pid',
            'src/index.js',
        ], [/\.log$/i, /server\.pid$/i]);

        expect(violations).toEqual(expect.arrayContaining(['logs/app.log', 'runtime/server.pid']));
    });

    test('maintenance run returns report structure', () => {
        const report = runMaintenance({ apply: false });
        expect(report).toHaveProperty('checkedAt');
        expect(report).toHaveProperty('runtimeTrackedCount');
        expect(report).toHaveProperty('suspectDefinitionCount');
    });

    test('forbidden content reference scan returns path and matched patterns', () => {
        const suspects = findForbiddenContentReferences(['public/verticals/headyme.html'], [/serviceWorker\.register/i]);
        expect(Array.isArray(suspects)).toBe(true);
        if (suspects.length > 0) {
            expect(suspects[0]).toHaveProperty('file');
            expect(suspects[0]).toHaveProperty('matchedPatterns');
        }
    });
});
