#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');
const PRODUCT_REPOS_PATH = path.join(ROOT, 'configs', 'services', 'product-repos.yaml');
const PROJECTION_PATH = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'projection-integrity-report.json');

function readYaml(filePath) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function loadProjection() {
    if (!fs.existsSync(PROJECTION_PATH)) {
        return { entries: [], generatedAt: null };
    }
    return JSON.parse(fs.readFileSync(PROJECTION_PATH, 'utf8'));
}

function buildReport() {
    const repos = readYaml(PRODUCT_REPOS_PATH).products || {};
    const projection = loadProjection();
    const projectedIds = new Set((projection.entries || []).map((entry) => entry.id));

    const missing = Object.keys(repos).filter((id) => !projectedIds.has(id));
    const extra = Array.from(projectedIds).filter((id) => !repos[id]);

    return {
        generatedAt: new Date().toISOString(),
        projectionGeneratedAt: projection.generatedAt || null,
        totalRepos: Object.keys(repos).length,
        totalProjected: projectedIds.size,
        missing,
        extra,
        ok: missing.length === 0,
    };
}

function run() {
    const report = buildReport();
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`projection-integrity-report: ok=${report.ok} missing=${report.missing.length} extra=${report.extra.length}\n`);
}

if (require.main === module) {
    run();
}

module.exports = { buildReport };
