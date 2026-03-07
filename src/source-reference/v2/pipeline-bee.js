/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * Pipeline Bee — Decomposes hc_pipeline.js (1050 lines), hc-full-pipeline.js (515 lines),
 * pipeline-core.js, pipeline-infra.js, pipeline-pools.js, pipeline-runner.js,
 * task-dispatcher.js, task-manifest-schema.js
 */
const domain = 'pipeline';
const description = 'Full pipeline execution engine, stages, circuit breakers, task dispatch';
const priority = 0.9;

function getWork(ctx = {}) {
    return [
        async () => {
            try {
                const HCFullPipeline = require('../hc-full-pipeline');
                return { bee: domain, action: 'full-pipeline', stages: HCFullPipeline.STAGES?.length || 9 };
            } catch { return { bee: domain, action: 'full-pipeline', loaded: false }; }
        },
        async () => {
            try {
                const { CircuitBreaker, WorkerPool } = require('../pipeline/pipeline-infra');
                return { bee: domain, action: 'infra', circuitBreaker: !!CircuitBreaker, workerPool: !!WorkerPool };
            } catch { return { bee: domain, action: 'infra', loaded: false }; }
        },
        async () => {
            try {
                require('../pipeline/pipeline-core');
                return { bee: domain, action: 'pipeline-core', loaded: true };
            } catch { return { bee: domain, action: 'pipeline-core', loaded: false }; }
        },
        async () => {
            try {
                require('../pipeline/pipeline-pools');
                return { bee: domain, action: 'pipeline-pools', loaded: true };
            } catch { return { bee: domain, action: 'pipeline-pools', loaded: false }; }
        },
        async () => {
            try {
                require('../hcfp/pipeline-runner');
                return { bee: domain, action: 'hcfp-runner', loaded: true };
            } catch { return { bee: domain, action: 'hcfp-runner', loaded: false }; }
        },
        async () => {
            try {
                require('../hcfp/task-dispatcher');
                return { bee: domain, action: 'task-dispatcher', loaded: true };
            } catch { return { bee: domain, action: 'task-dispatcher', loaded: false }; }
        },
    ];
}

module.exports = { domain, description, priority, getWork };
