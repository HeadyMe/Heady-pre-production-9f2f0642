export class CognitiveRuntimeGovernor {
    started: number;
    ingressCount: number;
    executionCount: number;
    completionCount: number;
    terminalStateViolations: number;
    repeatInterceptions: number;
    prefetchHits: number;
    prefetchMisses: number;
    p95RetrievalMs: number;
    phaseStatus: Map<string, {
        ready: boolean;
        reason: string;
    }>;
    recordIngress(task?: {}): {
        taskId: string;
        intent: string;
        urgency: any;
        risk: any;
        memoryScope: any;
        ts: string;
    };
    recordPrefetch(prefetch?: {}): void;
    recordExecution(event?: {}): void;
    recordCompletion(result?: {}): {
        ok: boolean;
        error: string;
        terminalState?: undefined;
    } | {
        ok: boolean;
        terminalState: any;
        error?: undefined;
    };
    evaluateMigrationPhase(phase: any, evidence?: {}): {
        ok: boolean;
        error: string;
        phase?: undefined;
        ready?: undefined;
        reason?: undefined;
    } | {
        ok: boolean;
        phase: string;
        ready: boolean;
        reason: string;
        error?: undefined;
    };
    getStatus(): {
        ok: boolean;
        uptimeMs: number;
        metrics: {
            ingressCount: number;
            executionCount: number;
            completionCount: number;
            terminalStateViolations: number;
            repeatInterceptions: number;
            firstPassPrefetchHitRate: number;
            p95RetrievalMs: number;
        };
        phases: {
            [k: string]: {
                ready: boolean;
                reason: string;
            };
        };
        ts: string;
    };
}
export function getCognitiveRuntimeGovernor(): any;
//# sourceMappingURL=cognitive-runtime-governor.d.ts.map