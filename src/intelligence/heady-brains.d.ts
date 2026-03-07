/**
 * HeadyBrains — Computational Pre-Processor for the Heady AI Platform.
 *
 * HeadyBrains assembles full, rich context before any task is routed or executed.
 * It gathers memory, patterns, session history, user state, and enriches with
 * embeddings — all in parallel where possible.
 *
 * Key responsibilities:
 *   - assembleContext(task)    → full context object for downstream stages
 *   - preProcess(rawInput)     → normalize, classify intent, extract entities
 *   - enrichContext(context)   → add vector memory results, pattern matches
 *
 * @extends EventEmitter
 */
export class HeadyBrains extends EventEmitter<[never]> {
    /**
     * @param {object} [options]
     * @param {object} [options.vectorMemory]       - VectorMemory instance
     * @param {object} [options.patternEngine]      - PatternEngine instance
     * @param {number} [options.maxContextTokens]   - Context window token budget
     * @param {number} [options.memoryResultLimit]  - Max memory results to include
     * @param {number} [options.patternResultLimit] - Max pattern results to include
     */
    constructor(options?: {
        vectorMemory?: object | undefined;
        patternEngine?: object | undefined;
        maxContextTokens?: number | undefined;
        memoryResultLimit?: number | undefined;
        patternResultLimit?: number | undefined;
    });
    _vectorMemory: object;
    _patternEngine: object;
    _maxContextTokens: number;
    _memoryResultLimit: number;
    _patternResultLimit: number;
    /**
     * Assemble full context for a task.
     * Runs all gathering operations in parallel where possible.
     *
     * @param {object} task
     * @param {string} task.id
     * @param {string} task.type
     * @param {object} task.payload
     * @returns {Promise<AssembledContext>}
     */
    assembleContext(task: {
        id: string;
        type: string;
        payload: object;
    }): Promise<AssembledContext>;
    /**
     * Pre-process raw input: normalize, classify intent, extract entities.
     *
     * @param {*} rawInput - Raw string or object from user/system
     * @returns {Promise<PreProcessResult>}
     */
    preProcess(rawInput: any): Promise<PreProcessResult>;
    /**
     * Enrich an assembled context with vector memory similarity results
     * and pattern engine matches.
     *
     * @param {AssembledContext} context
     * @returns {Promise<EnrichedContext>}
     */
    enrichContext(context: AssembledContext): Promise<EnrichedContext>;
    /**
     * Gather relevant memories from vector store.
     */
    _gatherMemory(task: any): Promise<any>;
    /**
     * Gather matching patterns from pattern engine.
     */
    _gatherPatterns(task: any): Promise<any>;
    /**
     * Gather recent task history for context continuity.
     */
    _gatherRecentHistory(task: any): Promise<any>;
    /**
     * Gather user state (preferences, profile, session data).
     */
    _gatherUserState(task: any): Promise<any>;
    /**
     * Generate task embedding for semantic operations.
     */
    _generateEmbedding(task: any): Promise<any>;
    _generateEmbeddingFromText(text: any): Promise<any>;
    _vectorSearch(context: any): Promise<any>;
    _patternSearch(context: any): Promise<any>;
    /**
     * Normalize raw input string.
     */
    _normalize(input: any): any;
    /**
     * Rule-based intent classification.
     */
    _classifyIntent(text: any): {
        label: string;
        confidence: number;
    };
    /**
     * Extract named entities and key-value pairs from text.
     */
    _extractEntities(text: any): {
        type: string;
        value: any;
    }[];
    /**
     * Count total tokens in an assembled context.
     */
    _countContextTokens(ctx: any): number;
    /**
     * Priority-based context truncation when over token budget.
     * Drops lower-priority items first.
     *
     * Priority order (preserved longest):
     *   CRITICAL: userState, recentHistory
     *   HIGH:     patterns, vectorMatches
     *   MEDIUM:   memory, patternMatches
     *   LOW:      everything else
     */
    _pruneContext(ctx: any): void;
}
export const PHI: 1.6180339887;
/**
 * Estimate token count from a string.
 * @param {string} str
 * @returns {number}
 */
export function estimateTokens(str: string): number;
/**
 * Truncate a string to a target token budget.
 * @param {string} str
 * @param {number} maxTokens
 * @returns {string}
 */
export function truncateToTokens(str: string, maxTokens: number): string;
import { EventEmitter } from "events";
//# sourceMappingURL=heady-brains.d.ts.map