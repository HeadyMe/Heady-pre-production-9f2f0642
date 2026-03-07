export class ModelRegistry {
    /**
     * @param {object} opts
     * @param {object[]} [opts.extraModels]    - Additional model records to merge
     * @param {object}   [opts.taskBestModel]  - Override task→model mappings
     */
    constructor(opts?: {
        extraModels?: object[] | undefined;
        taskBestModel?: object | undefined;
    });
    _models: Map<any, any>;
    _taskMap: {
        'code-generation': string;
        'code-review': string;
        'complex-reasoning': string;
        'fast-chat': string;
        chat: string;
        'creative-writing': string;
        documentation: string;
        classification: string;
        summarization: string;
        'long-document': string;
        'real-time-research': string;
        'structured-output': string;
        'ultra-fast': string;
        'edge-inference': string;
        'local-privacy': string;
        math: string;
        science: string;
        multimodal: string;
        default: string;
    };
    /**
     * Get a model by ID.
     * @param {string} id
     * @returns {object|null}
     */
    getModel(id: string): object | null;
    /**
     * Filter models by criteria.
     * @param {object} filter
     * @param {string|string[]}  [filter.capability]  - Must have capability
     * @param {string}           [filter.costTier]    - Exact tier
     * @param {string}           [filter.maxCostTier] - At most this tier
     * @param {string}           [filter.provider]    - Provider name
     * @param {boolean}          [filter.available]   - Only available models
     * @param {number}           [filter.minContextWindow] - Minimum context window
     * @param {string}           [filter.latencyProfile]   - Exact latency profile
     * @returns {object[]}
     */
    getModels(filter?: {
        capability?: string | string[] | undefined;
        costTier?: string | undefined;
        maxCostTier?: string | undefined;
        provider?: string | undefined;
        available?: boolean | undefined;
        minContextWindow?: number | undefined;
        latencyProfile?: string | undefined;
    }): object[];
    /**
     * Get the best model for a given task type.
     * @param {string} taskType
     * @param {object} [constraints]  - { maxCostTier, provider, available }
     * @returns {object|null}
     */
    getBestModel(taskType: string, constraints?: object): object | null;
    _meetsConstraints(model: any, constraints: any): boolean;
    /**
     * Register or update a model.
     * @param {object} model
     */
    registerModel(model: object): this;
    /**
     * Update model availability (e.g., after runtime probing).
     */
    setAvailability(id: any, available: any): this;
    /**
     * Register a task→model mapping.
     */
    setTaskModel(taskType: any, modelId: any): this;
    getSummary(): {
        total: number;
        available: number;
        byProvider: {};
        taskMappings: {
            'code-generation': string;
            'code-review': string;
            'complex-reasoning': string;
            'fast-chat': string;
            chat: string;
            'creative-writing': string;
            documentation: string;
            classification: string;
            summarization: string;
            'long-document': string;
            'real-time-research': string;
            'structured-output': string;
            'ultra-fast': string;
            'edge-inference': string;
            'local-privacy': string;
            math: string;
            science: string;
            multimodal: string;
            default: string;
        };
    };
    listAll(): any[];
}
export const PROVIDERS: Readonly<{
    ANTHROPIC: "anthropic";
    OPENAI: "openai";
    GOOGLE: "google";
    GROQ: "groq";
    PERPLEXITY: "perplexity";
    CLOUDFLARE: "cloudflare";
    OLLAMA: "ollama";
}>;
export const CAPABILITIES: Readonly<{
    TEXT_GENERATION: "text-generation";
    CODE_GENERATION: "code-generation";
    FUNCTION_CALLING: "function-calling";
    VISION: "vision";
    REASONING: "reasoning";
    LONG_CONTEXT: "long-context";
    STREAMING: "streaming";
    JSON_MODE: "json-mode";
    EMBEDDINGS: "embeddings";
    REAL_TIME_DATA: "real-time-data";
    EDGE_INFERENCE: "edge-inference";
    LOCAL_INFERENCE: "local-inference";
}>;
export const COST_TIERS: Readonly<{
    FREE: "free";
    ECONOMY: "economy";
    STANDARD: "standard";
    PREMIUM: "premium";
    ULTRA: "ultra";
}>;
export const CATALOG: ({
    id: string;
    displayName: string;
    provider: "anthropic";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "standard";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "anthropic";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "ultra";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "anthropic";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "economy";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "openai";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "standard";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "openai";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "economy";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "openai";
    capabilities: ("reasoning" | "code-generation" | "function-calling" | "text-generation")[];
    costTier: "ultra";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "google";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "long-context" | "streaming" | "json-mode")[];
    costTier: "economy";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "google";
    capabilities: ("vision" | "code-generation" | "function-calling" | "text-generation" | "long-context" | "streaming" | "json-mode")[];
    costTier: "standard";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "groq";
    capabilities: ("code-generation" | "function-calling" | "text-generation" | "streaming" | "json-mode")[];
    costTier: "economy";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "perplexity";
    capabilities: ("real-time-data" | "text-generation" | "streaming")[];
    costTier: "standard";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "cloudflare";
    capabilities: ("code-generation" | "text-generation" | "streaming" | "edge-inference")[];
    costTier: "free";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
} | {
    id: string;
    displayName: string;
    provider: "ollama";
    capabilities: ("code-generation" | "text-generation" | "streaming" | "local-inference")[];
    costTier: "free";
    contextWindow: number;
    outputWindow: number;
    inputCostPer1MTokens: number;
    outputCostPer1MTokens: number;
    strengths: string[];
    latencyProfile: string;
    available: boolean;
})[];
export const TASK_BEST_MODEL: {
    'code-generation': string;
    'code-review': string;
    'complex-reasoning': string;
    'fast-chat': string;
    chat: string;
    'creative-writing': string;
    documentation: string;
    classification: string;
    summarization: string;
    'long-document': string;
    'real-time-research': string;
    'structured-output': string;
    'ultra-fast': string;
    'edge-inference': string;
    'local-privacy': string;
    math: string;
    science: string;
    multimodal: string;
    default: string;
};
//# sourceMappingURL=model-registry.d.ts.map