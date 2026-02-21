import { AiRouter, AiTaskContext, ProviderChoice, AiRoutingResult, RoutingMetrics, HealthStatus, RoutingConfig } from './types';
export declare class HCAiRouter implements AiRouter {
    private config;
    private metrics;
    private routingHistory;
    private determinismSeed;
    private configPath;
    private telemetry;
    private nodeCapabilities;
    private providerClients;
    private configVersion;
    private orsHistory;
    private performanceCache;
    constructor(configPath?: string);
    initialize(): Promise<void>;
    private loadConfig;
    private loadNodeCapabilities;
    chooseProvider(ctx: AiTaskContext): Promise<ProviderChoice>;
    private getOrsMode;
    private selectOptimalProvider;
    private isProviderAvailable;
    private calculateProviderScore;
    private calculateTemperature;
    private generateRoutingReason;
    private calculateConfidence;
    private estimateCost;
    private getCloudUsagePercent;
    private getLocalCpuPercent;
    private logRoutingDecision;
    runTask<TOutput = any>(ctx: AiTaskContext, prompt: string | object): Promise<AiRoutingResult<TOutput>>;
    private executeWithProvider;
    private updateMetrics;
    getHealth(): Promise<HealthStatus>;
    private generateAlerts;
    getMetrics(): RoutingMetrics;
    updateConfig(config: Partial<RoutingConfig>): Promise<void>;
    reloadConfig(): Promise<void>;
    analyzePerformance(): Promise<{
        insights: string[];
        recommendations: string[];
        configUpdates: Partial<RoutingConfig>;
    }>;
    setDeterminismSeed(seed: number): void;
    getRoutingHistory(traceId?: string): Promise<AiRoutingResult[]>;
}
//# sourceMappingURL=ai-router.d.ts.map