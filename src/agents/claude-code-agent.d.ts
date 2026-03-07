export class ClaudeCodeAgent {
    constructor(options?: {});
    id: string;
    skills: string[];
    projectRoot: any;
    timeoutMs: any;
    claudeBin: any;
    model: any;
    history: any[];
    totalTokens: number;
    totalCost: number;
    describe(): string;
    /**
     * Handle a task routed by the Supervisor.
     *
     * @param {Object} input
     * @param {Object} input.request - The SupervisorRequest
     * @param {Object} input.metadata - Plan metadata
     * @returns {Object} Structured result
     */
    handle(input: {
        request: Object;
        metadata: Object;
    }): Object;
    /**
     * Build a structured prompt for HeadyJules Code based on task type.
     * Utilizes the Universal Heady Prompt Architecture.
     */
    _buildPrompt(request: any, metadata: any): string;
    /**
     * Execute HeadyJules Code CLI with the given prompt.
     * Falls back to SDK gateway if CLI is not available.
     */
    _executeClaudeCode(prompt: any, request: any): Promise<any>;
    /**
     * Check if `headyjules` CLI is available on PATH.
     */
    _isClaudeCliAvailable(): Promise<any>;
    /**
     * Run HeadyJules CLI in non-interactive mode with a prompt.
     */
    _runClaudeCli(prompt: any, request: any): Promise<any>;
    /**
     * Fallback when CLI is not available — route through SDK gateway for real AI response.
     */
    _fallbackExecution(prompt: any, request: any): Promise<{
        output: any;
        files: never[];
        suggestions: never[];
        fallback: boolean;
        engine: any;
    } | {
        output: string;
        files: never[];
        suggestions: never[];
        fallback: boolean;
        engine?: undefined;
    }>;
    /**
     * Get agent status for monitoring.
     */
    getStatus(): {
        id: string;
        skills: string[];
        model: any;
        history: any[];
        totalInvocations: number;
        successRate: number;
    };
}
export const AGENT_ID: "headyjules-code";
export const AGENT_SKILLS: string[];
//# sourceMappingURL=claude-code-agent.d.ts.map