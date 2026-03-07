/**
 * Select the optimal model for a given task type.
 *
 * @param {string} taskType - The type of task (e.g., 'code-refactoring', 'web-research')
 * @param {Object} opts - Optional overrides
 * @param {string} opts.preferredModel - Force a specific model
 * @param {string} opts.costConstraint - 'free', 'budget', 'standard', 'premium'
 * @param {number} opts.maxLatencyMs - Maximum acceptable latency
 * @param {number} opts.contextSize - Required context window size
 * @returns {Object} The selected model config with routing metadata
 */
export function routeTask(taskType: string, opts?: {
    preferredModel: string;
    costConstraint: string;
    maxLatencyMs: number;
    contextSize: number;
}): Object;
/**
 * Route with automatic retry and failover.
 * If the primary model fails, automatically tries the next available model.
 */
export function routeWithFailover(taskType: any, callFn: any, opts?: {}): Promise<{
    success: boolean;
    errors: {
        model: any;
        attempt: number;
        error: any;
        timestamp: string;
    }[];
    routing: Object;
    result?: undefined;
    attempts?: undefined;
} | {
    success: boolean;
    result: any;
    routing: Object;
    attempts: number;
    errors?: undefined;
} | {
    success: boolean;
    errors: {
        model: any;
        attempt: number;
        error: any;
        timestamp: string;
    }[];
    attempts: any;
    routing?: undefined;
    result?: undefined;
}>;
export function getRoutingStats(): {
    availableModels: {
        key: string;
        provider: string;
        model: string;
        costTier: string;
    }[];
    totalRegistered: number;
    totalAvailable: number;
    taskTypes: string[];
    totalRouted: number;
    byModel: {};
    byTask: {};
    failovers: number;
    avgLatencyMs: number;
    errors: never[];
};
export function getRouterHealth(): {
    status: string;
    modelsAvailable: number;
    modelsTotal: number;
    totalRouted: number;
    failoverRate: number;
    availableProviders: string[];
    missingKeys: {
        model: string;
        envKey: string;
    }[];
};
export function llmRouterRoutes(app: any): void;
export const MODEL_REGISTRY: {
    'claude-sonnet': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'gemini-pro': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'gpt-54': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'gpt-4o': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'perplexity-sonar': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'groq-llama': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
    'huggingface-open': {
        provider: string;
        model: string;
        envKey: string;
        maxTokens: number;
        strengths: string[];
        costTier: string;
        avgLatencyMs: number;
    };
};
export const ROUTING_MATRIX: {
    'code-refactoring': string;
    'ast-manipulation': string;
    'code-generation': string;
    'code-review': string;
    'bug-fix': string;
    'swarm-orchestration': string;
    'system-planning': string;
    'architecture-design': string;
    'complex-reasoning': string;
    'multimodal-analysis': string;
    'web-research': string;
    'market-analysis': string;
    'citation-research': string;
    'competitor-analysis': string;
    'rapid-testing': string;
    'parallel-eval': string;
    'quick-classification': string;
    'health-check-ai': string;
    general: string;
    'instruction-following': string;
    'function-calling': string;
    'complex-task': string;
    'content-generation': string;
    summarization: string;
    embedding: string;
    classification: string;
    'high-volume-batch': string;
};
//# sourceMappingURL=llm-router.d.ts.map