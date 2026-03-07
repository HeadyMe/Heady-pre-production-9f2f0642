'use strict';

/**
 * @file custom-mcp-tool.js
 * @description How to create and register a custom MCP (Model Context Protocol) tool
 * with HeadyOS. Custom tools extend what HeadyOS agents can do.
 *
 * This example creates three custom tools:
 * 1. `company_lookup` — Look up internal company data
 * 2. `send_alert` — Send an alert to a Slack channel
 * 3. `run_sql_query` — Execute read-only SQL queries against a database
 *
 * MCP Tool Contract:
 * - name: Unique identifier (kebab-case)
 * - description: What the tool does (used by AI to decide when to call it)
 * - inputSchema: JSON Schema for arguments
 * - execute(args): Async function returning the result
 *
 * @see https://docs.headyme.com/sdk/custom-mcp-tools
 */

const { z } = require('zod');
const express = require('express');

const PHI = 1.618033988749895;
const fib = (n) => {
  const seq = [0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  return seq[n] ?? Math.round(seq[16] * PHI ** (n - 16));
};

// HeadyOS client (stub)
const heady = {
  mcp: {
    registerTool: async (tool) => ({ toolId: `tool-${tool.name}`, status: 'registered' }),
    listTools: async () => [],
    executeTool: async (name, args) => ({ result: `Mock result for ${name}` }),
  },
};

// ---------------------------------------------------------------------------
// Custom MCP Tool Definition Interface
// ---------------------------------------------------------------------------

/**
 * Base class for creating custom MCP tools.
 * Extend this to create your own tools.
 */
class HeadyMCPTool {
  constructor({ name, description, inputSchema, version = '1.0.0' }) {
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.version = version;
    this.serverName = process.env.MCP_SERVER_NAME || 'custom-tools-server';
  }

  /**
   * Execute the tool. Override this in subclasses.
   * @param {Object} args - Validated arguments matching inputSchema
   * @returns {Promise<Object>} Tool result
   */
  async execute(args) {
    throw new Error(`Tool ${this.name}: execute() not implemented`);
  }

  /**
   * Convert to HeadyOS MCP registration format.
   */
  toRegistrationPayload() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      serverName: this.serverName,
      version: this.version,
      requiresAuth: true,
      endpoint: `${process.env.MCP_SERVER_URL || 'http://localhost:3003'}/mcp/execute/${this.name}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool 1: Company Lookup
// ---------------------------------------------------------------------------

const CompanyLookupSchema = z.object({
  companyName: z.string().min(1).max(fib(9)), // max 34 chars
  fields: z.array(z.enum(['revenue', 'employees', 'funding', 'industry', 'founded', 'website', 'description'])).optional(),
});

class CompanyLookupTool extends HeadyMCPTool {
  constructor() {
    super({
      name: 'company_lookup',
      description: 'Look up detailed information about a company. Returns revenue, employee count, funding history, industry classification, and more.',
      inputSchema: {
        type: 'object',
        required: ['companyName'],
        properties: {
          companyName: { type: 'string', description: 'Name of the company to look up' },
          fields: {
            type: 'array',
            items: { type: 'string', enum: ['revenue', 'employees', 'funding', 'industry', 'founded', 'website', 'description'] },
            description: 'Specific fields to return (default: all)',
          },
        },
      },
    });
  }

  async execute(args) {
    const parsed = CompanyLookupSchema.parse(args);

    // In production: query your internal CRM, Clearbit, Crunchbase, etc.
    // This is a demonstration with mock data
    const mockData = {
      companyName: parsed.companyName,
      revenue: '$2.4B ARR',
      employees: '8,400',
      funding: 'Series D - $500M (2024)',
      industry: 'Enterprise Software / AI',
      founded: '2019',
      website: 'https://example.com',
      description: `${parsed.companyName} is a leading enterprise software company.`,
      source: 'internal_crm',
      confidence: 1 / PHI, // ≈ 0.618
    };

    const fields = parsed.fields;
    if (fields && fields.length > 0) {
      const filtered = { companyName: mockData.companyName };
      for (const field of fields) {
        if (field in mockData) filtered[field] = mockData[field];
      }
      return filtered;
    }

    return mockData;
  }
}

// ---------------------------------------------------------------------------
// Tool 2: Send Alert
// ---------------------------------------------------------------------------

const SendAlertSchema = z.object({
  channel: z.string().startsWith('#'),
  message: z.string().min(1).max(fib(12)), // max 144 chars
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  mentionOnCall: z.boolean().default(false),
});

class SendAlertTool extends HeadyMCPTool {
  constructor() {
    super({
      name: 'send_alert',
      description: 'Send a structured alert message to a Slack channel. Use for notifying teams about important events, threshold breaches, or required actions.',
      inputSchema: {
        type: 'object',
        required: ['channel', 'message'],
        properties: {
          channel: { type: 'string', description: 'Slack channel (e.g., #alerts, #ops-critical)' },
          message: { type: 'string', description: 'Alert message to send', maxLength: 144 },
          severity: { type: 'string', enum: ['info', 'warning', 'critical'], default: 'info' },
          mentionOnCall: { type: 'boolean', description: 'Whether to @mention the on-call team', default: false },
        },
      },
    });
  }

  async execute(args) {
    const parsed = SendAlertSchema.parse(args);

    const severityEmoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
    const formattedMessage = `${severityEmoji[parsed.severity]} [${parsed.severity.toUpperCase()}] ${parsed.message}`;

    // In production: POST to Slack webhook or use @slack/web-api
    console.log(`[SendAlert] Sending to ${parsed.channel}: ${formattedMessage}`);

    // Simulate Slack API call
    const result = {
      success: true,
      channel: parsed.channel,
      severity: parsed.severity,
      message: formattedMessage,
      timestamp: new Date().toISOString(),
      slackTs: `${Math.floor(Date.now() / 1000)}.${Math.random().toString().slice(2, 8)}`,
    };

    return result;
  }
}

// ---------------------------------------------------------------------------
// Tool 3: Run SQL Query
// ---------------------------------------------------------------------------

const RunSQLSchema = z.object({
  query: z.string().min(1)
    .refine(q => q.trim().toUpperCase().startsWith('SELECT'), {
      message: 'Only SELECT queries are allowed for security',
    }),
  database: z.enum(['analytics', 'sales', 'operations']).default('analytics'),
  maxRows: z.number().int().positive().max(fib(10)).default(fib(8)), // max 55, default 21
});

class RunSQLQueryTool extends HeadyMCPTool {
  constructor() {
    super({
      name: 'run_sql_query',
      description: 'Execute a read-only SQL SELECT query against internal databases (analytics, sales, or operations). Returns structured results. Maximum results: 55 rows.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'SQL SELECT query to execute. Only SELECT statements are allowed.',
          },
          database: {
            type: 'string',
            enum: ['analytics', 'sales', 'operations'],
            default: 'analytics',
            description: 'Target database to query',
          },
          maxRows: {
            type: 'integer',
            default: 21,
            maximum: 55,
            description: `Maximum rows to return (default: fib(8)=21, max: fib(10)=55)`,
          },
        },
      },
    });
  }

  async execute(args) {
    const parsed = RunSQLSchema.parse(args);

    // Security: additional SQL injection prevention
    const dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE'];
    const upperQuery = parsed.query.toUpperCase();
    if (dangerous.some(kw => upperQuery.includes(kw))) {
      throw new Error('Query contains disallowed SQL keywords. Only SELECT is permitted.');
    }

    console.log(`[RunSQL] Executing on ${parsed.database}: ${parsed.query.substring(0, 50)}...`);

    // In production: execute against actual database with read-only credentials
    // This is a mock result
    const mockResult = {
      database: parsed.database,
      query: parsed.query,
      rowCount: fib(5), // 5 mock rows
      rows: Array.from({ length: fib(5) }, (_, i) => ({
        id: i + 1,
        value: `mock_value_${i + 1}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
      })),
      executionMs: Math.round(1000 / PHI), // ≈ 618ms
      truncated: false,
    };

    return mockResult;
  }
}

// ---------------------------------------------------------------------------
// MCP Tool Registry
// ---------------------------------------------------------------------------

const REGISTERED_TOOLS = new Map();

/**
 * Register a custom MCP tool in the local registry.
 */
const registerTool = (tool) => {
  REGISTERED_TOOLS.set(tool.name, tool);
  console.log(`[MCP] Registered tool: ${tool.name} v${tool.version}`);
};

/**
 * Register all custom tools and sync to HeadyOS.
 */
const initializeTools = async () => {
  // Register tools locally
  const tools = [
    new CompanyLookupTool(),
    new SendAlertTool(),
    new RunSQLQueryTool(),
  ];

  for (const tool of tools) {
    registerTool(tool);
  }

  // Register with HeadyOS MCP server
  for (const tool of tools) {
    try {
      const result = await heady.mcp.registerTool(tool.toRegistrationPayload());
      console.log(`[MCP] Registered with HeadyOS: ${tool.name} → ID: ${result.toolId}`);
    } catch (err) {
      console.error(`[MCP] Failed to register ${tool.name} with HeadyOS:`, err.message);
    }
  }

  return tools;
};

// ---------------------------------------------------------------------------
// MCP Server (Express)
// ---------------------------------------------------------------------------

const app = express();
app.use(express.json());

/**
 * POST /mcp/execute/:toolName
 * Execute a registered MCP tool.
 * HeadyOS calls this endpoint when an agent invokes your tool.
 */
app.post('/mcp/execute/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { arguments: args, context } = req.body;

  const tool = REGISTERED_TOOLS.get(toolName);
  if (!tool) {
    return res.status(404).json({
      isError: true,
      errorMessage: `Tool '${toolName}' not found`,
    });
  }

  console.log(`[MCP] Executing tool: ${toolName}`, args);
  const startMs = Date.now();

  try {
    const result = await tool.execute(args || {});
    res.json({
      toolName,
      result,
      isError: false,
      executionMs: Date.now() - startMs,
      executedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(`[MCP] Tool ${toolName} error:`, err);
    res.json({
      toolName,
      isError: true,
      errorMessage: err.message,
      executionMs: Date.now() - startMs,
      executedAt: new Date().toISOString(),
    });
  }
});

/**
 * GET /mcp/tools
 * List all registered tools (for HeadyOS discovery).
 */
app.get('/mcp/tools', (req, res) => {
  const tools = Array.from(REGISTERED_TOOLS.values()).map(t => t.toRegistrationPayload());
  res.json(tools);
});

/**
 * GET /mcp/tools/:toolName
 * Get a specific tool's definition.
 */
app.get('/mcp/tools/:toolName', (req, res) => {
  const tool = REGISTERED_TOOLS.get(req.params.toolName);
  if (!tool) return res.status(404).json({ error: 'Tool not found' });
  res.json(tool.toRegistrationPayload());
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'heady-custom-mcp-server',
    toolsRegistered: REGISTERED_TOOLS.size,
    tools: Array.from(REGISTERED_TOOLS.keys()),
  });
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

(async () => {
  await initializeTools();
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`[MCP] Custom MCP tool server running on port ${PORT}`);
    console.log(`[MCP] Tools: ${Array.from(REGISTERED_TOOLS.keys()).join(', ')}`);
    console.log(`[MCP] Register URL: ${process.env.MCP_SERVER_URL || `http://localhost:${PORT}`}`);
  });
})();

module.exports = { app, HeadyMCPTool, registerTool, initializeTools, CompanyLookupTool, SendAlertTool, RunSQLQueryTool };
