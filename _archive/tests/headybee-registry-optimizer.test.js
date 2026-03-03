const fs = require('fs');
const path = require('path');
const { runOnce } = require('../scripts/autonomous/headybee-registry-optimizer');

describe('headybee registry optimizer', () => {
    test('runOnce writes optimization report', () => {
        runOnce();
        const reportPath = path.join(__dirname, '..', 'configs', 'services', 'headybee-optimization-report.json');
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

        expect(report.valid).toBe(true);
        expect(report.topTemplates.length).toBeGreaterThan(0);
        expect(report.registryHash).toMatch(/^[a-f0-9]{64}$/);
    });
});
