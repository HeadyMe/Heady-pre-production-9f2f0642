export class MonteCarloEngine {
    /**
     * @param {object} [opts]
     * @param {number} [opts.defaultSeed=42]  default PRNG seed
     */
    constructor(opts?: {
        defaultSeed?: number | undefined;
    });
    _defaultSeed: number;
    /** @type {Array<{ scenario: string, result: object, runAt: number }>} */
    _history: Array<{
        scenario: string;
        result: object;
        runAt: number;
    }>;
    /**
     * Fast readiness score from operational signals.
     *
     * @param {object} signals
     * @param {number} [signals.errorRate=0]          fraction 0-1 (lower is better)
     * @param {boolean} [signals.lastDeploySuccess=true]
     * @param {number} [signals.cpuPressure=0]        fraction 0-1 (lower is better)
     * @param {number} [signals.memoryPressure=0]     fraction 0-1 (lower is better)
     * @param {number} [signals.serviceHealthRatio=1] fraction 0-1 (higher is better)
     * @param {number} [signals.openIncidents=0]      integer (lower is better)
     * @returns {{ score: number, grade: string, breakdown: object }}
     */
    quickReadiness(signals?: {
        errorRate?: number | undefined;
        lastDeploySuccess?: boolean | undefined;
        cpuPressure?: number | undefined;
        memoryPressure?: number | undefined;
        serviceHealthRatio?: number | undefined;
        openIncidents?: number | undefined;
    }): {
        score: number;
        grade: string;
        breakdown: object;
    };
    /**
     * Run a full Monte Carlo cycle.
     *
     * @param {object} scenario
     * @param {string} [scenario.name='unnamed']
     * @param {number} [scenario.seed]           PRNG seed (defaults to timestamp)
     * @param {Array<{ name: string, probability: number, impact: number, mitigation?: string }>} [scenario.riskFactors=[]]
     * @param {number} [iterations=10000]
     * @returns {{
     *   scenario: string,
     *   iterations: number,
     *   confidence: number,
     *   failureRate: number,
     *   riskGrade: string,
     *   topMitigations: string[],
     *   outcomes: { success: number, partial: number, failure: number },
     *   confidenceBounds: { lower: number, upper: number },
     *   seed: number,
     * }}
     */
    runFullCycle(scenario?: {
        name?: string | undefined;
        seed?: number | undefined;
        riskFactors?: {
            name: string;
            probability: number;
            impact: number;
            mitigation?: string;
        }[] | undefined;
    }, iterations?: number): {
        scenario: string;
        iterations: number;
        confidence: number;
        failureRate: number;
        riskGrade: string;
        topMitigations: string[];
        outcomes: {
            success: number;
            partial: number;
            failure: number;
        };
        confidenceBounds: {
            lower: number;
            upper: number;
        };
        seed: number;
    };
    /**
     * Return recent simulation history.
     * @param {number} [limit=20]
     * @returns {Array<{ scenario: string, result: object, runAt: number }>}
     */
    getHistory(limit?: number): Array<{
        scenario: string;
        result: object;
        runAt: number;
    }>;
    /**
     * Engine status summary.
     * @returns {{ totalRuns: number, lastRun: number|null }}
     */
    status(): {
        totalRuns: number;
        lastRun: number | null;
    };
}
/**
 * Create a seeded Mulberry32 PRNG.
 * @param {number} seed  32-bit unsigned integer
 * @returns {function(): number} returns floats in [0, 1)
 */
export function mulberry32(seed: number): () => number;
export const RISK_GRADE: Readonly<{
    GREEN: "GREEN";
    YELLOW: "YELLOW";
    ORANGE: "ORANGE";
    RED: "RED";
}>;
//# sourceMappingURL=monte-carlo.d.ts.map