/**
 * HeadySoul — The coherence guardian and values arbiter of the Heady AI Platform.
 *
 * HeadySoul maintains the mission-aligned identity of the system by:
 *   1. Enforcing Structural Integrity across all components
 *   2. Enforcing Semantic Coherence via embedding distance
 *   3. Enforcing Mission Alignment (community, equity, empowerment)
 *
 * It holds a "soul state" embedding in vector memory as the canonical
 * representation of what the system *should* be. Any mutation or drift
 * is evaluated against this embedding.
 *
 * @extends EventEmitter
 */
export class HeadySoul extends EventEmitter<[never]> {
    /**
     * @param {object} [options]
     * @param {object} [options.vectorMemory]     - VectorMemory instance
     * @param {object} [options.driftDetector]    - DriftDetector instance
     * @param {object} [options.missionOverride]  - Override default mission statement
     */
    constructor(options?: {
        vectorMemory?: object | undefined;
        driftDetector?: object | undefined;
        missionOverride?: object | undefined;
    });
    _vectorMemory: object;
    _driftDetector: object;
    _state: "STABLE";
    _violations: any[];
    _healingQueue: any[];
    _rejections: any[];
    _SOUL_EMBEDDING_KEY: string;
    _mission: object;
    _initialized: boolean;
    /**
     * Initialize HeadySoul by loading or seeding the core soul embedding.
     * Must be called before evaluating coherence.
     * @returns {Promise<void>}
     */
    initialize(): Promise<void>;
    _soulEmbedding: any;
    /**
     * Evaluate a component against all three Unbreakable Laws.
     *
     * @param {object} component
     * @param {string} component.id          - Component identifier
     * @param {string} component.type        - 'code' | 'content' | 'config' | 'action'
     * @param {*}      component.content     - The actual component content
     * @param {object} [component.embedding] - Pre-computed embedding (optional)
     * @returns {Promise<CoherenceResult>}
     */
    evaluateCoherence(component: {
        id: string;
        type: string;
        content: any;
        embedding?: object | undefined;
    }): Promise<CoherenceResult>;
    /**
     * Validate a proposed code/config mutation against soul laws.
     * Returns approved result or throws with rejection reason.
     *
     * @param {object} change
     * @param {string} change.id          - Change identifier
     * @param {string} change.description - Human-readable description
     * @param {string} change.type        - 'code' | 'config' | 'schema' | 'policy'
     * @param {*}      change.before      - Previous state
     * @param {*}      change.after       - Proposed state
     * @returns {Promise<MutationValidationResult>}
     */
    validateMutation(change: {
        id: string;
        description: string;
        type: string;
        before: any;
        after: any;
    }): Promise<MutationValidationResult>;
    /**
     * Respond to a drift alert from DriftDetector.
     *
     * @param {object} alert
     * @param {number} alert.driftScore
     * @param {string} alert.component
     * @param {object} [alert.details]
     * @returns {Promise<void>}
     */
    onDriftAlert(alert: {
        driftScore: number;
        component: string;
        details?: object | undefined;
    }): Promise<void>;
    /**
     * Return the current mission statement, values, and constraints.
     * @returns {object} Mission document
     */
    getValues(): object;
    /**
     * Get the current soul state.
     * @returns {string} One of SoulState values
     */
    getState(): string;
    /**
     * Return recent violations.
     * @param {number} [limit=10]
     * @returns {object[]}
     */
    getViolations(limit?: number): object[];
    /**
     * Return recent mutation rejections.
     * @param {number} [limit=10]
     * @returns {object[]}
     */
    getRejections(limit?: number): object[];
    /**
     * Law 1: Structural Integrity
     */
    _checkStructuralIntegrity(component: any): Promise<{
        lawId: string;
        name: string;
        severity: string;
        passed: boolean;
        reason: null;
        checks: never[];
    }>;
    /**
     * Law 2: Semantic Coherence
     */
    _checkSemanticCoherence(component: any): Promise<{
        lawId: string;
        name: string;
        severity: string;
        passed: boolean;
        reason: null;
        distance: null;
    }>;
    /**
     * Law 3: Mission Alignment
     */
    _checkMissionAlignment(component: any): Promise<{
        lawId: string;
        name: string;
        severity: string;
        passed: boolean;
        reason: null;
        checks: never[];
    }>;
    _attemptHealing(alert: any): Promise<void>;
    _driftToHealingPriority(driftScore: any): "LOW" | "MEDIUM" | "HIGH" | "IMMEDIATE";
    /**
     * Rudimentary unclosed block detection for JS-like code.
     * Counts braces, brackets, parens.
     */
    _detectUnclosedBlocks(code: any): boolean;
}
/**
 * The three immutable laws that HeadySoul enforces.
 * Violations are never silently ignored — they surface as events and errors.
 */
export const UNBREAKABLE_LAWS: Readonly<{
    STRUCTURAL_INTEGRITY: {
        id: string;
        name: string;
        description: string;
        severity: string;
    };
    SEMANTIC_COHERENCE: {
        id: string;
        name: string;
        description: string;
        severity: string;
        toleranceThreshold: number;
    };
    MISSION_ALIGNMENT: {
        id: string;
        name: string;
        description: string;
        severity: string;
        missionKeywords: string[];
    };
}>;
export const SoulState: Readonly<{
    STABLE: "STABLE";
    ALERT: "ALERT";
    HEALING: "HEALING";
    VIOLATED: "VIOLATED";
}>;
export const PHI: 1.6180339887;
import { EventEmitter } from "events";
//# sourceMappingURL=heady-soul.d.ts.map