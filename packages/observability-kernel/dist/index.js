"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObservabilityKernel = void 0;
const node_crypto_1 = require("node:crypto");
const phi_math_1 = require("@heady-ai/phi-math");
class ObservabilityKernel {
    workflows = new Map();
    spans = new Map();
    auditLog = [];
    neuralStream = [];
    createWorkflow(kind, attributes = {}) {
        const workflowId = `wf-${(0, node_crypto_1.randomUUID)()}`;
        const workflow = { workflowId, kind, createdAt: Date.now(), attributes };
        this.workflows.set(workflowId, workflow);
        return workflow;
    }
    startSpan(workflowId, name, attributes = {}) {
        const span = {
            spanId: `sp-${(0, node_crypto_1.randomUUID)()}`,
            workflowId,
            name,
            startedAt: Date.now(),
            attributes,
        };
        this.spans.set(span.spanId, span);
        return span;
    }
    endSpan(spanId, attributes = {}) {
        const span = this.spans.get(spanId);
        if (!span)
            throw new Error(`Unknown span: ${spanId}`);
        span.endedAt = Date.now();
        span.attributes = { ...span.attributes, ...attributes };
        return span;
    }
    recordNeuralEvent(workflowId, type, payload, vector) {
        this.neuralStream.push({ workflowId, type, payload, vector, createdAt: Date.now() });
        if (this.neuralStream.length > (0, phi_math_1.fib)(14))
            this.neuralStream.shift();
    }
    appendAudit(kind, payload) {
        const previousHash = this.auditLog.at(-1)?.hash ?? 'GENESIS';
        const createdAt = Date.now();
        const hash = (0, node_crypto_1.createHash)('sha256')
            .update(JSON.stringify({ kind, payload, createdAt, previousHash }))
            .digest('hex');
        const record = { auditId: (0, node_crypto_1.randomUUID)(), kind, payload, createdAt, hash, previousHash };
        this.auditLog.push(record);
        return record;
    }
    getWorkflow(workflowId) {
        return this.workflows.get(workflowId);
    }
    getWorkflowSpans(workflowId) {
        return Array.from(this.spans.values()).filter((span) => span.workflowId === workflowId);
    }
    exportAuditTrail() {
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
exports.ObservabilityKernel = ObservabilityKernel;
//# sourceMappingURL=index.js.map