#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const yaml = require('js-yaml');
const { minimatch } = require('minimatch');
const {
    UnifiedEnterpriseAutonomyService,
} = require('../../src/services/unified-enterprise-autonomy');

const ROOT = path.join(__dirname, '..', '..');
const CATALOG_PATH = path.join(ROOT, 'configs', 'resources', 'vector-embedding-catalog.yaml');
const COLAB_PLAN_PATH = path.join(ROOT, 'configs', 'resources', 'colab-pro-plus-orchestration.yaml');
const REPORT_PATH = path.join(ROOT, 'data', 'embedding-bootstrap-report.json');

function readYaml(filePath) {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function getTrackedFiles() {
    const output = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

function matchesAny(filePath, patterns = []) {
    return patterns.some((pattern) => minimatch(filePath, pattern, { dot: true }));
}

function buildChunkPlan(text, chunkSize, overlap, maxChunksPerFile) {
    const chunks = [];
    const normalized = String(text || '').trim();
    if (!normalized) return chunks;

    const step = Math.max(1, chunkSize - overlap);
    for (let cursor = 0; cursor < normalized.length && chunks.length < maxChunksPerFile; cursor += step) {
        const chunk = normalized.slice(cursor, cursor + chunkSize);
        if (!chunk.trim()) continue;
        chunks.push(chunk);
    }
    return chunks;
}

function fileToEmbeddingDocs(filePath, catalog, commitSha) {
    const absolute = path.join(ROOT, filePath);
    const stat = fs.statSync(absolute);
    if (stat.size > 512_000) return [];

    const raw = fs.readFileSync(absolute, 'utf8');
    const chunks = buildChunkPlan(
        raw,
        catalog.chunking.max_chars,
        catalog.chunking.overlap_chars,
        catalog.chunking.max_chunks_per_file,
    );

    return chunks.map((content, chunkIndex) => {
        const id = crypto.createHash('sha256').update(`${commitSha}:${filePath}:${chunkIndex}`).digest('hex').slice(0, 20);
        return {
            id: `bootstrap_${id}`,
            content,
            metadata: {
                type: 'project_embedding',
                source: filePath,
                chunkIndex,
                commitSha,
                deterministic: true,
                tags: inferTags(filePath),
            },
        };
    });
}

function inferTags(filePath) {
    const tags = [];
    if (filePath.startsWith('src/bees/')) tags.push('headybees', 'swarm');
    if (filePath.includes('template')) tags.push('template');
    if (filePath.startsWith('configs/')) tags.push('governance', 'config');
    if (filePath.startsWith('docs/')) tags.push('knowledge');
    if (filePath.startsWith('tests/')) tags.push('quality');
    return tags;
}

function buildQueueAssignments(colabPlan, queuePressure = {}) {
    const queueWeights = colabPlan.scheduling?.queue_weights || {};
    const workers = colabPlan.workers || [];

    return Object.keys(queueWeights).map((queue) => {
        const ranked = workers
            .filter((worker) => (worker.queues || []).includes(queue))
            .map((worker) => {
                const pressure = Number(queuePressure[queue] || 0);
                const capacity = Number(worker.max_concurrency || 1);
                const score = (queueWeights[queue] * capacity) - pressure;
                return { workerId: worker.id, score: Number(score.toFixed(4)) };
            })
            .sort((a, b) => b.score - a.score);

        return {
            queue,
            candidates: ranked,
            selectedWorker: ranked[0]?.workerId || null,
        };
    });
}

function collectEmbeddingDocs(catalogPath = CATALOG_PATH) {
    const catalog = readYaml(catalogPath);
    const commitSha = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const tracked = getTrackedFiles();

    const scoped = tracked.filter((filePath) => matchesAny(filePath, catalog.include_patterns)
        && !matchesAny(filePath, catalog.exclude_patterns));

    const docs = scoped.flatMap((filePath) => fileToEmbeddingDocs(filePath, catalog, commitSha));
    const syntheticCollectionDocs = (catalog.collections || []).map((collection, idx) => ({
        id: `bootstrap_collection_${idx}`,
        content: `Collection ${collection.name}: ${collection.query}`,
        metadata: {
            type: 'project_embedding_collection',
            source: 'configs/resources/vector-embedding-catalog.yaml',
            commitSha,
            deterministic: true,
            collection: collection.name,
            tags: ['collection', 'determinism'],
        },
    }));

    return {
        commitSha,
        totalFiles: scoped.length,
        totalDocs: docs.length + syntheticCollectionDocs.length,
        docs: docs.concat(syntheticCollectionDocs),
    };
}

async function bootstrap({ apply = false } = {}) {
    const colabPlan = readYaml(COLAB_PLAN_PATH);
    const collection = collectEmbeddingDocs();
    const queueAssignments = buildQueueAssignments(colabPlan);
    const autonomyService = new UnifiedEnterpriseAutonomyService({
        colabPlanPath: COLAB_PLAN_PATH,
        embeddingCatalogPath: CATALOG_PATH,
    });
    const dispatchPreview = autonomyService.dispatch();

    const report = {
        generatedAt: new Date().toISOString(),
        mode: apply ? 'apply' : 'dry-run',
        commitSha: collection.commitSha,
        totalFiles: collection.totalFiles,
        totalDocs: collection.totalDocs,
        queueAssignments,
        dispatchPreview,
    };

    if (apply) {
        const vectorMemory = require('../../src/vector-memory');
        await vectorMemory.init();

        let ingested = 0;
        for (const doc of collection.docs) {
            const inserted = await vectorMemory.smartIngest({
                content: doc.content,
                metadata: doc.metadata,
            }, 0.94);
            if (inserted) ingested += 1;
        }

        report.ingestedDocs = ingested;
    }

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.stdout.write(`deterministic-embedding-bootstrap: ${report.mode} complete (${report.totalDocs} docs)\n`);

    return report;
}

if (require.main === module) {
    const apply = process.argv.includes('--apply');
    bootstrap({ apply }).catch((error) => {
        process.stderr.write(`${error.message}\n`);
        process.exit(1);
    });
}

module.exports = {
    buildChunkPlan,
    fileToEmbeddingDocs,
    collectEmbeddingDocs,
    buildQueueAssignments,
    bootstrap,
};
