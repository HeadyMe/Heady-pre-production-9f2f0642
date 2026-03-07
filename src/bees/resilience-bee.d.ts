export const domain: "resilience";
export const description: "Auto-heal, cache, circuit breaker, connection pool, rate limiter, retry, auto-tuning, hot-cold cache";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=resilience-bee.d.ts.map