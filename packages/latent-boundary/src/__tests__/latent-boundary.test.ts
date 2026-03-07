import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundaryGateway, ModelGateway, ToolRegistry, McpBoundaryServer } from '../index';

test('boundary gateway returns accepted session for strong trust', () => {
  const gateway = new BoundaryGateway();
  const result = gateway.createSession({
    subjectId: 'user-1',
    authStrength: 0.95,
    trustInputs: { behavioralTrust: 0.9, schemaConformance: 0.9, ratePosture: 0.9 },
  });
  assert.equal(result.accepted, true);
});

test('tool registry exposes MCP-compatible tool calls', async () => {
  const tools = new ToolRegistry();
  tools.register({
    schema: { name: 'echo', requiredKeys: ['message'], description: 'Echoes the message' },
    invoke: async (input) => ({ echoed: input.message }),
  });
  const server = new McpBoundaryServer(tools);
  const response = await server.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'echo', arguments: { message: 'hi' } } });
  assert.ok('result' in response);
  if (!('result' in response)) throw new Error('Expected result in MCP response');
  assert.equal((response.result as { echoed: string }).echoed, 'hi');
});

test('model gateway falls back if primary fails', async () => {
  const gateway = new ModelGateway();
  gateway.register({
    providerId: 'primary',
    invoke: async () => { throw new Error('boom'); },
    latencyScore: 0.9,
    complexityScore: 0.9,
    costScore: 0.4,
    contextScore: 0.8,
    capabilityScore: 0.9,
  });
  gateway.register({
    providerId: 'fallback',
    invoke: async () => 'ok',
    latencyScore: 0.8,
    complexityScore: 0.8,
    costScore: 0.6,
    contextScore: 0.8,
    capabilityScore: 0.8,
  });
  const result = await gateway.execute({
    latencyRequirement: 0.9,
    taskComplexity: 0.9,
    costSensitivity: 0.5,
    contextWindowNeed: 0.8,
    capabilityMatch: 0.9,
  }, 'hello');
  assert.equal(result.providerId, 'fallback');
});
