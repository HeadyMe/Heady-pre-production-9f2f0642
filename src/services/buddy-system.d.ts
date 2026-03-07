export class BuddySystem {
    constructor(config: any);
    config: any;
    topology: any;
    octree: OctreeManager;
    redisBridge: RedisSyncBridge;
    tracker: TrajectoryTracker;
    prefetchRadius: any;
    maxPrefetch: any;
    decayEnabled: any;
    decayLambda: any;
    minRelevance: any;
    _ingestionCount: number;
    _prefetchCount: number;
    _running: boolean;
    _ingestionQueue: any[];
    /**
     * Ingest a data payload from the HCFullPipeline.
     * @param {string} id - Unique identifier
     * @param {string} text - Raw content
     * @param {object} [meta] - { filePath, mtime, birthtime, isRealtime }
     * @returns {{ id, coords: {x,y,z}, receipt: string }}
     */
    ingest(id: string, text: string, meta?: object): {
        id: any;
        coords: {
            x: any;
            y: any;
            z: any;
        };
        receipt: string;
    };
    /**
     * Batch ingest multiple payloads.
     */
    batchIngest(items: any): any;
    /**
     * Update the Executor's current position and pre-fetch nearby blocks.
     * @param {{ x, y, z }} executorPosition
     * @returns {{ prefetched: number, predicted: {x,y,z}|null }}
     */
    updateExecutorPosition(executorPosition: {
        x: any;
        y: any;
        z: any;
    }): {
        prefetched: number;
        predicted: {
            x: any;
            y: any;
            z: any;
        } | null;
    };
    /**
     * Apply temporal decay to all items. Down-rank stale items.
     * @returns {{ pruned: number, total: number }}
     */
    applyTemporalDecay(): {
        pruned: number;
        total: number;
    };
    /**
     * Retrieve nearest context for a given query coordinate.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @param {number} [k=5]
     * @returns {Array}
     */
    retrieveContext(x: number, y: number, z: number, k?: number): any[];
    /**
     * Retrieve context for a text query (auto-embeds then searches).
     * @param {string} queryText
     * @param {number} [k=5]
     * @returns {{ coords: {x,y,z}, results: Array, receipt: string }}
     */
    queryContext(queryText: string, k?: number): {
        coords: {
            x: any;
            y: any;
            z: any;
        };
        results: any[];
        receipt: string;
    };
    status(): {
        service: string;
        running: boolean;
        octreeStats: {
            totalItems: number;
            maxDepth: any;
            maxItemsPerLeaf: any;
            bounds: {
                min: any[];
                max: any[];
            };
        };
        cacheStats: {
            hitRate: string;
            hits: number;
            misses: number;
            writes: number;
            publishes: number;
            mode: string;
            inMemorySize: number;
        };
        ingestionCount: number;
        prefetchCount: number;
        trajectoryHistory: number;
        topology: any;
    };
    start(): void;
    stop(): void;
}
export class TrajectoryTracker {
    constructor(smoothing?: number, lookaheadSteps?: number);
    smoothing: number;
    lookaheadSteps: number;
    history: any[];
    maxHistory: number;
    /**
     * Record a new position and compute predicted next position.
     * @param {{ x: number, y: number, z: number }} pos
     * @returns {{ x: number, y: number, z: number } | null} predicted position
     */
    record(pos: {
        x: number;
        y: number;
        z: number;
    }): {
        x: number;
        y: number;
        z: number;
    } | null;
    predict(): {
        x: number;
        y: number;
        z: number;
    } | null;
}
export function registerRoutes(app: any): BuddySystem;
import { OctreeManager } from "./octree-manager";
import { RedisSyncBridge } from "./redis-sync-bridge";
//# sourceMappingURL=buddy-system.d.ts.map