/**
 * Heady Auto-Tuning Concurrency — Adaptive Pool Sizing
 * Dynamically adjusts concurrency limits based on throughput,
 * latency, and error rates. Uses AIMD (Additive Increase,
 * Multiplicative Decrease) algorithm.
 */
export class AutoTuningPool {
    constructor(name: any, options?: {});
    name: any;
    minConcurrency: any;
    maxConcurrency: any;
    concurrency: any;
    active: number;
    queue: any[];
    increaseStep: any;
    decreaseFactor: any;
    tuneIntervalMs: any;
    latencyTargetMs: any;
    _window: any[];
    _windowSizeMs: number;
    _tuner: NodeJS.Timeout;
    totalProcessed: number;
    totalErrors: number;
    execute(fn: any): Promise<any>;
    _record(latencyMs: any, isError: any): void;
    _tune(): void;
    getStatus(): {
        name: any;
        concurrency: any;
        active: number;
        queued: number;
        avgLatencyMs: number;
        errorRate: string;
        totalProcessed: number;
        totalErrors: number;
        bounds: {
            min: any;
            max: any;
        };
    };
    destroy(): void;
}
export function getPool(name: any, options: any): any;
export function getAllPoolStatus(): {};
//# sourceMappingURL=auto-tuning-pool.d.ts.map