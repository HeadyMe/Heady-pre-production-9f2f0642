'use strict';

/**
 * HeadyChain Graph Builder
 * Fluent API for constructing directed acyclic graphs (DAGs) of agent nodes.
 * Supports conditional routing, serialization, and Mermaid visualization.
 */

const { NODE_TYPES } = require('./nodes');

class GraphBuilder {
  constructor(id) {
    this.id = id || `graph_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.nodes = new Map();   // nodeId -> { id, type, config, metadata }
    this.edges = [];          // { from, to, condition, label }
    this.entryPoint = null;
    this.exitPoints = new Set();
    this._compiled = null;
  }

  /**
   * Add a node to the graph.
   * @param {string} id - Unique node identifier
   * @param {string} type - One of NODE_TYPES values
   * @param {object} config - Node-specific configuration
   * @param {object} [metadata] - Optional display/documentation metadata
   */
  addNode(id, type, config = {}, metadata = {}) {
    if (this.nodes.has(id)) {
      throw new Error(`Graph node '${id}' already exists`);
    }
    if (!Object.values(NODE_TYPES).includes(type)) {
      throw new Error(`Unknown node type '${type}'. Valid types: ${Object.values(NODE_TYPES).join(', ')}`);
    }
    this.nodes.set(id, { id, type, config: { ...config }, metadata });
    this._compiled = null; // invalidate
    return this;
  }

  /**
   * Add a directed edge from → to with an optional condition function.
   * @param {string} from - Source node id
   * @param {string} to - Target node id
   * @param {Function|null} [condition] - (state) => boolean; if null always traversed
   * @param {string} [label] - Human-readable label for visualization
   */
  addEdge(from, to, condition = null, label = '') {
    if (condition !== null && typeof condition !== 'function') {
      throw new Error(`Edge condition from '${from}' to '${to}' must be a function or null`);
    }
    this.edges.push({ from, to, condition, label });
    this._compiled = null;
    return this;
  }

  /**
   * Add a conditional routing edge from one node to multiple possible targets.
   * @param {string} from - Source node id
   * @param {Array<{to: string, condition: Function, label?: string}>} branches
   */
  addConditionalEdge(from, branches) {
    if (!Array.isArray(branches) || branches.length === 0) {
      throw new Error(`branches must be a non-empty array`);
    }
    for (const branch of branches) {
      if (!branch.to) throw new Error(`Each branch must have a 'to' field`);
      if (typeof branch.condition !== 'function') {
        throw new Error(`Each branch must have a condition function`);
      }
      this.edges.push({
        from,
        to: branch.to,
        condition: branch.condition,
        label: branch.label || '',
      });
    }
    this._compiled = null;
    return this;
  }

  /**
   * Set the entry point (first node executed).
   */
  setEntryPoint(nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Entry point '${nodeId}' does not exist in graph`);
    }
    this.entryPoint = nodeId;
    this._compiled = null;
    return this;
  }

  /**
   * Set a node as an exit point (terminal node).
   * Multiple exit points are allowed.
   */
  setExitPoint(nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw new Error(`Exit point '${nodeId}' does not exist in graph`);
    }
    this.exitPoints.add(nodeId);
    this._compiled = null;
    return this;
  }

  /**
   * Compile the graph: validate structure, detect cycles, find unreachable nodes.
   * Returns a compiled graph descriptor used by the execution engine.
   */
  compile() {
    if (this.nodes.size === 0) {
      throw new Error('Graph has no nodes');
    }
    if (!this.entryPoint) {
      throw new Error('Graph has no entry point. Call setEntryPoint()');
    }

    // Build adjacency lists
    const adjacency = new Map();    // nodeId -> [toId, ...]
    const reverseAdj = new Map();   // nodeId -> [fromId, ...]
    for (const id of this.nodes.keys()) {
      adjacency.set(id, []);
      reverseAdj.set(id, []);
    }
    for (const edge of this.edges) {
      if (!this.nodes.has(edge.from)) {
        throw new Error(`Edge references unknown source node '${edge.from}'`);
      }
      if (!this.nodes.has(edge.to)) {
        throw new Error(`Edge references unknown target node '${edge.to}'`);
      }
      adjacency.get(edge.from).push(edge.to);
      reverseAdj.get(edge.to).push(edge.from);
    }

    // Cycle detection via DFS (colors: white=0, gray=1, black=2)
    const color = new Map();
    for (const id of this.nodes.keys()) color.set(id, 0);

    const dfsStack = [];
    function dfs(node) {
      if (color.get(node) === 1) {
        throw new Error(`Cycle detected in graph at node '${node}'. Path: ${[...dfsStack, node].join(' → ')}`);
      }
      if (color.get(node) === 2) return;
      color.set(node, 1);
      dfsStack.push(node);
      for (const neighbor of adjacency.get(node)) {
        dfs(neighbor);
      }
      dfsStack.pop();
      color.set(node, 2);
    }
    for (const id of this.nodes.keys()) {
      if (color.get(id) === 0) dfs(id);
    }

    // Unreachable node detection (BFS from entry)
    const reachable = new Set();
    const queue = [this.entryPoint];
    reachable.add(this.entryPoint);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const neighbor of adjacency.get(current)) {
        if (!reachable.has(neighbor)) {
          reachable.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    const unreachable = [...this.nodes.keys()].filter(id => !reachable.has(id));
    if (unreachable.length > 0) {
      throw new Error(`Unreachable nodes detected: ${unreachable.join(', ')}`);
    }

    // Auto-detect exit points (nodes with no outgoing edges) if none set
    const exitPoints = new Set(this.exitPoints);
    for (const [id] of this.nodes) {
      if (adjacency.get(id).length === 0 && !exitPoints.has(id)) {
        exitPoints.add(id);
      }
    }

    // Build topological order (Kahn's algorithm)
    const inDegree = new Map();
    for (const id of this.nodes.keys()) inDegree.set(id, 0);
    for (const edge of this.edges) {
      inDegree.set(edge.to, inDegree.get(edge.to) + 1);
    }
    const topoQueue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) topoQueue.push(id);
    }
    const topoOrder = [];
    while (topoQueue.length > 0) {
      const node = topoQueue.shift();
      topoOrder.push(node);
      for (const neighbor of adjacency.get(node)) {
        const newDeg = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) topoQueue.push(neighbor);
      }
    }

    // Build edge map for fast lookup
    const edgeMap = new Map(); // from -> [{ to, condition, label }]
    for (const edge of this.edges) {
      if (!edgeMap.has(edge.from)) edgeMap.set(edge.from, []);
      edgeMap.get(edge.from).push({ to: edge.to, condition: edge.condition, label: edge.label });
    }

    this._compiled = {
      id: this.id,
      nodes: Object.fromEntries(
        [...this.nodes.entries()].map(([k, v]) => [k, { ...v }])
      ),
      edges: this.edges.map(e => ({ from: e.from, to: e.to, label: e.label })),
      edgeMap,
      adjacency,
      reverseAdj,
      entryPoint: this.entryPoint,
      exitPoints,
      topoOrder,
    };

    return this._compiled;
  }

  /**
   * Return the compiled graph, compiling if necessary.
   */
  getCompiled() {
    if (!this._compiled) return this.compile();
    return this._compiled;
  }

  /**
   * Serialize the graph to a JSON-compatible object.
   * Note: condition functions are serialized as their .toString() source.
   */
  toJSON() {
    return {
      id: this.id,
      entryPoint: this.entryPoint,
      exitPoints: [...this.exitPoints],
      nodes: [...this.nodes.entries()].map(([id, node]) => ({
        id,
        type: node.type,
        config: node.config,
        metadata: node.metadata,
      })),
      edges: this.edges.map(e => ({
        from: e.from,
        to: e.to,
        label: e.label,
        condition: e.condition ? e.condition.toString() : null,
      })),
    };
  }

  /**
   * Reconstruct a GraphBuilder from a serialized JSON object.
   * WARNING: eval is used to restore condition functions — only use with trusted input.
   */
  static fromJSON(json) {
    const builder = new GraphBuilder(json.id);
    for (const node of json.nodes) {
      builder.addNode(node.id, node.type, node.config, node.metadata);
    }
    for (const edge of json.edges) {
      /* eslint-disable no-eval */
      const condFn = edge.condition ? eval(`(${edge.condition})`) : null;
      /* eslint-enable no-eval */
      builder.addEdge(edge.from, edge.to, condFn, edge.label);
    }
    if (json.entryPoint) builder.setEntryPoint(json.entryPoint);
    for (const ep of json.exitPoints || []) builder.setExitPoint(ep);
    return builder;
  }

  /**
   * Generate a Mermaid flowchart diagram string for documentation.
   */
  toMermaid() {
    const lines = ['flowchart TD'];
    // Node definitions with type labels
    for (const [id, node] of this.nodes) {
      const label = node.metadata.label || id;
      const typeTag = node.type;
      let shape;
      switch (node.type) {
        case NODE_TYPES.LLM:         shape = `["🤖 ${label}\\n[${typeTag}]"]`; break;
        case NODE_TYPES.TOOL:        shape = `["🔧 ${label}\\n[${typeTag}]"]`; break;
        case NODE_TYPES.CONDITIONAL: shape = `{"❓ ${label}\\n[${typeTag}]"}`; break;
        case NODE_TYPES.PARALLEL:    shape = `(["⚡ ${label}\\n[${typeTag}]"])`; break;
        case NODE_TYPES.REDUCE:      shape = `["➕ ${label}\\n[${typeTag}]"]`; break;
        case NODE_TYPES.TRANSFORM:   shape = `["⚙️ ${label}\\n[${typeTag}]"]`; break;
        case NODE_TYPES.HUMAN:       shape = `[/"👤 ${label}\\n[${typeTag}]"/]`; break;
        case NODE_TYPES.SUBCHAIN:    shape = `[["🔗 ${label}\\n[${typeTag}]"]]`; break;
        case NODE_TYPES.RETRY:       shape = `["🔄 ${label}\\n[${typeTag}]"]`; break;
        default:                     shape = `["${label}\\n[${typeTag}]"]`;
      }
      lines.push(`  ${id}${shape}`);
    }
    // Edges
    for (const edge of this.edges) {
      const arrow = edge.condition ? `-->|"${edge.label || 'if condition'}"|` : '-->';
      lines.push(`  ${edge.from} ${arrow} ${edge.to}`);
    }
    // Entry/exit styling
    if (this.entryPoint) lines.push(`  style ${this.entryPoint} fill:#2a9d8f,color:#fff`);
    for (const ep of this.exitPoints) {
      lines.push(`  style ${ep} fill:#e76f51,color:#fff`);
    }
    return lines.join('\n');
  }

  /**
   * Return a summary string for debugging.
   */
  toString() {
    return `GraphBuilder(id=${this.id}, nodes=${this.nodes.size}, edges=${this.edges.length}, entry=${this.entryPoint})`;
  }
}

module.exports = { GraphBuilder };
