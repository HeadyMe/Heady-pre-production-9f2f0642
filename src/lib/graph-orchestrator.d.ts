export = GraphOrchestrator;
declare class GraphOrchestrator {
    constructor(name: any);
    name: any;
    nodes: Map<any, any>;
    edges: Map<any, any>;
    entryPoint: any;
    conditionalEdges: Map<any, any>;
    addNode(name: any, fn: any): this;
    addEdge(from: any, to: any): this;
    addConditionalEdge(from: any, conditionFn: any): this;
    setEntryPoint(name: any): this;
    run(initialState?: {}, opts?: {}): Promise<{
        state: {};
        trace: ({
            node: any;
            durationMs: number;
            success: boolean;
            error?: undefined;
        } | {
            node: any;
            durationMs: number;
            success: boolean;
            error: any;
        })[];
        steps: number;
        completed: boolean;
    }>;
    runParallel(branches: any, state: any): Promise<any[]>;
    toJSON(): {
        name: any;
        nodes: any[];
        edges: any;
        entryPoint: any;
    };
}
//# sourceMappingURL=graph-orchestrator.d.ts.map