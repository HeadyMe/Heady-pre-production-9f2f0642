export class RedisSyncBridge {
    constructor(config: any);
    config: any;
    prefix: any;
    ttlMs: number;
    cache: InMemoryCache;
    redisClient: object | null;
    mode: string;
    _stats: {
        hits: number;
        misses: number;
        writes: number;
        publishes: number;
    };
    /**
     * Connect to Redis if available.
     * @param {object} redisClient - A connected ioredis / node-redis client
     */
    connectRedis(redisClient: object): void;
    _key(id: any): string;
    /**
     * Push a spatial block to the cache.
     * @param {string} id - Unique item identifier
     * @param {object} data - { x, y, z, payload }
     * @param {number} [ttlMs] - Custom TTL
     */
    pushBlock(id: string, data: object, ttlMs?: number): Promise<void>;
    /**
     * Pull a spatial block from cache.
     * @param {string} id
     * @returns {object|null}
     */
    pullBlock(id: string): object | null;
    /**
     * Push multiple spatial blocks (pre-fetch batch).
     * @param {Array<{ id, data }>} blocks
     */
    pushBatch(blocks: Array<{
        id: any;
        data: any;
    }>): Promise<void>;
    /**
     * Publish a state update to all subscribers.
     * @param {string} channel
     * @param {object} message
     */
    publish(channel: string, message: object): Promise<void>;
    /**
     * Subscribe to state updates.
     */
    subscribe(channel: any, callback: any): void;
    /**
     * Remove a block.
     */
    removeBlock(id: any): Promise<void>;
    /**
     * Flush all cached spatial blocks.
     */
    flush(): Promise<void>;
    /** Cache statistics. */
    stats(): {
        hitRate: string;
        hits: number;
        misses: number;
        writes: number;
        publishes: number;
        mode: string;
        inMemorySize: number;
    };
}
export class InMemoryCache {
    constructor(ttlMs?: number);
    _store: Map<any, any>;
    _ttl: number;
    _subscribers: Map<any, any>;
    set(key: any, value: any, ttlMs: any): Promise<string>;
    get(key: any): Promise<any>;
    del(key: any): Promise<1 | 0>;
    keys(pattern: any): Promise<any[]>;
    publish(channel: any, message: any): Promise<any>;
    subscribe(channel: any, callback: any): void;
    unsubscribe(channel: any, callback: any): void;
    flush(): Promise<void>;
    get size(): number;
    prune(): void;
}
export function registerRoutes(app: any, bridgeInstance: any): any;
export function loadRedisConfig(): any;
//# sourceMappingURL=redis-sync-bridge.d.ts.map