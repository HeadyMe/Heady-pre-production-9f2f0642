export function loadAllConfigs(): {
    pipeline: any;
    resources: any;
    services: any;
    governance: any;
    concepts: any;
};
export function computeConfigHashes(sources: any): {};
export namespace RunStatus {
    let IDLE: string;
    let RUNNING: string;
    let PAUSED: string;
    let RECOVERY: string;
    let HALTED: string;
    let COMPLETED: string;
    let FAILED: string;
}
export function createRunState(pipelineDef: any): {
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
};
export function appendLog(state: any, level: any, message: any, detail: any): void;
export function evaluateStopRules(state: any, stopRule: any): {
    condition: any;
    triggered: boolean;
} | null;
export function applyStopAction(state: any, action: any): void;
export function runCheckpoint(state: any, stageId: any, checkpointProtocol: any, configHashSources: any): {
    id: string;
    stageId: any;
    ts: string;
    configHashes: {};
    readinessScore: any;
    errorRate: any;
    completedTasks: any;
    failedTasks: any;
    responsibilities: never[];
};
export function topologicalSort(stages: any): any[];
//# sourceMappingURL=pipeline-core.d.ts.map