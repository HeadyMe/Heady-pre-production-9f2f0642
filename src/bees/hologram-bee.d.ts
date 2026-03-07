/**
 * Compile an AST node on-demand.
 * Pulls AST JSON, transforms to executable JS, caches in RAM.
 *
 * @param {Object} astNode — node from ast_nodes table
 * @returns {Object} { output, hash, fromCache, compileTimeMs }
 */
export function compileNode(astNode: Object): Object;
/**
 * Compile multiple AST nodes and bundle into a single module.
 * Used by UICompilerBee to assemble a full page from scattered nodes.
 */
export function compileBundle(astNodes: any, options?: {}): {
    bundle: string;
    hash: string;
    nodeCount: number;
    totalBytes: number;
    compileTimeMs: number;
    nodes: {
        path: any;
        type: any;
        hash: any;
    }[];
};
/**
 * Push compiled output to remote edge cache.
 * Backups are REMOTE-ONLY — no local storage unless explicitly requested.
 */
export function pushToEdge(compiledOutput: any, target: any): Promise<{
    target: any;
    pushed: boolean;
}>;
/**
 * Transform AST JSON back to executable source code.
 * This is the core compiler — turns pure potential into materialized reality.
 */
export function transformAST(astJson: any, options?: {}): any;
/**
 * Get compilation stats.
 */
export function getStats(): {
    totalCompilations: number;
    totalCacheHits: number;
    cacheSize: number;
    cacheHitRate: string;
    recentCompilations: any[];
};
/**
 * Clear the ephemeral compilation cache.
 */
export function clearCache(): {
    cleared: number;
};
/**
 * Express routes.
 */
export function hologramBeeRoutes(app: any): void;
//# sourceMappingURL=hologram-bee.d.ts.map