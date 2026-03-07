import { CircuitBreaker } from "./circuit-breaker";
import { HeadyCache } from "./cache";
import { getCache } from "./cache";
import { getAllCacheMetrics } from "./cache";
import { caches } from "./cache";
import { ConnectionPool } from "./pool";
import { PoolExhaustedError } from "./pool";
import { PoolTimeoutError } from "./pool";
import { getPool } from "./pool";
import { getAllPoolStatus } from "./pool";
import { pools } from "./pool";
import { RateLimiter } from "./rate-limiter";
import { limiters } from "./rate-limiter";
import { retry } from "./retry";
import { DEFAULT_OPTIONS as RETRY_DEFAULTS } from "./retry";
import { phiDelay } from "./exponential-backoff";
import { withBackoff } from "./exponential-backoff";
import { createResilientFn } from "./exponential-backoff";
import { delayTable } from "./exponential-backoff";
import { PHI as PHI_RATIO } from "./exponential-backoff";
/**
 * Get full resilience status for all primitives
 * Useful for /api/resilience/status endpoint and HeadyLens telemetry
 */
export function getResilienceStatus(): {
    timestamp: string;
    circuitBreakers: any;
    caches: {};
    pools: {};
    rateLimiters: {
        [k: string]: {
            trackedClients: number;
            windowMs: any;
            maxRequests: any;
        };
    };
    summary: {
        breakersRegistered: number;
        breakersOpen: number;
        totalCacheHitRate: string;
        poolsActive: any;
        rateLimiterClients: number;
    };
};
export { CircuitBreaker, CircuitOpenError, getBreaker, getAllBreakers, CRITICAL_SERVICES, HeadyCache, getCache, getAllCacheMetrics, caches, ConnectionPool, PoolExhaustedError, PoolTimeoutError, getPool, getAllPoolStatus, pools, RateLimiter, limiters, retry, RETRY_DEFAULTS, phiDelay, withBackoff, createResilientFn, delayTable, PHI_RATIO };
//# sourceMappingURL=index.d.ts.map