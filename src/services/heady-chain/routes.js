'use strict';

/**
 * HeadyChain Express Router
 * All chain execution, tool, agent, and management endpoints.
 */

const express = require('express');
const router = express.Router();

const { HeadyChain, defaultChain, WORKFLOW_STATUS } = require('./index');
const { GraphBuilder } = require('./graph');
const { globalRegistry: toolRegistry } = require('./tools');
const { AgentFactory } = require('./agents');
const { getHealth, liveness, readiness } = require('./health');
const config = require('./config');

// Use a shared HeadyChain instance (can be overridden in tests)
let chain = defaultChain;

/**
 * Attach a HeadyChain instance to the router (for dependency injection).
 */
router.setChain = function(c) { chain = c; };
router.getChain = function() { return chain; };

// ─── Middleware ───────────────────────────────────────────────────────────────

function validateBody(requiredFields) {
  return (req, res, next) => {
    const missing = requiredFields.filter(f => !(f in req.body));
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required fields',
        missing,
      });
    }
    next();
  };
}

// ─── Health ───────────────────────────────────────────────────────────────────

/**
 * GET /health
 * Full service health check with metrics.
 */
router.get('/health', async (req, res) => {
  try {
    const health = await getHealth(chain);
    res.json(health);
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: err.message });
  }
});

/**
 * GET /health/live
 * Kubernetes liveness probe.
 */
router.get('/health/live', liveness);

/**
 * GET /health/ready
 * Kubernetes readiness probe.
 */
router.get('/health/ready', readiness);

// ─── Chain Execution ──────────────────────────────────────────────────────────

/**
 * POST /chain/execute
 * Execute a workflow graph synchronously.
 *
 * Body:
 *   graph {object}        - GraphBuilder JSON (from toJSON())
 *   state {object}        - Initial workflow state
 *   dryRun {boolean}      - Dry-run mode (no LLM/tool calls)
 *   timeoutMs {number}    - Workflow timeout override
 *   checkpointId {string} - Resume from checkpoint
 *   metadata {object}     - Arbitrary workflow metadata
 */
router.post('/chain/execute', validateBody(['graph']), async (req, res) => {
  const {
    graph,
    state = {},
    dryRun = false,
    timeoutMs,
    checkpointId,
    metadata = {},
  } = req.body;

  try {
    const result = await chain.execute(graph, state, {
      dryRun,
      timeoutMs: timeoutMs || config.DEFAULT_WORKFLOW_TIMEOUT_MS,
      checkpointId,
      metadata,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.message.includes('timed out') ? 408 : 400;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * POST /chain/stream
 * Execute a workflow with Server-Sent Events streaming.
 *
 * Body: same as /chain/execute
 */
router.post('/chain/stream', validateBody(['graph']), async (req, res) => {
  const {
    graph,
    state = {},
    dryRun = false,
    timeoutMs,
    metadata = {},
  } = req.body;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  // Heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, config.SSE_HEARTBEAT_MS);

  try {
    sendEvent('start', { message: 'Workflow starting' });

    const result = await chain.execute(graph, state, {
      dryRun,
      timeoutMs: timeoutMs || config.DEFAULT_WORKFLOW_TIMEOUT_MS,
      metadata,
      streamCallback: (event) => {
        sendEvent(event.type || 'event', event);
      },
    });

    sendEvent('complete', { success: true, ...result });
  } catch (err) {
    sendEvent('error', { success: false, error: err.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * GET /chain/:id/status
 * Get workflow status and progress.
 */
router.get('/chain/:id/status', (req, res) => {
  const status = chain.getWorkflowStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: `Workflow '${req.params.id}' not found` });
  }
  res.json(status);
});

/**
 * POST /chain/:id/resume
 * Resume a paused (human-in-the-loop) workflow.
 *
 * Body:
 *   input {*} - Human-provided input value
 */
router.post('/chain/:id/resume', (req, res) => {
  const { input } = req.body;
  if (input === undefined) {
    return res.status(400).json({ error: 'Missing required field: input' });
  }

  try {
    chain.resume(req.params.id, input);
    res.json({ success: true, workflowId: req.params.id, message: 'Workflow resumed' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /chain/validate
 * Validate a workflow graph without executing it.
 *
 * Body:
 *   graph {object} - GraphBuilder JSON to validate
 */
router.post('/chain/validate', validateBody(['graph']), (req, res) => {
  const { graph } = req.body;
  const result = chain.validateGraph(graph);
  const status = result.valid ? 200 : 400;
  res.status(status).json(result);
});

/**
 * GET /chain/workflows
 * List all tracked workflows.
 */
router.get('/chain/workflows', (req, res) => {
  const workflows = chain.listWorkflows();
  res.json({ count: workflows.length, workflows });
});

// ─── Tools ────────────────────────────────────────────────────────────────────

/**
 * GET /tools
 * List all registered tools with schemas.
 */
router.get('/tools', (req, res) => {
  const tools = toolRegistry.list();
  res.json({
    count: tools.length,
    tools,
  });
});

/**
 * GET /tools/for-llm
 * List tools in OpenAI function-calling format.
 */
router.get('/tools/for-llm', (req, res) => {
  res.json(toolRegistry.listForLLM());
});

/**
 * POST /tools/register
 * Register a new tool at runtime.
 *
 * Body:
 *   name {string}           - Tool name
 *   description {string}    - Tool description
 *   inputSchema {object}    - JSON Schema for inputs
 *   handlerCode {string}    - JS function body (async (input) => result)
 *   timeoutMs {number}      - Optional timeout
 */
router.post('/tools/register', validateBody(['name', 'description', 'handlerCode']), (req, res) => {
  const { name, description, inputSchema, handlerCode, timeoutMs, tags } = req.body;

  // Security: only allow in non-production or with explicit flag
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DYNAMIC_TOOLS !== 'true') {
    return res.status(403).json({ error: 'Dynamic tool registration disabled in production' });
  }

  try {
    /* eslint-disable no-new-func */
    const handler = new Function('return (async (input) => { ' + handlerCode + ' })')();
    /* eslint-enable no-new-func */

    toolRegistry.register(name, {
      description,
      inputSchema: inputSchema || { type: 'object', properties: {} },
      handler,
      timeoutMs,
      tags: tags || [],
    });

    res.json({ success: true, name, message: `Tool '${name}' registered` });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /tools/:name/execute
 * Execute a tool directly (for testing/debugging).
 */
router.post('/tools/:name/execute', async (req, res) => {
  const { name } = req.params;
  const input = req.body;

  const tool = toolRegistry.getTool(name);
  if (!tool) {
    return res.status(404).json({ error: `Tool '${name}' not found` });
  }

  try {
    const result = await toolRegistry.execute(name, input);
    res.json({ success: true, tool: name, input, result });
  } catch (err) {
    res.status(400).json({ success: false, tool: name, error: err.message });
  }
});

/**
 * GET /tools/stats
 * Tool execution statistics.
 */
router.get('/tools/stats', (req, res) => {
  res.json(toolRegistry.getStats());
});

// ─── Agents ───────────────────────────────────────────────────────────────────

/**
 * POST /agents/react
 * Execute a ReAct (Reasoning + Acting) agent.
 *
 * Body:
 *   input {string}          - User input/question
 *   maxIterations {number}  - Override max iterations
 *   model {string}          - LLM model override
 *   systemPrompt {string}   - Optional system prompt override
 *   context {object}        - Additional context for interpolation
 */
router.post('/agents/react', validateBody(['input']), async (req, res) => {
  const { input, maxIterations, model, systemPrompt, context = {} } = req.body;

  try {
    const agent = AgentFactory.react({
      toolRegistry,
      maxIterations: maxIterations || config.REACT_MAX_ITERATIONS,
      model: model || config.HEADY_INFER_DEFAULT_MODEL,
      systemPrompt,
    });

    const result = await agent.run(input, context);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /agents/plan-execute
 * Execute a Plan & Execute agent.
 *
 * Body:
 *   objective {string}  - Task objective
 *   model {string}      - LLM model override
 *   context {object}    - Background context
 */
router.post('/agents/plan-execute', validateBody(['objective']), async (req, res) => {
  const { objective, model, context = {} } = req.body;

  try {
    const agent = AgentFactory.planAndExecute({
      toolRegistry,
      model: model || config.HEADY_INFER_DEFAULT_MODEL,
    });

    const result = await agent.run(objective, context);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /agents/tool-calling
 * Execute a ToolCallingAgent (native function calling).
 *
 * Body:
 *   input {string}      - User input
 *   model {string}      - LLM model
 *   systemPrompt {string}
 */
router.post('/agents/tool-calling', validateBody(['input']), async (req, res) => {
  const { input, model, systemPrompt } = req.body;

  try {
    const agent = AgentFactory.toolCalling({
      toolRegistry,
      model: model || config.HEADY_INFER_DEFAULT_MODEL,
      systemPrompt,
    });

    const result = await agent.run(input);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /agents/critic
 * Critique a piece of content.
 *
 * Body:
 *   content {string}    - Content to critique
 *   task {string}       - Original task description
 *   criteria {Array}    - Evaluation criteria
 *   model {string}
 */
router.post('/agents/critic', validateBody(['content']), async (req, res) => {
  const { content, task = '', criteria, model } = req.body;

  try {
    const agent = AgentFactory.critic({
      model: model || config.HEADY_INFER_DEFAULT_MODEL,
      criteria: criteria || ['accuracy', 'completeness', 'clarity'],
    });

    const result = await agent.critique(content, task);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

/**
 * GET /metrics
 * Service execution metrics.
 */
router.get('/metrics', (req, res) => {
  const metrics = chain.getMetrics();
  res.json({
    service: config.SERVICE_NAME,
    version: config.SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    phi: config.PHI,
    ...metrics,
  });
});

// ─── Graph Utilities ──────────────────────────────────────────────────────────

/**
 * POST /graph/mermaid
 * Generate Mermaid diagram for a graph.
 *
 * Body:
 *   graph {object} - GraphBuilder JSON
 */
router.post('/graph/mermaid', validateBody(['graph']), (req, res) => {
  try {
    const builder = GraphBuilder.fromJSON(req.body.graph);
    const mermaid = builder.toMermaid();
    res.json({ success: true, mermaid });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /graph/validate
 * Alias for /chain/validate.
 */
router.post('/graph/validate', validateBody(['graph']), (req, res) => {
  const result = chain.validateGraph(req.body.graph);
  res.status(result.valid ? 200 : 400).json(result);
});

module.exports = router;
