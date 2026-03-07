"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('spatial bus delivers events inside radius', () => {
    const bus = new index_1.SpatialEventBus();
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
    strict_1.default.equal(count, 1);
    strict_1.default.equal(delivered, 1);
    strict_1.default.equal(bus.replayEvents('kernel.tick').length, 1);
});
//# sourceMappingURL=spatial-events.test.js.map