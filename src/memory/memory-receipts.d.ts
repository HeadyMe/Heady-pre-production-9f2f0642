export = MemoryReceipts;
declare class MemoryReceipts {
    constructor(opts?: {});
    receipts: any[];
    maxReceipts: any;
    stats: {
        ingested: number;
        embedded: number;
        stored: number;
        dropped: number;
    };
    attempts: any[];
    maxAttempts: any;
    taskStates: Map<any, any>;
    repeatFingerprintCounts: Map<any, any>;
    repeatThreshold: any;
    repeatWindowMs: any;
    maxRepeatFingerprints: any;
    emit(receipt: any): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        operation: any;
        source: any;
        sourceId: any;
        documentId: any;
        stored: boolean;
        reason: any;
        contentHash: any;
        details: any;
        ts: string;
    };
    ingest(source: any, sourceId: any, opts?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        operation: any;
        source: any;
        sourceId: any;
        documentId: any;
        stored: boolean;
        reason: any;
        contentHash: any;
        details: any;
        ts: string;
    };
    embed(documentId: any, provider: any, model: any, opts?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        operation: any;
        source: any;
        sourceId: any;
        documentId: any;
        stored: boolean;
        reason: any;
        contentHash: any;
        details: any;
        ts: string;
    };
    store(source: any, sourceId: any, documentId: any, opts?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        operation: any;
        source: any;
        sourceId: any;
        documentId: any;
        stored: boolean;
        reason: any;
        contentHash: any;
        details: any;
        ts: string;
    };
    drop(source: any, sourceId: any, reason: any, opts?: {}): {
        id: `${string}-${string}-${string}-${string}-${string}`;
        operation: any;
        source: any;
        sourceId: any;
        documentId: any;
        stored: boolean;
        reason: any;
        contentHash: any;
        details: any;
        ts: string;
    };
    getReceipts(filter?: {}, limit?: number): any[];
    getStats(): {
        total: number;
        storedRate: number;
        attempts: number;
        activeTasks: number;
        repeatFingerprints: number;
        ingested: number;
        embedded: number;
        stored: number;
        dropped: number;
    };
    recordAttempt(attempt?: {}): {
        attempt: {
            id: `${string}-${string}-${string}-${string}-${string}`;
            taskId: string;
            inputHash: string | null;
            constraintsHash: string | null;
            outputHash: string | null;
            verdict: string;
            errorClass: string | null;
            metadata: any;
            ts: string;
        };
        repeat: {
            detected: boolean;
            count: number;
            fingerprint: null;
            threshold?: undefined;
        } | {
            detected: boolean;
            count: any;
            threshold: any;
            fingerprint: string;
        };
        taskState: any;
    };
    closeTask(taskId: any, terminalState: any, reason: any, evidence?: {}): {
        taskId: string;
        closed: boolean;
        terminalState: any;
        reason: any;
        evidence: any;
        closedAt: any;
        idempotent: boolean;
    } | {
        taskId: string;
        closed: boolean;
        terminalState: any;
        reason: any;
        evidence: any;
        closedAt: any;
        idempotent?: undefined;
    };
    getTaskState(taskId: any): any;
    listOpenTasks(limit?: number): any[];
    getAttempts(limit?: number): any[];
    getOperationalStatus(): {
        status: string;
        terminalStates: string[];
        allowedVerdicts: string[];
        capacity: {
            maxReceipts: any;
            maxAttempts: any;
            maxRepeatFingerprints: any;
        };
        stats: {
            total: number;
            storedRate: number;
            attempts: number;
            activeTasks: number;
            repeatFingerprints: number;
            ingested: number;
            embedded: number;
            stored: number;
            dropped: number;
        };
        ts: string;
    };
    _trackRepeatFailure(attempt: any): {
        detected: boolean;
        count: number;
        fingerprint: null;
        threshold?: undefined;
    } | {
        detected: boolean;
        count: any;
        threshold: any;
        fingerprint: string;
    };
}
declare namespace MemoryReceipts {
    export { TERMINAL_STATES };
}
declare const TERMINAL_STATES: Set<string>;
//# sourceMappingURL=memory-receipts.d.ts.map