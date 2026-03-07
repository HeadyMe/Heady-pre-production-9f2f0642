export function computeSwarmAllocation(input?: {}): {
    targetBees: number;
    targetSwarms: number;
    asyncConcurrency: number;
    strategy: string;
    score: {
        loadScore: number;
        pendingTasks: number;
        p95LatencyMs: number;
        errorRate: number;
    };
};
export function evaluateLiveCloudStatus(input?: {}): {
    hasCloudUrl: boolean;
    heartbeatHealthy: boolean;
    servicesHealthy: boolean;
    liveReady: boolean;
};
//# sourceMappingURL=swarm-intelligence.d.ts.map