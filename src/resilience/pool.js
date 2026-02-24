/**
 * Heady Connection Pool — Bounded concurrent request management
 * Prevents thundering herds and enforces max concurrency per target.
 * Addresses registry bestPracticeScores.pooling = 0.
 */

class ConnectionPool {
    constructor(name, options = {}) {
        this.name = name;
        this.maxConcurrent = options.maxConcurrent || 10;
        this.queueLimit = options.queueLimit || 50;
        this.timeoutMs = options.timeoutMs || 30000;

        this.active = 0;
        this.queue = [];
        this.metrics = { acquired: 0, released: 0, queued: 0, timeouts: 0, rejected: 0 };
    }

    /**
     * Execute a function within pool limits
     * @param {Function} fn - async function to run
     * @returns {Promise<any>}
     */
    async execute(fn) {
        if (this.active < this.maxConcurrent) {
            return this._run(fn);
        }

        if (this.queue.length >= this.queueLimit) {
            this.metrics.rejected++;
            throw new PoolExhaustedError(`Pool "${this.name}" exhausted: ${this.active} active, ${this.queue.length} queued`);
        }

        // Queue the request
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const idx = this.queue.findIndex(q => q.timer === timer);
                if (idx !== -1) this.queue.splice(idx, 1);
                this.metrics.timeouts++;
                reject(new PoolTimeoutError(`Pool "${this.name}" queue timeout after ${this.timeoutMs}ms`));
            }, this.timeoutMs);

            this.queue.push({ fn, resolve, reject, timer });
            this.metrics.queued++;
        });
    }

    async _run(fn) {
        this.active++;
        this.metrics.acquired++;
        try {
            return await fn();
        } finally {
            this.active--;
            this.metrics.released++;
            this._drainQueue();
        }
    }

    _drainQueue() {
        if (this.queue.length > 0 && this.active < this.maxConcurrent) {
            const next = this.queue.shift();
            clearTimeout(next.timer);
            this._run(next.fn).then(next.resolve).catch(next.reject);
        }
    }

    getStatus() {
        return {
            name: this.name,
            active: this.active,
            queued: this.queue.length,
            maxConcurrent: this.maxConcurrent,
            queueLimit: this.queueLimit,
            metrics: { ...this.metrics },
            utilization: this.maxConcurrent > 0
                ? (this.active / this.maxConcurrent * 100).toFixed(1) + '%'
                : '0%',
        };
    }
}

class PoolExhaustedError extends Error {
    constructor(msg) { super(msg); this.name = 'PoolExhaustedError'; }
}

class PoolTimeoutError extends Error {
    constructor(msg) { super(msg); this.name = 'PoolTimeoutError'; }
}

// ─── Named Pool Instances ──────────────────────────────────────────
// As recommended by registry: cloud-requests, file-operations
const pools = {
    cloud: new ConnectionPool('cloud', { maxConcurrent: 8, queueLimit: 30, timeoutMs: 30000 }),
    file: new ConnectionPool('file', { maxConcurrent: 20, queueLimit: 100, timeoutMs: 10000 }),
    ai: new ConnectionPool('ai', { maxConcurrent: 6, queueLimit: 20, timeoutMs: 60000 }),      // AI calls are slow
    edge: new ConnectionPool('edge', { maxConcurrent: 15, queueLimit: 50, timeoutMs: 5000 }),
    database: new ConnectionPool('database', { maxConcurrent: 10, queueLimit: 40, timeoutMs: 15000 }),
};

function getPool(name, options) {
    if (!pools[name]) {
        pools[name] = new ConnectionPool(name, options);
    }
    return pools[name];
}

function getAllPoolStatus() {
    const result = {};
    for (const [name, pool] of Object.entries(pools)) {
        result[name] = pool.getStatus();
    }
    return result;
}

module.exports = { ConnectionPool, PoolExhaustedError, PoolTimeoutError, getPool, getAllPoolStatus, pools };
