/**
 * T7: Graph Orchestrator — TypeScript-equivalent graph-based agent orchestration in JS
 * @module src/lib/graph-orchestrator
 */
'use strict';

class GraphOrchestrator {
    constructor(name) {
        this.name = name;
        this.nodes = new Map();
        this.edges = new Map();
        this.entryPoint = null;
        this.conditionalEdges = new Map();
    }

    addNode(name, fn) {
        this.nodes.set(name, fn);
        return this;
    }

    addEdge(from, to) {
        if (!this.edges.has(from)) this.edges.set(from, []);
        this.edges.get(from).push({ to, condition: null });
        return this;
    }

    addConditionalEdge(from, conditionFn) {
        this.conditionalEdges.set(from, conditionFn);
        return this;
    }

    setEntryPoint(name) {
        this.entryPoint = name;
        return this;
    }

    async run(initialState = {}, opts = {}) {
        if (!this.entryPoint) throw new Error('No entry point set');
        const maxSteps = opts.maxSteps || 50;
        const trace = [];
        let state = { ...initialState };
        let current = this.entryPoint;
        let steps = 0;

        while (current && current !== '__end__' && steps < maxSteps) {
            const nodeFn = this.nodes.get(current);
            if (!nodeFn) throw new Error(`Node "${current}" not found`);

            const start = Date.now();
            try {
                state = await nodeFn(state);
                trace.push({ node: current, durationMs: Date.now() - start, success: true });
            } catch (err) {
                trace.push({ node: current, durationMs: Date.now() - start, success: false, error: err.message });
                if (!opts.continueOnError) throw err;
            }

            // Determine next node
            if (this.conditionalEdges.has(current)) {
                current = await this.conditionalEdges.get(current)(state);
            } else {
                const edges = this.edges.get(current) || [];
                current = edges.length > 0 ? edges[0].to : null;
            }
            steps++;
        }

        return { state, trace, steps, completed: current === '__end__' || !current };
    }

    // Parallel branch execution
    async runParallel(branches, state) {
        const results = await Promise.allSettled(
            branches.map(branch => {
                const sub = new GraphOrchestrator(`${this.name}:${branch}`);
                // Copy nodes relevant to branch
                for (const [name, fn] of this.nodes) {
                    if (name.startsWith(branch)) sub.addNode(name, fn);
                }
                return sub.run(state);
            })
        );
        return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason.message });
    }

    toJSON() {
        return {
            name: this.name,
            nodes: [...this.nodes.keys()],
            edges: Object.fromEntries([...this.edges.entries()].map(([k, v]) => [k, v.map(e => e.to)])),
            entryPoint: this.entryPoint,
        };
    }
}

module.exports = GraphOrchestrator;
