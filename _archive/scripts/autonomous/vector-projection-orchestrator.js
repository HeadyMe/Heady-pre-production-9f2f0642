#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { deterministicVector3FromText, normalizeVector3 } = require('../../backend/src/utils/vectorStore3d');

const ROOT = path.join(__dirname, '..', '..');
const REPO_CONFIG = path.join(ROOT, 'configs', 'services', 'product-repos.yaml');
const OUTPUT_PATH = path.join(ROOT, 'configs', 'services', 'public-vector-projections.json');
const DEFAULT_INTERVAL_MS = 60_000;

function readProductRepos(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = yaml.load(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.products || typeof parsed.products !== 'object') {
        throw new Error(`Expected products map in ${filePath}`);
    }

    return Object.entries(parsed.products).map(([name, config]) => ({
        name,
        url: config.repo ? `https://github.com/${config.repo}` : null,
        description: config.description || '',
        domain: config.domain || null,
        type: config.type || 'product',
        cloudLayer: config.cloud_layer || 'unknown',
    }));
}

function toSpherical([x, y, z]) {
    const radius = Math.sqrt(x * x + y * y + z * z);
    const theta = Math.atan2(y, x);
    const phi = radius === 0 ? 0 : Math.acos(z / radius);
    return { radius, theta, phi };
}

function toBarycentric([x, y, z]) {
    const sum = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
    return {
        a: Math.abs(x) / sum,
        b: Math.abs(y) / sum,
        c: Math.abs(z) / sum,
    };
}

function calculateAxisWeights(vectors) {
    if (vectors.length === 0) {
        return [1 / 3, 1 / 3, 1 / 3];
    }

    const means = [0, 0, 0];
    vectors.forEach((vector) => {
        means[0] += vector[0];
        means[1] += vector[1];
        means[2] += vector[2];
    });
    means[0] /= vectors.length;
    means[1] /= vectors.length;
    means[2] /= vectors.length;

    const variances = [0, 0, 0];
    vectors.forEach((vector) => {
        variances[0] += (vector[0] - means[0]) ** 2;
        variances[1] += (vector[1] - means[1]) ** 2;
        variances[2] += (vector[2] - means[2]) ** 2;
    });

    const varianceSum = variances[0] + variances[1] + variances[2];
    if (varianceSum === 0) {
        return [1 / 3, 1 / 3, 1 / 3];
    }

    return variances.map((value) => value / varianceSum);
}

function projectWithDynamicAxes(vector, axisWeights) {
    return normalizeVector3([
        vector[0] * axisWeights[0],
        vector[1] * axisWeights[1],
        vector[2] * axisWeights[2],
    ]);
}

function buildProjectionEntries(repos) {
    const baseVectors = repos.map((repo) => deterministicVector3FromText(`${repo.name}:${repo.url || ''}:${repo.description || ''}`));
    const axisWeights = calculateAxisWeights(baseVectors);

    const entries = repos.map((repo, idx) => {
        const source = baseVectors[idx];
        const adjusted = projectWithDynamicAxes(source, axisWeights);
        const spherical = toSpherical(adjusted);
        const barycentric = toBarycentric(adjusted);

        return {
            id: repo.name,
            type: 'public-repository',
            displayName: repo.name,
            endpoint: repo.url,
            description: repo.description || '',
            projection: {
                vector3: adjusted,
                spherical,
                barycentric,
            },
            outwardManifest: {
                githubUrl: repo.url,
                channels: ['github'],
            },
            updatedAt: new Date().toISOString(),
        };
    });

    return { entries, axisWeights };
}

function writeProjectionManifest(data) {
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function runOnce() {
    const repos = readProductRepos(REPO_CONFIG);
    const { entries, axisWeights } = buildProjectionEntries(repos);

    writeProjectionManifest({
        version: 1,
        generatedAt: new Date().toISOString(),
        mode: 'autonomous-dynamic-projection',
        source: path.relative(ROOT, REPO_CONFIG),
        axisWeights,
        entries,
    });

    process.stdout.write(`vector-projection-orchestrator: projected ${entries.length} repositories\n`);
}

function parseInterval() {
    const arg = process.argv.find((value) => value.startsWith('--interval-ms='));
    if (!arg) return DEFAULT_INTERVAL_MS;
    const value = Number(arg.split('=')[1]);
    if (!Number.isFinite(value) || value < 1000) {
        throw new Error('Invalid --interval-ms value. It must be >= 1000.');
    }
    return Math.floor(value);
}

function main() {
    const watchMode = process.argv.includes('--watch');
    runOnce();

    if (!watchMode) {
        return;
    }

    const intervalMs = parseInterval();
    process.stdout.write(`vector-projection-orchestrator: watch mode enabled (${intervalMs}ms)\n`);
    setInterval(runOnce, intervalMs);
}

if (require.main === module) {
    main();
}

module.exports = {
    readProductRepos,
    buildProjectionEntries,
    calculateAxisWeights,
    projectWithDynamicAxes,
    toBarycentric,
    toSpherical,
};
