/**
 * Route a task to the optimal AI provider/model.
 *
 * @param {string} taskType - Category of the task (must match ROUTING_MATRIX key)
 * @param {Object} options  - { useFallback, contextSize, urgency }
 * @returns {Object} Routing decision with provider, model, and rationale
 */
export function routeTask(taskType: string, options?: Object): Object;
/**
 * Get routing statistics.
 */
export function getRoutingStats(): {
    availableRoutes: number;
    providers: string[];
    totalRouted: number;
    byProvider: {};
    byTask: {};
    failoverCount: number;
};
/**
 * Get the full routing matrix.
 */
export function getRoutingMatrix(): {
    taskType: string;
    provider: string;
    model: string;
    reason: string;
    fallback: string | null;
}[];
/**
 * Add or update a routing entry.
 */
export function setRoute(taskType: any, config: any): {
    success: boolean;
    error: string;
    taskType?: undefined;
    route?: undefined;
} | {
    success: boolean;
    taskType: any;
    route: any;
    error?: undefined;
};
export function modelRouterRoutes(app: any): void;
export const ROUTING_MATRIX: {
    'code-refactor': {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    'code-review': {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    orchestration: {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    'market-data': {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    'rapid-test': {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    embedding: {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    research: {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    creative: {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
    vision: {
        provider: string;
        model: string;
        reason: string;
        fallback: {
            provider: string;
            model: string;
        };
    };
};
//# sourceMappingURL=model-router.d.ts.map