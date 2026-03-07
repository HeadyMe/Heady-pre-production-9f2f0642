import test from 'node:test';
import assert from 'node:assert/strict';
import { ObservabilityKernel } from '../index';

test('workflow ids are prefixed and spans can complete', async () => {
  const obs = new ObservabilityKernel();
  const workflow = obs.createWorkflow('kernel-loop');
  assert.equal(workflow.workflowId.startsWith('wf-'), true);
  const span = obs.startSpan(workflow.workflowId, 'phase:perceive');
  await new Promise((resolve) => setTimeout(resolve, 5));
  const finished = obs.endSpan(span.spanId);
  assert.ok((finished.endedAt ?? 0) >= finished.startedAt);
});

test('audit trail preserves previous hash links', () => {
  const obs = new ObservabilityKernel();
  const first = obs.appendAudit('one', { ok: 1 });
  const second = obs.appendAudit('two', { ok: 2 });
  assert.equal(second.previousHash, first.hash);
});
