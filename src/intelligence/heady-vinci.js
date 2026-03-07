/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const { EventEmitter } = require('events');
const logger = require('../utils/logger');
const { PatternEngine } = require('../patterns/pattern-engine');
const { HeadyConductor } = require('../orchestration/heady-conductor');

const PHI = 1.6180339887;

// ─── Plan node types ──────────────────────────────────────────────────────────
const NodeType = Object.freeze({
  LLM:         'LLM',
  BEE:         'BEE',
  MEMORY:      'MEMORY',
  PATTERN:     'PATTERN',
  TOOL:        'TOOL',
  GOVERNANCE:  'GOVERNANCE',
  CONDUCTOR:   'CONDUCTOR',
  PARALLEL:    'PARALLEL',
  CONDITIONAL: 'CONDITIONAL',
});

// ─── Conflict resolution strategies ─────────────────────────────────────────
const ConflictStrategy = Object.freeze({
  PRIORITY:   'PRIORITY',    // Higher priority node wins
  MERGE:      'MERGE',       // Attempt to merge proposals
  ESCALATE:   'ESCALATE',    // Escalate to human review
  VOTE:       'VOTE',        // Majority vote across proposals
  SOCRATIC:   'SOCRATIC',    // Socratic dialogue to find truth
});

// ─── Reasoning validation states ─────────────────────────────────────────────
const ReasoningState = Object.freeze({
  PENDING:   'PENDING',
  VALID:     'VALID',
  INVALID:   'INVALID',
  ESCALATED: 'ESCALATED',
});

/**
 * HeadyVinci — Session Planner & Meta-Reasoner
 *
 * HeadyVinci sits at the top of the logic chain. It is the architect and
 * composer responsible for:
 *   - Holding global mission and values context
 *   - Planning execution: which nodes to invoke, in what order
 *   - Resolving conflicts between competing node proposals
 *   - Maintaining the topology of all active nodes
 *   - Socratic Loop: challenging its own reasoning before projecting to code
 *   - Integrating with the pattern engine for optimization
 *
 * @extends EventEmitter
 */
class HeadyVinci extends EventEmitter {
  /**
   * @param {object} [options]
   * @param {object} [options.patternEngine]  - PatternEngine instance
   * @param {object} [options.conductor]      - HeadyConductor instance
   * @param {object} [options.mission]        - Mission and values object
   * @param {number} [options.maxPlanDepth]   - Maximum planning recursion depth
   * @param {number} [options.socraticRounds] - Number of Socratic challenge rounds
   */
  constructor(options = {}) {
    super();

    this._patternEngine  = options.patternEngine || new PatternEngine();
    this._conductor      = options.conductor     || new HeadyConductor();
    this._maxPlanDepth   = options.maxPlanDepth   || 5;
    this._socraticRounds = options.socraticRounds || 3;

    // Global mission + values
    this._mission = options.mission || {
      goal: "Serve HeadyConnection's community through equitable, empowering technology",
      values: ['community', 'equity', 'empowerment', 'transparency', 'safety'],
      constraints: [
        'No harmful content',
        'No privacy violations',
        'Mission-aligned output only',
      ],
    };

    // Node topology registry: nodeId → NodeDescriptor
    this._topology = new Map();

    // Session plans: planId → ExecutionPlan
    this._plans = new Map();

    // Conflict history
    this._conflictHistory = [];

    // Reasoning trace for Socratic loop
    this._reasoningTrace = [];

    logger.info('[HeadyVinci] Initialized', {
      maxPlanDepth: this._maxPlanDepth,
      socraticRounds: this._socraticRounds,
    });
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Create an execution plan for a task.
   * Plans which nodes to invoke, in what order, with priorities.
   *
   * @param {object} task
   * @param {string} task.id
   * @param {string} task.type
   * @param {object} task.payload
   * @param {object} [context] - Assembled context from HeadyBrains
   * @returns {Promise<ExecutionPlan>}
   */
  async plan(task, context = {}) {
    const planId = `plan-${task.id}-${Date.now()}`;
    logger.debug('[HeadyVinci] Planning', { planId, taskType: task.type });

    // Step 1: Fetch relevant patterns for optimization
    const patterns = await this._patternEngine.match({
      taskType: task.type,
      payload: task.payload,
      limit: 5,
    }).catch(() => []);

    // Step 2: Build initial plan
    const draft = await this._buildPlan(task, context, patterns);

    // Step 3: Socratic Loop — validate reasoning before committing
    const validated = await this._socraticLoop(draft, task);

    // Step 4: Prioritize
    const prioritized = this._prioritizeNodes(validated.plan, context);

    const executionPlan = {
      planId,
      taskId: task.id,
      taskType: task.type,
      nodes: prioritized,
      strategy: validated.strategy,
      reasoning: validated.reasoning,
      patterns: patterns.map((p) => p.id || p.name),
      missionAlignment: this._assessMissionAlignment(task, context),
      createdAt: Date.now(),
      depth: this._computeDepth(prioritized),
    };

    this._plans.set(planId, executionPlan);
    this.emit('plan:created', { planId, taskId: task.id, nodeCount: prioritized.length });
    logger.info('[HeadyVinci] Plan created', {
      planId, taskId: task.id, nodes: prioritized.length,
    });

    return executionPlan;
  }

  /**
   * Resolve conflicts between competing node proposals.
   * Uses configurable strategy; defaults to PRIORITY with Socratic fallback.
   *
   * @param {object[]} proposals  - Array of proposed execution plans or results
   * @param {string}   [strategy] - ConflictStrategy value
   * @returns {Promise<ResolvedProposal>}
   */
  async resolveConflicts(proposals, strategy = ConflictStrategy.PRIORITY) {
    if (!proposals || proposals.length === 0) {
      throw new Error('[HeadyVinci] resolveConflicts: no proposals provided');
    }
    if (proposals.length === 1) return { resolved: proposals[0], strategy: 'UNCONTESTED' };

    logger.debug('[HeadyVinci] Resolving conflicts', {
      count: proposals.length, strategy,
    });

    let resolved;

    switch (strategy) {
      case ConflictStrategy.PRIORITY:
        resolved = this._resolveByPriority(proposals);
        break;

      case ConflictStrategy.MERGE:
        resolved = this._resolveByMerge(proposals);
        break;

      case ConflictStrategy.VOTE:
        resolved = this._resolveByVote(proposals);
        break;

      case ConflictStrategy.SOCRATIC: {
        const socratic = await this._socraticConflictResolution(proposals);
        resolved = socratic;
        break;
      }

      case ConflictStrategy.ESCALATE:
        this.emit('conflict:escalated', { proposals });
        resolved = proposals[0]; // Return first pending escalation
        break;

      default:
        resolved = this._resolveByPriority(proposals);
    }

    const result = {
      resolved,
      strategy,
      competingCount: proposals.length,
      resolvedAt: Date.now(),
    };

    this._conflictHistory.push(result);
    this.emit('conflict:resolved', result);
    logger.info('[HeadyVinci] Conflict resolved', { strategy, competingCount: proposals.length });

    return result;
  }

  /**
   * Register a node in the topology.
   *
   * @param {object} node
   * @param {string} node.id
   * @param {string} node.type   - NodeType value
   * @param {object} [node.meta]
   * @returns {void}
   */
  registerNode(node) {
    if (!node.id) throw new Error('[HeadyVinci] registerNode: node.id required');
    if (!node.type) throw new Error('[HeadyVinci] registerNode: node.type required');

    const descriptor = {
      id: node.id,
      type: node.type,
      meta: node.meta || {},
      registeredAt: Date.now(),
      status: 'ACTIVE',
      relationships: [],
    };
    this._topology.set(node.id, descriptor);
    this.emit('topology:node:registered', { nodeId: node.id, type: node.type });
    logger.debug('[HeadyVinci] Node registered', { nodeId: node.id, type: node.type });
  }

  /**
   * Define a relationship between two nodes.
   * @param {string} fromNodeId
   * @param {string} toNodeId
   * @param {string} [relation] - e.g. 'feeds', 'monitors', 'governs'
   */
  linkNodes(fromNodeId, toNodeId, relation = 'feeds') {
    const from = this._topology.get(fromNodeId);
    const to   = this._topology.get(toNodeId);
    if (!from) throw new Error(`[HeadyVinci] Node not found: ${fromNodeId}`);
    if (!to)   throw new Error(`[HeadyVinci] Node not found: ${toNodeId}`);

    from.relationships.push({ target: toNodeId, relation });
    this.emit('topology:link', { from: fromNodeId, to: toNodeId, relation });
  }

  /**
   * Get the full node topology.
   * @returns {object} Topology as adjacency description
   */
  getTopology() {
    return {
      nodes: Array.from(this._topology.values()),
      nodeCount: this._topology.size,
      snapshotAt: Date.now(),
    };
  }

  /**
   * Get the reasoning trace (Socratic loop history).
   * @param {number} [limit=20]
   * @returns {object[]}
   */
  getReasoningTrace(limit = 20) {
    return this._reasoningTrace.slice(-limit);
  }

  // ─── Plan Building ────────────────────────────────────────────────────────────

  /**
   * Build an initial execution plan from task and context.
   */
  async _buildPlan(task, context, patterns) {
    const nodes = [];
    let order = 0;

    // Always start with MEMORY retrieval
    nodes.push({
      id: `${task.id}:memory`,
      type: NodeType.MEMORY,
      order: order++,
      priority: 10,
      label: 'Retrieve relevant memory',
      required: false,
    });

    // Pattern-based node injection
    if (patterns.length > 0) {
      nodes.push({
        id: `${task.id}:pattern`,
        type: NodeType.PATTERN,
        order: order++,
        priority: 8,
        label: 'Apply matching patterns',
        required: false,
        patterns: patterns.map((p) => p.id),
      });
    }

    // Governance check before execution
    nodes.push({
      id: `${task.id}:governance`,
      type: NodeType.GOVERNANCE,
      order: order++,
      priority: 100, // Highest — always runs
      label: 'Governance and policy check',
      required: true,
    });

    // Main execution node — type depends on task
    if (task.type === 'llm_task' || task.type === 'generate' || task.type === 'query') {
      nodes.push({
        id: `${task.id}:llm`,
        type: NodeType.LLM,
        order: order++,
        priority: 9,
        label: 'LLM inference',
        required: true,
      });
    } else if (task.type === 'search' || task.type === 'lookup') {
      nodes.push({
        id: `${task.id}:tool:search`,
        type: NodeType.TOOL,
        order: order++,
        priority: 9,
        label: 'Search tool execution',
        required: true,
        tool: 'search',
      });
    } else {
      // Default: route through conductor
      nodes.push({
        id: `${task.id}:conductor`,
        type: NodeType.CONDUCTOR,
        order: order++,
        priority: 9,
        label: 'Conductor routing',
        required: true,
      });
    }

    return {
      nodes,
      strategy: 'SEQUENTIAL',
      reasoning: [`Initial plan for task type: ${task.type}`],
    };
  }

  // ─── Socratic Loop ────────────────────────────────────────────────────────────

  /**
   * Validate and refine a plan draft through Socratic questioning.
   * Each round challenges an assumption in the plan and attempts to
   * find a better answer.
   *
   * @param {object} draft   - Draft plan
   * @param {object} task
   * @returns {Promise<ValidatedPlan>}
   */
  async _socraticLoop(draft, task) {
    let current = { ...draft };
    const traceEntry = {
      taskId: task.id,
      rounds: [],
      state: ReasoningState.PENDING,
      startedAt: Date.now(),
    };

    for (let round = 0; round < this._socraticRounds; round++) {
      const challenge = this._generateChallenge(current, task, round);
      const response  = await this._answerChallenge(challenge, current, task);

      traceEntry.rounds.push({ round, challenge, response });

      if (response.refine) {
        current = response.refinedPlan || current;
        logger.debug('[HeadyVinci:Socratic] Plan refined', { round, taskId: task.id });
      }

      if (response.state === ReasoningState.INVALID) {
        traceEntry.state = ReasoningState.ESCALATED;
        this.emit('reasoning:escalated', { taskId: task.id, round, challenge });
        break;
      }
    }

    if (traceEntry.state !== ReasoningState.ESCALATED) {
      traceEntry.state = ReasoningState.VALID;
    }

    traceEntry.completedAt = Date.now();
    this._reasoningTrace.push(traceEntry);

    return {
      plan: current.nodes,
      strategy: current.strategy,
      reasoning: current.reasoning,
      socraticTrace: traceEntry,
    };
  }

  /**
   * Generate a Socratic challenge for the current plan.
   */
  _generateChallenge(plan, task, round) {
    const challenges = [
      `Why is this the right order of nodes for task type "${task.type}"?`,
      `Are all required nodes present? Could any be removed without loss?`,
      `Does this plan align with the mission values: ${this._mission.values.join(', ')}?`,
      `What is the failure mode if the LLM node returns empty? Is there a fallback?`,
      `Is governance check positioned before execution? (It must be.)`,
    ];
    return challenges[round % challenges.length];
  }

  /**
   * Answer a Socratic challenge and optionally refine the plan.
   */
  async _answerChallenge(challenge, plan, task) {
    const response = {
      challenge,
      answer: null,
      refine: false,
      refinedPlan: null,
      state: ReasoningState.VALID,
    };

    // Check: governance before execution
    const govIndex  = plan.nodes.findIndex((n) => n.type === NodeType.GOVERNANCE);
    const execIndex = plan.nodes.findIndex((n) =>
      [NodeType.LLM, NodeType.TOOL, NodeType.CONDUCTOR, NodeType.BEE].includes(n.type)
    );

    if (govIndex !== -1 && execIndex !== -1 && govIndex > execIndex) {
      // Governance is after execution — fix it
      const nodes = [...plan.nodes];
      const govNode = nodes.splice(govIndex, 1)[0];
      nodes.splice(execIndex, 0, govNode);
      response.refine = true;
      response.refinedPlan = { ...plan, nodes };
      response.answer = 'Governance node repositioned before execution';
      plan.reasoning.push('Socratic: governance moved before execution node');
    }

    return response;
  }

  // ─── Prioritization ───────────────────────────────────────────────────────────

  /**
   * Sort plan nodes by priority (descending), preserving required ordering.
   */
  _prioritizeNodes(nodes, context) {
    const priority = context?.priority || 'normal';
    const boost = priority === 'high' ? 5 : priority === 'low' ? -2 : 0;

    return [...nodes].sort((a, b) => {
      // Required nodes always first
      if (a.required && !b.required) return -1;
      if (!a.required && b.required) return 1;
      // Then by priority score
      return (b.priority + boost) - (a.priority + boost);
    });
  }

  // ─── Conflict Resolution Strategies ──────────────────────────────────────────

  _resolveByPriority(proposals) {
    return proposals.reduce((best, p) => {
      const pScore = p.priority || p.score || 0;
      const bScore = best.priority || best.score || 0;
      return pScore > bScore ? p : best;
    });
  }

  _resolveByMerge(proposals) {
    // Deep merge all proposal objects
    return proposals.reduce((merged, p) => {
      return this._deepMerge(merged, p);
    }, {});
  }

  _resolveByVote(proposals) {
    // Each proposal votes for itself; winner is most common value
    const counts = new Map();
    for (const p of proposals) {
      const key = JSON.stringify(p);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let best = proposals[0];
    let bestCount = 0;
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        best = JSON.parse(key);
      }
    }
    return best;
  }

  async _socraticConflictResolution(proposals) {
    logger.debug('[HeadyVinci] Socratic conflict resolution', { count: proposals.length });
    // Challenge each proposal against the mission
    const scored = proposals.map((p) => ({
      proposal: p,
      alignment: this._assessMissionAlignment(p, {}),
    }));
    scored.sort((a, b) => b.alignment.score - a.alignment.score);
    return scored[0].proposal;
  }

  // ─── Mission Alignment ────────────────────────────────────────────────────────

  _assessMissionAlignment(task, context) {
    const text = JSON.stringify(task).toLowerCase();
    let score = 1.0;
    const flags = [];

    // Boost for mission keywords
    for (const kw of this._mission.values) {
      if (text.includes(kw)) score = Math.min(1, score * PHI / PHI + 0.05);
    }

    // Penalize for constraint violations
    if (text.includes('harm') || text.includes('illegal')) {
      score -= 0.3;
      flags.push('potential_harm');
    }

    return { score: Math.max(0, score), flags };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _computeDepth(nodes) {
    return nodes.reduce((max, n) => Math.max(max, n.order || 0), 0) + 1;
  }

  _deepMerge(target, source) {
    const out = { ...target };
    for (const key of Object.keys(source)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        key in target &&
        typeof target[key] === 'object'
      ) {
        out[key] = this._deepMerge(target[key], source[key]);
      } else if (Array.isArray(source[key]) && Array.isArray(target[key])) {
        out[key] = [...target[key], ...source[key]];
      } else {
        out[key] = source[key];
      }
    }
    return out;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = { HeadyVinci, NodeType, ConflictStrategy, ReasoningState, PHI };
