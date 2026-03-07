import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryStream } from '../index';

test('memory stream retrieves the most relevant vector first', () => {
  const memory = new MemoryStream();
  memory.write({
    agentId: 'a1',
    kind: 'observation',
    tier: 1,
    vector: [1, 0, 0],
    position: { x: 0, y: 0, z: 0 },
    payload: { note: 'aligned' },
    importance: 0.9,
    visibility: 'private',
  });
  memory.write({
    agentId: 'a1',
    kind: 'observation',
    tier: 1,
    vector: [0, 1, 0],
    position: { x: 0, y: 0, z: 0 },
    payload: { note: 'orthogonal' },
    importance: 0.4,
    visibility: 'private',
  });
  const results = memory.retrieve<{ note: string }>({ requesterAgentId: 'a1', queryVector: [1, 0, 0], limit: 1 });
  assert.equal(results[0]?.record.payload.note, 'aligned');
});

test('reflection returns centroid and source ids', () => {
  const memory = new MemoryStream();
  memory.write({
    agentId: 'a1',
    kind: 'plan',
    tier: 2,
    vector: [1, 1, 0],
    position: { x: 0, y: 0, z: 0 },
    payload: { step: 1 },
    importance: 0.8,
    visibility: 'shared',
  });
  const reflection = memory.reflect('a1');
  assert.equal(reflection.sourceIds.length, 1);
  assert.equal(reflection.centroid.length, 3);
});
