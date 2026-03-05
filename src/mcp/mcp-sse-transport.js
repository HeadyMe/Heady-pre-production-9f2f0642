/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * HeadyMCP SSE Transport — HTTP/SSE bridge for remote MCP clients
 *
 * Provides:
 *   GET  /mcp/sse       — SSE stream (requires OAuth bearer token)
 *   POST /mcp/message   — JSON-RPC message endpoint
 *
 * Bridges incoming HTTP requests to the MCP SDK's tool/resource/prompt
 * handlers. This allows Claude Desktop (and any MCP client) to connect
 * remotely over HTTPS instead of requiring local stdio transport.
 */

const express = require('express');
const crypto = require('crypto');
const fetch = require('node-fetch');
const logger = require('../utils/logger');

// ── Tool/Resource/Prompt definitions (imported from the MCP server) ──
// We replicate the handler logic here since the stdio server can't be
// reused directly — it's bound to stdin/stdout.

class McpSseTransport {
    constructor(opts = {}) {
        this.oauthProvider = opts.oauthProvider;
        this.baseUrl = opts.baseUrl || process.env.HEADY_MANAGER_URL || 'http://localhost:3301';
        this.apiKey = opts.apiKey || process.env.HEADY_API_KEY || '';
        this.sessions = new Map();  // sessionId → { res, tier, clientId }
        this.router = express.Router();
        this._setupRoutes();
    }

    // ── Auth Middleware ───────────────────────────────────────────────
    _authenticate(req) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.slice(7);

        // Try OAuth token first, then raw API key
        if (this.oauthProvider) {
            const verified = this.oauthProvider.verifyAccessToken(token);
            if (verified) return verified;
        }

        // Fallback: accept raw Heady API key
        if (token === this.apiKey) {
            return { valid: true, tier: 'admin', scope: 'mcp:tools mcp:resources mcp:prompts', apiKey: token };
        }

        return null;
    }

    // ── Internal API call helper ─────────────────────────────────────
    async _headyPost(path, body, apiKey) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey || this.apiKey}`,
                'X-Heady-Source': 'heady-mcp-sse',
            },
            body: JSON.stringify(body),
        });
        return res.json();
    }

    async _headyGet(path, apiKey) {
        const res = await fetch(`${this.baseUrl}${path}`, {
            headers: {
                'Authorization': `Bearer ${apiKey || this.apiKey}`,
                'X-Heady-Source': 'heady-mcp-sse',
            },
        });
        return res.json();
    }

    // ── Tool Registry ────────────────────────────────────────────────
    _getTools() {
        // Return the same 30 tools defined in heady-mcp-server.js
        // Loaded dynamically to stay in sync
        try {
            // Tools are exported from the tool definitions
            return require('./heady-mcp-tools').HEADY_TOOLS;
        } catch {
            // Fallback: return a subset inline
            return [
                { name: 'heady_chat', description: 'Send a chat message to Heady Brain.', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] } },
                { name: 'heady_analyze', description: 'Analyze code or text using Heady Brain.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string' } }, required: ['content'] } },
                { name: 'heady_deep_scan', description: 'Deep scan a project directory.', inputSchema: { type: 'object', properties: { directory: { type: 'string' } }, required: ['directory'] } },
                { name: 'heady_health', description: 'Check Heady service health.', inputSchema: { type: 'object', properties: { service: { type: 'string' } } } },
            ];
        }
    }

    // ── Tool Execution ───────────────────────────────────────────────
    async _executeTool(name, args, apiKey) {
        // Route tool calls to existing Heady REST API endpoints
        const TOOL_ROUTES = {
            heady_chat: { method: 'POST', path: '/api/brain/chat', mapArgs: (a) => ({ message: a.message, system: a.system, model: 'heady-brain', temperature: a.temperature ?? 0.7, max_tokens: a.max_tokens ?? 4096, source: 'heady-mcp-sse' }) },
            heady_deep_scan: { method: 'POST', path: '/api/edge/deep-scan', mapArgs: (a) => ({ directory: a.directory, include_vectors: true }) },
            heady_analyze: { method: 'POST', path: '/api/brain/analyze', mapArgs: (a) => ({ content: a.content, type: a.type || 'general', source: 'heady-mcp-sse' }) },
            heady_complete: { method: 'POST', path: '/api/brain/generate', mapArgs: (a) => ({ prompt: a.prompt, language: a.language, max_tokens: a.max_tokens ?? 2048, source: 'heady-mcp-sse' }) },
            heady_embed: { method: 'POST', path: '/api/brain/embed', mapArgs: (a) => ({ text: a.text, model: a.model || 'nomic-embed-text', source: 'heady-mcp-sse' }) },
            heady_health: { method: 'GET', path: '/api/health', mapArgs: () => ({}) },
            heady_deploy: { method: 'POST', path: '/api/deploy', mapArgs: (a) => ({ ...a, source: 'heady-mcp-sse' }) },
            heady_search: { method: 'POST', path: '/api/brain/search', mapArgs: (a) => ({ query: a.query, scope: a.scope || 'all', limit: a.limit || 10, source: 'heady-mcp-sse' }) },
            heady_refactor: { method: 'POST', path: '/api/brain/analyze', mapArgs: (a) => ({ content: a.code, type: 'code', focus: a.goals ? `Refactor for: ${a.goals.join(', ')}` : 'refactoring', task: 'refactor', source: 'heady-mcp-sse' }) },
            heady_memory: { method: 'POST', path: '/api/vector/search', mapArgs: (a) => ({ query: a.query, limit: a.limit || 5, source: 'heady-mcp-sse' }) },
            heady_auto_flow: { method: 'POST', path: '/api/hcfp/auto-flow', mapArgs: (a) => ({ task: a.task, code: a.code, context: a.context, source: 'heady-mcp-sse' }) },
            heady_jules_task: { method: 'POST', path: '/api/jules/task', mapArgs: (a) => ({ task: a.task, repository: a.repository, priority: a.priority || 'normal', source: 'heady-mcp-sse' }) },
            heady_perplexity_research: { method: 'POST', path: '/api/perplexity/research', mapArgs: (a) => ({ query: a.query, mode: a.mode || 'deep', maxSources: a.maxSources || 10, source: 'heady-mcp-sse' }) },
            heady_claude: { method: 'POST', path: '/api/headyjules/chat', mapArgs: (a) => ({ message: a.message, system: a.system, model: 'heady-headyjules-enforced', source: 'heady-mcp-sse' }) },
            heady_openai: { method: 'POST', path: '/api/headycompute/chat', mapArgs: (a) => ({ message: a.message, model: 'heady-headycompute-enforced', source: 'heady-mcp-sse' }) },
            heady_gemini: { method: 'POST', path: '/api/headypythia/generate', mapArgs: (a) => ({ prompt: a.prompt, model: a.model || 'headypythia-3.1-pro-preview', source: 'heady-mcp-sse' }) },
            heady_groq: { method: 'POST', path: '/api/groq/chat', mapArgs: (a) => ({ message: a.message, source: 'heady-mcp-sse' }) },
            heady_buddy: { method: 'POST', path: '/api/buddy/chat', mapArgs: (a) => ({ message: a.message, provider: a.provider || 'auto', source: 'heady-mcp-sse' }) },
            heady_edge_ai: { method: 'POST', path: '/api/edge/chat', mapArgs: (a) => ({ text: a.text, message: a.message, model: a.model, source: 'heady-mcp-sse' }) },
            heady_notion: { method: 'POST', path: '/api/notion/sync', mapArgs: () => ({ source: 'heady-mcp-sse' }) },
            heady_battle: { method: 'POST', path: '/api/battle/session', mapArgs: (a) => ({ action: a.action, task: a.task, content: a.code, source: 'heady-mcp-sse' }) },
            heady_patterns: { method: 'POST', path: '/api/patterns/analyze', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_risks: { method: 'POST', path: '/api/risks/assess', mapArgs: (a) => ({ content: a.content, scope: a.scope || 'all', source: 'heady-mcp-sse' }) },
            heady_coder: { method: 'POST', path: '/api/coder/generate', mapArgs: (a) => ({ prompt: a.prompt, language: a.language, source: 'heady-mcp-sse' }) },
            heady_codex: { method: 'POST', path: '/api/codex/generate', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_copilot: { method: 'POST', path: '/api/copilot/suggest', mapArgs: (a) => ({ code: a.code, language: a.language, source: 'heady-mcp-sse' }) },
            heady_ops: { method: 'POST', path: '/api/ops/deploy', mapArgs: (a) => ({ action: a.action, service: a.service, source: 'heady-mcp-sse' }) },
            heady_maid: { method: 'POST', path: '/api/maid/clean', mapArgs: (a) => ({ action: a.action, target: a.target, source: 'heady-mcp-sse' }) },
            heady_maintenance: { method: 'GET', path: '/api/maintenance/status', mapArgs: () => ({}) },
            heady_lens: { method: 'POST', path: '/api/lens/analyze', mapArgs: (a) => ({ action: a.action || 'analyze', image_url: a.image_url, prompt: a.prompt, source: 'heady-mcp-sse' }) },
            heady_vinci: { method: 'POST', path: '/api/vinci/predict', mapArgs: (a) => ({ data: a.data, context: a.context, source: 'heady-mcp-sse' }) },
            heady_soul: { method: 'POST', path: '/api/soul/analyze', mapArgs: (a) => ({ content: a.content, action: a.action || 'analyze', source: 'heady-mcp-sse' }) },
            heady_huggingface_model: { method: 'POST', path: '/api/headyhub/model', mapArgs: (a) => ({ action: a.action, modelId: a.modelId, query: a.query, source: 'heady-mcp-sse' }) },
            heady_hcfp_status: { method: 'GET', path: '/api/hcfp/status', mapArgs: () => ({}) },
            heady_orchestrator: { method: 'GET', path: '/api/orchestrator/status', mapArgs: () => ({}) },
        };

        const route = TOOL_ROUTES[name];
        if (!route) {
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }

        try {
            const mapped = route.mapArgs(args || {});
            const result = route.method === 'GET'
                ? await this._headyGet(route.path, apiKey)
                : await this._headyPost(route.path, mapped, apiKey);

            const text = result.response || result.content || result.text || result.completion || JSON.stringify(result, null, 2);
            return { content: [{ type: 'text', text }] };
        } catch (err) {
            return { content: [{ type: 'text', text: `Heady MCP Error: ${err.message}` }], isError: true };
        }
    }

    // ── JSON-RPC Handler ─────────────────────────────────────────────
    async _handleJsonRpc(message, auth) {
        const { method, id, params } = message;

        switch (method) {
            case 'initialize':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {}, resources: {}, prompts: {} },
                        serverInfo: { name: 'heady-mcp', version: '2.0.0' },
                    },
                };

            case 'tools/list':
                return { jsonrpc: '2.0', id, result: { tools: this._getTools() } };

            case 'tools/call': {
                const result = await this._executeTool(params.name, params.arguments, auth.apiKey);
                return { jsonrpc: '2.0', id, result };
            }

            case 'resources/list':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        resources: [
                            { uri: 'heady://services/catalog', name: 'Heady Service Catalog', mimeType: 'application/json' },
                            { uri: 'heady://services/health', name: 'Heady Health Status', mimeType: 'application/json' },
                        ],
                    },
                };

            case 'resources/read': {
                const { uri } = params;
                if (uri === 'heady://services/health') {
                    const health = await this._headyGet('/api/health', auth.apiKey).catch(e => ({ error: e.message }));
                    return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(health) }] } };
                }
                return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: '{}' }] } };
            }

            case 'prompts/list':
                return {
                    jsonrpc: '2.0', id,
                    result: {
                        prompts: [
                            { name: 'heady_code_review', description: 'Review code with Heady Brain' },
                            { name: 'heady_architect', description: 'Get architectural guidance' },
                            { name: 'heady_debug', description: 'Debug with Heady Brain' },
                        ],
                    },
                };

            case 'notifications/initialized':
                return null;  // No response needed for notifications

            case 'ping':
                return { jsonrpc: '2.0', id, result: {} };

            default:
                return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
        }
    }

    // ── Route Setup ──────────────────────────────────────────────────
    _setupRoutes() {
        // SSE Endpoint — long-lived connection
        this.router.get('/sse', (req, res) => {
            const auth = this._authenticate(req);
            if (!auth) {
                return res.status(401).json({ error: 'unauthorized', error_description: 'Valid OAuth token or API key required' });
            }

            const sessionId = crypto.randomBytes(16).toString('hex');

            // SSE headers
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            });

            // Store session
            this.sessions.set(sessionId, { res, auth, connectedAt: Date.now() });

            // Send endpoint event (tells client where to POST messages)
            const messageUrl = `${this.oauthProvider?.issuer || this.baseUrl}/mcp/message?sessionId=${sessionId}`;
            res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

            // Keepalive every 30s
            const keepalive = setInterval(() => {
                try { res.write(': keepalive\n\n'); } catch { clearInterval(keepalive); }
            }, 30000);

            // Cleanup on disconnect
            req.on('close', () => {
                clearInterval(keepalive);
                this.sessions.delete(sessionId);
                logger.logNodeActivity('MCP-SSE', `Session ${sessionId.slice(0, 8)}... disconnected`);
            });

            logger.logNodeActivity('MCP-SSE', `Session ${sessionId.slice(0, 8)}... connected (tier: ${auth.tier})`);
        });

        // Message Endpoint — receives JSON-RPC from client
        this.router.post('/message', express.json(), async (req, res) => {
            const { sessionId } = req.query;
            const session = this.sessions.get(sessionId);

            if (!session) {
                // Also allow direct auth for stateless calls
                const auth = this._authenticate(req);
                if (!auth) {
                    return res.status(401).json({ error: 'unauthorized' });
                }
                // Stateless mode: handle request directly
                const response = await this._handleJsonRpc(req.body, auth);
                if (response) return res.json(response);
                return res.status(202).end();
            }

            const response = await this._handleJsonRpc(req.body, session.auth);

            // Send response via SSE
            if (response) {
                try {
                    session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
                } catch {
                    // SSE connection dead — cleanup
                    this.sessions.delete(sessionId);
                }
            }

            res.status(202).end();
        });

        // Health check
        this.router.get('/health', (_req, res) => {
            res.json({
                ok: true,
                service: 'heady-mcp-sse',
                activeSessions: this.sessions.size,
                transport: 'sse',
                oauth: !!this.oauthProvider,
                ts: new Date().toISOString(),
            });
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = { McpSseTransport };
