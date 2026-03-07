export function registerRoutes(app: any, orchestrator: any): void;
export function getDashboard(orchestrator: any): Promise<{
    ts: string;
    local: {
        hostname: string;
        platform: NodeJS.Platform;
        arch: NodeJS.Architecture;
        cpu: {
            cores: number;
            model: string;
            loadAvg1m: number;
            loadAvg5m: number;
            loadAvg15m: number;
            utilization: number;
        };
        memory: {
            total: string;
            free: string;
            used: string;
            utilization: number;
        };
        uptime: number;
        nodeVersion: string;
        processMemory: {
            rss: string;
            heapUsed: string;
            heapTotal: string;
        };
    };
    providers: {
        service: string;
        type: string;
        configured: boolean;
        keyCount: number;
        totalKeys: number;
    }[];
    nodes: any[];
    orchestrator: any;
    data: {};
    summary: {
        cpuUtil: string;
        memUtil: string;
        activeProviders: string;
        activeAgents: any;
        completedTasks: any;
        vectorEntries: any;
        auditEntries: any;
    };
}>;
export function getLocalResources(): {
    hostname: string;
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
    cpu: {
        cores: number;
        model: string;
        loadAvg1m: number;
        loadAvg5m: number;
        loadAvg15m: number;
        utilization: number;
    };
    memory: {
        total: string;
        free: string;
        used: string;
        utilization: number;
    };
    uptime: number;
    nodeVersion: string;
    processMemory: {
        rss: string;
        heapUsed: string;
        heapTotal: string;
    };
};
export function getProviderStatus(): {
    service: string;
    type: string;
    configured: boolean;
    keyCount: number;
    totalKeys: number;
}[];
//# sourceMappingURL=compute-dashboard.d.ts.map