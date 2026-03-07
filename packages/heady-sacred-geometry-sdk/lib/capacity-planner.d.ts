export class CapacityPlanner {
    constructor(tier?: string);
    tier: string;
    params: {
        maxConnections: number;
        maxVectors: number;
        cacheEntries: number;
        retryLimit: number;
        timeoutMs: number;
        healthInterval: number;
        scanInterval: number;
        backupInterval: number;
        scaleFactor: number;
        splitRatio: number;
    };
    _allocations: Map<any, any>;
    /**
     * Allocate resources between two competing agents using golden split
     * @param {string} primaryId - primary agent
     * @param {string} secondaryId - secondary agent
     * @param {number} totalBudget - total resource units
     * @returns {{ primary: number, secondary: number }}
     */
    allocate(primaryId: string, secondaryId: string, totalBudget: number): {
        primary: number;
        secondary: number;
    };
    /**
     * Compute retry delay for a given attempt using φ-backoff
     * @param {number} attempt - attempt number (0-based)
     * @returns {number} delay in ms
     */
    retryDelay(attempt: number): number;
    /**
     * Generate alert thresholds for monitoring
     * @param {number} count - number of threshold levels
     * @returns {number[]} percentage thresholds
     */
    alertThresholds(count?: number): number[];
    /**
     * Scale agent capacity for a given hierarchy level
     * @param {number} level - hierarchy depth
     * @returns {object} scaled capacity parameters
     */
    scaleForLevel(level: number): object;
    /**
     * Generate a harmonic capacity series for scaling
     * @param {number} baseCapacity
     * @param {number} levels
     * @returns {number[]}
     */
    harmonicSeries(baseCapacity: number, levels?: number): number[];
    /**
     * Classify a metric into a Sacred Geometry tier
     * @param {number} normalizedValue - 0 to 1
     * @returns {{ tier: number, label: string, base13: string }}
     */
    classify(normalizedValue: number): {
        tier: number;
        label: string;
        base13: string;
    };
    /**
     * Get current planner state
     */
    getState(): {
        tier: string;
        params: {
            maxConnections: number;
            maxVectors: number;
            cacheEntries: number;
            retryLimit: number;
            timeoutMs: number;
            healthInterval: number;
            scanInterval: number;
            backupInterval: number;
            scaleFactor: number;
            splitRatio: number;
        };
        activeAllocations: number;
        backoffCurve: {
            attempt: number;
            delayMs: number;
        }[];
    };
}
//# sourceMappingURL=capacity-planner.d.ts.map