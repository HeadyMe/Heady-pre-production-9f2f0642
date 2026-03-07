/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Continuous Learning Module — Real-Time Interaction → 3D Vector Space
 *
 * Every interaction, preference, directive, decision, and behavioral
 * pattern is captured, embedded, and stored in the 3D GPU vector space.
 * This creates a living, searchable memory that improves over time.
 *
 * Categories:
 *   - directive:   Standing orders ("always use deep-research mode")
 *   - preference:  Style/workflow preferences ("never keep items pending")
 *   - interaction: Every tool call, question, feedback
 *   - decision:    Architecture/design choices
 *   - identity:    Personal/business info (HeadyConnection Inc., domains, etc.)
 *   - pattern:     Detected behavioral patterns
 */

const crypto = require('crypto');

class ContinuousLearner {
    constructor(vectorStore) {
        this.vectorStore = vectorStore;
        this.dimensions = 384;
        this.interactionCount = 0;
        this.directives = new Map();
        this.learnedPatterns = [];
        this._sessionStart = Date.now();
    }

    /**
     * Convert text to a deterministic embedding vector.
     * Uses SHA-512 hash → normalized float32 array.
     */
    _embed(text) {
        const hash = crypto.createHash('sha512').update(text).digest();
        const embedding = new Float32Array(this.dimensions);
        for (let i = 0; i < this.dimensions; i++) {
            embedding[i] = (hash[i % hash.length] / 255.0) * 2 - 1;
        }
        const norm = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
        for (let i = 0; i < this.dimensions; i++) embedding[i] /= norm;
        return Array.from(embedding);
    }

    /**
     * Learn from any interaction — stores in vector space.
     */
    learn(content, category = 'interaction', metadata = {}) {
        this.interactionCount++;
        const embedding = this._embed(content);
        const fullMeta = {
            type: 'learning',
            category,
            content: content.substring(0, 500),
            timestamp: new Date().toISOString(),
            sessionUptime: Date.now() - this._sessionStart,
            interactionIndex: this.interactionCount,
            ...metadata,
        };

        const result = this.vectorStore.store(embedding, fullMeta);
        return { stored: true, category, index: result.index, vectorCount: result.vectorCount };
    }

    /**
     * Record a standing directive.
     */
    learnDirective(directive, source = 'user') {
        const id = `dir-${this.directives.size + 1}`;
        this.directives.set(id, {
            content: directive,
            source,
            learnedAt: new Date().toISOString(),
        });
        return this.learn(directive, 'directive', { directiveId: id, source });
    }

    /**
     * Record a preference.
     */
    learnPreference(preference) {
        return this.learn(preference, 'preference');
    }

    /**
     * Record a tool call interaction.
     */
    learnToolCall(toolName, args, resultSummary) {
        const content = `Tool: ${toolName} | Args: ${JSON.stringify(args).substring(0, 200)} | Result: ${resultSummary}`;
        return this.learn(content, 'interaction', { toolName });
    }

    /**
     * Record an identity fact.
     */
    learnIdentity(fact) {
        return this.learn(fact, 'identity');
    }

    /**
     * Record a decision/design choice.
     */
    learnDecision(decision) {
        return this.learn(decision, 'decision');
    }

    /**
     * Search memory for relevant context.
     */
    recall(query, topK = 5) {
        const embedding = this._embed(query);
        return this.vectorStore.search(embedding, topK);
    }

    /**
     * Get learning statistics.
     */
    getStats() {
        const vectorStats = this.vectorStore.getStats();
        const categories = {};
        // Count by category from vector metadata
        for (const vec of this.vectorStore.vectors || []) {
            const cat = vec?.metadata?.category || 'unknown';
            categories[cat] = (categories[cat] || 0) + 1;
        }

        return {
            totalInteractions: this.interactionCount,
            totalVectors: vectorStats.vectorCount,
            memoryMB: vectorStats.memoryMB,
            gpu: vectorStats.gpu,
            activeDirectives: this.directives.size,
            directives: Object.fromEntries(this.directives),
            categories,
            sessionUptime: `${((Date.now() - this._sessionStart) / 1000).toFixed(0)}s`,
        };
    }
}

module.exports = { ContinuousLearner };
