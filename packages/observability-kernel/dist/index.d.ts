export interface WorkflowRecord {
    workflowId: string;
    kind: string;
    createdAt: number;
    attributes: Record<string, unknown>;
}
export interface SpanRecord {
    spanId: string;
    workflowId: string;
    name: string;
    startedAt: number;
    endedAt?: number;
    attributes: Record<string, unknown>;
}
export interface AuditRecord {
    auditId: string;
    kind: string;
    payload: unknown;
    createdAt: number;
    hash: string;
    previousHash: string;
}
export declare class ObservabilityKernel {
    private readonly workflows;
    private readonly spans;
    private readonly auditLog;
    private readonly neuralStream;
    createWorkflow(kind: string, attributes?: Record<string, unknown>): WorkflowRecord;
    startSpan(workflowId: string, name: string, attributes?: Record<string, unknown>): SpanRecord;
    endSpan(spanId: string, attributes?: Record<string, unknown>): SpanRecord;
    recordNeuralEvent(workflowId: string, type: string, payload: unknown, vector?: number[]): void;
    appendAudit(kind: string, payload: unknown): AuditRecord;
    getWorkflow(workflowId: string): WorkflowRecord | undefined;
    getWorkflowSpans(workflowId: string): SpanRecord[];
    exportAuditTrail(): AuditRecord[];
    metrics(): {
        workflows: number;
        spans: number;
        auditRecords: number;
        neuralEvents: number;
        averageLatencyMs: number;
    };
}
//# sourceMappingURL=index.d.ts.map