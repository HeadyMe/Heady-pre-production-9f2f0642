export class MonteCarloScheduler {
    constructor(opts?: {});
    simulations: any;
    pools: any;
    history: any[];
    /**
     * Run Monte Carlo simulation for task allocation.
     * @param {Object} task - { type, priority, requiredMemoryMB, estimatedDurationMs }
     * @returns {Object} - { bestPool, confidence, simResults }
     */
    simulate(task: Object): Object;
    _estimateLatency(pool: any, task: any): number;
    _estimateCost(pool: any, task: any): number;
    _estimateAvailability(pool: any): number;
    _estimateMemoryFit(pool: any, requiredMB: any): number;
    getStatus(): {
        ok: boolean;
        simulations: any;
        pools: any;
        historySize: number;
        lastResult: any;
    };
}
export function getMonteCarloScheduler(opts: any): any;
//# sourceMappingURL=monte-carlo-scheduler.d.ts.map