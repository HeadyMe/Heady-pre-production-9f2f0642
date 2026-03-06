/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady™ MCP Server Template ═══
 *
 * JSON-RPC 2.0 + SSE transport for Model Context Protocol.
 * Used to expose internal Heady tools as MCP endpoints that
 * any LLM client (Claude, GPT, Gemini) can discover and call.
 *
 * Deploy to Cloud Run or Cloudflare Workers.
 */

'use strict';

require('dotenv').config();
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { Hono } = require('hono');
const { serve } = require('@hono/node-server');

const PORT = parseInt(process.env.PORT || '8080', 10);

// ── MCP Server Setup ────────────────────────────────────────────
const mcp = new McpServer({
    name: 'heady-mcp-template',
    version: '1.0.0',
    description: 'Heady™ MCP Server — Template for tool exposure',
});

// ── Register Tools ──────────────────────────────────────────────

// Example: Health check tool
mcp.tool(
    'health_check',
    'Check the health of this MCP server',
    {},
    async () => ({
        content: [{
            type: 'text',
            text: JSON.stringify({
                status: 'operational',
                server: 'heady-mcp-template',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            }, null, 2),
        }],
    })
);

// Example: Vector query tool
mcp.tool(
    'query_vector_space',
    'Search the Heady 3D vector space for relevant AST nodes',
    {
        query: { type: 'string', description: 'Natural language search query' },
        limit: { type: 'number', description: 'Max results (default 10)' },
    },
    async ({ query, limit = 10 }) => ({
        content: [{
            type: 'text',
            text: JSON.stringify({
                query,
                limit,
                results: [],
                note: 'Wire this to pgvector cosine similarity query',
            }, null, 2),
        }],
    })
);

// ── Register Resources ──────────────────────────────────────────

mcp.resource(
    'server://config',
    'server://config',
    'Server configuration and capabilities',
    'application/json',
    async () => ({
        contents: [{
            uri: 'server://config',
            mimeType: 'application/json',
            text: JSON.stringify({
                name: 'heady-mcp-template',
                tools: ['health_check', 'query_vector_space'],
                transport: ['sse', 'stdio'],
            }, null, 2),
        }],
    })
);

// ── HTTP + SSE Transport ────────────────────────────────────────
const app = new Hono();
const activeSessions = new Map();

// Health endpoint
app.get('/health', (c) => c.json({ status: 'ok', server: 'heady-mcp-template' }));

// SSE endpoint — clients connect here
app.get('/sse', async (c) => {
    const sessionId = crypto.randomUUID();
    const transport = new SSEServerTransport(`/messages/${sessionId}`, c.res);
    activeSessions.set(sessionId, transport);

    transport.onClose = () => {
        activeSessions.delete(sessionId);
        console.log(`[MCP] Session ${sessionId} closed`);
    };

    console.log(`[MCP] New SSE session: ${sessionId}`);
    await mcp.connect(transport);
});

// Message endpoint — clients POST JSON-RPC here
app.post('/messages/:sessionId', async (c) => {
    const sessionId = c.req.param('sessionId');
    const transport = activeSessions.get(sessionId);
    if (!transport) return c.json({ error: 'Session not found' }, 404);

    const body = await c.req.text();
    await transport.handlePostMessage(body);
    return c.text('ok');
});

// ── Start Server ────────────────────────────────────────────────
serve({ fetch: app.fetch, port: PORT }, () => {
    console.log(`[MCP] Heady™ MCP Server projected on :${PORT}`);
    console.log(`[MCP] SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`[MCP] Health: http://localhost:${PORT}/health`);
});
