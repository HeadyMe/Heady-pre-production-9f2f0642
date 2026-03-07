export type CanonicalPattern = {
    id: string;
    name: string;
    type: string;
    description: string;
    /**
     * 0-1
     */
    confidence: number;
    /**
     * Unix ms
     */
    detectedAt: number;
};
export class PatternEngine {
    /** @type {Map<string, CanonicalPattern>} */
    _registry: Map<string, CanonicalPattern>;
    /** @type {Array<{ detectedAt: number, patterns: CanonicalPattern[], context: object }>} */
    _history: Array<{
        detectedAt: number;
        patterns: CanonicalPattern[];
        context: object;
    }>;
    /**
     * Detect patterns in `data` via all four lenses.
     * Also cross-references registered canonical patterns.
     *
     * @param {*} data     the data to analyse
     * @param {object} [context={}]  optional context hints (intent, source, tags, etc.)
     * @returns {{ patterns: CanonicalPattern[], lenses: object }}
     */
    detect(data: any, context?: object): {
        patterns: CanonicalPattern[];
        lenses: object;
    };
    /**
     * @private
     */
    private _matchRegistered;
    /**
     * Register a known pattern definition.
     * @param {string} patternId
     * @param {object} definition  canonical pattern fields
     * @returns {CanonicalPattern}
     */
    register(patternId: string, definition: object): CanonicalPattern;
    /**
     * Retrieve a registered pattern by ID.
     * @param {string} patternId
     * @returns {CanonicalPattern|undefined}
     */
    getRegistered(patternId: string): CanonicalPattern | undefined;
    /**
     * List all registered patterns.
     * @returns {CanonicalPattern[]}
     */
    listRegistered(): CanonicalPattern[];
    /**
     * Suggest optimizations for a detected pattern.
     * @param {CanonicalPattern} pattern
     * @returns {string[]}  optimization suggestions
     */
    optimize(pattern: CanonicalPattern): string[];
    /**
     * Return recent detection history.
     * @param {number} [limit=20]
     * @returns {Array<{ detectedAt: number, patterns: CanonicalPattern[], context: object }>}
     */
    getHistory(limit?: number): Array<{
        detectedAt: number;
        patterns: CanonicalPattern[];
        context: object;
    }>;
}
export const PATTERN_TYPES: Readonly<{
    STRUCTURAL: "structural";
    TEMPORAL: "temporal";
    BEHAVIORAL: "behavioral";
    SEMANTIC: "semantic";
}>;
//# sourceMappingURL=pattern-engine.d.ts.map