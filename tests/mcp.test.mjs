import test from 'node:test';
import assert from 'node:assert/strict';
import { createMcpRegistry, handleRpc } from '../packages/mcp/src/index.mjs';

const memoryStore = {
  async upsertMemory(args) { return { ok: true, ...args }; },
  async searchMemories() { return [{ id: '1', score: 0.9 }]; },
  async timeline() { return [{ id: '1' }]; }
};

const registry = createMcpRegistry({ memoryStore });

const ctx = { user: { id: 'user-1', email: 'test@example.com' } };

test('tools/list returns declared tools', async () => {
  const response = await handleRpc(registry, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, ctx);
  assert.equal(response.result.tools.length >= 4, true);
});

test('tools/call executes a tool', async () => {
  const response = await handleRpc(registry, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'memories.search', arguments: { query: 'hello' } }
  }, ctx);
  assert.equal(Array.isArray(response.result), true);
});
