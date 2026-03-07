export class A2AProtocol extends EventEmitter<[never]> {
    constructor(opts?: {});
    _agents: Map<any, any>;
    _tasks: Map<any, any>;
    _localCard: {
        schema: string;
        name: any;
        displayName: any;
        version: any;
        description: any;
        url: any;
        capabilities: {
            streaming: boolean;
            pushNotifications: any;
            stateTransitionHistory: any;
        };
        skills: any;
        protocols: string[];
        authentication: {
            type: any;
            required: boolean;
        };
        endpoints: {
            task: string;
            status: string;
            discovery: string;
            health: string;
        };
    };
    _taskCounter: number;
    _stats: {
        tasksCreated: number;
        tasksCompleted: number;
        tasksFailed: number;
        discoveryRequests: number;
    };
    /**
     * Register a known agent in the mesh.
     */
    registerAgent(agentId: any, card: any): this;
    /**
     * Discover agents by skill.
     */
    discoverBySkill(skillName: any): any[];
    /**
     * Create a task delegation request (JSON-RPC 2.0 envelope).
     */
    createTask(targetAgentId: any, params: any): {
        jsonrpc: string;
        method: string;
        id: string;
        params: {
            target: any;
            source: any;
            skill: any;
            input: any;
            priority: any;
            timeout: any;
            createdAt: string;
        };
        status: string;
        result: null;
    };
    /**
     * Update task status (called when agent responds).
     */
    updateTask(taskId: any, status: any, result: any): any;
    /**
     * Get the local agent's discovery card.
     */
    getLocalCard(): {
        schema: string;
        name: any;
        displayName: any;
        version: any;
        description: any;
        url: any;
        capabilities: {
            streaming: boolean;
            pushNotifications: any;
            stateTransitionHistory: any;
        };
        skills: any;
        protocols: string[];
        authentication: {
            type: any;
            required: boolean;
        };
        endpoints: {
            task: string;
            status: string;
            discovery: string;
            health: string;
        };
    };
    /**
     * List all known agents in the mesh.
     */
    listAgents(): {
        agentId: any;
        name: any;
        displayName: any;
        status: any;
        skills: any;
        lastSeen: string;
    }[];
    getStats(): {
        knownAgents: number;
        activeTasks: number;
        tasksCreated: number;
        tasksCompleted: number;
        tasksFailed: number;
        discoveryRequests: number;
    };
    /**
     * Register HTTP routes.
     */
    registerRoutes(app: any): void;
}
export function createAgentCard(opts?: {}): {
    schema: string;
    name: any;
    displayName: any;
    version: any;
    description: any;
    url: any;
    capabilities: {
        streaming: boolean;
        pushNotifications: any;
        stateTransitionHistory: any;
    };
    skills: any;
    protocols: string[];
    authentication: {
        type: any;
        required: boolean;
    };
    endpoints: {
        task: string;
        status: string;
        discovery: string;
        health: string;
    };
};
import EventEmitter = require("events");
//# sourceMappingURL=a2a.d.ts.map