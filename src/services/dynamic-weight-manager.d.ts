export class DynamicWeightManager {
    agents: Map<any, any>;
    weights: Map<any, any>;
    masterAgentId: any;
    reweightTimer: NodeJS.Timeout | null;
    epoch: number;
    register(agentId: any, config?: {}): any;
    reportMetrics(agentId: any, metrics: any): void;
    recalculate(): void;
    /**
     * Get the best agent for a task, weighted by dynamic scores.
     */
    getBestAgent(excludeIds?: any[]): {
        agentId: any;
        weight: number;
    } | null;
    /**
     * Get ranked agents by weight.
     */
    getRanking(): {
        agentId: any;
        weight: number;
        metrics: any;
    }[];
    start(): void;
    stop(): void;
    getHealth(): {
        epoch: number;
        totalAgents: number;
        masterAgent: any;
        ranking: {
            agentId: any;
            weight: number;
            metrics: any;
        }[];
        reweightIntervalMs: number;
    };
}
export const dynamicWeights: DynamicWeightManager;
export function registerDynamicWeightRoutes(app: any): void;
//# sourceMappingURL=dynamic-weight-manager.d.ts.map