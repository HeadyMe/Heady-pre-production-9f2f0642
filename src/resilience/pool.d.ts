/**
 * Heady Connection Pool — Bounded concurrent request management
 * Prevents thundering herds and enforces max concurrency per target.
 * Addresses registry bestPracticeScores.pooling = 0.
 */
export class ConnectionPool {
    constructor(name: any, options?: {});
    name: any;
    maxConcurrent: any;
    queueLimit: any;
    timeoutMs: any;
    active: number;
    queue: any[];
    metrics: {
        acquired: number;
        released: number;
        queued: number;
        timeouts: number;
        rejected: number;
    };
    /**
     * Execute a function within pool limits
     * @param {Function} fn - async function to run
     * @returns {Promise<any>}
     */
    execute(fn: Function): Promise<any>;
    _run(fn: any): Promise<any>;
    _drainQueue(): void;
    getStatus(): {
        name: any;
        active: number;
        queued: number;
        maxConcurrent: any;
        queueLimit: any;
        metrics: {
            acquired: number;
            released: number;
            queued: number;
            timeouts: number;
            rejected: number;
        };
        utilization: string;
    };
}
export class PoolExhaustedError extends Error {
    constructor(msg: any);
}
export class PoolTimeoutError extends Error {
    constructor(msg: any);
}
export function getPool(name: any, options: any): any;
export function getAllPoolStatus(): {};
export namespace pools {
    let cloud: ConnectionPool;
    let file: ConnectionPool;
    let ai: ConnectionPool;
    let edge: ConnectionPool;
    let database: ConnectionPool;
}
//# sourceMappingURL=pool.d.ts.map