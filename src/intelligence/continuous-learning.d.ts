/**
 * Run one learning cycle:
 * 1. Pick the highest-priority unlearned topic
 * 2. Send to 2-3 providers in parallel
 * 3. Score and compare responses
 * 4. Store best knowledge in vector memory
 * 5. Update curriculum and stats
 *
 * @param {Object} vectorMem - vector memory instance for storage
 * @returns {Object} - learning result
 */
export function runLearningCycle(vectorMem: Object): Object;
export function getLearnStats(): {
    curriculumSize: number;
    remaining: number;
    completed: number;
    categories: string[];
    totalLearned: number;
    totalProviderCalls: number;
    providerSuccesses: {
        headypythia: number;
        groq: number;
        perplexity: number;
        headyhub: number;
    };
    providerErrors: {
        headypythia: number;
        groq: number;
        perplexity: number;
        headyhub: number;
    };
    topicsCompleted: number;
    lastLearnedAt: null;
    lastTopic: null;
};
export function registerRoutes(app: any): void;
//# sourceMappingURL=continuous-learning.d.ts.map