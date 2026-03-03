/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
const path = require('path');
const { execSync } = require('child_process');
const logger = require('./utils/logger');

function loadScenarios() {
    const scenariosPath = path.join(__dirname, 'config', 'headybee-template-scenarios.json');
    delete require.cache[require.resolve(scenariosPath)];
    return require(scenariosPath);
}

function buildRegistrySnapshot({ templates = [], beeDomains = [] } = {}) {
    const uniqueTemplateNames = new Set(templates.map((t) => t.name));
    const uniqueBeeDomains = new Set(beeDomains.map((b) => b.domain));
    const zones = new Set(templates.map((t) => t.zone));

    return {
        generatedAt: Date.now(),
        templates,
        beeDomains,
        stats: {
            templateCount: uniqueTemplateNames.size,
            beeDomainCount: uniqueBeeDomains.size,
            coveredZones: Array.from(zones).sort((a, b) => a - b),
        },
    };
}

function validateRegistry(snapshot) {
    const issues = [];
    const templateNames = snapshot.templates.map((t) => t.name);
    const duplicateTemplates = templateNames.filter((name, idx) => templateNames.indexOf(name) !== idx);

    if (duplicateTemplates.length > 0) {
        issues.push({
            code: 'duplicate-template',
            detail: `Duplicate templates detected: ${Array.from(new Set(duplicateTemplates)).join(', ')}`,
            severity: 'error',
        });
    }

    const expectedZones = [...Array(8).keys()];
    const missingZones = expectedZones.filter((zone) => !snapshot.stats.coveredZones.includes(zone));
    if (missingZones.length > 0) {
        issues.push({
            code: 'missing-zone-coverage',
            detail: `Missing zone coverage for: ${missingZones.join(', ')}`,
            severity: 'error',
        });
    }

    const lowPriority = snapshot.templates.filter((t) => typeof t.priority === 'number' && t.priority < 0.7);
    if (lowPriority.length > 0) {
        issues.push({
            code: 'low-priority-templates',
            detail: `Templates below optimization threshold: ${lowPriority.map((t) => t.name).join(', ')}`,
            severity: 'warn',
        });
    }

    return {
        valid: issues.filter((i) => i.severity === 'error').length === 0,
        issues,
    };
}

function evaluateScenarioCoverage(snapshot, scenarios = loadScenarios()) {
    return scenarios.map((scenario) => {
        const availableTemplates = new Set(snapshot.templates.map((t) => t.name));
        const availableDomains = new Set(snapshot.beeDomains.map((b) => b.domain));

        const missingTemplates = scenario.requiredTemplates.filter((name) => !availableTemplates.has(name));
        const missingBeeDomains = scenario.requiredBeeDomains.filter((name) => !availableDomains.has(name));

        const totalRequirements = scenario.requiredTemplates.length + scenario.requiredBeeDomains.length;
        const missingRequirements = missingTemplates.length + missingBeeDomains.length;
        const coverageScore = Number((((totalRequirements - missingRequirements) / totalRequirements) * 100).toFixed(2));

        return {
            id: scenario.id,
            priority: scenario.priority,
            description: scenario.description,
            coverageScore,
            healthy: missingRequirements === 0,
            missingTemplates,
            missingBeeDomains,
        };
    });
}

function createProjectionState(snapshot, coverage, validation) {
    let gitBranch = 'unknown';
    let gitCommit = 'unknown';

    try {
        gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim() || 'detached';
        gitCommit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
        logger.logError('TemplateRegistryOptimizer', 'git-source-of-truth-resolution-failed', error);
    }

    const averageCoverage = coverage.length
        ? Number((coverage.reduce((acc, item) => acc + item.coverageScore, 0) / coverage.length).toFixed(2))
        : 0;

    return {
        generatedAt: Date.now(),
        sourceOfTruth: {
            gitBranch,
            gitCommit,
        },
        snapshot: snapshot.stats,
        validation,
        coverageSummary: {
            averageCoverage,
            fullyReadyScenarios: coverage.filter((s) => s.healthy).length,
            totalScenarios: coverage.length,
        },
        scenarios: coverage,
    };
}

module.exports = {
    loadScenarios,
    buildRegistrySnapshot,
    validateRegistry,
    evaluateScenarioCoverage,
    createProjectionState,
};
