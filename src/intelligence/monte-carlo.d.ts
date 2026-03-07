export = MonteCarloEngine;
declare class MonteCarloEngine {
    constructor(opts?: {});
    defaultIterations: any;
    seed: any;
    history: any[];
    _seededRandom(seed: any): number;
    quickReadiness(signals?: {}): {
        score: number;
        grade: string;
        signals: {};
        ts: string;
        recommendation: string;
    };
    runFullCycle(scenario?: {}, iterations?: any): {
        scenario: any;
        iterations: any;
        seed: any;
        outcomes: {
            success: number;
            partial: number;
            failure: number;
        };
        confidence: number;
        failureRate: number;
        riskGrade: string;
        topMitigations: any;
        ts: string;
    };
    getHistory(limit?: number): any[];
    status(): {
        runsCompleted: number;
        lastRun: any;
        defaultIterations: any;
    };
}
//# sourceMappingURL=monte-carlo.d.ts.map