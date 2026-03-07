import { createHash, randomUUID } from 'node:crypto';
import { fib } from '@heady-ai/phi-math';

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

export class ObservabilityKernel {
  private readonly workflows = new Map<string, WorkflowRecord>();
  private readonly spans = new Map<string, SpanRecord>();
  private readonly auditLog: AuditRecord[] = [];
  private readonly neuralStream: Array<{ workflowId: string; type: string; vector?: number[]; createdAt: number; payload: unknown }> = [];

  createWorkflow(kind: string, attributes: Record<string, unknown> = {}): WorkflowRecord {
    const workflowId = `wf-${randomUUID()}`;
    const workflow = { workflowId, kind, createdAt: Date.now(), attributes };
    this.workflows.set(workflowId, workflow);
    return workflow;
  }

  startSpan(workflowId: string, name: string, attributes: Record<string, unknown> = {}): SpanRecord {
    const span = {
      spanId: `sp-${randomUUID()}`,
      workflowId,
      name,
      startedAt: Date.now(),
      attributes,
    };
    this.spans.set(span.spanId, span);
    return span;
  }

  endSpan(spanId: string, attributes: Record<string, unknown> = {}): SpanRecord {
    const span = this.spans.get(spanId);
    if (!span) throw new Error(`Unknown span: ${spanId}`);
    span.endedAt = Date.now();
    span.attributes = { ...span.attributes, ...attributes };
    return span;
  }

  recordNeuralEvent(workflowId: string, type: string, payload: unknown, vector?: number[]): void {
    this.neuralStream.push({ workflowId, type, payload, vector, createdAt: Date.now() });
    if (this.neuralStream.length > fib(14)) this.neuralStream.shift();
  }

  appendAudit(kind: string, payload: unknown): AuditRecord {
    const previousHash = this.auditLog.at(-1)?.hash ?? 'GENESIS';
    const createdAt = Date.now();
    const hash = createHash('sha256')
      .update(JSON.stringify({ kind, payload, createdAt, previousHash }))
      .digest('hex');
    const record = { auditId: randomUUID(), kind, payload, createdAt, hash, previousHash };
    this.auditLog.push(record);
    return record;
  }

  getWorkflow(workflowId: string): WorkflowRecord | undefined {
    return this.workflows.get(workflowId);
  }

  getWorkflowSpans(workflowId: string): SpanRecord[] {
    return Array.from(this.spans.values()).filter((span) => span.workflowId === workflowId);
  }

  exportAuditTrail(): AuditRecord[] {
    return [...this.auditLog];
  }

  metrics() {
    const finishedSpans = Array.from(this.spans.values()).filter((span) => typeof span.endedAt === 'number');
    const averageLatencyMs = finishedSpans.length === 0
      ? 0
      : finishedSpans.reduce((sum, span) => sum + ((span.endedAt ?? span.startedAt) - span.startedAt), 0) / finishedSpans.length;
    return {
      workflows: this.workflows.size,
      spans: this.spans.size,
      auditRecords: this.auditLog.length,
      neuralEvents: this.neuralStream.length,
      averageLatencyMs,
    };
  }
}
