#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RUNTIME_CONFIG_PATH = path.join(ROOT, 'configs', 'services', 'unified-liquid-runtime.json');
const COLAB_CONFIG_PATH = path.join(ROOT, 'configs', 'resources', 'colab-pro-plus-orchestration.yaml');
const SNAPSHOT_OUTPUT_PATH = path.join(ROOT, 'configs', 'services', 'unified-runtime-snapshot.json');

const REQUIRED_IDS = [
    'HeadyConductor',
    'HeadyCloudConductor',
    'HeadySwarm',
    'headybees',
    'template-injection-bridge',
    'ableton-live-bridge',
];

function readRuntimeConfig(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readColabWorkers(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const workerMatches = [...raw.matchAll(/- id:\s*([^\n]+)[\s\S]*?gpu_profile:\s*([^\n]+)/g)];
    return workerMatches.map((match) => ({
        id: match[1].trim(),
        gpu_profile: match[2].trim(),
    }));
}

function collectIds(runtimeConfig) {
    return [
        ...(runtimeConfig.controlPlane?.orchestrators || []).map((item) => item.id),
        ...(runtimeConfig.controlPlane?.swarm || []).map((item) => item.id),
        runtimeConfig.dataPlane?.vectorWorkspace?.id,
        runtimeConfig.dataPlane?.templateInjection?.id,
        runtimeConfig.performancePlane?.liveMusic?.id,
    ].filter(Boolean);
}

function collectEndpoints(runtimeConfig) {
    return [
        ...(runtimeConfig.controlPlane?.orchestrators || []).map((item) => item.healthEndpoint),
        ...(runtimeConfig.controlPlane?.swarm || []).map((item) => item.healthEndpoint),
        runtimeConfig.dataPlane?.vectorWorkspace?.healthEndpoint,
        runtimeConfig.dataPlane?.templateInjection?.healthEndpoint,
        runtimeConfig.performancePlane?.liveMusic?.healthEndpoint,
        runtimeConfig.projectionPlane?.healthEndpoint,
    ].filter(Boolean);
}

function validateNoFrontendBackendNaming(runtimeConfig) {
    const serialized = JSON.stringify(runtimeConfig).toLowerCase();
    return !serialized.includes('frontend') && !serialized.includes('backend');
}

function validateCloudOnlyEndpoints(endpoints) {
    return endpoints.every((endpoint) => endpoint.startsWith('https://') && !endpoint.includes('localhost'));
}

function validateRequiredIds(ids) {
    const missing = REQUIRED_IDS.filter((id) => !ids.includes(id));
    return { ok: missing.length === 0, missing };
}

function validateColabTriple(colabConfig) {
    const workers = colabConfig.workers || [];
    const hasThreeWorkers = workers.length === 3;
    const allGpuProfiles = workers.every((worker) => Boolean(worker.gpu_profile));
    return {
        ok: hasThreeWorkers && allGpuProfiles,
        workers: workers.map((worker) => ({ id: worker.id, gpuProfile: worker.gpu_profile })),
    };
}

function buildSnapshot(runtimeConfig, colabConfig) {
    const ids = collectIds(runtimeConfig);
    const endpoints = collectEndpoints(runtimeConfig);
    const requiredCheck = validateRequiredIds(ids);
    const cloudEndpointCheck = validateCloudOnlyEndpoints(endpoints);
    const namingCheck = validateNoFrontendBackendNaming(runtimeConfig);
    const colabCheck = validateColabTriple(colabConfig);

    const validation = {
        requiredServices: requiredCheck,
        cloudOnlyEndpoints: { ok: cloudEndpointCheck },
        noFrontendBackendSplit: { ok: namingCheck },
        tripleColabGpuPlan: colabCheck,
        targetServiceBand: {
            ok:
                runtimeConfig.serviceCaps.targetMicroservices >= runtimeConfig.serviceCaps.minMicroservices
                && runtimeConfig.serviceCaps.targetMicroservices <= runtimeConfig.serviceCaps.maxMicroservices,
            limits: runtimeConfig.serviceCaps,
        },
    };

    return {
        generatedAt: new Date().toISOString(),
        mode: runtimeConfig.mode,
        objective: runtimeConfig.objective,
        ids,
        endpoints,
        validation,
        allChecksPass: Object.values(validation).every((check) => check.ok),
    };
}

function run() {
    const runtimeConfig = readRuntimeConfig(RUNTIME_CONFIG_PATH);
    const colabConfig = { workers: readColabWorkers(COLAB_CONFIG_PATH) };
    const snapshot = buildSnapshot(runtimeConfig, colabConfig);

    fs.writeFileSync(SNAPSHOT_OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

    process.stdout.write(
        `unified-runtime-orchestrator: checks=${snapshot.allChecksPass ? 'pass' : 'fail'} output=${path.relative(ROOT, SNAPSHOT_OUTPUT_PATH)}\n`,
    );

    if (!snapshot.allChecksPass) {
        process.exitCode = 1;
    }

    return snapshot;
}

if (require.main === module) {
    run();
}

module.exports = {
    buildSnapshot,
    collectIds,
    collectEndpoints,
    validateCloudOnlyEndpoints,
    validateNoFrontendBackendNaming,
    validateRequiredIds,
    validateColabTriple,
    readColabWorkers,
};
