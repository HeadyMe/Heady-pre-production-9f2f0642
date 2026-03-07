export class HeadyOrchestrator extends EventEmitter<[never]> {
    constructor(options?: {});
    options: {
        maxConcurrentWorkflows: number;
    };
    _workflows: Map<any, any>;
    _poolActive: {
        HOT: number;
        WARM: number;
        COLD: number;
        RESERVE: number;
        GOVERNANCE: number;
    };
    _progressListeners: Map<any, any>;
    _createWorkflowState(workflowSpec: any): {
        workflowId: any;
        spec: any;
        steps: any;
        status: string;
        createdAt: number;
        startedAt: null;
        completedAt: null;
        results: {};
        errors: never[];
        pool: any;
    };
    onProgress(workflowId: any, callback: any): void;
    _emitProgress(workflowId: any, update: any): void;
    _acquirePoolSlot(pool: any): boolean;
    _releasePoolSlot(pool: any): void;
    _waitForPoolSlot(pool: any, timeoutMs?: number): Promise<boolean>;
    _executeStep(wf: any, step: any, context: any): Promise<boolean>;
    _runWithTimeout(fn: any, ms: any, message: any): Promise<any>;
    _invokeStep(step: any, context: any): Promise<any>;
    _executeSequential(wf: any, steps: any, context: any): Promise<boolean>;
    _executeParallel(wf: any, steps: any, context: any): Promise<boolean>;
    execute(workflowSpec: any): Promise<{
        workflowId: any;
        status: string;
        totalSteps: any;
        completed: any;
        failed: any;
        skipped: any;
        duration: number;
        results: {};
        errors: never[];
    }>;
    getWorkflow(workflowId: any): any;
    listWorkflows(status: any): any[];
    getPoolStatus(): {};
}
export namespace STEP_STATUS {
    let PENDING: string;
    let RUNNING: string;
    let COMPLETED: string;
    let FAILED: string;
    let SKIPPED: string;
    let TIMEOUT: string;
}
export namespace WORKFLOW_STATUS {
    export let QUEUED: string;
    let RUNNING_1: string;
    export { RUNNING_1 as RUNNING };
    let COMPLETED_1: string;
    export { COMPLETED_1 as COMPLETED };
    let FAILED_1: string;
    export { FAILED_1 as FAILED };
    export let PARTIAL: string;
}
export namespace POOL_CONCURRENCY {
    let HOT: number;
    let WARM: number;
    let COLD: number;
    let RESERVE: number;
    let GOVERNANCE: number;
}
export function phiBackoffDelay(attempt: any): number;
import { EventEmitter } from "events";
//# sourceMappingURL=heady-orchestrator.d.ts.map