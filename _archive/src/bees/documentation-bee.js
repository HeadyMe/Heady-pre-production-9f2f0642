/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Documentation Bee — Auto-generates and validates documentation
 * across README, API docs, architecture diagrams, and changelogs.
 */
const domain = 'documentation';
const description = 'Auto-generate and validate README, API docs, architecture diagrams, changelogs, and concept documentation';
const priority = 0.5;

const fs = require('fs');
const path = require('path');

const DOC_TARGETS = [
    { name: 'README', file: 'README.md', required: true },
    { name: 'API-docs', file: 'docs/api/README.md', required: false },
    { name: 'SRE-runbook', file: 'docs/sre/README.md', required: false },
    { name: 'architecture', file: 'docs/architecture.md', required: false },
    { name: 'changelog', file: 'CHANGELOG.md', required: false },
];

function getWork(ctx = {}) {
    const rootDir = ctx.rootDir || path.resolve(__dirname, '../..');
    const work = [];

    // Check documentation freshness
    work.push(...DOC_TARGETS.map(doc => async () => {
        const fullPath = path.join(rootDir, doc.file);
        try {
            const stats = fs.statSync(fullPath);
            const content = fs.readFileSync(fullPath, 'utf8');
            const ageDays = (Date.now() - stats.mtimeMs) / 86400000;
            const wordCount = content.split(/\s+/).length;
            const hasTODOs = (content.match(/TODO|FIXME|PLACEHOLDER/gi) || []).length;
            return {
                bee: domain, action: `check-${doc.name}`,
                exists: true, ageDays: +ageDays.toFixed(1), wordCount, hasTODOs,
                stale: ageDays > 30, needsUpdate: hasTODOs > 0 || ageDays > 30,
            };
        } catch {
            return {
                bee: domain, action: `check-${doc.name}`,
                exists: false, required: doc.required, needsCreation: doc.required,
            };
        }
    }));

    // Scan for undocumented exports
    work.push(async () => {
        const beesDir = path.resolve(__dirname);
        const bees = fs.readdirSync(beesDir).filter(f => f.endsWith('.js') && f !== 'registry.js' && !f.startsWith('_'));
        const undocumented = [];
        for (const file of bees) {
            const content = fs.readFileSync(path.join(beesDir, file), 'utf8');
            if (!content.includes('/**') && !content.includes('* @')) {
                undocumented.push(file);
            }
        }
        return { bee: domain, action: 'scan-jsdoc', totalBees: bees.length, undocumented: undocumented.length, files: undocumented };
    });

    // Validate concepts-index alignment
    work.push(async () => {
        try {
            const conceptsPath = path.join(rootDir, 'configs/agent-profiles/concepts-index.yaml');
            const content = fs.readFileSync(conceptsPath, 'utf8');
            const implCount = (content.match(/status: active/g) || []).length;
            const plannedCount = (content.match(/status: planned/g) || []).length;
            return { bee: domain, action: 'concepts-audit', implemented: implCount, planned: plannedCount };
        } catch {
            return { bee: domain, action: 'concepts-audit', error: 'concepts-index.yaml not found' };
        }
    });

    return work;
}

module.exports = { domain, description, priority, getWork, DOC_TARGETS };
