"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('memory stream retrieves the most relevant vector first', () => {
    const memory = new index_1.MemoryStream();
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
    const results = memory.retrieve({ requesterAgentId: 'a1', queryVector: [1, 0, 0], limit: 1 });
    strict_1.default.equal(results[0]?.record.payload.note, 'aligned');
});
(0, node_test_1.default)('reflection returns centroid and source ids', () => {
    const memory = new index_1.MemoryStream();
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
    strict_1.default.equal(reflection.sourceIds.length, 1);
    strict_1.default.equal(reflection.centroid.length, 3);
});
//# sourceMappingURL=memory-stream.test.js.map