"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryStream = void 0;
const node_crypto_1 = require("node:crypto");
const phi_math_1 = require("@heady-ai/phi-math");
const csl_router_1 = require("@heady-ai/csl-router");
class MemoryStream {
    accessController;
    eventBus;
    records = [];
    constructor(accessController, eventBus) {
        this.accessController = accessController;
        this.eventBus = eventBus;
    }
    write(input) {
        const record = {
            ...input,
            memoryId: (0, node_crypto_1.randomUUID)(),
            createdAt: Date.now(),
        };
        this.records.push(record);
        if (this.eventBus) {
            this.eventBus.publish({
                id: record.memoryId,
                type: 'memory.written',
                origin: record.position,
                emittedBy: record.agentId,
                payload: { kind: record.kind, tier: record.tier },
                emittedAt: record.createdAt,
                trustScore: Math.max(0.236068, Math.min(1, record.importance)),
                topicVector: record.vector,
            });
        }
        return record;
    }
    retrieve(options) {
        const weights = (0, phi_math_1.phiWeights)(3);
        const now = Date.now();
        return this.records
            .filter((record) => (options.includeKinds ? options.includeKinds.includes(record.kind) : true))
            .filter((record) => (!options.sinceMs ? true : record.createdAt >= now - options.sinceMs))
            .filter((record) => this.accessController ? this.accessController.canRead(options.requesterAgentId, record) : true)
            .map((record) => {
            const ageMs = Math.max(1, now - record.createdAt);
            const recency = Math.exp(-ageMs / (89 * 1000));
            const relevance = Math.max(0, (0, phi_math_1.cosineSimilarity)(options.queryVector, record.vector));
            const score = (0, csl_router_1.weightedAverageScore)([
                { name: 'relevance', value: relevance, weight: weights[0] },
                { name: 'importance', value: record.importance, weight: weights[1] },
                { name: 'recency', value: recency, weight: weights[2] },
            ]).score;
            return { record: record, score, relevance, recency };
        })
            .sort((left, right) => right.score - left.score)
            .slice(0, options.limit ?? 13);
    }
    reflect(agentId, maxItems = 8) {
        const source = this.records
            .filter((record) => record.agentId === agentId)
            .slice(-maxItems);
        return {
            agentId,
            sourceIds: source.map((record) => record.memoryId),
            centroid: (0, phi_math_1.meanVector)(source.map((record) => record.vector)),
            averageImportance: source.length === 0 ? 0 : source.reduce((sum, record) => sum + record.importance, 0) / source.length,
            sourceKinds: source.map((record) => record.kind),
        };
    }
    all() {
        return [...this.records];
    }
}
exports.MemoryStream = MemoryStream;
//# sourceMappingURL=index.js.map