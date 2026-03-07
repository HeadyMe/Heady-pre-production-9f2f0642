export class DriftDetector {
    /**
     * @param {object} [opts]
     * @param {function} [opts.onEscalation]  called with alert object on CRITICAL drift
     */
    constructor(opts?: {
        onEscalation?: Function | undefined;
    });
    /**
     * componentId → { baseline: Float64Array, current: Float64Array|null, updatedAt: number }
     * @type {Map<string, object>}
     */
    _components: Map<string, object>;
    /**
     * alertId → { id, componentId, severity, similarity, detectedAt, dismissed }
     * @type {Map<string, object>}
     */
    _alerts: Map<string, object>;
    /**
     * componentId → Array<{ similarity: number, ts: number }>
     * @type {Map<string, Array>}
     */
    _history: Map<string, any[]>;
    _onEscalation: Function | null;
    /**
     * Establish or reset the baseline for a component.
     * @param {string} componentId
     * @param {number[]|Float64Array} vector
     */
    setBaseline(componentId: string, vector: number[] | Float64Array): void;
    /**
     * Track a new observation for a component and check for drift.
     * @param {string} componentId
     * @param {number[]|Float64Array} currentVector
     * @returns {{ similarity: number, severity: string|null, alert: object|null }}
     */
    monitor(componentId: string, currentVector: number[] | Float64Array): {
        similarity: number;
        severity: string | null;
        alert: object | null;
    };
    /**
     * Explicit drift check for a component (uses the last monitored vector).
     * @param {string} componentId
     * @returns {{ similarity: number|null, severity: string|null, isDrifting: boolean }}
     */
    detectDrift(componentId: string): {
        similarity: number | null;
        severity: string | null;
        isDrifting: boolean;
    };
    /**
     * @private
     */
    private _raiseAlert;
    /**
     * Return all non-dismissed alerts.
     * @returns {object[]}
     */
    getAlerts(): object[];
    /**
     * Dismiss an alert by ID.
     * @param {string} alertId
     * @returns {boolean} true if found and dismissed
     */
    dismissAlert(alertId: string): boolean;
    /**
     * Overview of all monitored components.
     * @returns {{
     *   total: number,
     *   monitored: Array<{ componentId: string, similarity: number|null, severity: string|null, isDrifting: boolean, updatedAt: number|null }>,
     *   activeAlerts: number,
     * }}
     */
    summary(): {
        total: number;
        monitored: Array<{
            componentId: string;
            similarity: number | null;
            severity: string | null;
            isDrifting: boolean;
            updatedAt: number | null;
        }>;
        activeAlerts: number;
    };
    /**
     * Drift history for a specific component.
     * @param {string} componentId
     * @param {number} [limit=100]
     * @returns {Array<{ similarity: number, ts: number }>}
     */
    getHistory(componentId: string, limit?: number): Array<{
        similarity: number;
        ts: number;
    }>;
}
export const SEVERITY: Readonly<{
    LOW: "LOW";
    MEDIUM: "MEDIUM";
    HIGH: "HIGH";
    CRITICAL: "CRITICAL";
}>;
//# sourceMappingURL=drift-detector.d.ts.map