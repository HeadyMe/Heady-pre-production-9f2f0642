/**
 * Classify a task and determine the optimal sub-agent.
 *
 * @param {object} task - Task from manifest (has name, action, service_group, inputs)
 * @returns {{ agent: string, endpoint: string, reason: string }}
 */
export function classify(task: object): {
    agent: string;
    endpoint: string;
    reason: string;
};
/**
 * Classify multiple tasks and return a dispatch plan.
 *
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Array of { task, dispatch } objects
 */
export function createDispatchPlan(tasks: any[]): any[];
/**
 * Create a prioritized dispatch plan from the auto-flow pipeline.
 * @param {object} opts - { pool, minWeight, limit }
 * @returns {Array} Array of { task, dispatch } objects
 */
export function createPipelinePlan(opts?: object): any[];
/**
 * Load the auto-flow pipeline from disk and return tasks sorted by priority.
 * @param {object} opts - { pool: 'hot'|'warm'|'cold'|'all', minWeight: 1-5, limit: number }
 * @returns {Array} Sorted task array
 */
export function loadPipeline(opts?: object): any[];
/**
 * Get agent registry summary.
 */
export function getAgentRegistry(): {
    key: string;
    name: string;
    endpoint: string;
    capabilities: string[];
    keyword_count: number;
}[];
export const SUB_AGENTS: {
    "heady-io": {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: string[];
    };
    "heady-bot": {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: string[];
    };
    "heady-mcp": {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: string[];
    };
    "heady-connection": {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: string[];
    };
    "heady-cloudrun": {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: string[];
    };
    core: {
        name: string;
        endpoint: string;
        capabilities: string[];
        keywords: never[];
    };
};
//# sourceMappingURL=task-dispatcher.d.ts.map