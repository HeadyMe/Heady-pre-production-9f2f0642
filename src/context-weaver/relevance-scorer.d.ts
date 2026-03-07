/**
 * Score an array of candidate AST nodes against the Intent + Target
 * using the composite Si equation.
 *
 * @param {number[]} intentEmbedding — the embedded intent vector
 * @param {Object[]} candidateNodes — array of node objects, each with:
 *   - id: UUID
 *   - embedding: number[] (node's vector embedding)
 *   - updatedAt: ISO timestamp or Date (from ast_governance / updated_at)
 *   - ...other metadata
 * @param {Map<string, number>} distanceMap — nodeId → graph distance from target
 * @param {Object} options
 * @param {number} options.alpha — semantic weight (default 0.50)
 * @param {number} options.beta — graph proximity weight (default 0.30)
 * @param {number} options.gamma — recency weight (default 0.20)
 * @param {number} options.lambda — decay constant (default ~7-day half-life)
 * @returns {Object[]} nodes with `composite_score`, `score_breakdown` fields, sorted descending
 */
export function scoreNodes(intentEmbedding: number[], candidateNodes: Object[], distanceMap: Map<string, number>, options?: {
    alpha: number;
    beta: number;
    gamma: number;
    lambda: number;
}): Object[];
/**
 * Score without embeddings — uses only graph proximity and recency.
 * Useful when intent embedding is unavailable.
 */
export function scoreByStructure(candidateNodes: any, distanceMap: any, options?: {}): Object[];
/**
 * Cosine similarity between two equal-length vectors.
 * Falls back to 0 if vectors are incompatible.
 */
export function cosineSimilarity(a: any, b: any): number;
export const DEFAULT_ALPHA: 0.5;
export const DEFAULT_BETA: 0.3;
export const DEFAULT_GAMMA: 0.2;
export const DEFAULT_LAMBDA: 1.1457e-9;
//# sourceMappingURL=relevance-scorer.d.ts.map