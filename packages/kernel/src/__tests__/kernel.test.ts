import test from 'node:test';
import assert from 'node:assert/strict';
import { LatentKernel } from '../index';

test('kernel runs a basic observe reflect plan loop', async () => {
  const kernel = new LatentKernel();
  kernel.registerNode({
    nodeType: 'planner',
    run: async ({ input, retrievedMemory }) => ({
      output: { echoed: input['goal'], retrieved: retrievedMemory.length },
      outputVector: [1, 0, 0],
      events: [{ type: 'planner.completed', payload: { ok: true } }],
    }),
  });

  const runtime = kernel.spawnAgent({ nodeType: 'planner', seedText: 'demo' });
  const result = await kernel.runAgentLoop(runtime.identity.agentId, { goal: 'ship' }, [1, 0, 0]);

  assert.equal(result.output.echoed, 'ship');
  const projected = kernel.projectState();
  assert.equal(projected.agents.length, 1);
  assert.ok(projected.memoryCount >= 3);
});
