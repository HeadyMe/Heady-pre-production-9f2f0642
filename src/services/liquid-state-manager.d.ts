export namespace STATES {
    let LATENT: string;
    let MATERIALIZING: string;
    let PROJECTED: string;
    let STALE: string;
    let PRUNED: string;
}
export const TRANSITIONS: {
    [STATES.LATENT]: string[];
    [STATES.MATERIALIZING]: string[];
    [STATES.PROJECTED]: string[];
    [STATES.STALE]: string[];
    [STATES.PRUNED]: string[];
};
export const STALENESS_BUDGETS: {
    'cloud-run': number;
    'cloudflare-edge': number;
    'github-monorepo': number;
    'huggingface-spaces': number;
    'colab-notebooks': number;
    'local-dev': number;
};
/**
 * Initialize a target into the lifecycle as LATENT.
 *
 * @param {string} targetId - Unique target identifier
 * @param {Object} meta - Target metadata (type, url, tier, etc.)
 */
export function registerTarget(targetId: string, meta?: Object): any;
/**
 * Transition a target to MATERIALIZING state (projection starting).
 *
 * @param {string} targetId
 * @returns {Object} Transition result
 */
export function materialize(targetId: string): Object;
/**
 * Mark a target as PROJECTED (projection complete).
 *
 * @param {string} targetId
 * @param {Object} result - Sync result metadata
 * @returns {Object} Transition result
 */
export function markProjected(targetId: string, result?: Object): Object;
/**
 * Mark a target as STALE (needs refresh).
 *
 * @param {string} targetId
 * @param {string} reason
 * @returns {Object} Transition result
 */
export function markStale(targetId: string, reason?: string): Object;
/**
 * Prune a target (remove projection, return to latent pool).
 *
 * @param {string} targetId
 * @param {string} reason
 * @returns {Object} Transition result
 */
export function prune(targetId: string, reason?: string): Object;
/**
 * Return a pruned target back to LATENT for re-projection.
 *
 * @param {string} targetId
 * @returns {Object} Transition result
 */
export function reactivate(targetId: string): Object;
/**
 * Full lifecycle: LATENT → MATERIALIZING → PROJECTED in one call.
 * Used when the projection sync is synchronous or already complete.
 *
 * @param {string} targetId
 * @param {Object} result - Sync result metadata
 * @returns {Object} Final transition result
 */
export function projectFull(targetId: string, result?: Object): Object;
/**
 * Check all PROJECTED targets and auto-transition to STALE if they
 * exceed their staleness budget.
 *
 * @returns {Array} List of targets that transitioned to STALE
 */
export function detectStaleness(): any[];
/**
 * Get the full lifecycle map — all targets with their current states.
 */
export function getLifecycleMap(): {};
/**
 * Get targets in a specific state.
 */
export function getByState(state: any): any[];
/**
 * Get the transition log (audit trail).
 */
export function getTransitionLog(limit?: number): any[];
/**
 * Get lifecycle dashboard summary.
 */
export function getDashboard(): {
    totalTargets: number;
    stateCounts: {};
    transitionLogSize: number;
    lastTransition: any;
    states: {
        LATENT: string;
        MATERIALIZING: string;
        PROJECTED: string;
        STALE: string;
        PRUNED: string;
    };
};
export function boot(): {
    totalTargets: number;
    stateCounts: {};
    transitionLogSize: number;
    lastTransition: any;
    states: {
        LATENT: string;
        MATERIALIZING: string;
        PROJECTED: string;
        STALE: string;
        PRUNED: string;
    };
};
export function liquidStateRoutes(app: any): void;
//# sourceMappingURL=liquid-state-manager.d.ts.map