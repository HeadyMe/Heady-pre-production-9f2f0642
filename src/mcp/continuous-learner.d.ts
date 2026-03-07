export class ContinuousLearner {
    constructor(vectorStore: any);
    vectorStore: any;
    dimensions: number;
    interactionCount: number;
    directives: Map<any, any>;
    learnedPatterns: any[];
    _sessionStart: number;
    /**
     * Convert text to a deterministic embedding vector.
     * Uses SHA-512 hash → normalized float32 array.
     */
    _embed(text: any): number[];
    /**
     * Learn from any interaction — stores in vector space.
     */
    learn(content: any, category?: string, metadata?: {}): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Record a standing directive.
     */
    learnDirective(directive: any, source?: string): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Record a preference.
     */
    learnPreference(preference: any): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Record a tool call interaction.
     */
    learnToolCall(toolName: any, args: any, resultSummary: any): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Record an identity fact.
     */
    learnIdentity(fact: any): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Record a decision/design choice.
     */
    learnDecision(decision: any): {
        stored: boolean;
        category: string;
        index: any;
        vectorCount: any;
    };
    /**
     * Search memory for relevant context.
     */
    recall(query: any, topK?: number): any;
    /**
     * Get learning statistics.
     */
    getStats(): {
        totalInteractions: number;
        totalVectors: any;
        memoryMB: any;
        gpu: any;
        activeDirectives: number;
        directives: any;
        categories: {};
        sessionUptime: string;
    };
}
//# sourceMappingURL=continuous-learner.d.ts.map