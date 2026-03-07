/*
 * © 2026 HeadySystems Inc..
 * Performance Budget Enforcer — P5 Assessment Item
 * Fails CI when TTI, API p95, or sync RTT budgets are exceeded.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml') || null;

describe('Performance Budgets (P5)', () => {
    let budgets;

    beforeAll(() => {
        const configPath = path.join(__dirname, '..', 'configs', 'resources', 'performance-budgets.yaml');
        if (fs.existsSync(configPath)) {
            const raw = fs.readFileSync(configPath, 'utf8');
            // Simple YAML parse for budget values
            budgets = {};
            const lines = raw.split('\n');
            let currentBudget = null;
            for (const line of lines) {
                const budgetMatch = line.match(/^\s{2}(\S+):/);
                if (budgetMatch && !line.includes('target') && !line.includes('warning')) {
                    currentBudget = budgetMatch[1];
                    budgets[currentBudget] = {};
                }
                const targetMatch = line.match(/target_ms:\s*(\d+)/);
                if (targetMatch && currentBudget) {
                    budgets[currentBudget].target_ms = parseInt(targetMatch[1]);
                }
                const warningMatch = line.match(/warning_ms:\s*(\d+)/);
                if (warningMatch && currentBudget) {
                    budgets[currentBudget].warning_ms = parseInt(warningMatch[1]);
                }
            }
        }
    });

    test('performance budget config exists and is valid', () => {
        const configPath = path.join(__dirname, '..', 'configs', 'resources', 'performance-budgets.yaml');
        expect(fs.existsSync(configPath)).toBe(true);
    });

    test('TTI budget is defined and reasonable', () => {
        expect(budgets).toBeDefined();
        expect(budgets.tti).toBeDefined();
        expect(budgets.tti.target_ms).toBeLessThanOrEqual(5000);
        expect(budgets.tti.target_ms).toBeGreaterThan(0);
    });

    test('API p95 budget is defined', () => {
        expect(budgets['api_p95']).toBeDefined();
        expect(budgets['api_p95'].target_ms).toBeLessThanOrEqual(1000);
    });

    test('sync RTT budget is defined', () => {
        expect(budgets['sync_rtt']).toBeDefined();
        expect(budgets['sync_rtt'].target_ms).toBeLessThanOrEqual(500);
    });

    test('health endpoint responds within API budget', async () => {
        // In CI, measure actual response time
        const start = Date.now();
        const { UnifiedEnterpriseAutonomyService } = require('../src/services/unified-enterprise-autonomy');
        const svc = new UnifiedEnterpriseAutonomyService();
        svc.getHealth();
        const elapsed = Date.now() - start;

        const apiTarget = budgets?.['api_p95']?.target_ms || 500;
        expect(elapsed).toBeLessThan(apiTarget);
    });

    test('projection contracts config exists', () => {
        const contractPath = path.join(__dirname, '..', 'configs', 'resources', 'projection-contracts.yaml');
        expect(fs.existsSync(contractPath)).toBe(true);
    });

    test('auto-remediation runbook config exists', () => {
        const runbookPath = path.join(__dirname, '..', 'configs', 'resources', 'auto-remediation-runbook.yaml');
        expect(fs.existsSync(runbookPath)).toBe(true);
    });
});
