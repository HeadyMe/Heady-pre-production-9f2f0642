/**
 * Emit a deterministic receipt for a projection action.
 *
 * @param {'projected'|'pruned'|'synced'|'healed'|'validated'|'drifted'} action
 * @param {Object} payload - Action-specific data
 * @returns {Object} The receipt with chain hash
 */
export function emitReceipt(action: "projected" | "pruned" | "synced" | "healed" | "validated" | "drifted", payload?: Object): Object;
/**
 * Validate projection staleness against the governance budget.
 */
export function validateStaleness(target: any, lastSyncTimestamp: any): {
    withinBudget: boolean;
    staleMs: number;
    budget: any;
    receipt: Object;
};
/**
 * Record a projection action with full payload.
 */
export function recordProjection(action: any, targets: any, metadata?: {}): Object;
/**
 * Check chain integrity — verify hash linkage.
 */
export function verifyChain(): {
    valid: boolean;
    chainLength: number;
    brokenAt: number;
};
/**
 * Get governance dashboard data.
 */
export function getGovernanceDashboard(): {
    chainLength: number;
    chainValid: boolean;
    lastReceipt: any;
    actionCounts: {};
    rules: {
        maxStalenessMs: number;
        transportTargets: string[];
        requiredScans: string[];
        autoHeal: boolean;
        enforceChain: boolean;
    };
};
/**
 * Replay the receipt chain for a specific time range.
 */
export function replayChain(sinceTimestamp: any, untilTimestamp: any): any[];
/**
 * Express API routes for projection governance.
 */
export function governanceRoutes(app: any): void;
export namespace GOVERNANCE_RULES {
    let maxStalenessMs: number;
    let transportTargets: string[];
    let requiredScans: string[];
    let autoHeal: boolean;
    let enforceChain: boolean;
}
//# sourceMappingURL=projection-governance.d.ts.map