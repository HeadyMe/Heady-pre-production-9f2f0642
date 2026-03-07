/**
 * Assemble an optimal prompt payload by greedily packing Si-scored nodes.
 *
 * @param {string} intentText — the mutation intent / command
 * @param {Object} targetNode — the target AST node being mutated
 * @param {string} targetNode.code — source code of the target (or stringified AST)
 * @param {string} targetNode.filepath — file path
 * @param {string} targetNode.signature — function/class signature
 * @param {Object[]} scoredNodes — Si-scored dependency nodes (pre-sorted desc)
 * @param {string} modelRouting — model identifier for token limit
 * @param {Object} options
 * @param {number} options.reservedOutput — tokens reserved for AI output
 * @returns {Object} { payload, metrics }
 */
export function allocate(intentText: string, targetNode: {
    code: string;
    filepath: string;
    signature: string;
}, scoredNodes: Object[], modelRouting?: string, options?: {
    reservedOutput: number;
}): Object;
/**
 * Preview allocation metrics without assembling the full payload.
 */
export function preview(intentText: any, targetNode: any, scoredNodes: any, modelRouting?: string): {
    model: string;
    maxTokens: number;
    available: number;
    coreTokens: number;
    estimatedTotal: number;
    wouldInclude: number;
    wouldExclude: number;
    packEfficiency: number;
};
/**
 * Count tokens in a text string.
 * Uses len/4 heuristic — within ~5% of cl100k_base for English text.
 *
 * @param {string} text
 * @returns {number} estimated token count
 */
export function countTokens(text: string): number;
/**
 * Resolve the context window limit for a given model routing string.
 *
 * @param {string} modelRouting — model identifier
 * @returns {number} max context tokens
 */
export function resolveModelLimit(modelRouting: string): number;
export const MODEL_LIMITS: {
    'claude-3-5-sonnet': number;
    'claude-3-opus': number;
    'claude-3-haiku': number;
    claude: number;
    'gpt-4': number;
    'gpt-4o': number;
    'gpt-4o-mini': number;
    'gpt-4-turbo': number;
    'gpt-3.5-turbo': number;
    'gemini-2.0-flash': number;
    'gemini-1.5-pro': number;
    gemini: number;
    groq: number;
    'llama-3.1-70b': number;
    'mixtral-8x7b': number;
    default: number;
};
export const DEFAULT_RESERVED_OUTPUT: 4000;
//# sourceMappingURL=token-budget-allocator.d.ts.map