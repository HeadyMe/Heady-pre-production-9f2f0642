/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 * Pipeline Infrastructure — CircuitBreaker, WorkerPool, TaskCache.
 * Extracted from hc_pipeline.js for maintainability.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const CACHE_DIR = path.join(__dirname, "..", "..", ".heady_cache");
const TASK_CACHE_FILE = path.join(CACHE_DIR, "pipeline_task_cache.json");
const CACHE_TTL_MS = 3600000; // 1 hour
const CACHE_MAX_ENTRIES = 200;

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────────

class CircuitBreaker {
    constructor(config) {
        this.enabled = config.enabled !== false;
        this.failureThreshold = config.failureThreshold || 5;
        this.resetTimeoutMs = config.resetTimeoutMs || 30000;
        this.halfOpenMax = config.halfOpenMaxRequests || 2;
        this.state = "closed"; // closed | open | half-open
        this.failures = 0;
        this.lastFailureAt = null;
        this.halfOpenAttempts = 0;
    }

    canExecute() {
        if (!this.enabled) return true;
        if (this.state === "closed") return true;
        if (this.state === "open") {
            if (Date.now() - this.lastFailureAt >= this.resetTimeoutMs) {
                this.state = "half-open";
                this.halfOpenAttempts = 0;
                return true;
            }
            return false;
        }
        // half-open
        return this.halfOpenAttempts < this.halfOpenMax;
    }

    recordSuccess() {
        if (this.state === "half-open") {
            this.state = "closed";
            this.failures = 0;
        }
    }

    recordFailure() {
        this.failures++;
        this.lastFailureAt = Date.now();
        if (this.state === "half-open") {
            this.state = "open";
        } else if (this.failures >= this.failureThreshold) {
            this.state = "open";
        }
    }

    getStatus() {
        return { state: this.state, failures: this.failures, threshold: this.failureThreshold };
    }
}

// ─── WORKER POOL (semaphore concurrency) ────────────────────────────────────

class WorkerPool {
    constructor(concurrency) {
        this.concurrency = concurrency;
        this.running = 0;
        this.queue = [];
    }

    run(fn) {
        return new Promise((resolve, reject) => {
            const execute = () => {
                this.running++;
                fn().then(
                    (val) => { this.running--; this._drain(); resolve(val); },
                    (err) => { this.running--; this._drain(); reject(err); }
                );
            };
            if (this.running < this.concurrency) {
                execute();
            } else {
                this.queue.push(execute);
            }
        });
    }

    _drain() {
        if (this.queue.length > 0 && this.running < this.concurrency) {
            this.queue.shift()();
        }
    }

    runAll(fns) {
        return Promise.allSettled(fns.map((fn) => this.run(fn)));
    }

    getStats() {
        return { concurrency: this.concurrency, running: this.running, queued: this.queue.length };
    }
}

// ─── TASK RESULT CACHE ──────────────────────────────────────────────────────

let _taskCache = null;

function loadTaskCache() {
    if (_taskCache) return _taskCache;
    try {
        if (fs.existsSync(TASK_CACHE_FILE)) {
            _taskCache = JSON.parse(fs.readFileSync(TASK_CACHE_FILE, "utf8"));
        } else {
            _taskCache = {};
        }
    } catch (_) {
        _taskCache = {};
    }
    return _taskCache;
}

function saveTaskCache() {
    try {
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
        fs.writeFileSync(TASK_CACHE_FILE, JSON.stringify(_taskCache, null, 2), "utf8");
    } catch (_) {
        // non-fatal
    }
}

function getTaskCacheKey(taskName, configHashes) {
    const codeVersion = process.env.GITHUB_SHA || process.env.npm_package_version || 'dev';
    const input = taskName + codeVersion + JSON.stringify(configHashes || {});
    return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function getCachedResult(taskName, configHashes) {
    const cache = loadTaskCache();
    const key = getTaskCacheKey(taskName, configHashes);
    const entry = cache[key];
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
        delete cache[key];
        return null;
    }
    return entry.result;
}

function setCachedResult(taskName, configHashes, result) {
    const cache = loadTaskCache();
    const key = getTaskCacheKey(taskName, configHashes);
    cache[key] = { taskName, cachedAt: Date.now(), result };
    const keys = Object.keys(cache);
    if (keys.length > CACHE_MAX_ENTRIES) {
        const sorted = keys.sort((a, b) => (cache[a].cachedAt || 0) - (cache[b].cachedAt || 0));
        for (let i = 0; i < keys.length - CACHE_MAX_ENTRIES; i++) delete cache[sorted[i]];
    }
    saveTaskCache();
}

function invalidateCache() {
    _taskCache = {};
    saveTaskCache();
}

module.exports = {
    CircuitBreaker,
    WorkerPool,
    loadTaskCache,
    getCachedResult,
    setCachedResult,
    invalidateCache,
};
