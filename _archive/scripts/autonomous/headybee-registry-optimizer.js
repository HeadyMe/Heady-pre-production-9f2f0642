#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
    readRegistry,
    readOptimizationPolicy,
    buildOptimizationReport,
} = require('../../src/services/headybee-template-registry');

const ROOT = path.join(__dirname, '..', '..');
const OUTPUT_PATH = path.join(ROOT, 'configs', 'services', 'headybee-optimization-report.json');

function writeReport(report) {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function runOnce() {
    const registry = readRegistry();
    const policy = readOptimizationPolicy();
    const report = buildOptimizationReport(registry, policy);
    writeReport(report);
    process.stdout.write(`headybee-registry-optimizer: analyzed ${registry.templates.length} templates\n`);
}

function main() {
    runOnce();
}

if (require.main === module) {
    main();
}

module.exports = {
    runOnce,
    writeReport,
};
