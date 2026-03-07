/**
 * Heady Models Registry — Branded AI Model Lineup
 *
 * Each model maps to a specific arena configuration
 * controlling which nodes compete, timeouts, and scoring weights.
 *
 * OpenAI-compatible: use model names in POST /api/v1/chat/completions
 */
export const HEADY_MODELS: {
    'heady-battle-v1': {
        id: string;
        name: string;
        description: string;
        tier: string;
        context_window: number;
        max_output: number;
        pricing: {
            input_per_1k: number;
            output_per_1k: number;
            currency: string;
        };
        arena: {
            nodes: string;
            min_competitors: number;
            max_timeout_ms: number;
            scoring: {
                quality: number;
                speed: number;
                relevance: number;
                creativity: number;
            };
        };
        capabilities: string[];
        badge: string;
    };
    'heady-flash': {
        id: string;
        name: string;
        description: string;
        tier: string;
        context_window: number;
        max_output: number;
        pricing: {
            input_per_1k: number;
            output_per_1k: number;
            currency: string;
        };
        arena: {
            nodes: string[];
            min_competitors: number;
            max_timeout_ms: number;
            scoring: {
                quality: number;
                speed: number;
                relevance: number;
                creativity: number;
            };
        };
        capabilities: string[];
        badge: string;
    };
    'heady-reason': {
        id: string;
        name: string;
        description: string;
        tier: string;
        context_window: number;
        max_output: number;
        pricing: {
            input_per_1k: number;
            output_per_1k: number;
            currency: string;
        };
        arena: {
            nodes: string[];
            min_competitors: number;
            max_timeout_ms: number;
            scoring: {
                quality: number;
                speed: number;
                relevance: number;
                creativity: number;
            };
            thinking_budget: number;
        };
        capabilities: string[];
        badge: string;
    };
    'heady-edge': {
        id: string;
        name: string;
        description: string;
        tier: string;
        context_window: number;
        max_output: number;
        pricing: {
            input_per_1k: number;
            output_per_1k: number;
            currency: string;
        };
        arena: {
            nodes: string[];
            min_competitors: number;
            max_timeout_ms: number;
            scoring: {
                quality: number;
                speed: number;
                relevance: number;
                creativity: number;
            };
        };
        capabilities: string[];
        badge: string;
    };
    'heady-buddy': {
        id: string;
        name: string;
        description: string;
        tier: string;
        context_window: number;
        max_output: number;
        pricing: {
            input_per_1k: number;
            output_per_1k: number;
            currency: string;
        };
        arena: {
            nodes: string[];
            min_competitors: number;
            max_timeout_ms: number;
            scoring: {
                quality: number;
                speed: number;
                relevance: number;
                creativity: number;
            };
            memory_enabled: boolean;
        };
        capabilities: string[];
        badge: string;
    };
};
export const FINE_TUNE_PRICING: {
    'heady-flash': {
        training_per_hour: number;
        hosting_per_hour: number;
        min_examples: number;
        max_examples: number;
        estimated_time_per_1k: number;
        currency: string;
    };
    'heady-buddy': {
        training_per_hour: number;
        hosting_per_hour: number;
        min_examples: number;
        max_examples: number;
        estimated_time_per_1k: number;
        currency: string;
    };
    'heady-battle-v1': {
        training_per_hour: number;
        hosting_per_hour: number;
        min_examples: number;
        max_examples: number;
        estimated_time_per_1k: number;
        currency: string;
    };
};
/**
 * List all available models with metadata
 */
export function listModels(): {
    id: string;
    object: string;
    created: number;
    owned_by: string;
    permission: never[];
    root: string;
    parent: null;
    tier: string;
    badge: string;
    description: string;
    context_window: number;
    max_output: number;
    pricing: {
        input_per_1k: number;
        output_per_1k: number;
        currency: string;
    } | {
        input_per_1k: number;
        output_per_1k: number;
        currency: string;
    } | {
        input_per_1k: number;
        output_per_1k: number;
        currency: string;
    } | {
        input_per_1k: number;
        output_per_1k: number;
        currency: string;
    } | {
        input_per_1k: number;
        output_per_1k: number;
        currency: string;
    };
    capabilities: string[];
}[];
/**
 * Get a specific model config by name
 * Falls back to heady-flash if not found
 */
export function getModelConfig(name: any): any;
/**
 * Get fine-tuning pricing for a model
 */
export function getFineTunePricing(modelId: any): any;
/**
 * Check if a model requires premium access
 */
export function isPremium(modelId: any): boolean;
/**
 * Get the arena config for a model (which nodes compete, scoring, etc.)
 */
export function getArenaConfig(modelId: any): any;
//# sourceMappingURL=heady-models.d.ts.map