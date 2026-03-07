export class CircuitBreaker {
    constructor(name: any, opts?: {});
    name: any;
    state: string;
    failureThreshold: any;
    successThreshold: any;
    timeout: any;
    failureCount: number;
    successCount: number;
    lastFailureTime: number | null;
    totalCalls: number;
    totalFailures: number;
    totalSuccesses: number;
    exec(fn: any): Promise<any>;
    _onSuccess(): void;
    _onFailure(): void;
    getStatus(): {
        name: any;
        state: string;
        failureCount: number;
        successCount: number;
        totalCalls: number;
        totalFailures: number;
        totalSuccesses: number;
        lastFailure: string | null;
    };
    reset(): void;
}
export class Bulkhead {
    constructor(name: any, maxConcurrent?: number);
    name: any;
    maxConcurrent: number;
    active: number;
    rejected: number;
    exec(fn: any): Promise<any>;
    getStatus(): {
        name: any;
        active: number;
        max: number;
        rejected: number;
    };
}
export function getCircuitBreaker(name: any, opts: any): any;
export function getAllBreakerStatus(): any[];
export namespace STATES {
    let CLOSED: string;
    let OPEN: string;
    let HALF_OPEN: string;
}
//# sourceMappingURL=circuit-breaker.d.ts.map