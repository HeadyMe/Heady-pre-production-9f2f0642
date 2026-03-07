export type KVOptions = {
    /**
     * - Maximum number of entries (LRU eviction)
     */
    maxSize?: number | undefined;
    /**
     * - Default TTL in ms (0 = no expiry)
     */
    defaultTtlMs?: number | undefined;
    /**
     * - File path for persistence (optional)
     */
    persistPath?: string | undefined;
    /**
     * - How often to persist (ms)
     */
    persistIntervalMs?: number | undefined;
    /**
     * - Run periodic TTL cleanup
     */
    autoCleanup?: boolean | undefined;
    /**
     * - TTL cleanup interval (ms)
     */
    cleanupIntervalMs?: number | undefined;
};
/**
 * @typedef {Object} KVOptions
 * @property {number} [maxSize=1000] - Maximum number of entries (LRU eviction)
 * @property {number} [defaultTtlMs=0] - Default TTL in ms (0 = no expiry)
 * @property {string} [persistPath] - File path for persistence (optional)
 * @property {number} [persistIntervalMs=60000] - How often to persist (ms)
 * @property {boolean} [autoCleanup=true] - Run periodic TTL cleanup
 * @property {number} [cleanupIntervalMs=30000] - TTL cleanup interval (ms)
 */
export class HeadyKV {
    /**
     * @param {KVOptions} [options={}]
     */
    constructor(options?: KVOptions);
    _maxSize: number;
    _defaultTtlMs: number;
    _persistPath: string | null;
    /** @type {Map<string, LRUNode>} */
    _map: Map<string, LRUNode>;
    _head: LRUNode;
    _tail: LRUNode;
    /** @type {NodeJS.Timeout|null} */
    _cleanupHandle: NodeJS.Timeout | null;
    /** @type {NodeJS.Timeout|null} */
    _persistHandle: NodeJS.Timeout | null;
    /**
     * Stores a value with an optional TTL.
     * @param {string} key
     * @param {*} value - Must be JSON-serialisable
     * @param {number} [ttlMs] - TTL in ms (0 or undefined = use default or no expiry)
     * @returns {this}
     */
    set(key: string, value: any, ttlMs?: number): this;
    /**
     * Gets a value by key. Returns undefined if missing or expired.
     * @param {string} key
     * @returns {*}
     */
    get(key: string): any;
    /**
     * Checks whether a key exists and is not expired.
     * @param {string} key
     * @returns {boolean}
     */
    has(key: string): boolean;
    /**
     * Deletes a key.
     * @param {string} key
     * @returns {boolean} True if the key existed
     */
    delete(key: string): boolean;
    /**
     * Removes all entries.
     * @returns {this}
     */
    clear(): this;
    /**
     * Returns the number of non-expired entries.
     * @returns {number}
     */
    get size(): number;
    /**
     * Returns the remaining TTL for a key in milliseconds.
     * Returns -1 if no expiry, 0 if expired/missing.
     * @param {string} key
     * @returns {number}
     */
    ttl(key: string): number;
    /**
     * Updates the TTL of an existing key.
     * @param {string} key
     * @param {number} ttlMs
     * @returns {boolean} True if the key exists and was updated
     */
    expire(key: string, ttlMs: number): boolean;
    /**
     * Gets a value and deletes it atomically.
     * @param {string} key
     * @returns {*}
     */
    pop(key: string): any;
    /**
     * Gets a value, or computes and stores it if missing/expired.
     * @param {string} key
     * @param {Function} computeFn - () => value or Promise<value>
     * @param {number} [ttlMs]
     * @returns {Promise<*>}
     */
    getOrSet(key: string, computeFn: Function, ttlMs?: number): Promise<any>;
    /**
     * Increments a numeric counter. Initialises to 0 if absent.
     * @param {string} key
     * @param {number} [by=1]
     * @returns {number} New value
     */
    incr(key: string, by?: number): number;
    /**
     * Returns all non-expired keys.
     * @returns {string[]}
     */
    keys(): string[];
    /**
     * Returns all non-expired values.
     * @returns {*[]}
     */
    values(): any[];
    /**
     * Returns all non-expired [key, value] entries.
     * @returns {Array<[string, *]>}
     */
    entries(): Array<[string, any]>;
    _addToHead(node: any): void;
    _removeNode(node: any): void;
    _moveToHead(node: any): void;
    _evictLRU(): void;
    _evictExpired(): void;
    /**
     * Saves current store contents to disk as JSON.
     */
    _saveToDisk(): void;
    /**
     * Loads store contents from disk.
     */
    _loadFromDisk(): void;
    /**
     * Persists to disk and clears all timers.
     */
    destroy(): void;
    /**
     * Returns store statistics.
     * @returns {Object}
     */
    stats(): Object;
}
/**
 * Creates a new HeadyKV instance.
 * @param {KVOptions} [options]
 * @returns {HeadyKV}
 */
export function createKV(options?: KVOptions): HeadyKV;
/** Default in-memory store (no persistence, 1000 entries). */
export const defaultStore: HeadyKV;
declare class LRUNode {
    constructor(key: any, value: any, expiresAt: any);
    key: any;
    value: any;
    expiresAt: any;
    prev: any;
    next: any;
}
export {};
//# sourceMappingURL=heady-kv.d.ts.map