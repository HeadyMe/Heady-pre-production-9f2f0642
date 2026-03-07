const fs = require('fs');
const path = require('path');
const { PhiDecay } = require('../core/phi-scales');
const logger = require('../utils/logger').child({ component: 'regression-detector' });

class RegressionDetector {
    constructor() {
        this.baselinePath = path.join(process.cwd(), 'tests', '.regression-baseline.json');
        this.decay = new PhiDecay(1.0, 0.1);
    }

    loadBaseline() {
        if (fs.existsSync(this.baselinePath)) {
            return JSON.parse(fs.readFileSync(this.baselinePath, 'utf-8'));
        }
        return { tests: {}, timestamp: 0 };
    }

    saveBaseline(results) {
        fs.writeFileSync(this.baselinePath, JSON.stringify({
            tests: results,
            timestamp: Date.now()
        }, null, 2));
    }

    detectRegressions(current, baseline) {
        const regressions = [];
        const improvements = [];

        for (const [testName, currentResult] of Object.entries(current)) {
            const baselineResult = baseline.tests[testName];

            if (!baselineResult) {
                // New test
                continue;
            }

            if (baselineResult === 'pass' && currentResult === 'fail') {
                regressions.push({ test: testName, was: 'pass', now: 'fail' });
            } else if (baselineResult === 'fail' && currentResult === 'pass') {
                improvements.push({ test: testName, was: 'fail', now: 'pass' });
            }
        }

        return { regressions, improvements, hasRegressions: regressions.length > 0 };
    }

    generateReport(detection) {
        logger.info('Regression detection complete', {
            regressions: detection.regressions.length,
            improvements: detection.improvements.length
        });

        return detection;
    }
}

module.exports = RegressionDetector;
