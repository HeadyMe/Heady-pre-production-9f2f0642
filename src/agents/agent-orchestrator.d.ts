export class AgentOrchestrator {
    /**
     * @param {object} opts
     * @param {number}  [opts.maxConcurrentTasks=8]
     * @param {number}  [opts.taskTimeoutMs=30000]
     * @param {object}  [opts.kv]          - HeadyKV instance (injected or created)
     * @param {object}  [opts.conductor]   - HeadyConductor instance (injected or created)
     */
    constructor(opts?: {
        maxConcurrentTasks?: number | undefined;
        taskTimeoutMs?: number | undefined;
        kv?: object | undefined;
        conductor?: object | undefined;
    });
    maxConcurrentTasks: number;
    taskTimeoutMs: number;
    _kv: any;
    _conductor: any;
    /** @type {Map<string, AgentNode>} */
    _agents: Map<string, AgentNode>;
    /** @type {Map<string, CircuitBreaker>} */
    _breakers: Map<string, CircuitBreaker>;
    /** @type {Map<string, Promise>} */
    _activeTasks: Map<string, Promise<any>>;
    _taskCounter: number;
    _initialized: boolean;
    init(): Promise<this>;
    shutdown(): Promise<void>;
    /**
     * Register an agent node.
     * @param {string} name   - One of KNOWN_AGENTS or a custom name
     * @param {object} config - Agent configuration
     * @returns {AgentNode}
     */
    registerAgent(name: string, config?: object): AgentNode;
    _registerInternal(name: any, config: any, persist: any): {
        name: any;
        config: any;
        state: string;
        metrics: {
            tasksCompleted: number;
            tasksFailed: number;
            totalLatencyMs: number;
            lastActivityAt: null;
            registeredAt: number;
        };
        handler: any;
    };
    /**
     * Remove an agent by name.
     * @param {string} name
     */
    removeAgent(name: string): Promise<boolean>;
    /**
     * Dispatch a task to a named agent.
     * @param {object} task
     * @param {string} agentName
     * @returns {Promise<any>}
     */
    dispatch(task: object, agentName: string): Promise<any>;
    _executeTask(node: any, task: any, taskId: any): Promise<any>;
    /**
     * Get status and metrics for a single agent.
     * @param {string} name
     * @returns {object}
     */
    getAgentStatus(name: string): object;
    /**
     * Get status for all registered agents.
     * @returns {object[]}
     */
    getAllAgentStatuses(): object[];
    /**
     * List all registered agent names.
     * @returns {string[]}
     */
    listAgents(): string[];
    /**
     * Summary health object.
     */
    getHealth(): {
        healthy: boolean;
        total: number;
        idle: number;
        busy: number;
        errored: number;
        activeTasks: number;
        agents: object[];
    };
}
export const KNOWN_AGENTS: string[];
export namespace AGENT_STATES {
    let IDLE: string;
    let BUSY: string;
    let ERROR: string;
    let OFFLINE: string;
    let STARTING: string;
    let DRAINING: string;
}
//# sourceMappingURL=agent-orchestrator.d.ts.map