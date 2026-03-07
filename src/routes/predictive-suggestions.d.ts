export namespace SUGGESTION_CATALOG {
    let morning: {
        label: string;
        prompt: string;
    }[];
    let evening: {
        label: string;
        prompt: string;
    }[];
    let systemDown: {
        label: string;
        prompt: string;
    }[];
    let allHealthy: {
        label: string;
        prompt: string;
    }[];
    let didYouKnow: {
        label: string;
        prompt: string;
    }[];
    let universal: {
        label: string;
        prompt: string;
    }[];
}
/**
 * Get context-aware suggestions.
 * @param {Object} context
 * @param {number} [context.hour] - Current hour (0-23)
 * @param {boolean} [context.systemHealthy] - Are all services up?
 * @param {string[]} [context.recentTopics] - Topics from recent chat
 * @param {number} [context.sessionCount] - User's total session count
 * @param {number} [limit=5] - Max suggestions to return
 * @returns {Array<{label: string, prompt: string, category: string}>}
 */
export function getSuggestions(context?: {
    hour?: number | undefined;
    systemHealthy?: boolean | undefined;
    recentTopics?: string[] | undefined;
    sessionCount?: number | undefined;
}, limit?: number): Array<{
    label: string;
    prompt: string;
    category: string;
}>;
/**
 * Get a "Did you know?" tip for post-task moments.
 * @returns {{label: string, prompt: string}}
 */
export function getDidYouKnowTip(): {
    label: string;
    prompt: string;
};
//# sourceMappingURL=predictive-suggestions.d.ts.map