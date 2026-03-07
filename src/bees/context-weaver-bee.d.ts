/**
 * Assemble an optimally packed context window using Dynamic Semantic Packing.
 *
 * @param {Object} query
 * @param {string}   query.intent      — what the LLM is trying to do
 * @param {string[]} query.seedPaths   — starting node_paths to expand from
 * @param {number[]} query.embedding   — intent's semantic embedding
 * @param {number}   query.maxNodes    — max candidate nodes to consider (default 100)
 * @param {number}   query.maxTokens   — override token budget (default: auto from model)
 * @param {string}   query.model       — LLM model routing (default: 'default')
 * @param {Object} options
 * @param {Object}   options.dbClient       — Neon DB client
 * @param {Object}   options.vectorMemory   — in-memory vector store
 * @param {string}   options.projectRoot    — project root for filesystem fallback
 * @returns {Object} assembled context window with Si scores and pack metrics
 */
export function assembleContext(query: {
    intent: string;
    seedPaths: string[];
    embedding: number[];
    maxNodes: number;
    maxTokens: number;
    model: string;
}, options?: {
    dbClient: Object;
    vectorMemory: Object;
    projectRoot: string;
}): Object;
/**
 * Retrieve a cached context by ID (for LLM re-use within TTL).
 */
export function getContext(contextId: any): any;
/**
 * Get assembly stats.
 */
export function getStats(): {
    engine: string;
    totalAssemblies: number;
    activeContexts: number;
    recentAssemblies: any[];
};
/**
 * Express routes for the ContextWeaver Engine.
 */
export function contextWeaverRoutes(app: any): void;
//# sourceMappingURL=context-weaver-bee.d.ts.map