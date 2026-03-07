/* © 2024-2026 HeadySystems Inc. All Rights Reserved. PROPRIETARY AND CONFIDENTIAL. */
'use strict';

const logger = require('../utils/logger').child('topology-projection-bee');
const CSL    = require('../core/semantic-logic');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PHI = 1.6180339887;

/**
 * An agent is considered unresponsive if its last heartbeat is older than
 * PHI² × base window (base = 30 s → threshold ≈ 78.5 s).
 */
const HEARTBEAT_BASE_S       = 30;
const UNRESPONSIVE_THRESHOLD_MS = Math.round(PHI * PHI * HEARTBEAT_BASE_S * 1000); // ≈ 78,541ms

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------

/**
 * Return all registered bees/agents.
 * Prefers global.beeRegistry (Map or Array of { domain, description, priority,
 * state, lastHeartbeat, connections }).
 */
function getAllAgents() {
  if (global.beeRegistry) {
    if (global.beeRegistry instanceof Map) {
      return [...global.beeRegistry.values()];
    }
    if (typeof global.beeRegistry.list === 'function') {
      return global.beeRegistry.list();
    }
    if (Array.isArray(global.beeRegistry)) {
      return global.beeRegistry;
    }
  }
  // Fallback: return an empty array — topology bee will still function
  // and emit an empty graph on start-up.
  logger.warn('global.beeRegistry not found — returning empty agent list');
  return [];
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

/**
 * Build an adjacency representation from agents' `connections` arrays.
 * Each agent may declare { connections: ['domain-a', 'domain-b'] }.
 * Returns { nodes: [{domain, ...}], edges: [{from, to, weight}] }
 */
function buildAdjacencyGraph(agents) {
  const nodes = agents.map(a => ({
    id:            a.domain,
    domain:        a.domain,
    description:   a.description  ?? '',
    priority:      a.priority     ?? 0,
    state:         a.state        ?? 'unknown',
    lastHeartbeat: a.lastHeartbeat ?? null,
  }));

  const edges = [];
  const domainSet = new Set(agents.map(a => a.domain));

  for (const agent of agents) {
    if (!Array.isArray(agent.connections)) continue;
    for (const target of agent.connections) {
      if (!domainSet.has(target)) continue;
      // Use CSL weighted_superposition to compute edge weight from both
      // agents' priorities (higher priority pair → stronger edge)
      const targetAgent  = agents.find(a => a.domain === target);
      const edgeWeight   = CSL.weighted_superposition([
        { value: agent.priority       ?? 0, weight: 0.5 },
        { value: targetAgent?.priority ?? 0, weight: 0.5 },
      ]);
      edges.push({ from: agent.domain, to: target, weight: parseFloat(edgeWeight.toFixed(4)) });
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

/**
 * Worker: map-agents
 * Maps all active agents/bees with their domains, states, priorities, and
 * last heartbeat timestamps.
 */
function makeMapAgentsWorker() {
  return async function mapAgents() {
    const tag = 'map-agents';
    logger.debug(`[${tag}] starting`);

    const agents  = getAllAgents();
    const now     = Date.now();
    const mapped  = agents.map(a => ({
      domain:        a.domain,
      description:   a.description  ?? '',
      priority:      a.priority     ?? 0,
      state:         a.state        ?? 'unknown',
      lastHeartbeat: a.lastHeartbeat ?? null,
      heartbeatAgeMs: a.lastHeartbeat ? now - a.lastHeartbeat : null,
      connections:   a.connections  ?? [],
    }));

    const stateGroups = mapped.reduce((acc, a) => {
      acc[a.state] = (acc[a.state] || 0) + 1;
      return acc;
    }, {});

    const result = {
      worker:      tag,
      capturedAt:  now,
      agentCount:  mapped.length,
      agents:      mapped,
      stateGroups,
    };

    logger.info(`[${tag}] completed`, {
      agentCount: result.agentCount,
      states:     stateGroups,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:topology', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: compute-graph
 * Builds an adjacency graph of agent relationships and computes basic
 * graph metrics (degree centrality, connectivity).
 */
function makeComputeGraphWorker() {
  return async function computeGraph() {
    const tag = 'compute-graph';
    logger.debug(`[${tag}] starting`);

    const agents = getAllAgents();
    const graph  = buildAdjacencyGraph(agents);

    // Compute in/out degree per node
    const inDegree  = {};
    const outDegree = {};
    for (const node of graph.nodes) {
      inDegree[node.id]  = 0;
      outDegree[node.id] = 0;
    }
    for (const edge of graph.edges) {
      outDegree[edge.from] = (outDegree[edge.from] || 0) + 1;
      inDegree[edge.to]    = (inDegree[edge.to]    || 0) + 1;
    }

    // Degree centrality: normalised by max possible degree
    const n      = graph.nodes.length;
    const maxDeg = n > 1 ? n - 1 : 1;
    const centrality = graph.nodes.map(node => ({
      domain:       node.id,
      inDegree:     inDegree[node.id]  ?? 0,
      outDegree:    outDegree[node.id] ?? 0,
      totalDegree: (inDegree[node.id] ?? 0) + (outDegree[node.id] ?? 0),
      centrality:   parseFloat(((inDegree[node.id] ?? 0) / maxDeg).toFixed(4)),
    })).sort((a, b) => b.totalDegree - a.totalDegree);

    // Is the graph connected? (BFS from first node)
    const dominated   = new Set();
    const adjList     = {};
    for (const node of graph.nodes) adjList[node.id] = [];
    for (const edge of graph.edges) {
      adjList[edge.from].push(edge.to);
      adjList[edge.to].push(edge.from); // treat as undirected for connectivity
    }

    let isConnected = false;
    if (graph.nodes.length > 0) {
      const queue = [graph.nodes[0].id];
      dominated.add(graph.nodes[0].id);
      while (queue.length) {
        const curr = queue.shift();
        for (const neighbor of (adjList[curr] || [])) {
          if (!dominated.has(neighbor)) {
            dominated.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      isConnected = dominated.size === graph.nodes.length;
    }

    const result = {
      worker:      'compute-graph',
      capturedAt:  Date.now(),
      nodeCount:   graph.nodes.length,
      edgeCount:   graph.edges.length,
      nodes:       graph.nodes,
      edges:       graph.edges,
      centrality,
      isConnected,
      connectedComponents: isConnected ? 1 : graph.nodes.length - dominated.size + 1,
    };

    logger.info(`[${tag}] completed`, {
      nodes:       result.nodeCount,
      edges:       result.edgeCount,
      isConnected: result.isConnected,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:topology', { worker: tag, data: result });
    }

    return result;
  };
}

/**
 * Worker: detect-orphans
 * Identifies disconnected or unresponsive agents.
 * An agent is an "orphan" if it has no edges in the graph OR its heartbeat
 * exceeds the PHI-scaled unresponsive threshold.
 */
function makeDetectOrphansWorker() {
  return async function detectOrphans() {
    const tag = 'detect-orphans';
    logger.debug(`[${tag}] starting`);

    const agents  = getAllAgents();
    const now     = Date.now();
    const graph   = buildAdjacencyGraph(agents);

    // Build set of domains that appear in at least one edge
    const connectedDomains = new Set();
    for (const edge of graph.edges) {
      connectedDomains.add(edge.from);
      connectedDomains.add(edge.to);
    }

    const orphans = [];

    for (const agent of agents) {
      const hasConnections  = connectedDomains.has(agent.domain);
      const heartbeatAgeMs  = agent.lastHeartbeat ? now - agent.lastHeartbeat : Infinity;
      const isUnresponsive  = heartbeatAgeMs > UNRESPONSIVE_THRESHOLD_MS;

      // CSL ternary_gate: true = connected+responsive, null = no edges, false = unresponsive
      const verdict = CSL.ternary_gate(hasConnections ? 1 : 0, isUnresponsive ? -1 : 0);

      if (!hasConnections || isUnresponsive) {
        const orphan = {
          domain:          agent.domain,
          reason:          !hasConnections ? 'no-connections' : 'unresponsive',
          isUnresponsive,
          hasConnections,
          heartbeatAgeMs:  heartbeatAgeMs === Infinity ? null : heartbeatAgeMs,
          thresholdMs:     UNRESPONSIVE_THRESHOLD_MS,
          state:           agent.state ?? 'unknown',
          cslVerdict:      verdict,
        };
        orphans.push(orphan);
        logger.warn(`[${tag}] orphan detected`, { domain: agent.domain, reason: orphan.reason });

        if (global.eventBus) {
          global.eventBus.emit('topology:orphan-detected', orphan);
        }
      }
    }

    const result = {
      worker:      tag,
      capturedAt:  now,
      orphans,
      orphanCount: orphans.length,
      agentCount:  agents.length,
      threshold:   UNRESPONSIVE_THRESHOLD_MS,
    };

    logger.info(`[${tag}] completed`, {
      orphanCount: result.orphanCount,
      agentCount:  result.agentCount,
    });

    if (global.eventBus) {
      global.eventBus.emit('projection:topology', { worker: tag, data: result });
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Bee export
// ---------------------------------------------------------------------------
const domain      = 'topology-projection';
const description = 'Projects the swarm topology and agent graph: agent mapping, adjacency graph with centrality metrics, and orphan/disconnection detection.';
const priority    = 0.6;

function getWork() {
  return [
    makeMapAgentsWorker(),
    makeComputeGraphWorker(),
    makeDetectOrphansWorker(),
  ];
}

module.exports = { domain, description, priority, getWork };
