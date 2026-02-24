import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
    return c.json({
        status: 'online',
        service: 'heady-edge-node',
        nodes: ['memory', 'search', 'swarm', 'manager'],
        region: c.req.raw.cf?.colo || 'unknown'
    })
})

// === Edge Memory (Vectorize + AI) ===
app.post('/api/memory/search', async (c) => {
    const { query, limit = 5 } = await c.req.json()

    if (!c.env.HEADY_AI || !c.env.HEADY_MEMORY_VECS) {
        return c.json({ error: "Bindings not active", fallback: true })
    }

    const embeddings = await c.env.HEADY_AI.run('@cf/baai/bge-large-en-v1.5', {
        text: [query]
    })

    const matches = await c.env.HEADY_MEMORY_VECS.query(
        embeddings.data[0],
        { topK: limit, returnMetadata: true }
    )

    return c.json({ success: true, matches: matches.matches })
})

// === Edge KV Cache (Manager Proxy) ===
app.get('/api/manager/health', async (c) => {
    if (c.env.HEADY_KV_CACHE) {
        const cached = await c.env.HEADY_KV_CACHE.get('manager_health', 'json')
        if (cached) return c.json({ ...cached, source: 'edge-kv-cache' })
    }

    return c.json({ status: 'healthy', source: 'origin-stub' })
})

// === Edge Swarm Queue ===
app.post('/api/swarm/forage', async (c) => {
    const task = await c.req.json()

    if (c.env.SWARM_QUEUE) {
        await c.env.SWARM_QUEUE.send(task)
        return c.json({ success: true, message: "Task pushed to global edge queue" })
    }

    return c.json({ success: false, error: "Queue binding missing" })
})

// === Edge Search (Vectorize + Workers AI) ===
// Full 4-stage pipeline: Embed → Vector Search → AI Synthesis → KV Cache
app.post('/api/search', async (c) => {
    const { query, limit = 10, mode = 'semantic' } = await c.req.json()

    if (!query) return c.json({ error: 'query required' }, 400)

    const results = { query, mode, matches: [], meta: { colo: c.req.raw.cf?.colo || 'unknown', ts: Date.now() } }

    // Stage 1: Generate embedding at the edge
    if (c.env.HEADY_AI && c.env.HEADY_MEMORY_VECS) {
        try {
            const embeddings = await c.env.HEADY_AI.run('@cf/baai/bge-large-en-v1.5', {
                text: [query]
            })

            // Stage 2: Vectorize semantic search
            const vectorResults = await c.env.HEADY_MEMORY_VECS.query(
                embeddings.data[0],
                { topK: limit, returnMetadata: true }
            )

            results.matches = vectorResults.matches.map(m => ({
                id: m.id,
                score: m.score,
                content: m.metadata?.content || m.metadata?.text || '',
                source: m.metadata?.source || 'memory',
                tags: m.metadata?.tags || [],
            }))

            results.meta.embeddingModel = 'bge-large-en-v1.5'
            results.meta.vectorCount = vectorResults.matches.length
        } catch (e) {
            results.meta.vectorError = e.message
        }
    }

    // Stage 3: AI-powered answer synthesis
    if (c.env.HEADY_AI && results.matches.length > 0) {
        try {
            const context = results.matches.slice(0, 3).map(m => m.content).join('\n\n')
            const answer = await c.env.HEADY_AI.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [
                    { role: 'system', content: 'You are Heady, an intelligent AI assistant. Answer based on the provided context. Be concise and precise.' },
                    { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
                ],
                max_tokens: 512,
            })
            results.answer = answer.response
            results.meta.answerModel = 'llama-3.1-8b-instruct'
        } catch (e) {
            results.meta.answerError = e.message
        }
    }

    // Stage 4: Cache in KV for repeat queries (1hr TTL)
    if (c.env.HEADY_KV_CACHE && results.matches.length > 0) {
        const cacheKey = `search:${query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100)}`
        await c.env.HEADY_KV_CACHE.put(cacheKey, JSON.stringify(results), { expirationTtl: 3600 })
    }

    return c.json(results)
})

// === Edge Search (GET — quick queries with cache-first) ===
app.get('/api/search', async (c) => {
    const query = c.req.query('q')
    if (!query) return c.json({ error: 'q param required' }, 400)

    // Check KV cache first
    if (c.env.HEADY_KV_CACHE) {
        const cacheKey = `search:${query.toLowerCase().trim().replace(/\s+/g, '_').substring(0, 100)}`
        const cached = await c.env.HEADY_KV_CACHE.get(cacheKey, 'json')
        if (cached) return c.json({ ...cached, meta: { ...cached.meta, source: 'edge-cache' } })
    }

    // Forward to POST handler
    const url = new URL(c.req.url)
    return app.fetch(new Request(url.origin + '/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: parseInt(c.req.query('limit') || '10') }),
    }), c.env, c.executionCtx)
})

export default app
