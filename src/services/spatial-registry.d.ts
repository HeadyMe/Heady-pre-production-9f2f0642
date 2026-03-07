export class SpatialRegistry {
    vectorMemory: typeof import("../vector-memory") | null;
    vectorSpaceOps: any;
    octreeManager: typeof import("../services/octree-manager") | null;
    spatialEmbedder: typeof import("../services/spatial-embedder") | null;
    redisSyncBridge: import("../services/redis-sync-bridge").RedisSyncBridge | null;
    vectorFederation: any;
    vectorPipeline: any;
    edgeContextCache: {
        lastScanTime: null;
        globalContext: null;
        isScanning: boolean;
        triggerAsyncScan(directory: any): Promise<void>;
        getOptimalContext(): null;
    };
    /**
     * Initialize all spatial subsystems — called once at boot.
     */
    boot(): this;
    /**
     * Register all spatial routes on the Express app.
     * @param {Express} app
     */
    registerRoutes(app: Express): void;
    /**
     * Connect Upstash Redis to the bridge for production spatial caching.
     * @param {Object} redisClient
     */
    connectRedis(redisClient: Object): void;
    getVectorMemory(): typeof import("../vector-memory") | null;
    getVectorSpaceOps(): any;
}
//# sourceMappingURL=spatial-registry.d.ts.map