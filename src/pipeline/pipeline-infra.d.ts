export class CircuitBreaker {
    constructor(config: any);
    enabled: boolean;
    failureThreshold: any;
    resetTimeoutMs: any;
    halfOpenMax: any;
    state: string;
    failures: number;
    lastFailureAt: number | null;
    halfOpenAttempts: number;
    canExecute(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getStatus(): {
        state: string;
        failures: number;
        threshold: any;
    };
}
export class WorkerPool {
    constructor(concurrency: any);
    concurrency: any;
    running: number;
    queue: any[];
    run(fn: any): Promise<any>;
    _drain(): void;
    runAll(fns: any): Promise<PromiseSettledResult<any>[]>;
    getStats(): {
        concurrency: any;
        running: number;
        queued: number;
    };
}
export function loadTaskCache(): any;
export function getCachedResult(taskName: any, configHashes: any): any;
export function setCachedResult(taskName: any, configHashes: any, result: any): void;
export function invalidateCache(): void;
//# sourceMappingURL=pipeline-infra.d.ts.map