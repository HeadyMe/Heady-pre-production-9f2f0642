/**
 * Build adjacency list from ast_edges for a target node and its neighborhood.
 *
 * @param {string} targetNodePath — e.g. "src/services/vault-boot.js::bootVault"
 * @param {Object} dbClient — Neon DB client with .query()
 * @param {Object} options
 * @param {number} options.maxDepth — max BFS hops (default 5)
 * @param {string[]} options.edgeTypes — relationship types to follow
 * @returns {Object} { adjacency, distances, nodeMap, stats }
 */
export function buildGraph(targetNodePath: string, dbClient: Object, options?: {
    maxDepth: number;
    edgeTypes: string[];
}): Object;
/**
 * Fallback: build a local dependency graph by parsing require()/import from files.
 *
 * @param {string} targetPath — filepath relative to project root
 * @param {string} projectRoot — absolute path to project root
 * @returns {Object} { adjacency, distances, nodeMap, stats }
 */
export function buildLocalGraph(targetPath: string, projectRoot: string): Object;
/**
 * BFS from a source node to compute shortest distances to all reachable nodes.
 *
 * @param {string} sourceId — starting node UUID
 * @param {Map} adjacency — adjacency list (nodeId → edges[])
 * @param {number} maxDepth — maximum traversal depth
 * @returns {Map<string, number>} nodeId → shortest distance
 */
export function computeDistances(sourceId: string, adjacency: Map<any, any>, maxDepth?: number): Map<string, number>;
export const MAX_TRAVERSAL_DEPTH: 5;
export const EDGE_TYPES: string[];
//# sourceMappingURL=dependency-graph.d.ts.map