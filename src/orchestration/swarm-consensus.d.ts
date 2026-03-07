export class SwarmConsensus extends EventEmitter<[never]> {
    constructor();
    locks: Map<any, any>;
    waitQueues: Map<any, any>;
    staleTimer: NodeJS.Timeout | null;
    totalAcquired: number;
    totalReleased: number;
    totalExpired: number;
    totalConflicts: number;
    /**
     * Acquire a lock on a file path.
     * @param {string} filePath  - Path to lock
     * @param {string} owner     - Owner identifier (beeId, nodeId, etc.)
     * @param {object} opts      - { type: 'exclusive'|'shared', ttlMs, wait }
     * @returns {Promise<object>} Lock result
     */
    acquire(filePath: string, owner: string, opts?: object): Promise<object>;
    release(filePath: any, owner: any): {
        ok: boolean;
        error: string;
        filePath?: undefined;
        remainingOwners?: undefined;
        released?: undefined;
    } | {
        ok: boolean;
        filePath: any;
        remainingOwners: any;
        error?: undefined;
        released?: undefined;
    } | {
        ok: boolean;
        filePath: any;
        released: boolean;
        error?: undefined;
        remainingOwners?: undefined;
    };
    /**
     * Extend a lock's TTL (called by the lock holder to keep it alive).
     */
    heartbeat(filePath: any, owner: any): {
        ok: boolean;
        error: string;
        filePath?: undefined;
        newExpiry?: undefined;
        heartbeats?: undefined;
    } | {
        ok: boolean;
        filePath: any;
        newExpiry: any;
        heartbeats: any;
        error?: undefined;
    };
    startStaleCheck(): void;
    stopStaleCheck(): void;
    _processWaitQueue(filePath: any): Promise<void>;
    getLocks(): {};
    isLocked(filePath: any): boolean;
    getStatus(): {
        activeLocks: number;
        waitQueueDepth: any;
        totalAcquired: number;
        totalReleased: number;
        totalExpired: number;
        totalConflicts: number;
        staleCheckActive: boolean;
        lockTtlMs: number;
        locks: {};
    };
}
export const consensus: SwarmConsensus;
export function registerConsensusRoutes(app: any): void;
import EventEmitter = require("events");
//# sourceMappingURL=swarm-consensus.d.ts.map