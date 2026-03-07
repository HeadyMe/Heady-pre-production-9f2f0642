export = HCFullPipeline;
declare class HCFullPipeline extends EventEmitter<[never]> {
    constructor(opts?: {});
    maxConcurrent: any;
    runs: Map<any, any>;
    monteCarlo: any;
    policyEngine: any;
    incidentManager: any;
    errorInterceptor: any;
    vectorMemory: any;
    selfAwareness: any;
    buddyMetacognition: any;
    selfHealStats: {
        attempts: number;
        successes: number;
        failures: number;
    };
    /**
     * Auto-wire pipeline events into the self-awareness telemetry loop.
     * Every stage completion/failure is ingested as a telemetry event,
     * creating the recursive feedback loop for true self-awareness.
     */
    _wireAutoTelemetry(): void;
    _createSeededRng(seed: any): () => number;
    createRun(request?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        requestId: any;
        seed: number;
        status: string;
        currentStage: number;
        stages: {
            num: number;
            name: string;
            status: string;
            startedAt: null;
            finishedAt: null;
            metrics: {};
            result: null;
            error: null;
        }[];
        request: {};
        config: {
            arenaEnabled: boolean;
            approvalRequired: boolean;
            skipStages: any;
        };
        startedAt: null;
        finishedAt: null;
        result: null;
    };
    execute(runId: any): Promise<any>;
    _executeStage(run: any, stage: any): Promise<any>;
    /**
     * INTAKE — The Async Semantic Barrier
     * CRITICAL: Vector memory is queried BEFORE any downstream reaction.
     * The pipeline is structurally blocked from proceeding until 3D vector
     * context is fully retrieved and injected into the run context.
     * This eliminates the race condition that causes memoryless hallucination.
     */
    _stageIntake(run: any): Promise<{
        validated: boolean;
        taskType: any;
        inputSize: number;
        semanticBarrier: {
            vectorContextNodes: any;
            graphContextNodes: any;
            topScore: any;
            retrievedAt: any;
            grounded: boolean;
        };
    }>;
    _stageTriage(run: any): {
        priority: any;
        riskLevel: any;
        nodePool: any;
        triaged: boolean;
    };
    _stageMonteCarlo(run: any): any;
    _stageArena(run: any): {
        skipped: boolean;
        reason: string;
        entries?: undefined;
        winner?: undefined;
        nodeCount?: undefined;
        deterministic?: undefined;
    } | {
        entries: any;
        winner: any;
        nodeCount: any;
        deterministic: boolean;
        skipped?: undefined;
        reason?: undefined;
    };
    _stageJudge(run: any): {
        skipped: boolean;
        reason: string;
        winner?: undefined;
        score?: undefined;
        deterministic?: undefined;
        criteria?: undefined;
    } | {
        winner: any;
        score: any;
        deterministic: boolean;
        criteria: {
            correctness: number;
            quality: number;
            performance: number;
            safety: number;
            creativity: number;
        };
        skipped?: undefined;
        reason?: undefined;
    };
    _stageApprove(run: any): {
        approved: boolean;
        auto: boolean;
        reason: string;
        pending?: undefined;
    } | {
        approved: boolean;
        pending: boolean;
        reason: string;
        auto?: undefined;
    };
    /**
     * EXECUTE — Metacognitive Gate
     * Before executing, Buddy assesses system confidence.
     * If self-awareness reports critically low confidence, execution is blocked.
     * This implements the "Agentic Metacognition" subroutine from the blueprint.
     */
    _stageExecute(run: any): Promise<{
        executed: boolean;
        winner: any;
        ts: string;
        contextDepth: any;
        groundedInMemory: boolean;
        metacognition: {
            confidence: any;
            errorRate1m: any;
            recommendations: any;
        } | null;
    }>;
    _stageVerify(run: any): {
        passed: true;
        confidence: any;
        ts: string;
    };
    _stageReceipt(run: any): {
        receiptId: `${string}-${string}-${string}-${string}-${string}`;
        runId: any;
        requestId: any;
        seed: any;
        stages: any;
        winner: any;
        confidence: any;
        ts: string;
    };
    _selectNodePool(taskType: any): any;
    _rollback(run: any, failedIndex: any): Promise<void>;
    /**
     * Attempts to automatically remediate a stage failure.
     * Checks vector memory for similar past failures with known resolutions.
     * @returns {boolean} true if self-heal found a resolution
     */
    _selfHeal(run: any, stage: any, error: any, stageIndex: any): boolean;
    resume(runId: any, approval?: {}): Promise<any>;
    getRun(runId: any): any;
    listRuns(limit?: number): any[];
    status(): {
        total: number;
        running: number;
        paused: number;
        completed: number;
        failed: number;
        selfHeal: {
            attempts: number;
            successes: number;
            failures: number;
        };
    };
}
declare namespace HCFullPipeline {
    export { STAGES };
    export { STATUS };
}
import { EventEmitter } from "events";
declare const STAGES: string[];
declare namespace STATUS {
    let PENDING: string;
    let RUNNING: string;
    let COMPLETED: string;
    let FAILED: string;
    let PAUSED: string;
    let SKIPPED: string;
    let ROLLED_BACK: string;
}
//# sourceMappingURL=hc-full-pipeline.d.ts.map