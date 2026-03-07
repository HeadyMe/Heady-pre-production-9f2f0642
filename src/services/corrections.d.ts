export = Corrections;
/**
 * HeadyCorrections
 *
 * Behavioral analysis and subtle improvement engine.
 * Observes patterns, suggests improvements, and tracks behavioral evolution
 * over time — discreetly integrated into the platform.
 */
declare class Corrections extends EventEmitter<[never]> {
    /**
     * Expose all pattern categories.
     */
    static get PATTERN_CATEGORIES(): Readonly<{
        INEFFICIENCY: "inefficiency";
        ERROR_PRONE: "error_prone";
        SUBOPTIMAL: "suboptimal";
        DRIFT: "drift";
        REDUNDANCY: "redundancy";
        TIMING: "timing";
        RESOURCE_WASTE: "resource_waste";
        COMMUNICATION: "communication";
    }>;
    /**
     * Expose all correction strategies.
     */
    static get CORRECTION_STRATEGIES(): Readonly<{
        SUBSTITUTE: "substitute";
        AUGMENT: "augment";
        REDUCE: "reduce";
        REORDER: "reorder";
        AUTOMATE: "automate";
        CACHE: "cache";
        PARALLELIZE: "parallelize";
    }>;
    /**
     * @param {object} [opts]
     * @param {number}  [opts.patternWindow]   - Events to track per pattern (default 50)
     * @param {number}  [opts.patternThreshold] - Occurrences before suggesting (default 3)
     * @param {object}  [opts.logger]
     */
    constructor({ patternWindow, patternThreshold, logger }?: {
        patternWindow?: number | undefined;
        patternThreshold?: number | undefined;
        logger?: object | undefined;
    });
    _patterns: Map<any, any>;
    _corrections: Map<any, any>;
    _patternWindow: number;
    _patternThreshold: number;
    _log: object;
    _stats: {
        analysisCount: number;
        suggestionsGenerated: number;
        patternsTracked: number;
        correctionsApplied: number;
    };
    _defaultLogger(): {
        info: () => void;
        warn: (...a: any[]) => void;
        error: (...a: any[]) => void;
    };
    _generateId(): string;
    _detectCategory(behavior: any, context: any): "communication" | "drift" | "redundancy" | "inefficiency" | "error_prone" | "suboptimal" | "timing" | "resource_waste";
    _calculateSeverity(category: any, occurrences: any): number;
    _selectSuggestions(category: any, limit?: number): any;
    /**
     * Analyze a behavior pattern and return insights.
     *
     * @param {string} behavior   - Behavior description to analyze
     * @param {object} [context]  - Context metadata (service, userId, frequency, etc.)
     * @returns {Promise<object>} Analysis result
     */
    analyze(behavior: string, context?: object): Promise<object>;
    /**
     * Generate improvement suggestions for a behavior.
     *
     * @param {string} behavior - Behavior to improve
     * @param {object} [opts]
     * @param {string} [opts.category] - Pre-classified category (skips detection)
     * @param {number} [opts.limit=3]  - Max suggestions to return
     * @returns {Promise<Array<{ text: string, strategy: string, priority: string }>>}
     */
    suggest(behavior: string, { category, limit }?: {
        category?: string | undefined;
        limit?: number | undefined;
    }): Promise<Array<{
        text: string;
        strategy: string;
        priority: string;
    }>>;
    /**
     * Track a behavioral pattern over time.
     * Accumulates occurrences and fires 'pattern_threshold' event when
     * a pattern crosses the configured threshold.
     *
     * @param {object} pattern
     * @param {string} pattern.behavior   - Behavior description (used as key)
     * @param {string} [pattern.category]
     * @param {number} [pattern.severity]
     * @param {object} [pattern.context]
     * @returns {Promise<object>} Updated pattern record
     */
    track(pattern: {
        behavior: string;
        category?: string | undefined;
        severity?: number | undefined;
        context?: object | undefined;
    }): Promise<object>;
    /**
     * Get all tracked patterns, optionally filtered by category or threshold.
     *
     * @param {object} [filters]
     * @param {string}  [filters.category]
     * @param {number}  [filters.minOccurrences]
     * @param {'severity'|'occurrences'|'lastSeen'} [filters.sortBy]
     * @returns {object[]}
     */
    getPatterns(filters?: {
        category?: string | undefined;
        minOccurrences?: number | undefined;
        sortBy?: "severity" | "occurrences" | "lastSeen" | undefined;
    }): object[];
    /**
     * Record that a correction was applied.
     *
     * @param {string} patternKey  - Behavior key
     * @param {string} correctionId
     * @param {object} [result]
     */
    recordCorrectionApplied(patternKey: string, correctionId: string, result?: object): void;
    /**
     * Return stats about the corrections engine.
     * @returns {object}
     */
    getStats(): object;
    /**
     * Clear tracked patterns (does not affect corrections log).
     */
    clearPatterns(): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=corrections.d.ts.map