export type Experience = {
    /**
     * - Unique experience ID
     */
    id: string;
    /**
     * - Serialised content (text, JSON-string, etc.)
     */
    content: string;
    /**
     * - 384-dim embedding
     */
    vector: number[];
    /**
     * - Arbitrary metadata (source, tags, context, etc.)
     */
    metadata: Object;
    /**
     * - Learning weight (higher = more influential) [0, 2]
     */
    weight: number;
    /**
     * - Historical feedback scores
     */
    feedbackHistory: number[];
    createdAt: number;
    updatedAt: number;
};
export type Feedback = {
    experienceId: string;
    /**
     * - Feedback score [-1, 1] (negative = harmful, positive = helpful)
     */
    score: number;
    /**
     * - What triggered this feedback
     */
    signal?: string | undefined;
    timestamp: number;
};
export type Insight = {
    id: string;
    title: string;
    description: string;
    /**
     * - 'cluster' | 'trend' | 'anomaly' | 'pattern'
     */
    type: string;
    confidence: number;
    supportingExperienceIds: string[];
    /**
     * - Type-specific data
     */
    data: Object;
    generatedAt: number;
};
export type RecallResult = {
    id: string;
    content: string;
    similarity: number;
    weight: number;
    metadata: Object;
    createdAt: number;
};
/**
 * @typedef {Object} Experience
 * @property {string} id - Unique experience ID
 * @property {string} content - Serialised content (text, JSON-string, etc.)
 * @property {number[]} vector - 384-dim embedding
 * @property {Object} metadata - Arbitrary metadata (source, tags, context, etc.)
 * @property {number} weight - Learning weight (higher = more influential) [0, 2]
 * @property {number[]} feedbackHistory - Historical feedback scores
 * @property {number} createdAt
 * @property {number} updatedAt
 */
/**
 * @typedef {Object} Feedback
 * @property {string} experienceId
 * @property {number} score - Feedback score [-1, 1] (negative = harmful, positive = helpful)
 * @property {string} [signal] - What triggered this feedback
 * @property {number} timestamp
 */
/**
 * @typedef {Object} Insight
 * @property {string} id
 * @property {string} title
 * @property {string} description
 * @property {string} type - 'cluster' | 'trend' | 'anomaly' | 'pattern'
 * @property {number} confidence
 * @property {string[]} supportingExperienceIds
 * @property {Object} data - Type-specific data
 * @property {number} generatedAt
 */
/**
 * @typedef {Object} RecallResult
 * @property {string} id
 * @property {string} content
 * @property {number} similarity
 * @property {number} weight
 * @property {Object} metadata
 * @property {number} createdAt
 */
/**
 * Continuous learning system backed by vector memory.
 *
 * @example
 * const cl = new ContinuousLearning();
 * await cl.learn({ content: 'User requested feature X', tags: ['product'] });
 * const memories = await cl.recall('feature requests', 5);
 * await cl.adapt({ experienceId: memories[0].id, score: 0.8 });
 * const insights = cl.getInsights();
 */
export class ContinuousLearning {
    /**
     * @param {Object} [options={}]
     * @param {VectorMemory} [options.memory] - Injected VectorMemory instance
     * @param {Object} [options.embeddingProviderOptions]
     * @param {number} [options.defaultRecallLimit=10]
     * @param {number} [options.maxExperiences=50000]
     */
    constructor(options?: {
        memory?: VectorMemory | undefined;
        embeddingProviderOptions?: Object | undefined;
        defaultRecallLimit?: number | undefined;
        maxExperiences?: number | undefined;
    });
    _memory: VectorMemory;
    _embeddingProvider: any;
    _defaultRecallLimit: number;
    _maxExperiences: number;
    /**
     * In-memory experience index (fast lookup by ID without full vector scan).
     * @type {Map<string, Experience>}
     */
    _index: Map<string, Experience>;
    /**
     * Feedback log.
     * @type {Feedback[]}
     */
    _feedbackLog: Feedback[];
    /**
     * Cached insights (regenerated on demand).
     * @type {Insight[]}
     */
    _insights: Insight[];
    /** Flag: insight cache is stale. */
    _insightsDirty: boolean;
    /** Total experiences learned. */
    _learnCount: number;
    /**
     * Stores an experience with its embedding in vector memory.
     *
     * @param {Object} experience
     * @param {string} experience.content - Textual content to embed
     * @param {Object} [experience.metadata={}] - Additional metadata
     * @param {string} [experience.id] - Optional explicit ID
     * @param {number} [experience.weight=1.0] - Initial learning weight [0, 2]
     * @returns {Promise<Experience>}
     */
    learn(experience: {
        content: string;
        metadata?: Object | undefined;
        id?: string | undefined;
        weight?: number | undefined;
    }): Promise<Experience>;
    /**
     * Retrieves the most relevant experiences for a query.
     *
     * @param {string} query - Query text to embed and search
     * @param {number} [limit] - Max results (default: defaultRecallLimit)
     * @param {Object} [options={}]
     * @param {number} [options.minScore=0.4] - Minimum similarity score
     * @param {string[]} [options.tags] - Filter by metadata tags
     * @returns {Promise<RecallResult[]>}
     */
    recall(query: string, limit?: number, options?: {
        minScore?: number | undefined;
        tags?: string[] | undefined;
    }): Promise<RecallResult[]>;
    /**
     * Adjusts the weight of an experience based on feedback.
     * Positive feedback increases weight (max 2.0), negative decreases (min 0.0).
     *
     * @param {Object} feedback
     * @param {string} feedback.experienceId
     * @param {number} feedback.score - Feedback signal [-1, 1]
     * @param {string} [feedback.signal] - Description of feedback signal
     * @returns {Promise<{ experienceId: string, newWeight: number, delta: number }>}
     */
    adapt(feedback: {
        experienceId: string;
        score: number;
        signal?: string | undefined;
    }): Promise<{
        experienceId: string;
        newWeight: number;
        delta: number;
    }>;
    /**
     * Generates structured insights from accumulated learning data.
     * Results are cached; call with force=true to regenerate.
     *
     * @param {boolean} [force=false] - Force regeneration even if cache is fresh
     * @returns {Insight[]}
     */
    getInsights(force?: boolean): Insight[];
    /**
     * @private
     */
    private _insightVolumeTrend;
    /**
     * @private
     */
    private _insightWeightDistribution;
    /**
     * @private
     */
    private _insightFeedbackEffectiveness;
    /**
     * @private
     */
    private _insightSemanticClusters;
    /**
     * @private
     */
    private _insightTagDistribution;
    /**
     * Returns learning system statistics.
     *
     * @returns {Object}
     */
    stats(): Object;
    /**
     * Removes the oldest experience from the index.
     * @private
     */
    private _pruneOldest;
    /**
     * Clears all learning data.
     * @returns {void}
     */
    reset(): void;
}
/**
 * Creates a new ContinuousLearning instance.
 * @param {Object} [options={}]
 * @returns {ContinuousLearning}
 */
export function createContinuousLearning(options?: Object): ContinuousLearning;
/** Shared default continuous learning instance. */
export const defaultLearner: ContinuousLearning;
/** Namespace used within VectorMemory for experiences. */
export const EXPERIENCE_NS: "experiences";
/** Namespace used for generated insights. */
export const INSIGHT_NS: "insights";
import { VectorMemory } from "./vector-memory";
//# sourceMappingURL=continuous-learning.d.ts.map