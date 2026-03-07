"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('workflow ids are prefixed and spans can complete', async () => {
    const obs = new index_1.ObservabilityKernel();
    const workflow = obs.createWorkflow('kernel-loop');
    strict_1.default.equal(workflow.workflowId.startsWith('wf-'), true);
    const span = obs.startSpan(workflow.workflowId, 'phase:perceive');
    await new Promise((resolve) => setTimeout(resolve, 5));
    const finished = obs.endSpan(span.spanId);
    strict_1.default.ok((finished.endedAt ?? 0) >= finished.startedAt);
});
(0, node_test_1.default)('audit trail preserves previous hash links', () => {
    const obs = new index_1.ObservabilityKernel();
    const first = obs.appendAudit('one', { ok: 1 });
    const second = obs.appendAudit('two', { ok: 2 });
    strict_1.default.equal(second.previousHash, first.hash);
});
//# sourceMappingURL=observability-kernel.test.js.map