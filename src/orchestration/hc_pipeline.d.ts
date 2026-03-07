export class HCFullPipeline extends EventEmitter<[never]> {
    constructor();
    configs: {
        pipeline: any;
        resources: any;
        services: any;
        governance: any;
        concepts: any;
    } | null;
    state: {
        runId: string;
        pipelineName: any;
        version: any;
        status: string;
        startedAt: null;
        completedAt: null;
        currentStageId: null;
        stages: {};
        checkpoints: never[];
        errors: never[];
        metrics: {
            totalTasks: number;
            completedTasks: number;
            failedTasks: number;
            cachedTasks: number;
            retriedTasks: number;
            errorRate: number;
            readinessScore: number;
            elapsedMs: number;
        };
        configHashes: {};
        log: never[];
    } | null;
    circuitBreakers: Map<any, any>;
    history: any[];
    _mcScheduler: any;
    _patternEngine: any;
    _selfCritique: any;
    _stageTimings: any[];
    /**
     * Bind external systems so the pipeline can feed them data.
     * Call this from heady-manager.js after all systems are loaded.
     * @param {Object} systems - { mcScheduler, patternEngine, selfCritique }
     */
    bind(systems?: Object): void;
    load(): any;
    run(): Promise<{
        runId: string;
        pipelineName: any;
        version: any;
        status: string;
        startedAt: null;
        completedAt: null;
        currentStageId: null;
        stages: {};
        checkpoints: never[];
        errors: never[];
        metrics: {
            totalTasks: number;
            completedTasks: number;
            failedTasks: number;
            cachedTasks: number;
            retriedTasks: number;
            errorRate: number;
            readinessScore: number;
            elapsedMs: number;
        };
        configHashes: {};
        log: never[];
    }>;
    /**
     * Post-run feedback: feed timing data to MC scheduler and pattern engine,
     * run self-critique on the completed run, record improvements.
     */
    _postRunFeedback(): Promise<void>;
    getState(): {
        runId: string;
        pipelineName: any;
        version: any;
        status: string;
        startedAt: null;
        completedAt: null;
        currentStageId: null;
        stages: {};
        checkpoints: never[];
        errors: never[];
        metrics: {
            totalTasks: number;
            completedTasks: number;
            failedTasks: number;
            cachedTasks: number;
            retriedTasks: number;
            errorRate: number;
            readinessScore: number;
            elapsedMs: number;
        };
        configHashes: {};
        log: never[];
    } | null;
    getHistory(): any[];
    getCircuitBreakers(): {};
    getStageDag(): any;
    getConfigSummary(): {
        name: any;
        version: any;
        stages: any;
        totalTasks: any;
        global: any;
        stopRule: any;
        checkpointProtocol: {
            responsibilities: any;
            configHashSources: any;
        };
        configHashes: {};
        services: any;
        agents: any;
        concepts: {
            implemented: any;
            planned: any;
            publicDomain: any;
        };
    };
}
export const pipeline: HCFullPipeline;
export function registerTaskHandler(taskName: any, handler: any): void;
export namespace RunStatus {
    let IDLE: string;
    let RUNNING: string;
    let PAUSED: string;
    let RECOVERY: string;
    let HALTED: string;
    let COMPLETED: string;
    let FAILED: string;
}
export class CircuitBreaker {
    constructor(config: any);
    enabled: boolean;
    failureThreshold: any;
    resetTimeoutMs: any;
    halfOpenMax: any;
    state: string;
    failures: number;
    lastFailureAt: number | null;
    halfOpenAttempts: number;
    canExecute(): boolean;
    recordSuccess(): void;
    recordFailure(): void;
    getStatus(): {
        state: string;
        failures: number;
        threshold: any;
    };
}
export class WorkerPool {
    constructor(concurrency: any);
    concurrency: any;
    running: number;
    queue: any[];
    run(fn: any): Promise<any>;
    _drain(): void;
    runAll(fns: any): Promise<PromiseSettledResult<any>[]>;
    getStats(): {
        concurrency: any;
        running: number;
        queued: number;
    };
}
export function loadAllConfigs(): {
    pipeline: any;
    resources: any;
    services: any;
    governance: any;
    concepts: any;
};
export function computeConfigHashes(sources: any): {};
export function topologicalSort(stages: any): any[];
export function invalidateCache(): void;
import EventEmitter = require("events");
//# sourceMappingURL=hc_pipeline.d.ts.map