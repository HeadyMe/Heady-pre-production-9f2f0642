/**
 * E13: Worker Pool for CPU-bound tasks (embedding generation)
 * Uses worker_threads for parallel processing
 * @module src/lib/worker-pool
 */
'use strict';

const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');

const POOL_SIZE = parseInt(process.env.WORKER_POOL_SIZE || String(Math.max(2, os.cpus().length - 1)), 10);

class WorkerPool {
    constructor(opts = {}) {
        this.size = opts.size || POOL_SIZE;
        this.workers = [];
        this.queue = [];
        this.activeJobs = 0;
    }

    async execute(taskFn, data) {
        return new Promise((resolve, reject) => {
            const job = { taskFn: taskFn.toString(), data, resolve, reject };
            if (this.activeJobs < this.size) {
                this._runJob(job);
            } else {
                this.queue.push(job);
            }
        });
    }

    _runJob(job) {
        this.activeJobs++;
        const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      const fn = eval('(' + workerData.taskFn + ')');
      Promise.resolve(fn(workerData.data))
        .then(result => parentPort.postMessage({ result }))
        .catch(err => parentPort.postMessage({ error: err.message }));
    `;

        const worker = new Worker(workerCode, {
            eval: true,
            workerData: { taskFn: job.taskFn, data: job.data },
        });

        worker.on('message', (msg) => {
            this.activeJobs--;
            if (msg.error) job.reject(new Error(msg.error));
            else job.resolve(msg.result);
            worker.terminate();
            this._processQueue();
        });

        worker.on('error', (err) => {
            this.activeJobs--;
            job.reject(err);
            this._processQueue();
        });

        this.workers.push(worker);
    }

    _processQueue() {
        if (this.queue.length > 0 && this.activeJobs < this.size) {
            this._runJob(this.queue.shift());
        }
    }

    getStats() {
        return { poolSize: this.size, active: this.activeJobs, queued: this.queue.length };
    }

    async terminate() {
        await Promise.all(this.workers.map(w => w.terminate()));
        this.workers = [];
    }
}

// Batch embedding processor
async function batchEmbed(texts, embedFn, opts = {}) {
    const batchSize = opts.batchSize || 100;
    const pool = new WorkerPool({ size: opts.concurrency || 4 });
    const results = [];

    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        results.push(pool.execute(embedFn, batch));
    }

    const embeddings = await Promise.all(results);
    await pool.terminate();
    return embeddings.flat();
}

module.exports = { WorkerPool, batchEmbed };
