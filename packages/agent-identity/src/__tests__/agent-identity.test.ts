import test from 'node:test';
import assert from 'node:assert/strict';
import { IdentityAuthority } from '../index';

test('identity authority signs and verifies payloads', () => {
  const authority = new IdentityAuthority('secret');
  const agent = authority.createAgent({ nodeType: 'planner' });
  const envelope = authority.signPayload(agent.agentId, { hello: 'world' });
  assert.equal(authority.verifyEnvelope(envelope), true);
});

test('workflow tokens validate before expiry', () => {
  const authority = new IdentityAuthority('secret');
  const agent = authority.createAgent({ nodeType: 'planner' });
  const token = authority.createWorkflowToken(agent.agentId, 'wf-1', 60_000);
  assert.equal(authority.validateWorkflowToken(token), true);
});
