import test from 'node:test';
import assert from 'node:assert/strict';
import { SpatialEventBus } from '../index';

test('spatial bus delivers events inside radius', () => {
  const bus = new SpatialEventBus();
  let delivered = 0;
  bus.subscribe({
    id: 'sub-1',
    position: { x: 0, y: 0, z: 0 },
    radius: 8,
    handler: () => {
      delivered += 1;
    },
  });

  const count = bus.publish({
    id: 'evt-1',
    type: 'kernel.tick',
    origin: { x: 1, y: 1, z: 1 },
    emittedBy: 'agent-1',
    payload: { ok: true },
    emittedAt: Date.now(),
    trustScore: 0.9,
  });

  assert.equal(count, 1);
  assert.equal(delivered, 1);
  assert.equal(bus.replayEvents('kernel.tick').length, 1);
});
