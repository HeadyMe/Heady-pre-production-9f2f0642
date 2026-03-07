export class UpstashClient {
    constructor(url: any, token: any);
    url: any;
    token: any;
    _stats: {
        requests: number;
        errors: number;
        latencySum: number;
    };
    _exec(command: any): Promise<any>;
    pipeline(commands: any): Promise<any>;
    get(key: any): Promise<any>;
    set(key: any, value: any, opts?: {}): Promise<any>;
    del(...keys: any[]): Promise<any>;
    incr(key: any): Promise<any>;
    expire(key: any, seconds: any): Promise<any>;
    ttl(key: any): Promise<any>;
    keys(pattern: any): Promise<any>;
    hset(key: any, field: any, value: any): Promise<any>;
    hget(key: any, field: any): Promise<any>;
    hgetall(key: any): Promise<any>;
    hdel(key: any, ...fields: any[]): Promise<any>;
    lpush(key: any, ...values: any[]): Promise<any>;
    lrange(key: any, start: any, stop: any): Promise<any>;
    sadd(key: any, ...members: any[]): Promise<any>;
    smembers(key: any): Promise<any>;
    ping(): Promise<any>;
    dbsize(): Promise<any>;
    flushdb(): Promise<any>;
    getStats(): {
        requests: number;
        errors: number;
        avgLatencyMs: number;
        errorRate: string;
    };
    close(): void;
}
export class MemoryStore {
    _data: Map<any, any>;
    _expiry: Map<any, any>;
    _reaper: NodeJS.Timeout;
    get(key: any): Promise<any>;
    set(key: any, value: any, opts?: {}): Promise<string>;
    del(...keys: any[]): Promise<number>;
    incr(key: any): Promise<number>;
    expire(key: any, seconds: any): Promise<1 | 0>;
    ttl(key: any): Promise<number>;
    keys(pattern: any): Promise<any[]>;
    hset(key: any, field: any, value: any): Promise<any>;
    hget(key: any, field: any): Promise<any>;
    hgetall(key: any): Promise<any>;
    hdel(key: any, ...fields: any[]): Promise<any>;
    lpush(key: any, ...values: any[]): Promise<any>;
    lrange(key: any, start: any, stop: any): Promise<any>;
    sadd(key: any, ...members: any[]): Promise<number>;
    smembers(key: any): Promise<any[]>;
    ping(): Promise<string>;
    dbsize(): Promise<number>;
    flushdb(): Promise<string>;
    _isExpired(key: any): any;
    _prune(): void;
    _hashOp(key: any, fn: any): any;
    close(): void;
}
export function getRedisClient(): any;
export function getPoolHealth(): Promise<{
    connected: boolean;
    mode: string;
    stats: {
        requests: number;
        errors: number;
        avgLatencyMs: number;
        errorRate: string;
    } | {
        entries: any;
    };
    ts: string;
    error?: undefined;
} | {
    connected: boolean;
    mode: string;
    error: any;
    ts: string;
    stats?: undefined;
}>;
export function redisRoutes(app: any): void;
export const isConfigured: boolean;
//# sourceMappingURL=upstash-redis.d.ts.map