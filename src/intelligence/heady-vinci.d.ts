/**
 * HeadyVinci — Session Planner & Meta-Reasoner
 *
 * HeadyVinci sits at the top of the logic chain. It is the architect and
 * composer responsible for:
 *   - Holding global mission and values context
 *   - Planning execution: which nodes to invoke, in what order
 *   - Resolving conflicts between competing node proposals
 *   - Maintaining the topology of all active nodes
 *   - Socratic Loop: challenging its own reasoning before projecting to code
 *   - Integrating with the pattern engine for optimization
 *
 * @extends EventEmitter
 */
export class HeadyVinci extends EventEmitter<[never]> {
    /**
     * @param {object} [options]
     * @param {object} [options.patternEngine]  - PatternEngine instance
     * @param {object} [options.conductor]      - HeadyConductor instance
     * @param {object} [options.mission]        - Mission and values object
     * @param {number} [options.maxPlanDepth]   - Maximum planning recursion depth
     * @param {number} [options.socraticRounds] - Number of Socratic challenge rounds
     */
    constructor(options?: {
        patternEngine?: object | undefined;
        conductor?: object | undefined;
        mission?: object | undefined;
        maxPlanDepth?: number | undefined;
        socraticRounds?: number | undefined;
    });
    _patternEngine: object;
    _conductor: object;
    _maxPlanDepth: number;
    _socraticRounds: number;
    _mission: object;
    _topology: Map<any, any>;
    _plans: Map<any, any>;
    _conflictHistory: any[];
    _reasoningTrace: any[];
    /**
     * Create an execution plan for a task.
     * Plans which nodes to invoke, in what order, with priorities.
     *
     * @param {object} task
     * @param {string} task.id
     * @param {string} task.type
     * @param {object} task.payload
     * @param {object} [context] - Assembled context from HeadyBrains
     * @returns {Promise<ExecutionPlan>}
     */
    plan(task: {
        id: string;
        type: string;
        payload: object;
    }, context?: object): Promise<ExecutionPlan>;
    /**
     * Resolve conflicts between competing node proposals.
     * Uses configurable strategy; defaults to PRIORITY with Socratic fallback.
     *
     * @param {object[]} proposals  - Array of proposed execution plans or results
     * @param {string}   [strategy] - ConflictStrategy value
     * @returns {Promise<ResolvedProposal>}
     */
    resolveConflicts(proposals: object[], strategy?: string): Promise<ResolvedProposal>;
    /**
     * Register a node in the topology.
     *
     * @param {object} node
     * @param {string} node.id
     * @param {string} node.type   - NodeType value
     * @param {object} [node.meta]
     * @returns {void}
     */
    registerNode(node: {
        id: string;
        type: string;
        meta?: object | undefined;
    }): void;
    /**
     * Define a relationship between two nodes.
     * @param {string} fromNodeId
     * @param {string} toNodeId
     * @param {string} [relation] - e.g. 'feeds', 'monitors', 'governs'
     */
    linkNodes(fromNodeId: string, toNodeId: string, relation?: string): void;
    /**
     * Get the full node topology.
     * @returns {object} Topology as adjacency description
     */
    getTopology(): object;
    /**
     * Get the reasoning trace (Socratic loop history).
     * @param {number} [limit=20]
     * @returns {object[]}
     */
    getReasoningTrace(limit?: number): object[];
    /**
     * Build an initial execution plan from task and context.
     */
    _buildPlan(task: any, context: any, patterns: any): Promise<{
        nodes: ({
            id: string;
            type: "MEMORY";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            patterns?: undefined;
            tool?: undefined;
        } | {
            id: string;
            type: "PATTERN";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            patterns: any;
            tool?: undefined;
        } | {
            id: string;
            type: "GOVERNANCE";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            patterns?: undefined;
            tool?: undefined;
        } | {
            id: string;
            type: "LLM";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            patterns?: undefined;
            tool?: undefined;
        } | {
            id: string;
            type: "TOOL";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            tool: string;
            patterns?: undefined;
        } | {
            id: string;
            type: "CONDUCTOR";
            order: number;
            priority: number;
            label: string;
            required: boolean;
            patterns?: undefined;
            tool?: undefined;
        })[];
        strategy: string;
        reasoning: string[];
    }>;
    /**
     * Validate and refine a plan draft through Socratic questioning.
     * Each round challenges an assumption in the plan and attempts to
     * find a better answer.
     *
     * @param {object} draft   - Draft plan
     * @param {object} task
     * @returns {Promise<ValidatedPlan>}
     */
    _socraticLoop(draft: object, task: object): Promise<ValidatedPlan>;
    /**
     * Generate a Socratic challenge for the current plan.
     */
    _generateChallenge(plan: any, task: any, round: any): string;
    /**
     * Answer a Socratic challenge and optionally refine the plan.
     */
    _answerChallenge(challenge: any, plan: any, task: any): Promise<{
        challenge: any;
        answer: null;
        refine: boolean;
        refinedPlan: null;
        state: "VALID";
    }>;
    /**
     * Sort plan nodes by priority (descending), preserving required ordering.
     */
    _prioritizeNodes(nodes: any, context: any): any[];
    _resolveByPriority(proposals: any): any;
    _resolveByMerge(proposals: any): any;
    _resolveByVote(proposals: any): any;
    _socraticConflictResolution(proposals: any): Promise<any>;
    _assessMissionAlignment(task: any, context: any): {
        score: number;
        flags: string[];
    };
    _computeDepth(nodes: any): any;
    _deepMerge(target: any, source: any): any;
}
export const NodeType: Readonly<{
    LLM: "LLM";
    BEE: "BEE";
    MEMORY: "MEMORY";
    PATTERN: "PATTERN";
    TOOL: "TOOL";
    GOVERNANCE: "GOVERNANCE";
    CONDUCTOR: "CONDUCTOR";
    PARALLEL: "PARALLEL";
    CONDITIONAL: "CONDITIONAL";
}>;
export const ConflictStrategy: Readonly<{
    PRIORITY: "PRIORITY";
    MERGE: "MERGE";
    ESCALATE: "ESCALATE";
    VOTE: "VOTE";
    SOCRATIC: "SOCRATIC";
}>;
export const ReasoningState: Readonly<{
    PENDING: "PENDING";
    VALID: "VALID";
    INVALID: "INVALID";
    ESCALATED: "ESCALATED";
}>;
export const PHI: 1.6180339887;
import { EventEmitter } from "events";
//# sourceMappingURL=heady-vinci.d.ts.map