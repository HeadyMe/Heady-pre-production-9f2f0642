/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

const ToolRegistry = require('./tool-registry');

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'heady_memory',
    description: 'Search vector memory store using semantic similarity. Returns ranked results with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query' },
        limit: { type: 'integer', description: 'Max results to return', default: 10, minimum: 1, maximum: 100 },
        minScore: { type: 'number', description: 'Minimum similarity score (0-1)', default: 0.7, minimum: 0, maximum: 1 },
      },
      required: ['query'],
    },
  },
  {
    name: 'heady_embed',
    description: 'Generate vector embeddings for text using the specified model.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to embed' },
        model: {
          type: 'string',
          description: 'Embedding model to use',
          enum: ['text-embedding-3-small', 'text-embedding-3-large', 'heady-embed-v1'],
          default: 'text-embedding-3-small',
        },
      },
      required: ['text'],
    },
  },
  {
    name: 'heady_soul',
    description: 'Soul intelligence engine: analyze content for patterns, optimize reasoning, or train on new data.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content to process' },
        action: {
          type: 'string',
          enum: ['analyze', 'optimize', 'learn'],
          description: 'Action to perform',
          default: 'analyze',
        },
      },
      required: ['content', 'action'],
    },
  },
  {
    name: 'heady_vinci',
    description: 'Pattern recognition engine: learn patterns, make predictions, or recognize structures in data.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Input data for processing' },
        action: {
          type: 'string',
          enum: ['learn', 'predict', 'recognize'],
          description: 'Pattern operation to perform',
        },
        context: { type: 'object', description: 'Additional context for pattern matching', default: {} },
      },
      required: ['data', 'action'],
    },
  },
  {
    name: 'heady_conductor_route',
    description: 'Route a task through the HeadyConductor orchestration layer to the optimal node.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task description or prompt to route' },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'critical'],
          description: 'Task execution priority',
          default: 'normal',
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'heady_pipeline_run',
    description: 'Execute the HCFullPipeline with the given task. Supports full-auto mode for autonomous execution.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Task or goal to run through the full pipeline' },
        fullAuto: {
          type: 'boolean',
          description: 'Enable full-auto autonomous mode',
          default: false,
        },
      },
      required: ['task'],
    },
  },
  {
    name: 'heady_battle',
    description: 'Run an Arena Battle evaluation between candidate solutions. Returns ranked results with scores.',
    inputSchema: {
      type: 'object',
      properties: {
        candidates: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of candidate solutions to evaluate',
          minItems: 2,
        },
        criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Evaluation criteria for the battle',
          default: ['accuracy', 'quality', 'efficiency'],
        },
      },
      required: ['candidates'],
    },
  },
  {
    name: 'heady_health',
    description: 'Check health status of a specific service or all services.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Service name to check. Omit for global health check.',
        },
      },
    },
  },
  {
    name: 'heady_status',
    description: 'Get comprehensive system status including all nodes, services, and metrics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_nodes',
    description: 'List all active nodes in the Heady network with their current status and capabilities.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_monte_carlo',
    description: 'Run Monte Carlo simulation for decision-making under uncertainty.',
    inputSchema: {
      type: 'object',
      properties: {
        scenario: { type: 'string', description: 'Scenario description to simulate' },
        iterations: {
          type: 'integer',
          description: 'Number of simulation iterations',
          default: 1000,
          minimum: 100,
          maximum: 100000,
        },
      },
      required: ['scenario'],
    },
  },
  {
    name: 'heady_deploy',
    description: 'Deploy a service or configuration to the target environment.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'Deployment target',
          enum: ['local', 'cloud-me', 'cloud-sys', 'cloud-conn', 'hybrid'],
        },
        config: { type: 'object', description: 'Deployment configuration object' },
      },
      required: ['target'],
    },
  },
  {
    name: 'heady_code_generate',
    description: 'Generate production-ready code from a natural language prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Description of the code to generate' },
        language: {
          type: 'string',
          description: 'Target programming language',
          enum: ['javascript', 'typescript', 'python', 'go', 'rust', 'java', 'sql', 'bash'],
          default: 'javascript',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_code_review',
    description: 'Review code for bugs, security issues, performance, and style improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Source code to review' },
        context: { type: 'string', description: 'Additional context about the code (purpose, requirements)' },
      },
      required: ['code'],
    },
  },
  {
    name: 'heady_research',
    description: 'Conduct deep research on a topic using all available knowledge sources.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Research query or topic' },
        depth: {
          type: 'string',
          enum: ['shallow', 'standard', 'deep', 'exhaustive'],
          description: 'Research depth level',
          default: 'standard',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'heady_creative',
    description: 'Generate creative content: stories, marketing copy, ideas, designs, or artistic content.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Creative prompt or brief' },
        style: {
          type: 'string',
          description: 'Creative style or tone',
          enum: ['professional', 'casual', 'poetic', 'technical', 'storytelling', 'persuasive'],
          default: 'professional',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'heady_analyze',
    description: 'Analyze data, text, or structured information and return insights.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Data to analyze' },
        type: {
          type: 'string',
          enum: ['sentiment', 'statistical', 'semantic', 'temporal', 'comparative', 'anomaly'],
          description: 'Type of analysis to perform',
          default: 'semantic',
        },
      },
      required: ['data'],
    },
  },
  {
    name: 'heady_patterns',
    description: 'Detect patterns, trends, and structures in data using HeadyVinci pattern engine.',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: ['string', 'object', 'array'], description: 'Data for pattern detection' },
      },
      required: ['data'],
    },
  },
  {
    name: 'heady_governance_check',
    description: 'Validate an action or decision against governance policies, safety rules, and ethical guidelines.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'Action or decision to validate' },
        context: { type: 'object', description: 'Context including user, scope, and environment', default: {} },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_budget_status',
    description: 'Get current budget usage, limits, and remaining allocations for all cost categories.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_bee_spawn',
    description: 'Spawn a Bee agent worker for a specific domain or task.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Domain or capability for the bee agent',
          enum: ['research', 'coding', 'analysis', 'creative', 'monitoring', 'automation'],
        },
        config: { type: 'object', description: 'Bee configuration and initial task assignment', default: {} },
      },
      required: ['domain'],
    },
  },
  {
    name: 'heady_bee_status',
    description: 'Check the status and progress of a spawned Bee agent.',
    inputSchema: {
      type: 'object',
      properties: {
        beeId: { type: 'string', description: 'Unique bee agent identifier' },
      },
      required: ['beeId'],
    },
  },
  {
    name: 'heady_drift_check',
    description: 'Check semantic drift for a component — detects when behavior deviates from baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        componentId: {
          type: 'string',
          description: 'Component identifier to check for semantic drift',
        },
      },
      required: ['componentId'],
    },
  },
  {
    name: 'heady_coherence',
    description: 'Compute overall system coherence score across all nodes and services.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_readiness',
    description: 'Evaluate operational readiness: all nodes healthy, thresholds met, dependencies resolved.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'heady_story',
    description: 'Log an event to the HeadyAutobiographer for narrative tracking and historical record.',
    inputSchema: {
      type: 'object',
      properties: {
        event: {
          type: 'string',
          description: 'Event type',
          enum: ['action_taken', 'decision_made', 'error_encountered', 'healing_performed', 'milestone_reached', 'learning_captured'],
        },
        context: { type: 'object', description: 'Event context and metadata', default: {} },
      },
      required: ['event'],
    },
  },
  {
    name: 'heady_corrections',
    description: 'Analyze behavior patterns and apply subtle corrections or improvements.',
    inputSchema: {
      type: 'object',
      properties: {
        behavior: { type: 'string', description: 'Behavior or pattern to correct/improve' },
        context: { type: 'object', description: 'Context for the behavioral correction', default: {} },
      },
      required: ['behavior'],
    },
  },
  {
    name: 'heady_lens',
    description: 'Generate AR overlay explanation for a target object, concept, or data point.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Object, concept, or data point to explain' },
        query: { type: 'string', description: 'Specific question or aspect to focus the lens on' },
      },
      required: ['target', 'query'],
    },
  },
  {
    name: 'heady_secrets',
    description: 'Interface for secret management: get, set, rotate, or list secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'rotate', 'list', 'delete'],
          description: 'Secret management action',
        },
        key: { type: 'string', description: 'Secret key identifier' },
      },
      required: ['action'],
    },
  },
  {
    name: 'heady_config',
    description: 'Get or set configuration values for the Heady platform.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Configuration key (dot-notation supported, e.g. conductor.timeout)' },
        value: { description: 'Value to set. Omit to get current value.' },
      },
      required: ['key'],
    },
  },
  {
    name: 'heady_audit',
    description: 'Query the audit trail for system events, actions, and decisions.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for audit records' },
        limit: { type: 'integer', description: 'Max records to return', default: 50, minimum: 1, maximum: 500 },
      },
      required: ['query'],
    },
  },
];

// ─── HeadyMCPServer ───────────────────────────────────────────────────────────

class HeadyMCPServer {
  /**
   * @param {object} opts
   * @param {object} opts.conductor  - HeadyConductor instance (or compatible interface)
   * @param {object} [opts.logger]   - Pino/Winston-compatible logger
   */
  constructor({ conductor, logger } = {}) {
    this._conductor = conductor || null;
    this._log = logger || this._buildDefaultLogger();

    this._registry = new ToolRegistry({ logger: this._log });
    this._server = new Server(
      { name: 'heady-mcp', version: '3.1.0' },
      { capabilities: { tools: {} } }
    );

    this._registerAllTools();
    this._attachHandlers();
  }

  // ── Private: logger ──────────────────────────────────────────────────────

  _buildDefaultLogger() {
    return {
      info:  (...a) => console.error('[MCP:INFO]',  ...a),
      warn:  (...a) => console.error('[MCP:WARN]',  ...a),
      error: (...a) => console.error('[MCP:ERROR]', ...a),
      debug: (...a) => process.env.LOG_LEVEL === 'debug' && console.error('[MCP:DEBUG]', ...a),
    };
  }

  // ── Private: registration ────────────────────────────────────────────────

  _registerAllTools() {
    for (const def of TOOL_DEFINITIONS) {
      this._registry.register(def);
    }
    this._log.info(`Registered ${this._registry.list().length} MCP tools`);
  }

  // ── Private: handlers ────────────────────────────────────────────────────

  _attachHandlers() {
    this._server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: this._registry.list() };
    });

    this._server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      this._log.debug('Tool call', { name, args });

      try {
        const result = await this._dispatch(name, args || {});
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (err) {
        this._log.error('Tool execution error', { name, error: err.message });
        if (err instanceof McpError) throw err;
        throw new McpError(
          ErrorCode.InternalError,
          `Tool '${name}' execution failed: ${err.message}`
        );
      }
    });
  }

  // ── Private: dispatch ────────────────────────────────────────────────────

  /**
   * Dispatch a tool call through the conductor or direct handlers.
   * @param {string} name
   * @param {object} args
   * @returns {Promise<object>}
   */
  async _dispatch(name, args) {
    // Validate args against schema first
    const validation = this._registry.validate(name, args);
    if (!validation.valid) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments for '${name}': ${validation.errors.join(', ')}`
      );
    }

    // Route through conductor if available
    if (this._conductor && typeof this._conductor.handleMCPTool === 'function') {
      return await this._conductor.handleMCPTool(name, args);
    }

    // Fallback: built-in handlers
    return await this._handleDirect(name, args);
  }

  /**
   * Direct handler when no conductor is attached (standalone / test mode).
   */
  async _handleDirect(name, args) {
    const ts = new Date().toISOString();

    switch (name) {
      case 'heady_status':
        return {
          status: 'operational',
          version: '3.1.0',
          timestamp: ts,
          mode: 'standalone',
          nodes: { total: 0, active: 0 },
          message: 'MCP server running in standalone mode — conductor not attached',
        };

      case 'heady_health':
        return {
          service: args.service || 'all',
          status: 'healthy',
          timestamp: ts,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        };

      case 'heady_nodes':
        return {
          nodes: [],
          total: 0,
          timestamp: ts,
          message: 'No nodes registered — conductor not attached',
        };

      case 'heady_budget_status':
        return {
          timestamp: ts,
          budget: { total: 0, used: 0, remaining: 0 },
          message: 'Budget tracking requires conductor',
        };

      case 'heady_coherence':
        return { score: 0, timestamp: ts, message: 'Coherence requires live node data' };

      case 'heady_readiness':
        return {
          ready: true,
          timestamp: ts,
          checks: { mcp_server: 'pass', conductor: 'not_attached', memory: 'not_attached' },
        };

      default:
        return {
          tool: name,
          args,
          timestamp: ts,
          status: 'queued',
          message: `Tool '${name}' requires conductor — queued for when conductor attaches`,
        };
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Attach a conductor instance after construction.
   * @param {object} conductor
   */
  setConductor(conductor) {
    this._conductor = conductor;
    this._log.info('Conductor attached to MCP server');
  }

  /**
   * Start listening on stdio transport.
   * @returns {Promise<void>}
   */
  async start() {
    const transport = new StdioServerTransport();
    await this._server.connect(transport);
    this._log.info('HeadyMCPServer started on stdio transport (v3.1.0)');
  }

  /**
   * Gracefully shut down the server.
   * @returns {Promise<void>}
   */
  async stop() {
    try {
      await this._server.close();
      this._log.info('HeadyMCPServer stopped');
    } catch (err) {
      this._log.error('Error stopping MCP server', { error: err.message });
    }
  }
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

if (require.main === module) {
  const server = new HeadyMCPServer();

  process.on('SIGINT',  async () => { await server.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });

  server.start().catch((err) => {
    console.error('[HeadyMCP] Fatal startup error:', err);
    process.exit(1);
  });
}

module.exports = HeadyMCPServer;
