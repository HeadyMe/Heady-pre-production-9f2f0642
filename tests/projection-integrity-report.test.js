const { buildReport } = require('../scripts/ops/projection-integrity-report');

describe('projection integrity report', () => {
    test('buildReport returns shape with missing/extra arrays', () => {
        const report = buildReport();
        expect(Array.isArray(report.missing)).toBe(true);
        expect(Array.isArray(report.extra)).toBe(true);
        expect(typeof report.ok).toBe('boolean');
    });
});
