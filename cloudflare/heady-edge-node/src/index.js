import { Hono } from 'hono'

const app = new Hono()

// ═══════════════════════════════════════════════════════════════
// MCP Tool Registry — All Heady tools available at the edge
// ═══════════════════════════════════════════════════════════════
const HEADY_TOOLS = [
    { name: 'heady_chat', description: 'Chat with Heady Brain via edge AI.', inputSchema: { type: 'object', properties: { message: { type: 'string' }, system: { type: 'string' }, temperature: { type: 'number', default: 0.7 }, max_tokens: { type: 'integer', default: 4096 } }, required: ['message'] } },
    { name: 'heady_analyze', description: 'Analyze code/text via edge AI.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, type: { type: 'string', enum: ['code', 'text', 'security', 'performance', 'architecture', 'general'] }, language: { type: 'string' } }, required: ['content'] } },
    { name: 'heady_embed', description: 'Generate embeddings via edge AI.', inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } },
    { name: 'heady_memory', description: 'Search 3D vector memory (Vectorize).', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', default: 5 } }, required: ['query'] } },
    { name: 'heady_search', description: 'Full semantic search: embed → vector match → AI synthesis → cache.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', default: 10 } }, required: ['query'] } },
    { name: 'heady_store', description: 'Store content in vector memory with auto-embedding.', inputSchema: { type: 'object', properties: { content: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, source: { type: 'string' } }, required: ['content'] } },
    { name: 'heady_health', description: 'Health check across all edge services.', inputSchema: { type: 'object', properties: {} } },
    { name: 'heady_complete', description: 'Code/text completion via edge AI.', inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, language: { type: 'string' }, max_tokens: { type: 'integer', default: 2048 } }, required: ['prompt'] } },
    { name: 'heady_kv_get', description: 'Read from edge KV cache.', inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } },
    { name: 'heady_kv_put', description: 'Write to edge KV cache.', inputSchema: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, ttl: { type: 'integer', default: 3600 } }, required: ['key', 'value'] } },
    { name: 'heady_learn', description: 'Store a learning in vector memory (auto-embeds and indexes).', inputSchema: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string', enum: ['directive', 'preference', 'interaction', 'decision', 'identity', 'pattern'], default: 'interaction' } }, required: ['content'] } },
    { name: 'heady_recall', description: 'Recall relevant past interactions from vector memory.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, topK: { type: 'integer', default: 5 } }, required: ['query'] } },
]

// ═══════════════════════════════════════════════════════════════
// Tool Execution — All tools run natively at the edge
// ═══════════════════════════════════════════════════════════════
async function callTool(name, args, env) {
    const ai = env.HEADY_AI
    const vecs = env.HEADY_MEMORY_VECS
    const kv = env.HEADY_KV_CACHE

    try {
        switch (name) {
            case 'heady_chat': {
                if (!ai) return text('Edge AI binding not available')
                const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                    messages: [
                        { role: 'system', content: args.system || 'You are Heady, an intelligent AI assistant operating at the Cloudflare edge. Be concise, technical, and helpful.' },
                        { role: 'user', content: args.message },
                    ],
                    max_tokens: args.max_tokens || 4096,
                    temperature: args.temperature || 0.7,
                })
                return text(result.response)
            }

            case 'heady_analyze': {
                if (!ai) return text('Edge AI binding not available')
                const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                    messages: [
                        { role: 'system', content: `You are a ${args.type || 'general'} analysis expert. Analyze the following${args.language ? ` ${args.language}` : ''} content. Be thorough and actionable.` },
                        { role: 'user', content: args.content },
                    ],
                    max_tokens: 4096,
                })
                return text(result.response)
            }

            case 'heady_embed': {
                if (!ai) return text('Edge AI binding not available')
                const result = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.text] })
                return json({ dimensions: result.data[0].length, embedding: result.data[0].slice(0, 5).concat(['...']) })
            }

            case 'heady_memory': {
                if (!ai || !vecs) return text('Vectorize/AI bindings not available')
                const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.query] })
                const matches = await vecs.query(embeddings.data[0], { topK: args.limit || 5, returnMetadata: true })
                return json({
                    query: args.query,
                    matches: matches.matches.map(m => ({
                        id: m.id, score: m.score,
                        content: m.metadata?.content || m.metadata?.text || '',
                        source: m.metadata?.source || 'memory',
                        tags: m.metadata?.tags || [],
                    }))
                })
            }

            case 'heady_search': {
                if (!ai || !vecs) return text('Vectorize/AI bindings not available')
                // Stage 1: Embed
                const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.query] })
                // Stage 2: Vector search
                const vectorResults = await vecs.query(embeddings.data[0], { topK: args.limit || 10, returnMetadata: true })
                const matches = vectorResults.matches.map(m => ({
                    id: m.id, score: m.score,
                    content: m.metadata?.content || m.metadata?.text || '',
                    source: m.metadata?.source || 'memory',
                }))
                // Stage 3: AI synthesis
                let answer = null
                if (matches.length > 0) {
                    const context = matches.slice(0, 3).map(m => m.content).join('\n\n')
                    const synthesis = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                        messages: [
                            { role: 'system', content: 'Answer based on context. Be concise and precise.' },
                            { role: 'user', content: `Context:\n${context}\n\nQuestion: ${args.query}` },
                        ],
                        max_tokens: 512,
                    })
                    answer = synthesis.response
                }
                // Stage 4: Cache
                if (kv && matches.length > 0) {
                    const cacheKey = `search:${args.query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100)}`
                    await kv.put(cacheKey, JSON.stringify({ matches, answer }), { expirationTtl: 3600 })
                }
                return json({ query: args.query, matches, answer, count: matches.length })
            }

            case 'heady_store': {
                if (!ai || !vecs) return text('Vectorize/AI bindings not available')
                const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.content] })
                const id = crypto.randomUUID()
                await vecs.insert([{
                    id,
                    values: embeddings.data[0],
                    metadata: { content: args.content, source: args.source || 'mcp', tags: args.tags || [], ts: Date.now() },
                }])
                return json({ stored: true, id, dimensions: embeddings.data[0].length })
            }

            case 'heady_health': {
                return json({
                    status: 'online', service: 'heady-edge-node', version: '2.0.0',
                    bindings: { ai: !!ai, vectorize: !!vecs, kv: !!kv },
                    tools: HEADY_TOOLS.length,
                    transports: ['sse', 'rest'],
                    ts: new Date().toISOString(),
                })
            }

            case 'heady_complete': {
                if (!ai) return text('Edge AI binding not available')
                const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
                    messages: [
                        { role: 'system', content: `You are an expert ${args.language || ''} programmer. Complete the following code or text.` },
                        { role: 'user', content: args.prompt },
                    ],
                    max_tokens: args.max_tokens || 2048,
                })
                return text(result.response)
            }

            case 'heady_kv_get': {
                if (!kv) return text('KV binding not available')
                const val = await kv.get(args.key, 'json')
                return json({ key: args.key, value: val })
            }

            case 'heady_kv_put': {
                if (!kv) return text('KV binding not available')
                await kv.put(args.key, args.value, { expirationTtl: args.ttl || 3600 })
                return json({ stored: true, key: args.key, ttl: args.ttl || 3600 })
            }

            case 'heady_learn': {
                if (!ai || !vecs) return text('Vectorize/AI bindings not available')
                const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.content] })
                const id = crypto.randomUUID()
                await vecs.insert([{
                    id,
                    values: embeddings.data[0],
                    metadata: { content: args.content, category: args.category || 'interaction', source: 'learn', ts: Date.now() },
                }])
                return json({ learned: true, id, category: args.category || 'interaction' })
            }

            case 'heady_recall': {
                if (!ai || !vecs) return text('Vectorize/AI bindings not available')
                const embeddings = await ai.run('@cf/baai/bge-large-en-v1.5', { text: [args.query] })
                const matches = await vecs.query(embeddings.data[0], { topK: args.topK || 5, returnMetadata: true })
                return json({
                    query: args.query,
                    memories: matches.matches.map(m => ({
                        id: m.id, score: m.score,
                        content: m.metadata?.content || '',
                        category: m.metadata?.category || 'unknown',
                        ts: m.metadata?.ts,
                    }))
                })
            }

            default:
                return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true }
        }
    } catch (err) {
        return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
}

function text(t) { return { content: [{ type: 'text', text: typeof t === 'string' ? t : JSON.stringify(t, null, 2) }] } }
function json(o) { return { content: [{ type: 'text', text: JSON.stringify(o, null, 2) }] } }

// ═══════════════════════════════════════════════════════════════
// MCP JSON-RPC 2.0 Handler
// ═══════════════════════════════════════════════════════════════
async function handleJsonRpc(msg, env) {
    if (!msg || !msg.method) return null

    switch (msg.method) {
        case 'initialize':
            return {
                jsonrpc: '2.0', id: msg.id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: { tools: {} },
                    serverInfo: { name: 'heady-edge-mcp', version: '2.0.0' },
                },
            }

        case 'tools/list':
            return { jsonrpc: '2.0', id: msg.id, result: { tools: HEADY_TOOLS } }

        case 'tools/call': {
            const { name, arguments: args } = msg.params
            const result = await callTool(name, args || {}, env)
            return { jsonrpc: '2.0', id: msg.id, result }
        }

        case 'resources/list':
            return {
                jsonrpc: '2.0', id: msg.id,
                result: {
                    resources: [
                        { uri: 'heady://edge/health', name: 'Edge Health', mimeType: 'application/json' },
                        { uri: 'heady://edge/tools', name: 'Tool Catalog', mimeType: 'application/json' },
                    ],
                },
            }

        case 'resources/read': {
            const { uri } = msg.params
            let data
            if (uri === 'heady://edge/health') {
                data = { status: 'online', service: 'heady-edge-node', bindings: { ai: !!env.HEADY_AI, vectorize: !!env.HEADY_MEMORY_VECS, kv: !!env.HEADY_KV_CACHE } }
            } else if (uri === 'heady://edge/tools') {
                data = { tools: HEADY_TOOLS.map(t => t.name), count: HEADY_TOOLS.length }
            } else {
                data = { error: `Unknown resource: ${uri}` }
            }
            return { jsonrpc: '2.0', id: msg.id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data) }] } }
        }

        case 'ping':
            return { jsonrpc: '2.0', id: msg.id, result: {} }

        case 'notifications/initialized':
            return null

        default:
            return { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } }
    }
}

// ═══════════════════════════════════════════════════════════════
// SSE Transport (MCP native remote)
// ═══════════════════════════════════════════════════════════════
app.get('/sse', (c) => {
    const clientId = crypto.randomUUID()
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        start(controller) {
            // Send endpoint info as first SSE event
            controller.enqueue(encoder.encode(`event: endpoint\ndata: /mcp/message?clientId=${clientId}\n\n`))

            // Store the controller in KV for message routing (short TTL)
            // Since Workers are stateless, we use Durable Objects pattern via KV
            if (c.env.HEADY_KV_CACHE) {
                c.env.HEADY_KV_CACHE.put(`sse:${clientId}`, JSON.stringify({ active: true, ts: Date.now() }), { expirationTtl: 3600 })
            }

            // Keep-alive ping every 30s
            const keepAlive = setInterval(() => {
                try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch { clearInterval(keepAlive) }
            }, 30000)
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Heady-Client-Id': clientId,
        },
    })
})

// MCP message endpoint (paired with SSE)
app.post('/mcp/message', async (c) => {
    const body = await c.req.json()
    const response = await handleJsonRpc(body, c.env)
    // For stateless Workers, respond directly (client matches via request/response)
    return c.json(response || { jsonrpc: '2.0', result: null })
})

// ═══════════════════════════════════════════════════════════════
// JSON-RPC endpoint (direct, non-SSE)
// ═══════════════════════════════════════════════════════════════
app.post('/mcp/rpc', async (c) => {
    const body = await c.req.json()
    const response = await handleJsonRpc(body, c.env)
    return c.json(response || { jsonrpc: '2.0', result: null })
})

// ═══════════════════════════════════════════════════════════════
// REST APIs (existing + enhanced)
// ═══════════════════════════════════════════════════════════════
app.get('/', (c) => {
    return c.json({
        status: 'online',
        service: 'heady-edge-node',
        version: '2.0.0',
        nodes: ['memory', 'search', 'swarm', 'manager', 'mcp'],
        transports: ['sse', 'json-rpc', 'rest'],
        tools: HEADY_TOOLS.length,
        region: c.req.raw.cf?.colo || 'unknown',
    })
})

app.get('/health', async (c) => {
    return c.json({
        status: 'online',
        service: 'heady-edge-node',
        version: '2.0.0',
        bindings: {
            ai: !!c.env.HEADY_AI,
            vectorize: !!c.env.HEADY_MEMORY_VECS,
            kv: !!c.env.HEADY_KV_CACHE,
        },
        mcp: { tools: HEADY_TOOLS.length, transports: ['sse', 'json-rpc', 'rest'] },
        region: c.req.raw.cf?.colo || 'unknown',
        ts: new Date().toISOString(),
    })
})

app.get('/mcp/tools', (c) => {
    return c.json({ tools: HEADY_TOOLS, count: HEADY_TOOLS.length })
})

app.post('/mcp/tools/call', async (c) => {
    const body = await c.req.json()
    const result = await callTool(body.name, body.arguments || {}, c.env)
    return c.json(result)
})

// === Edge Memory (Vectorize + AI) ===
app.post('/api/memory/search', async (c) => {
    const { query, limit = 5 } = await c.req.json()
    if (!c.env.HEADY_AI || !c.env.HEADY_MEMORY_VECS) {
        return c.json({ error: 'Bindings not active', fallback: true })
    }
    const embeddings = await c.env.HEADY_AI.run('@cf/baai/bge-large-en-v1.5', { text: [query] })
    const matches = await c.env.HEADY_MEMORY_VECS.query(embeddings.data[0], { topK: limit, returnMetadata: true })
    return c.json({ success: true, matches: matches.matches })
})

// === Edge KV Cache ===
app.get('/api/manager/health', async (c) => {
    if (c.env.HEADY_KV_CACHE) {
        const cached = await c.env.HEADY_KV_CACHE.get('manager_health', 'json')
        if (cached) return c.json({ ...cached, source: 'edge-kv-cache' })
    }
    return c.json({ status: 'healthy', source: 'edge-node' })
})

// === Edge Search (full pipeline) ===
app.post('/api/search', async (c) => {
    const { query, limit = 10 } = await c.req.json()
    if (!query) return c.json({ error: 'query required' }, 400)
    const result = await callTool('heady_search', { query, limit }, c.env)
    try { return c.json(JSON.parse(result.content[0].text)) } catch { return c.json(result) }
})

app.get('/api/search', async (c) => {
    const query = c.req.query('q')
    if (!query) return c.json({ error: 'q param required' }, 400)
    // Check cache
    if (c.env.HEADY_KV_CACHE) {
        const cacheKey = `search:${query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100)}`
        const cached = await c.env.HEADY_KV_CACHE.get(cacheKey, 'json')
        if (cached) return c.json({ ...cached, source: 'edge-cache' })
    }
    const result = await callTool('heady_search', { query }, c.env)
    try { return c.json(JSON.parse(result.content[0].text)) } catch { return c.json(result) }
})

// === CORS preflight ===
app.options('*', (c) => {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    })
})

export default app
