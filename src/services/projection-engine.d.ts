/**
 * Get the current projection manifest.
 * Returns all active projections with health and staleness info.
 */
export function getProjectionManifest(): {
    receipt: {
        hash: string;
        timestamp: string;
    };
    version: any;
    sourceOfTruth: string;
    totalTargets: number;
    activeTargets: number;
    staleTargets: number;
    targets: {
        name: string;
        type: string;
        endpoint: string;
        status: string;
        stalenessBudgetMs: number;
        lastProjectedAt: any;
        lastProjectionHash: any;
        ageMs: number | null;
        isStale: boolean;
        healthPath: string | null;
    }[];
};
/**
 * Project to a specific target.
 * Records the projection event and updates state.
 *
 * @param {string} target - Target name (cloud-run, cloudflare-edge, etc.)
 * @param {Object} options - Projection options
 * @returns {Object} Projection result
 */
export function projectToTarget(target: string, options?: Object): Object;
/**
 * Detect and report stale projections.
 * Returns a cleanup plan without executing it.
 */
export function pruneStaleProjections(): {
    receipt: {
        hash: string;
        timestamp: string;
    };
    totalProjections: number;
    staleCount: number;
    staleProjections: {
        name: string;
        type: string;
        ageMs: number | null;
        stalenessBudgetMs: number;
        overBudgetMs: number;
        recommendation: string;
    }[];
    actions: {
        action: string;
        target: string;
        reason: string;
    }[];
};
/**
 * Execute a full projection sync across all active targets.
 */
export function syncAllProjections(options?: {}): {
    receipt: {
        hash: string;
        timestamp: string;
    };
    syncedTargets: number;
    results: Object[];
};
/**
 * Add or update a projection target.
 */
export function registerTarget(name: any, config: any): {
    success: boolean;
    target: any;
    config: any;
};
/**
 * Deprecate a projection target.
 */
export function deprecateTarget(name: any): {
    success: boolean;
    error: string;
    target?: undefined;
    status?: undefined;
} | {
    success: boolean;
    target: any;
    status: string;
    error?: undefined;
};
/**
 * Get projection history.
 */
export function getProjectionHistory(limit?: number): any[];
export function projectionRoutes(app: any): void;
export const PROJECTION_TARGETS: {
    'cloud-run': {
        type: string;
        endpoint: string;
        healthPath: string;
        stalenessBudgetMs: number;
        status: string;
    };
    'cloudflare-edge': {
        type: string;
        endpoint: string;
        healthPath: string;
        stalenessBudgetMs: number;
        status: string;
    };
    'huggingface-spaces': {
        type: string;
        endpoint: string;
        healthPath: string;
        stalenessBudgetMs: number;
        status: string;
    };
    'github-monorepo': {
        type: string;
        endpoint: string;
        healthPath: null;
        stalenessBudgetMs: number;
        status: string;
    };
};
//# sourceMappingURL=projection-engine.d.ts.map