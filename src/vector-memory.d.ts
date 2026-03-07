export class VectorMemory {
    /**
     * @param {object} [opts]
     * @param {string} [opts.defaultNamespace='default']
     */
    constructor(opts?: {
        defaultNamespace?: string | undefined;
    });
    _defaultNs: string;
    /** @type {Map<string, Map<string, { vector: Float64Array, metadata: object, updatedAt: number }>>} */
    _store: Map<string, Map<string, {
        vector: Float64Array;
        metadata: object;
        updatedAt: number;
    }>>;
    _ensureNamespace(ns: any): void;
    _resolveKey(key: any, namespace: any): {
        ns: any;
        map: Map<string, {
            vector: Float64Array;
            metadata: object;
            updatedAt: number;
        }> | undefined;
    };
    _toFloat64(v: any): Float64Array<ArrayBufferLike>;
    /**
     * Store a vector with associated metadata.
     * @param {string} key
     * @param {number[]|Float64Array} vector
     * @param {object} [metadata={}]
     * @param {string} [namespace]
     */
    store(key: string, vector: number[] | Float64Array, metadata?: object, namespace?: string): void;
    /**
     * Retrieve a stored entry by key.
     * @param {string} key
     * @param {string} [namespace]
     * @returns {{ vector: Float64Array, metadata: object, updatedAt: number }|null}
     */
    get(key: string, namespace?: string): {
        vector: Float64Array;
        metadata: object;
        updatedAt: number;
    } | null;
    /**
     * Update an existing entry. Creates it if not present.
     * @param {string} key
     * @param {number[]|Float64Array} vector
     * @param {object} [metadata={}]
     * @param {string} [namespace]
     */
    update(key: string, vector: number[] | Float64Array, metadata?: object, namespace?: string): void;
    /**
     * Delete an entry.
     * @param {string} key
     * @param {string} [namespace]
     * @returns {boolean} true if deleted
     */
    delete(key: string, namespace?: string): boolean;
    /**
     * Clear all entries in a namespace (or the default namespace).
     * @param {string} [namespace]
     */
    clear(namespace?: string): void;
    /**
     * Cosine similarity search across a namespace.
     * @param {number[]|Float64Array} queryVector
     * @param {number} [limit=5]
     * @param {number} [minScore=0.6]
     * @param {string} [namespace]
     * @returns {Array<{ key: string, score: number, metadata: object }>}
     */
    search(queryVector: number[] | Float64Array, limit?: number, minScore?: number, namespace?: string): Array<{
        key: string;
        score: number;
        metadata: object;
    }>;
    /**
     * Detect semantic drift between two vectors.
     * @param {number[]|Float64Array} vectorA
     * @param {number[]|Float64Array} vectorB
     * @returns {{ similarity: number, isDrifting: boolean }}
     */
    detectDrift(vectorA: number[] | Float64Array, vectorB: number[] | Float64Array): {
        similarity: number;
        isDrifting: boolean;
    };
    /**
     * Return high-level statistics about the memory store.
     * @returns {{ totalVectors: number, namespaces: string[], memoryEstimateBytes: number }}
     */
    stats(): {
        totalVectors: number;
        namespaces: string[];
        memoryEstimateBytes: number;
    };
    /**
     * Persist all namespaces to a JSON-lines file.
     * @param {string} filePath
     * @returns {Promise<void>}
     */
    persist(filePath: string): Promise<void>;
    /**
     * Load vectors from a JSON-lines file (merges into current store).
     * @param {string} filePath
     * @returns {Promise<number>} count of loaded entries
     */
    load(filePath: string): Promise<number>;
}
export const DRIFT_THRESHOLD: 0.75;
//# sourceMappingURL=vector-memory.d.ts.map