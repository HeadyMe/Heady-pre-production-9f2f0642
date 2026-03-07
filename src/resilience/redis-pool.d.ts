export class RedisPoolManager {
    constructor(opts?: {});
    maxConnections: any;
    minConnections: any;
    idleTimeout: any;
    url: any;
    pool: any[];
    active: number;
    waiting: any[];
    totalAcquired: number;
    totalReleased: number;
    totalCreated: number;
    acquire(): Promise<any>;
    release(conn: any): void;
    _createConnection(): Promise<{
        id: string;
        url: any;
        createdAt: number;
        get(key: any): Promise<null>;
        set(key: any, value: any, opts: any): Promise<string>;
        del(key: any): Promise<number>;
        publish(channel: any, message: any): Promise<number>;
    }>;
    getStatus(): {
        ok: boolean;
        pool: number;
        active: number;
        waiting: number;
        maxConnections: any;
        totalAcquired: number;
        totalReleased: number;
        totalCreated: number;
    };
}
export function getRedisPool(opts: any): any;
//# sourceMappingURL=redis-pool.d.ts.map