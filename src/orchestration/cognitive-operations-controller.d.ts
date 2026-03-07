export class CognitiveOperationsController {
    constructor(optsOrReceipts: any, opts?: {});
    receipts: any;
    maxRuns: any;
    runs: Map<any, any>;
    runOrder: any[];
    metrics: {
        beforeExecutionChecks: number;
        anomalyEscalations: number;
        completedRuns: number;
        failedClosedRuns: number;
        escalatedRuns: number;
        recoveredTimeoutRuns: number;
        unknownTerminalAttempts: number;
        repeatBreaks: number;
    };
    beginRun(input?: {}): {
        runId: string;
        taskId: string;
        queryClass: any;
        retrievalPolicy: {
            class: any;
            zoneFirst: boolean;
            maxGraphDepth: number;
            targetP95Ms: any;
            rankFormula: string;
        };
        workingMemoryDependencies: any;
        repeatRisk: {
            attempts: any;
            failures: any;
            risk: string;
        };
    };
    checkpoint(runId: any, payload?: {}): {
        ok: boolean;
        runId: any;
        stage: string;
        checkpointCount: any;
        heartbeatAgeMs: number;
    };
    recordAttempt(runId: any, attempt?: {}): {
        ok: boolean;
        runId: any;
        taskId: any;
        repeat: any;
        attempt: any;
    };
    anomaly(runId: any, anomaly?: {}): {
        ok: boolean;
        runId: any;
        anomalyCount: any;
        protocol: string;
    };
    finalize(runId: any, data?: {}): {
        ok: boolean;
        runId: any;
        receipt: any;
        terminalState: string;
    };
    getHealth(): {
        status: string;
        runStats: {
            total: number;
            active: number;
            stale: number;
        };
        metrics: {
            beforeExecutionChecks: number;
            anomalyEscalations: number;
            completedRuns: number;
            failedClosedRuns: number;
            escalatedRuns: number;
            recoveredTimeoutRuns: number;
            unknownTerminalAttempts: number;
            repeatBreaks: number;
        };
        receipts: any;
        retrievalPolicy: {
            urgent: {
                maxDepth: number;
                targetP95Ms: number;
            };
            standard: {
                maxDepth: number;
                targetP95Ms: number;
            };
            diagnostic: {
                maxDepth: number;
                targetP95Ms: number;
            };
        };
        ts: string;
    };
    finalizeRun(runId: any, data: any): {
        ok: boolean;
        runId: any;
        receipt: any;
        terminalState: string;
    };
    recordAnomaly(runId: any, data: any): {
        ok: boolean;
        runId: any;
        anomalyCount: any;
        protocol: string;
    };
    getStatus(): {
        status: string;
        runStats: {
            total: number;
            active: number;
            stale: number;
        };
        metrics: {
            beforeExecutionChecks: number;
            anomalyEscalations: number;
            completedRuns: number;
            failedClosedRuns: number;
            escalatedRuns: number;
            recoveredTimeoutRuns: number;
            unknownTerminalAttempts: number;
            repeatBreaks: number;
        };
        receipts: any;
        retrievalPolicy: {
            urgent: {
                maxDepth: number;
                targetP95Ms: number;
            };
            standard: {
                maxDepth: number;
                targetP95Ms: number;
            };
            diagnostic: {
                maxDepth: number;
                targetP95Ms: number;
            };
        };
        ts: string;
    };
    computeRetrievalPolicy(input: any): {
        class: any;
        zoneFirst: boolean;
        maxGraphDepth: number;
        targetP95Ms: any;
        rankFormula: string;
    };
    _findOpenDependencies(taskId: any): any;
    _repeatRisk(taskId: any): {
        attempts: any;
        failures: any;
        risk: string;
    };
    _normalizeQueryClass(queryClass: any): any;
    _computeRetrievalPolicy(input: any): {
        class: any;
        zoneFirst: boolean;
        maxGraphDepth: number;
        targetP95Ms: any;
        rankFormula: string;
    };
    _saveRun(run: any): void;
    _requireRun(runId: any): any;
}
//# sourceMappingURL=cognitive-operations-controller.d.ts.map