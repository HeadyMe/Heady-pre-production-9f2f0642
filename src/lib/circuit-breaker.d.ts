export class CircuitBreaker {
    constructor(opts?: {});
    failureThreshold: any;
    recoveryTimeout: any;
    halfOpenMaxCalls: any;
    state: string;
    _failures: number;
    _successes: number;
    _lastFailureTime: number;
    _halfOpenCalls: number;
    execute(fn: any): Promise<any>;
    _onSuccess(): void;
    _onFailure(): void;
    getState(): {
        state: string;
        failures: number;
        successes: number;
    };
    reset(): void;
}
export class TokenBucketRateLimiter {
    constructor(opts?: {});
    rate: any;
    burst: any;
    _buckets: Map<any, any>;
    consume(key: any, tokens?: number): {
        allowed: boolean;
        retryAfter: number;
        remaining?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        retryAfter?: undefined;
    };
    middleware(keyFn: any): (req: any, res: any, next: any) => any;
}
export namespace STATES {
    let CLOSED: string;
    let OPEN: string;
    let HALF_OPEN: string;
}
//# sourceMappingURL=circuit-breaker.d.ts.map