export class DAGEngine extends EventEmitter<[never]> {
    constructor();
    graphs: Map<any, any>;
    activeRuns: Map<any, any>;
    /**
     * Registers a new DAG workflow.
     * @param {string} graphId
     * @param {Array} nodes [{ id, action, payload, dependsOn: [], conditions: {} }]
     */
    registerGraph(graphId: string, nodes: any[]): void;
    saveState(runId: any, state: any): Promise<void>;
    loadState(runId: any): Promise<any>;
    /**
     * Executes a DAG instance statefully.
     */
    execute(graphId: any, initialContext?: {}): Promise<{
        runId: string;
        graphId: any;
        status: string;
        results: {};
        context: {};
        completed: never[];
        failed: never[];
    }>;
}
export function getDAGEngine(): any;
import EventEmitter = require("events");
//# sourceMappingURL=dag-engine.d.ts.map