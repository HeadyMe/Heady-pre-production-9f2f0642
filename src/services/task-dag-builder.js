/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * TaskDAGBuilder — Directed Acyclic Graph construction from plans.
 * Converts a plan (list of subtasks with dependencies) into an executable DAG
 * with topological ordering, parallel fan-out detection, and cycle validation.
 *
 * @module task-dag-builder
 */

'use strict';

const logger = require('../utils/logger');

class DAGNode {
    /**
     * @param {object} subtask
     * @param {string} subtask.id
     * @param {string} subtask.name
     * @param {string} subtask.type
     * @param {string[]} subtask.depends_on
     * @param {object} [subtask.verification]
     */
    constructor(subtask) {
        this.id = subtask.id;
        this.name = subtask.name;
        this.type = subtask.type;
        this.dependsOn = subtask.depends_on || [];
        this.verification = subtask.verification || null;
        this.metadata = subtask.metadata || {};
    }
}

class TaskDAG {
    constructor() {
        this.nodes = new Map();
        this.edges = new Map(); // parent → [children]
    }

    /** Add a node to the DAG. */
    addNode(node) {
        this.nodes.set(node.id, node);
        if (!this.edges.has(node.id)) {
            this.edges.set(node.id, []);
        }
        // Register edges from dependencies → this node
        for (const depId of node.dependsOn) {
            if (!this.edges.has(depId)) {
                this.edges.set(depId, []);
            }
            this.edges.get(depId).push(node.id);
        }
    }

    /** Get a node by ID. */
    getNode(id) {
        return this.nodes.get(id) || null;
    }

    /** Number of nodes. */
    get nodeCount() {
        return this.nodes.size;
    }

    /**
     * Get all nodes whose dependencies are fully satisfied.
     * @param {Set<string>} completed - Set of completed node IDs
     * @returns {DAGNode[]}
     */
    getReadyNodes(completed) {
        const ready = [];
        for (const [id, node] of this.nodes) {
            if (completed.has(id)) continue;
            const allDepsSatisfied = node.dependsOn.every(depId => completed.has(depId));
            if (allDepsSatisfied) {
                ready.push(node);
            }
        }
        return ready;
    }

    /**
     * Topological sort of all nodes.
     * @returns {DAGNode[]}
     * @throws {Error} if a cycle is detected
     */
    topologicalSort() {
        const visited = new Set();
        const visiting = new Set();
        const sorted = [];

        const visit = (nodeId) => {
            if (visited.has(nodeId)) return;
            if (visiting.has(nodeId)) {
                throw new Error(`Cycle detected in DAG at node: ${nodeId}`);
            }
            visiting.add(nodeId);
            const node = this.nodes.get(nodeId);
            if (node) {
                for (const depId of node.dependsOn) {
                    visit(depId);
                }
            }
            visiting.delete(nodeId);
            visited.add(nodeId);
            if (node) sorted.push(node);
        };

        for (const nodeId of this.nodes.keys()) {
            visit(nodeId);
        }

        return sorted;
    }

    /**
     * Detect maximum parallelism — how many nodes can run simultaneously.
     * @returns {number}
     */
    maxParallelism() {
        let max = 0;
        const completed = new Set();
        let remaining = this.nodes.size;

        while (remaining > 0) {
            const ready = this.getReadyNodes(completed);
            if (ready.length === 0) break;
            max = Math.max(max, ready.length);
            for (const node of ready) {
                completed.add(node.id);
                remaining--;
            }
        }

        return max;
    }

    /**
     * Serialize the DAG for storage/transmission.
     * @returns {object}
     */
    serialize() {
        const nodes = [];
        for (const [, node] of this.nodes) {
            nodes.push({
                id: node.id,
                name: node.name,
                type: node.type,
                depends_on: node.dependsOn,
                verification: node.verification,
                metadata: node.metadata,
            });
        }
        return { nodes, nodeCount: this.nodes.size, maxParallelism: this.maxParallelism() };
    }

    /**
     * Deserialize a DAG from storage.
     * @param {object} data
     * @returns {TaskDAG}
     */
    static deserialize(data) {
        const dag = new TaskDAG();
        for (const subtask of data.nodes) {
            dag.addNode(new DAGNode(subtask));
        }
        return dag;
    }
}

class TaskDAGBuilder {
    /**
     * Build a DAG from a plan.
     * @param {object} plan - { subtasks: [{ id, name, type, depends_on, verification }] }
     * @param {object} [context]
     * @returns {Promise<TaskDAG>}
     */
    async build(plan, context = {}) {
        const dag = new TaskDAG();

        if (!plan || !plan.subtasks || !Array.isArray(plan.subtasks)) {
            throw new Error('Invalid plan: must have subtasks array');
        }

        // Validate and add nodes
        const validIds = new Set(plan.subtasks.map(s => s.id));

        for (const subtask of plan.subtasks) {
            // Validate dependencies exist
            for (const depId of (subtask.depends_on || [])) {
                if (!validIds.has(depId)) {
                    logger.warn({ subtaskId: subtask.id, depId }, 'Removing invalid dependency');
                    subtask.depends_on = subtask.depends_on.filter(d => d !== depId);
                }
            }

            dag.addNode(new DAGNode(subtask));
        }

        // Validate no cycles
        try {
            dag.topologicalSort();
        } catch (err) {
            throw new Error(`DAG construction failed: ${err.message}`);
        }

        logger.info({
            nodeCount: dag.nodeCount,
            maxParallelism: dag.maxParallelism(),
        }, 'DAG built successfully');

        return dag;
    }
}

module.exports = { TaskDAGBuilder, TaskDAG, DAGNode };
