declare const _exports: HeadyRateLimiter;
export = _exports;
declare class HeadyRateLimiter {
    redis: any;
    checkLimit(ip: any, endpoint: any): Promise<{
        allowed: boolean;
        remaining: number;
        reason?: undefined;
        retryAfter?: undefined;
    } | {
        allowed: boolean;
        reason?: undefined;
        retryAfter?: undefined;
    } | {
        allowed: boolean;
        reason: string;
        retryAfter: any;
    }>;
    _checkLimitMemory(ip: any): {
        allowed: boolean;
        reason: string;
        retryAfter: number;
        remaining?: undefined;
    } | {
        allowed: boolean;
        remaining: number;
        reason?: undefined;
        retryAfter?: undefined;
    };
}
//# sourceMappingURL=rate-limiter.d.ts.map