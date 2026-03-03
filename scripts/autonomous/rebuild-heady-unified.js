#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function readFile(p) {
    return fs.readFileSync(path.join(ROOT, p), 'utf8');
}

function readJson(p) {
    return JSON.parse(readFile(p));
}

function parseServiceCatalog() {
    const raw = readFile('configs/services/service-catalog.yaml').split(/\r?\n/);
    const services = [];
    let inServices = false;
    let current = null;

    for (const line of raw) {
        if (/^services:\s*$/.test(line)) {
            inServices = true;
            continue;
        }
        if (/^agents:\s*$/.test(line)) {
            if (current) services.push(current);
            break;
        }
        if (!inServices) continue;

        const mStart = line.match(/^\s*-\s+name:\s+(.+)$/);
        if (mStart) {
            if (current) services.push(current);
            current = { name: mStart[1].trim() };
            continue;
        }

        const mEndpoint = line.match(/^\s+endpoint:\s+(.+)$/);
        if (mEndpoint && current) current.endpoint = mEndpoint[1].trim();

        const mCrit = line.match(/^\s+criticality:\s+(.+)$/);
        if (mCrit && current) current.criticality = mCrit[1].trim();
    }

    return services;
}

function parseColabPlan() {
    const raw = readFile('configs/resources/colab-pro-plus-orchestration.yaml').split(/\r?\n/);
    const workers = [];
    let seed = null;
    let inWorkers = false;
    let current = null;
    let inQueues = false;

    for (const line of raw) {
        const t = line.trim();
        if (t === 'workers:') {
            inWorkers = true;
            continue;
        }
        if (t === 'determinism:') {
            inWorkers = false;
            if (current) workers.push(current);
            current = null;
            continue;
        }
        const mSeed = t.match(/^seed_source:\s+(.+)$/);
        if (mSeed) {
            seed = mSeed[1].trim();
            continue;
        }
        if (!inWorkers) continue;

        const mStart = line.match(/^\s*-\s+id:\s+(.+)$/);
        if (mStart) {
            if (current) workers.push(current);
            current = { id: mStart[1].trim(), queues: [] };
            inQueues = false;
            continue;
        }
        if (!current) continue;

        const mRole = line.match(/^\s+role:\s+(.+)$/);
        if (mRole) current.role = mRole[1].trim();

        const mGpu = line.match(/^\s+gpu_profile:\s+(.+)$/);
        if (mGpu) current.gpu_profile = mGpu[1].trim();

        const mConc = line.match(/^\s+max_concurrency:\s+(\d+)$/);
        if (mConc) current.max_concurrency = Number(mConc[1]);

        if (/^\s+queues:\s*$/.test(line)) {
            inQueues = true;
            continue;
        }
        const mQueue = line.match(/^\s+-\s+(.+)$/);
        if (inQueues && mQueue) {
            current.queues.push(mQueue[1].trim());
            continue;
        }
        if (inQueues && /^\s+[a-z_]+:\s+/.test(line)) {
            inQueues = false;
        }
    }
    if (current) workers.push(current);

    return { workers, seed };
}

function cloudViolations(endpoints) {
    return endpoints.filter((e) => /localhost|127\.0\.0\.1/i.test(String(e || '')));
}

function main() {
    const services = parseServiceCatalog();
    const colab = parseColabPlan();
    const templates = readJson('configs/services/headybee-template-registry.json');
    const projections = readJson('configs/services/public-vector-projections.json');
    const scenariosRaw = readJson('src/config/headybee-template-scenarios.json');
    const scenarios = Array.isArray(scenariosRaw)
        ? scenariosRaw
        : (scenariosRaw.scenarios || []);

    const endpoints = [
        ...services.map((s) => s.endpoint),
        ...(projections.entries || []).map((e) => e.endpoint),
    ];

    const violations = cloudViolations(endpoints);
    const abletonReady = fs.existsSync(path.join(ROOT, 'ableton-remote-script/HeadyBuddy/HeadyBuddyScript.py'));

    const report = {
        generatedAt: new Date().toISOString(),
        architecture: {
            model: 'liquid-unified-microservice-fabric',
            frontendBackendSplit: false,
            services: services.length,
            criticalServices: services.filter((s) => s.criticality === 'critical').length,
        },
        orchestration: {
            conductor: 'HeadyConductor',
            cloudConductor: 'HeadyCloudConductor',
            swarmTasks: (templates.templates || []).reduce((a, t) => a + (t.headyswarmTasks || []).length, 0),
            beeDomains: [...new Set((templates.templates || []).flatMap((t) => t.bees || []))].length,
        },
        vectorWorkspace: {
            projectionCount: (projections.entries || []).length,
            templateCount: (templates.templates || []).length,
            syncProjectionScenarios: scenarios.filter((s) => {
                const domains = s.requiredBeeDomains || s.requiredServices || [];
                return domains.includes('sync-projection');
            }).length,
            cloudOnlyEndpoints: violations.length === 0,
            cloudViolations: violations,
        },
        realtime: {
            abletonRemoteScriptReady: abletonReady,
            midiBridgeTemplatePresent: (templates.templates || []).some((t) => t.id === 'hb-midi-creative-bridge-v1'),
        },
        colab: {
            workerCount: colab.workers.length,
            seedSource: colab.seed,
            totalMaxConcurrency: colab.workers.reduce((a, w) => a + (w.max_concurrency || 0), 0),
            workers: colab.workers,
        },
        ready: violations.length === 0 && abletonReady,
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exit(report.ready ? 0 : 1);
}

main();
