export class TernaryDecisionMatrix extends EventEmitter<[never]> {
    constructor(opts?: {});
    _shadowIndex: any[];
    _resonanceLog: any[];
    _ephemeralCount: number;
    _vectorMemory: any;
    _redisCache: any;
    _thresholds: {
        resonanceConfidence: any;
        repelConfidence: any;
        maxShadowSize: any;
        decayInterval: any;
    };
    _stats: {
        classified: number;
        resonance: number;
        ephemeral: number;
        repelled: number;
    };
    _decayTimer: NodeJS.Timeout;
    /**
     * Classify a signal into {-1, 0, +1} using feature analysis.
     * @param {Object} signal - The input signal to classify
     * @param {string} signal.type - Signal type (e.g., 'user_input', 'agent_output', 'error')
     * @param {*} signal.data - The actual data payload
     * @param {Object} [signal.context] - Additional context
     * @returns {Object} { state: -1|0|+1, action: string, signal }
     */
    classify(signal: {
        type: string;
        data: any;
        context?: Object | undefined;
    }): Object;
    /**
     * Batch classify an array of signals — sparse computation.
     * Returns only non-zero results (ignores noise).
     */
    sparseClassify(signals: any): Object[];
    /**
     * Extract classification features from a signal.
     */
    _extractFeatures(signal: any): {
        confidence: number;
        novelty: number;
        adversarial: boolean;
        verified: boolean;
        frequency: number;
        type: any;
    };
    /**
     * Apply ternary logic via CSL Ternary Gate: {-1, 0, +1} classification.
     * Uses continuous sigmoid activation instead of hard thresholds.
     */
    _applyTernaryLogic(features: any): 0 | 1 | -1;
    /**
     * +1: Core Resonance — commit to K3D vector storage.
     */
    _handleResonance(result: any): Promise<void>;
    /**
     * 0: Ephemeral — volatile cache only, evaporates on session close.
     */
    _handleEphemeral(result: any): void;
    /**
     * -1: Repel — quarantine into Shadow Index.
     */
    _handleRepel(result: any): void;
    /**
     * Decay old shadow entries to prevent stale quarantines.
     */
    _decayShadowIndex(): void;
    /**
     * Query the Shadow Index for known-bad patterns.
     */
    queryShadowIndex(query: any): any[];
    /**
     * Get ternary engine stats.
     */
    getStats(): {
        shadowIndexSize: number;
        resonanceLogSize: number;
        ephemeralCount: number;
        distribution: {
            resonance: string;
            ephemeral: string;
            repelled: string;
        };
        classified: number;
        resonance: number;
        ephemeral: number;
        repelled: number;
    };
    /**
     * Register API routes.
     */
    registerRoutes(app: any): void;
    destroy(): void;
}
export const TERNARY: Readonly<{
    CORE_RESONANCE: 1;
    EPHEMERAL: 0;
    REPEL: -1;
}>;
import EventEmitter = require("events");
//# sourceMappingURL=ternary-logic.d.ts.map