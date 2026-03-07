export class EmbeddingProvider {
    /**
     * @param {object} [opts]
     * @param {string[]} [opts.providerChain=['cloudflare','openai','local']]
     * @param {object} [opts.providerOpts={}]   per-provider options (apiKey, accountId, etc.)
     * @param {number} [opts.concurrency=8]     batch concurrency limit
     */
    constructor(opts?: {
        providerChain?: string[] | undefined;
        providerOpts?: object | undefined;
        concurrency?: number | undefined;
    });
    _chain: string[];
    _providerOpts: object;
    _concurrency: number;
    _cache: LRUCache;
    _breakers: {};
    /**
     * Compute the cache key (SHA-256 of content).
     * @param {string} text
     * @returns {string}
     */
    _cacheKey(text: string): string;
    /**
     * Generate a 384-dim embedding for a single piece of text.
     * Tries providers in chain order; falls back on circuit-break or error.
     * @param {string} text
     * @param {object} [options={}]
     * @returns {Promise<Float64Array>}
     */
    generateEmbedding(text: string, options?: object): Promise<Float64Array>;
    /**
     * Batch embed multiple texts with a concurrency limit.
     * @param {string[]} texts
     * @param {object} [options={}]
     * @returns {Promise<Float64Array[]>}
     */
    embedBatch(texts: string[], options?: object): Promise<Float64Array[]>;
    /**
     * Cache stats.
     * @returns {{ size: number, max: number }}
     */
    cacheStats(): {
        size: number;
        max: number;
    };
    /**
     * Circuit breaker states per provider.
     * @returns {object}
     */
    breakerStates(): object;
}
/**
 * Convenience function: generate embedding using the default provider instance.
 * @param {string} text
 * @param {object} [options]
 * @returns {Promise<Float64Array>}
 */
export function generateEmbedding(text: string, options?: object): Promise<Float64Array>;
export const defaultProvider: EmbeddingProvider;
declare class LRUCache {
    constructor(max: any);
    _max: any;
    _map: Map<any, any>;
    get(key: any): any;
    set(key: any, val: any): void;
    has(key: any): boolean;
    get size(): number;
}
export {};
//# sourceMappingURL=embedding-provider.d.ts.map