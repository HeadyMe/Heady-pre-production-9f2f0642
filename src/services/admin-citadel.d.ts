export class AdminCitadelService extends EventEmitter<[never]> {
    constructor(opts?: {});
    traceStore: TraceStore;
    interceptionQueue: InterceptionQueue;
    mcpArmory: MCPArmory;
    _godModeLog: any[];
    /**
     * God-Mode Terminal: natural language directive to override agent context.
     */
    executeGodModeDirective(directive: any, targetAgent: any): {
        id: string;
        directive: any;
        targetAgent: any;
        executedAt: string;
        status: string;
    };
    /**
     * Register all Citadel routes.
     */
    registerRoutes(app: any): void;
}
export class TraceStore {
    constructor(maxTraces?: number);
    _traces: Map<any, any>;
    _maxTraces: number;
    /**
     * Ingest an OTel-compatible span.
     */
    ingestSpan(span: any): {
        traceId: any;
        spanCount: any;
    };
    /**
     * Get a full trace by ID — for AI DVR replay.
     */
    getTrace(traceId: any): any;
    /**
     * Build a DAG from a trace's spans.
     */
    buildDAG(traceId: any): {
        traceId: any;
        nodes: {
            id: any;
            label: any;
            service: any;
            status: any;
            duration: any;
            metrics: any;
        }[];
        edges: {
            source: any;
            target: any;
            label: string;
        }[];
        spanCount: any;
    } | null;
    /**
     * Search traces by attributes.
     */
    search(query: any): {
        traceId: any;
        spanCount: any;
        startTime: any;
        status: any;
        services: any[];
    }[];
    getStats(): {
        totalTraces: number;
        totalSpans: any;
        errorTraces: number;
        hallucinatingTraces: number;
    };
}
export class InterceptionQueue extends EventEmitter<[never]> {
    constructor();
    _queue: any[];
    _history: any[];
    _stats: {
        intercepted: number;
        approved: number;
        vetoed: number;
        overridden: number;
    };
    /**
     * Intercept a high-risk operation.
     */
    intercept(operation: any): {
        id: string;
        operation: any;
        agent: any;
        riskLevel: any;
        createdAt: string;
        status: string;
        resolution: null;
    };
    /**
     * Admin resolves an interception: approve, veto, or override.
     */
    resolve(interceptId: any, action: any, overrideDirective: any): any;
    getPending(): any[];
    getHistory(n?: number): any[];
    getStats(): {
        queueLength: number;
        intercepted: number;
        approved: number;
        vetoed: number;
        overridden: number;
    };
}
export class MCPArmory {
    _bindings: Map<any, any>;
    _revocations: any[];
    /**
     * Grant an agent access to an MCP tool.
     */
    grant(agentId: any, toolName: any): boolean;
    /**
     * Revoke an agent's access to an MCP tool (instant — mid-thought revocation).
     */
    revoke(agentId: any, toolName: any): any;
    /**
     * Check if an agent has access to a tool.
     */
    isAuthorized(agentId: any, toolName: any): any;
    /**
     * Get full RBAC matrix.
     */
    getMatrix(): {
        agentId: any;
        tools: any[];
    }[];
    getRevocationHistory(): any[];
}
import EventEmitter = require("events");
//# sourceMappingURL=admin-citadel.d.ts.map