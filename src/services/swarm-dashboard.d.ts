export = SwarmDashboard;
declare class SwarmDashboard {
    _runs: any[];
    _bestConfig: {
        id: string;
        timestamp: string;
        config: any;
        metrics: any;
        confidence: number;
    } | null;
    recordRun(config: any, metrics: any): {
        id: string;
        timestamp: string;
        config: any;
        metrics: any;
        confidence: number;
    };
    _computeConfidence(metrics: any): number;
    getExplorationTree(): {
        totalRuns: number;
        bestConfig: {
            id: string;
            timestamp: string;
            config: any;
            metrics: any;
            confidence: number;
        } | null;
        recentRuns: any[];
        convergence: number;
        explorationRate: number;
    };
    getSummary(): {
        status: string;
        totalRuns?: undefined;
        bestScore?: undefined;
        avgScore?: undefined;
        worstScore?: undefined;
        bestConfig?: undefined;
        convergenceConfidence?: undefined;
    } | {
        totalRuns: number;
        bestScore: number;
        avgScore: number;
        worstScore: number;
        bestConfig: any;
        convergenceConfidence: number;
        status?: undefined;
    };
    routes(router: any): any;
}
//# sourceMappingURL=swarm-dashboard.d.ts.map