"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const index_1 = require("../index");
(0, node_test_1.default)('fib produces Fibonacci scaling values', () => {
    strict_1.default.equal((0, index_1.fib)(1), 1);
    strict_1.default.equal((0, index_1.fib)(7), 13);
    strict_1.default.equal((0, index_1.fib)(11), 89);
});
(0, node_test_1.default)('CSL labels map to expected bands', () => {
    strict_1.default.equal((0, index_1.labelForCslScore)(0.2), 'DORMANT');
    strict_1.default.equal((0, index_1.labelForCslScore)(0.35), 'LOW');
    strict_1.default.equal((0, index_1.labelForCslScore)(0.5), 'MODERATE');
    strict_1.default.equal((0, index_1.labelForCslScore)(0.75), 'HIGH');
    strict_1.default.equal((0, index_1.labelForCslScore)(0.95), 'CRITICAL');
});
(0, node_test_1.default)('cosine similarity aligns identical vectors', () => {
    strict_1.default.equal((0, index_1.cosineSimilarity)([1, 0, 0], [1, 0, 0]), 1);
});
(0, node_test_1.default)('hashToVector3 is deterministic', () => {
    strict_1.default.deepEqual((0, index_1.hashToVector3)('seed'), (0, index_1.hashToVector3)('seed'));
    strict_1.default.ok(index_1.PHI > 1);
});
//# sourceMappingURL=phi-math.test.js.map