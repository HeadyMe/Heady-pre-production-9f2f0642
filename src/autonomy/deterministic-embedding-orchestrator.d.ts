export class DeterministicEmbeddingOrchestrator {
    constructor({ fabricConfig }?: {});
    config: any;
    jobs: any[];
    completedJobs: any[];
    plan(options?: {}): {
        ok: boolean;
        version: number;
        planHash: string;
        slo: any;
        storage: any;
        orchestration: any;
        jobs: any;
        learningLoops: any;
        nodeResponsibilities: any;
        generatedAt: string;
    };
    executeJob(jobHash: any): {
        ok: boolean;
        hash: any;
        sourceId: any;
        type: any;
        status: string;
        embeddingType: any;
        assignedSubscription: any;
        startedAt: string;
        completedAt: string;
        latencyMs: number;
    } | {
        ok: boolean;
        error: string;
        hash: any;
    };
    getStatus(): {
        ok: boolean;
        totalJobs: number;
        completedJobs: number;
        pendingJobs: number;
        slo: any;
        storage: any;
        learningLoops: any;
        generatedAt: string;
    };
    health(): {
        ok: boolean;
        service: string;
        configLoaded: boolean;
        dataSources: any;
        subscriptions: any;
        learningLoops: any;
        timestamp: string;
    };
}
export function registerEmbeddingOrchestratorRoutes(app: any, orchestrator: any): void;
export function loadFabricConfig(): any;
export function computeJobHash(jobSpec: any): string;
//# sourceMappingURL=deterministic-embedding-orchestrator.d.ts.map