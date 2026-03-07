/**
 * Phase 1: ERROR DETECTION & PROBABILISTIC HALT
 *
 * Intercept the error. Halt probabilistic generation.
 * Do NOT attempt conversational debugging — capture raw state instead.
 *
 * @param {Error|string} error - The intercepted error
 * @param {object} context - Execution context at time of failure
 * @returns {object} Halted execution state
 */
export function interceptError(error: Error | string, context?: object): object;
/**
 * Phase 2: DETERMINISTIC STATE EXTRACTION
 *
 * Capture the objective, mathematical reality of the system.
 * Strip all conversational context. Extract pure state.
 *
 * @param {object} haltedState - State from Phase 1
 * @returns {object} Deterministic state snapshot
 */
export function extractDeterministicState(haltedState: object): object;
/**
 * Phase 3: SEMANTIC EQUIVALENCE VIRTUALIZATION
 * Phase 4: RULE SYNTHESIS VIA BOOLEAN LOGIC
 *
 * Analyze the root cause by filtering environmental noise
 * and deriving the deterministic constraint.
 *
 * @param {object} snapshot - Deterministic state snapshot
 * @param {object} haltedState - Original halted state
 * @returns {object} Root cause analysis
 */
export function analyzeRootCause(snapshot: object, haltedState: object): object;
/**
 * Phase 4 (continued): SYNTHESIZE DETERMINISTIC RULE
 *
 * Transform the root cause into a rigid, enforceable constraint.
 *
 * @param {object} rootCause - Root cause analysis from Phase 3/4
 * @returns {object} Synthesized rule
 */
export function synthesizeRule(rootCause: object): object;
/**
 * Phase 5: SYSTEM BASELINE UPDATE
 *
 * Write the synthesized rule upstream into AGENTS.md.
 * This permanently prevents the error pathway from recurring.
 *
 * @param {object} rule - Synthesized rule from Phase 4
 * @returns {object} Baseline update result
 */
export function updateBaseline(rule: object): object;
/**
 * Get all learned rules.
 * @returns {object[]} Array of learned rules
 */
export function getLearnedRules(): object[];
/**
 * Get error protocol statistics.
 * @returns {object} Stats
 */
export function getStats(): object;
/**
 * Hash an error for deduplication and lookup.
 */
declare function hashError(error: any): string;
/**
 * Classify an error into a category.
 */
declare function classifyError(error: any): {
    type: string;
    category: string;
    recoverable: boolean;
};
/**
 * Derive a deterministic constraint from the error classification.
 */
declare function deriveConstraint(classification: any, file: any, fn: any, haltedState: any): string;
/**
 * Parse a stack trace into structured frames.
 */
declare function parseCallStack(stack: any): any;
export { hashError as _hashError, classifyError as _classifyError, deriveConstraint as _deriveConstraint, parseCallStack as _parseCallStack };
//# sourceMappingURL=buddy-error-protocol.d.ts.map