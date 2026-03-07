/**
 * @heady/orchestrator — Service Orchestration & Liquid Architecture
 *
 * Manages dynamic resource allocation, Monte Carlo scheduling,
 * health probes, self-healing, and container morphing across
 * the Heady fleet (Colab + Cloud Run + Edge + Local).
 */
export interface OrchestrationTask {
    id: string;
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    requiredMemoryMB: number;
    estimatedDurationMs: number;
    payload?: Record<string, unknown>;
}
export interface SchedulingResult {
    taskId: string;
    assignedPool: string;
    confidence: number;
    latencyMs: number;
    simulations: number;
}
declare const RESOURCE_POOLS: readonly ["colab-brain", "colab-memory", "colab-conductor", "cloudrun-prod", "cloudrun-staging", "edge-cf", "local-ryzen"];
export type ResourcePool = typeof RESOURCE_POOLS[number];
export declare class HeadyOrchestrator {
    private taskQueue;
    private scheduledCount;
    private startTime;
    schedule(task: OrchestrationTask): Promise<SchedulingResult>;
    private estimateLatency;
    private estimateCost;
    private estimateMemory;
    getStatus(): {
        ok: boolean;
        uptime: number;
        scheduled: number;
        queueSize: number;
        pools: readonly ["colab-brain", "colab-memory", "colab-conductor", "cloudrun-prod", "cloudrun-staging", "edge-cf", "local-ryzen"];
    };
}
export declare function createOrchestrator(): HeadyOrchestrator;
export {};
//# sourceMappingURL=index.d.ts.map