export class RedisConnectionPool {
    constructor(config?: {});
    config: {
        host: string;
        port: number;
        password: string | undefined;
        db: number;
        maxConnections: number;
        minConnections: number;
        acquireTimeoutMs: number;
        idleTimeoutMs: number;
        retryDelayMs: number;
        maxRetries: number;
    };
    pool: any[];
    inUse: Set<any>;
    waitQueue: any[];
    stats: {
        totalAcquired: number;
        totalReleased: number;
        totalCreated: number;
        totalDestroyed: number;
        totalTimeouts: number;
        peakConnections: number;
        avgAcquireTimeMs: number;
        _acquireTimes: never[];
    };
    _maintenanceTimer: NodeJS.Timeout | null;
    _initialized: boolean;
    initialize(): Promise<void>;
    acquire(): Promise<any>;
    release(conn: any): void;
    withConnection(fn: any): Promise<any>;
    _createConnection(): Promise<any>;
    _isAlive(conn: any): any;
    _destroyConnection(conn: any): void;
    _recordAcquire(startTime: any): void;
    _runMaintenance(): void;
    getHealth(): {
        pool: {
            idle: number;
            inUse: number;
            waiting: number;
            max: number;
        };
        stats: {
            totalAcquired: number;
            totalReleased: number;
            totalCreated: number;
            totalDestroyed: number;
            totalTimeouts: number;
            peakConnections: number;
            avgAcquireTimeMs: number;
        };
    };
    shutdown(): Promise<void>;
}
export function getPool(config: any): any;
//# sourceMappingURL=redis-connection-pool.d.ts.map