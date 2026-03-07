"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorMemoryStore = void 0;
const core_1 = require("@heady-ai/core");
class VectorMemoryStore {
    memories = new Map();
    store(userId, memory) {
        if (!(0, core_1.validateUserId)(userId)) {
            throw new core_1.HeadyError('Invalid userId', 'INVALID_USER');
        }
        if (!this.memories.has(userId)) {
            this.memories.set(userId, []);
        }
        this.memories.get(userId).push(memory);
    }
    query(userId, embedding, limit = 10) {
        const userMemories = this.memories.get(userId) || [];
        return userMemories
            .map(m => ({ memory: m, similarity: this.cosineSimilarity(embedding, m.embedding) }))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(r => r.memory);
    }
    cosineSimilarity(a, b) {
        const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
        const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
        const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
        return dot / (magA * magB);
    }
    getStats(userId) {
        const userMemories = this.memories.get(userId) || [];
        return { count: userMemories.length, octants: Math.ceil(userMemories.length / 8) };
    }
}
exports.VectorMemoryStore = VectorMemoryStore;
//# sourceMappingURL=index.js.map