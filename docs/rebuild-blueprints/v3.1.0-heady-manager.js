/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview Heady™ AI Platform — Main Entry Point (heady-manager.js)
 *
 * Responsibilities:
 *  - Load configuration from src/config/
 *  - Initialise all subsystems in dependency order
 *  - Register all HTTP routes
 *  - Start the HTTP server on port 3301 (or HEADY_PORT)
 *  - Support --mcp flag for MCP stdio transport mode
 *  - Register LIFO graceful shutdown handlers
 *  - Emit structured JSON logs for all lifecycle events
 *
 * @module heady-manager
 */

// ── Core modules (no external deps) ────────────────────────────────────────
const http = require('http');
const { randomUUID } = require('crypto');

// ── Internal modules ────────────────────────────────────────────────────────
const config = require('./src/config');
const { createLogger, newCorrelationId } = require('./src/utils/logger');
const {
  registerShutdownHandler,
  attachProcessHandlers,
  isShuttingDown,
} = require('./src/lifecycle/graceful-shutdown');
const { corsMiddleware, applyCors } = require('./src/middleware/cors');
const { rateLimiter, apiLimiter, pipelineLimiter, battleLimiter, healthLimiter } = require('./src/middleware/rate-limiter');
const {
  handleLiveness,
  handleReadiness,
  handleStartup,
  registerSubsystem,
  markStartupComplete,
} = require('./src/routes/health-routes');

const logger = createLogger('heady-manager');

// ── Flags ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const IS_MCP_MODE = args.includes('--mcp');
const IS_PIPELINE_MODE = args.includes('--pipeline');

// ── Subsystem stubs (replaced by real implementations in subsequent phases) ──
// Each subsystem exposes: init(), getStatus(), shutdown()
// Until the full implementation is loaded, stubs provide safe no-ops.

/** @type {Object|null} */
let conductor = null;
/** @type {Object|null} */
let vectorMemory = null;
/** @type {Object|null} */
let monteCarloEngine = null;
/** @type {Object|null} */
let selfAwareness = null;
/** @type {Object|null} */
let beeFactory = null;
/** @type {Object|null} */
let hcFullPipeline = null;
/** @type {Object|null} */
let mcpServer = null;

// ---------------------------------------------------------------------------
// Stub loader — tries to require a module; returns a safe stub if not found
// ---------------------------------------------------------------------------

/**
 * Attempts to load a subsystem module. Returns a safe stub if unavailable.
 * @param {string} modulePath
 * @param {string} name
 * @returns {Object}
 */
function loadSubsystem(modulePath, name) {
  try {
    const mod = require(modulePath);
    logger.debug(`Subsystem loaded: ${name}`, { path: modulePath });
    return mod;
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn(`Subsystem not yet implemented — using stub: ${name}`);
    } else {
      logger.error(`Failed to load subsystem: ${name}`, { err });
    }
    // Return a safe stub
    return {
      name,
      _stub: true,
      async init() { logger.warn(`[STUB] ${name}.init() called`); },
      async shutdown() {},
      getStatus() { return { status: 'stub', name }; },
    };
  }
}

// ---------------------------------------------------------------------------
// Subsystem initialisation
// ---------------------------------------------------------------------------

/**
 * Loads and initialises all platform subsystems.
 * @returns {Promise<void>}
 */
async function initSubsystems() {
  logger.logSystem('subsystems:init:begin');

  conductor = loadSubsystem('./src/conductor/heady-conductor', 'HeadyConductor');
  vectorMemory = loadSubsystem('./src/memory/vector-memory', 'VectorMemory');
  monteCarloEngine = loadSubsystem('./src/engines/monte-carlo', 'MonteCarloEngine');
  selfAwareness = loadSubsystem('./src/awareness/self-awareness', 'SelfAwareness');
  beeFactory = loadSubsystem('./src/agents/bee-factory', 'BeeFactory');
  hcFullPipeline = loadSubsystem('./src/pipeline/hc-full-pipeline', 'HCFullPipeline');

  // Register subsystem health checks
  registerSubsystem('conductor', async () => {
    if (conductor && !conductor._stub) return { status: 'pass' };
    return { status: 'warn', details: { reason: 'stub' } };
  });
  registerSubsystem('vectorMemory', async () => {
    if (vectorMemory && !vectorMemory._stub) return { status: 'pass' };
    return { status: 'warn', details: { reason: 'stub' } };
  });
  registerSubsystem('monteCarlo', async () => {
    if (monteCarloEngine && !monteCarloEngine._stub) return { status: 'pass' };
    return { status: 'warn', details: { reason: 'stub' } };
  });
  registerSubsystem('beeFactory', async () => {
    if (beeFactory && !beeFactory._stub) return { status: 'pass' };
    return { status: 'warn', details: { reason: 'stub' } };
  });

  // Initialise each subsystem sequentially (dependency order)
  const initOrder = [
    { name: 'VectorMemory', mod: vectorMemory },
    { name: 'MonteCarloEngine', mod: monteCarloEngine },
    { name: 'SelfAwareness', mod: selfAwareness },
    { name: 'BeeFactory', mod: beeFactory },
    { name: 'HeadyConductor', mod: conductor },
    { name: 'HCFullPipeline', mod: hcFullPipeline },
  ];

  for (const { name, mod } of initOrder) {
    if (mod && typeof mod.init === 'function') {
      const t0 = Date.now();
      try {
        await mod.init(config);
        logger.info(`Subsystem initialised: ${name}`, { durationMs: Date.now() - t0 });
      } catch (err) {
        logger.error(`Subsystem init failed: ${name}`, { err });
        // Non-fatal — continue with other subsystems
      }
    }
  }

  logger.logSystem('subsystems:init:complete');
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

/**
 * Initialises the MCP server using stdio transport.
 * @returns {Promise<void>}
 */
async function initMCPServer() {
  try {
    const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

    mcpServer = new Server(
      { name: config.mcp.serverName, version: config.mcp.serverVersion },
      { capabilities: config.mcp.capabilities }
    );

    // Register MCP tools (loaded from tool registry in subsequent phases)
    mcpServer.setRequestHandler({ method: 'tools/list' }, async () => ({
      tools: [
        {
          name: 'heady_pulse',
          description: 'Returns the current pulse/heartbeat of the Heady AI Platform',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'heady_status',
          description: 'Returns full platform status including all subsystems',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'heady_conductor_route',
          description: 'Routes a prompt to the optimal AI provider via HeadyConductor',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'The prompt to route and execute' },
              provider: { type: 'string', description: 'Optional: force a specific provider' },
              model: { type: 'string', description: 'Optional: force a specific model' },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'heady_memory_search',
          description: 'Searches the vector memory store for relevant context',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              topK: { type: 'number', description: 'Number of results (default 10)' },
            },
            required: ['query'],
          },
        },
      ],
    }));

    mcpServer.setRequestHandler({ method: 'tools/call' }, async (request) => {
      const { name, arguments: toolArgs } = request.params;
      logger.logAudit('mcp.tool.call', { tool: name, args: toolArgs });

      switch (name) {
        case 'heady_pulse':
          return { content: [{ type: 'text', text: JSON.stringify(getPulse()) }] };
        case 'heady_status':
          return { content: [{ type: 'text', text: JSON.stringify(await getStatus()) }] };
        default:
          return { content: [{ type: 'text', text: JSON.stringify({ error: `Tool "${name}" not yet implemented` }) }], isError: true };
      }
    });

    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    logger.logSystem('mcp:server:started', { transport: 'stdio' });

  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      logger.warn('MCP SDK not installed — MCP server unavailable', { install: 'npm install @modelcontextprotocol/sdk' });
    } else {
      logger.error('Failed to start MCP server', { err });
    }
  }
}

// ---------------------------------------------------------------------------
// Platform status helpers
// ---------------------------------------------------------------------------

/**
 * Returns a lightweight pulse object.
 * @returns {Object}
 */
function getPulse() {
  return {
    status: 'alive',
    timestamp: new Date().toISOString(),
    platform: config.server.platform,
    version: config.server.version,
    environment: config.server.environment,
    node: config.server.name,
    uptime: Math.round(process.uptime()),
    pid: process.pid,
    sacredGeometry: {
      phi: config.sacredGeometry.PHI,
      fibonacci: config.sacredGeometry.FIBONACCI,
    },
  };
}

/**
 * Returns full platform status.
 * @returns {Promise<Object>}
 */
async function getStatus() {
  const subsystems = {};

  for (const [name, mod] of [
    ['conductor', conductor],
    ['vectorMemory', vectorMemory],
    ['monteCarlo', monteCarloEngine],
    ['selfAwareness', selfAwareness],
    ['beeFactory', beeFactory],
    ['pipeline', hcFullPipeline],
    ['mcp', mcpServer],
  ]) {
    if (!mod) {
      subsystems[name] = { status: 'not_loaded' };
    } else if (mod._stub) {
      subsystems[name] = { status: 'stub' };
    } else if (typeof mod.getStatus === 'function') {
      try {
        subsystems[name] = await mod.getStatus();
      } catch (err) {
        subsystems[name] = { status: 'error', error: err.message };
      }
    } else {
      subsystems[name] = { status: 'loaded' };
    }
  }

  const mem = process.memoryUsage();
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    platform: config.server.platform,
    version: config.server.version,
    environment: config.server.environment,
    node: config.server.name,
    uptime: Math.round(process.uptime()),
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    subsystems,
    resourcePools: config.resourcePools,
    domains: config.domains.HEADY_DOMAINS.map((d) => ({
      name: d.name,
      domain: d.domain,
      role: d.role,
    })),
  };
}

// ---------------------------------------------------------------------------
// Request router
// ---------------------------------------------------------------------------

/** @type {Map<string, { method: string, handler: Function, rateLimit?: Function }>} */
const _routes = new Map();

/**
 * Registers a route.
 * @param {string} method
 * @param {string} path
 * @param {Function} handler
 * @param {Function} [rateLimitMw]
 */
function addRoute(method, path, handler, rateLimitMw) {
  _routes.set(`${method}:${path}`, { method, handler, rateLimit: rateLimitMw });
}

/**
 * Dispatches an incoming request to the appropriate handler.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
async function dispatch(req, res) {
  const method = req.method.toUpperCase();
  const urlPath = (req.url || '/').split('?')[0];

  // Assign correlation ID
  const cid = req.headers['x-heady-correlation-id'] || newCorrelationId();
  req.correlationId = cid;
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', cid);
  res.setHeader('X-Heady-Node', config.server.name);

  // CORS
  const corsAction = applyCors(req, res);
  if (corsAction === 'deny' || corsAction === 'preflight') return;

  // Parse query
  const qIdx = (req.url || '/').indexOf('?');
  req.query = qIdx !== -1 ? Object.fromEntries(new URLSearchParams(req.url.slice(qIdx + 1))) : {};
  req.path = urlPath;

  // Parse body for mutating requests
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    req.body = await _parseBody(req);
  }

  // Route lookup — exact match
  const routeKey = `${method}:${urlPath}`;
  let route = _routes.get(routeKey);

  // Fallback: any-method
  if (!route) route = _routes.get(`ANY:${urlPath}`);

  if (!route) {
    logger.logRoute({ method, path: urlPath, status: 404, cid, ip: _getIp(req) });
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', path: urlPath }));
    return;
  }

  // Apply route-level rate limiter if configured
  if (route.rateLimit) {
    let rlBlocked = false;
    await new Promise((resolve) => {
      route.rateLimit(req, res, () => resolve());
      // If rate limiter ended the response, we'll detect it below
      if (res.writableEnded) { rlBlocked = true; resolve(); }
    });
    if (rlBlocked || res.writableEnded) return;
  }

  // Execute handler
  try {
    await route.handler(req, res);
    const status = res.statusCode || 200;
    logger.logRoute({ method, path: urlPath, status, cid, durationMs: Date.now() - req.startTime, ip: _getIp(req) });
  } catch (err) {
    logger.error('Route handler error', { err, method, path: urlPath, cid });
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal Server Error',
        correlationId: cid,
        ...(config.server.environment !== 'production' && { detail: err.message }),
      }));
    }
    logger.logRoute({ method, path: urlPath, status: 500, cid, durationMs: Date.now() - req.startTime });
  }
}

/**
 * Parses the request body as JSON.
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<*>}
 */
function _parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    const MAX = config.server.bodyLimit || 10 * 1024 * 1024;

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX) { req.destroy(); resolve(null); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve(null);
      const raw = Buffer.concat(chunks).toString('utf8');
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve(null); }
      } else {
        resolve(raw);
      }
    });
    req.on('error', () => resolve(null));
  });
}

/**
 * Extracts client IP from request.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function _getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return fwd ? fwd.split(',')[0].trim() : (req.socket?.remoteAddress || 'unknown');
}

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

function registerRoutes() {
  // ── Health ─────────────────────────────────────────────────────────────
  addRoute('GET', '/health/live', handleLiveness, healthLimiter());
  addRoute('GET', '/health/ready', handleReadiness, healthLimiter());
  addRoute('GET', '/health/startup', handleStartup, healthLimiter());

  // ── API: Pulse ─────────────────────────────────────────────────────────
  addRoute('GET', '/api/pulse', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getPulse()));
  }, apiLimiter());

  // ── API: Status ────────────────────────────────────────────────────────
  addRoute('GET', '/api/status', async (req, res) => {
    const status = await getStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  }, apiLimiter());

  // ── API: Nodes ─────────────────────────────────────────────────────────
  addRoute('GET', '/api/nodes', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      nodes: [
        {
          name: config.server.name,
          host: config.server.host,
          port: config.server.port,
          version: config.server.version,
          environment: config.server.environment,
          uptime: Math.round(process.uptime()),
          status: isShuttingDown() ? 'shutting_down' : 'active',
        },
      ],
      count: 1,
    }));
  }, apiLimiter());

  // ── API: Tools (MCP tool registry) ────────────────────────────────────
  addRoute('GET', '/api/tools', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tools: [
        { name: 'heady_pulse', description: 'Platform pulse/heartbeat', category: 'system' },
        { name: 'heady_status', description: 'Full platform status', category: 'system' },
        { name: 'heady_conductor_route', description: 'Route prompt to AI provider', category: 'ai' },
        { name: 'heady_memory_search', description: 'Search vector memory', category: 'memory' },
        { name: 'heady_pipeline_run', description: 'Execute a full pipeline', category: 'pipeline' },
        { name: 'heady_battle', description: 'Run agent battle simulation', category: 'simulation' },
        { name: 'heady_monte_carlo', description: 'Run Monte Carlo simulation', category: 'simulation' },
      ],
      count: 7,
      mcp: { enabled: true, version: '1.0', transport: config.mcp.transport },
    }));
  }, apiLimiter());

  // ── API: Memory ────────────────────────────────────────────────────────
  addRoute('GET', '/api/memory', async (req, res) => {
    if (vectorMemory && typeof vectorMemory.getStats === 'function') {
      const stats = await vectorMemory.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ...stats }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'stub', message: 'VectorMemory not yet implemented' }));
    }
  }, apiLimiter());

  addRoute('POST', '/api/memory', async (req, res) => {
    // Memory upsert endpoint — body: { text, metadata }
    if (!req.body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body required' }));
      return;
    }
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'accepted', correlationId: req.correlationId }));
  }, apiLimiter());

  // ── API: Embed ─────────────────────────────────────────────────────────
  addRoute('POST', '/api/embed', async (req, res) => {
    if (!req.body || !req.body.text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'body.text is required' }));
      return;
    }
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'accepted',
      correlationId: req.correlationId,
      model: config.vectorMemory.embeddingModel,
    }));
  }, apiLimiter());

  // ── API: Soul (platform identity/consciousness) ─────────────────────────
  addRoute('GET', '/api/soul', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      identity: {
        name: config.server.platform,
        company: config.server.company,
        version: config.server.version,
        node: config.server.name,
      },
      sacredGeometry: {
        phi: config.sacredGeometry.PHI,
        fibonacci: config.sacredGeometry.FIBONACCI,
        goldenAngleDeg: config.sacredGeometry.GOLDEN_ANGLE_DEG,
      },
      resourcePools: config.resourcePools,
      domains: config.domains.HEADY_DOMAINS.map((d) => d.domain),
      manifesto: 'Built with intention. Woven with sacred geometry. Harmonised with intelligence.',
    }));
  }, apiLimiter());

  // ── API: Vinci (creative AI assistant endpoint) ────────────────────────
  addRoute('POST', '/api/vinci', async (req, res) => {
    if (!req.body || !req.body.prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'body.prompt is required' }));
      return;
    }
    // Vinci module will be implemented in the AI phase
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'accepted',
      correlationId: req.correlationId,
      message: 'Vinci creative pipeline queued',
    }));
  }, apiLimiter());

  // ── API: Conductor route ────────────────────────────────────────────────
  addRoute('POST', '/api/conductor/route', async (req, res) => {
    if (!req.body || !req.body.prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'body.prompt is required' }));
      return;
    }
    if (conductor && !conductor._stub && typeof conductor.route === 'function') {
      try {
        const result = await conductor.route(req.body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        logger.error('Conductor route error', { err, cid: req.correlationId });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conductor routing failed', detail: err.message }));
      }
    } else {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'stub',
        correlationId: req.correlationId,
        message: 'HeadyConductor not yet implemented. Prompt received.',
        prompt: req.body.prompt.slice(0, 100),
      }));
    }
  }, pipelineLimiter());

  // ── API: Pipeline run ──────────────────────────────────────────────────
  addRoute('POST', '/api/pipeline/run', async (req, res) => {
    if (!req.body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body required' }));
      return;
    }
    if (hcFullPipeline && !hcFullPipeline._stub && typeof hcFullPipeline.run === 'function') {
      try {
        const result = await hcFullPipeline.run(req.body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        logger.error('Pipeline run error', { err, cid: req.correlationId });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Pipeline execution failed', detail: err.message }));
      }
    } else {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'stub',
        correlationId: req.correlationId,
        pipelineId: randomUUID(),
        message: 'HCFullPipeline not yet implemented. Job queued.',
      }));
    }
  }, pipelineLimiter());

  // ── API: Battle ────────────────────────────────────────────────────────
  addRoute('POST', '/api/battle', async (req, res) => {
    if (!req.body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body required' }));
      return;
    }
    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'accepted',
      battleId: randomUUID(),
      correlationId: req.correlationId,
      message: 'Battle simulation queued',
    }));
  }, battleLimiter());

  // ── API: Monte Carlo ───────────────────────────────────────────────────
  addRoute('POST', '/api/monte-carlo', async (req, res) => {
    if (!req.body) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request body required' }));
      return;
    }
    if (monteCarloEngine && !monteCarloEngine._stub && typeof monteCarloEngine.run === 'function') {
      try {
        const result = await monteCarloEngine.run(req.body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Monte Carlo simulation failed', detail: err.message }));
      }
    } else {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'stub',
        simulationId: randomUUID(),
        correlationId: req.correlationId,
        config: {
          iterations: config.monteCarlo.iterations,
          confidence: config.monteCarlo.confidenceLevel,
        },
        message: 'Monte Carlo engine not yet implemented. Simulation queued.',
      }));
    }
  }, pipelineLimiter());

  logger.debug('All routes registered', { count: _routes.size });
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

/** @type {http.Server|null} */
let _server = null;

/**
 * Starts the HTTP server.
 * @returns {Promise<void>}
 */
async function startServer() {
  const { port, host } = config.server;

  return new Promise((resolve, reject) => {
    _server = http.createServer((req, res) => {
      dispatch(req, res).catch((err) => {
        logger.fatal('Unhandled request dispatch error', { err });
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    });

    _server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });

    _server.listen(port, host, () => {
      const addr = _server.address();
      logger.logSystem('server:listening', {
        port: addr.port,
        host: addr.address,
        platform: config.server.platform,
        version: config.server.version,
        environment: config.server.environment,
      });
      resolve();
    });
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

function registerShutdownHandlers() {
  // Shutdown order (LIFO — last registered runs first)
  registerShutdownHandler('logger', async () => {
    logger.logSystem('shutdown:logger:flush');
  });

  registerShutdownHandler('http-server', async () => {
    if (!_server) return;
    await new Promise((resolve) => {
      _server.close(resolve);
      // Force-close after 10s if connections are still open
      setTimeout(resolve, 10000);
    });
    logger.info('HTTP server closed');
  });

  registerShutdownHandler('pipeline', async () => {
    if (hcFullPipeline && !hcFullPipeline._stub && typeof hcFullPipeline.shutdown === 'function') {
      await hcFullPipeline.shutdown();
    }
  });

  registerShutdownHandler('bee-factory', async () => {
    if (beeFactory && !beeFactory._stub && typeof beeFactory.shutdown === 'function') {
      await beeFactory.shutdown();
    }
  });

  registerShutdownHandler('conductor', async () => {
    if (conductor && !conductor._stub && typeof conductor.shutdown === 'function') {
      await conductor.shutdown();
    }
  });

  registerShutdownHandler('vector-memory', async () => {
    if (vectorMemory && !vectorMemory._stub && typeof vectorMemory.shutdown === 'function') {
      await vectorMemory.shutdown();
    }
  });

  registerShutdownHandler('mcp-server', async () => {
    if (mcpServer && typeof mcpServer.close === 'function') {
      await mcpServer.close();
    }
  });
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------

/**
 * Main platform bootstrap sequence.
 * @returns {Promise<void>}
 */
async function main() {
  const startTime = Date.now();

  logger.logSystem('platform:start', {
    platform: config.server.platform,
    version: config.server.version,
    environment: config.server.environment,
    node: config.server.name,
    pid: process.pid,
    nodeVersion: process.version,
    mcpMode: IS_MCP_MODE,
    pipelineMode: IS_PIPELINE_MODE,
  });

  // Attach OS signal handlers before anything else
  attachProcessHandlers();

  // Register shutdown handlers
  registerShutdownHandlers();

  if (IS_MCP_MODE) {
    // MCP stdio mode — no HTTP server
    logger.logSystem('mode:mcp-stdio');
    await initSubsystems();
    await initMCPServer();
    logger.logSystem('platform:mcp:ready', { startupMs: Date.now() - startTime });
    return;
  }

  if (IS_PIPELINE_MODE) {
    // Pipeline-only mode — run pipeline and exit
    logger.logSystem('mode:pipeline');
    await initSubsystems();
    if (hcFullPipeline && !hcFullPipeline._stub && typeof hcFullPipeline.runCLI === 'function') {
      await hcFullPipeline.runCLI(args.filter((a) => a !== '--pipeline'));
    } else {
      logger.warn('Pipeline mode requested but HCFullPipeline not implemented');
    }
    process.exit(0);
    return;
  }

  // Standard HTTP mode
  await initSubsystems();
  registerRoutes();
  await startServer();
  markStartupComplete();

  const startupMs = Date.now() - startTime;
  logger.logSystem('platform:ready', {
    startupMs,
    port: config.server.port,
    routes: _routes.size,
    platform: config.server.platform,
    sacredGeometry: {
      phi: config.sacredGeometry.PHI,
      fibonacci: config.sacredGeometry.FIBONACCI,
    },
  });

  // Log all registered routes at debug level
  for (const [key] of _routes) {
    logger.debug(`Route: ${key}`);
  }
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

main().catch((err) => {
  logger.fatal('Fatal error during platform bootstrap', { err });
  process.exit(1);
});
