/**
 * ═══ Heady™ MCP Telemetry — WebSocket Proxy Worker ═══
 *
 * Securely pipes live Colab cluster telemetry to the
 * headymcp.com dashboard while masking infrastructure IPs.
 *
 * Uses Durable Objects for persistent WebSocket connections.
 */

// ── Durable Object: TelemetrySession ────────────────────────────
export class TelemetrySession {
    constructor(state, env) {
        this.state = state;
        this.env = env;
        this.sessions = new Map(); // sessionId → WebSocket
        this.metrics = { messagesRelayed: 0, sessionsCreated: 0 };
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
            return this.handleWebSocket(request);
        }

        if (url.pathname === '/publish' && request.method === 'POST') {
            return this.handlePublish(request);
        }

        if (url.pathname === '/stats') {
            return Response.json({
                activeSessions: this.sessions.size,
                ...this.metrics,
            });
        }

        return new Response('Not found', { status: 404 });
    }

    handleWebSocket(request) {
        const [client, server] = Object.values(new WebSocketPair());
        const sessionId = crypto.randomUUID();

        server.accept();
        this.sessions.set(sessionId, server);
        this.metrics.sessionsCreated++;

        server.addEventListener('close', () => {
            this.sessions.delete(sessionId);
        });

        server.addEventListener('message', (event) => {
            // Client-to-upstream messages (e.g., subscription filters)
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'subscribe') {
                    // Store filter preferences in Durable Object storage
                    this.state.storage.put(`filter:${sessionId}`, msg.channels || []);
                }
            } catch (e) {
                // Non-JSON message, ignore
            }
        });

        return new Response(null, { status: 101, webSocket: client });
    }

    async handlePublish(request) {
        // Colab nodes POST telemetry here; we relay to all connected WebSocket clients
        const data = await request.text();
        let relayed = 0;

        for (const [_id, ws] of this.sessions) {
            try {
                ws.send(data);
                relayed++;
            } catch (e) {
                // Dead socket, will be cleaned up on close event
            }
        }

        this.metrics.messagesRelayed++;
        return Response.json({ relayed, total: this.sessions.size });
    }
}

// ── Edge Worker Entry ───────────────────────────────────────────
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('Origin') || '';
        const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',');

        // CORS headers
        const corsHeaders = {
            'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Heady-Token',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        // ── Health ──────────────────────────────────────────────
        if (url.pathname === '/health') {
            return Response.json({
                status: 'operational',
                worker: 'heady-mcp-telemetry',
                timestamp: new Date().toISOString(),
            }, { headers: corsHeaders });
        }

        // ── Route to Durable Object ────────────────────────────
        if (url.pathname.startsWith('/telemetry')) {
            // Auth check
            const token = request.headers.get('X-Heady-Token') || url.searchParams.get('token');
            if (!token || token !== env.HEADY_TELEMETRY_TOKEN) {
                return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
            }

            // Single Durable Object for all sessions (can be sharded later)
            const id = env.TELEMETRY_SESSIONS.idFromName('global');
            const stub = env.TELEMETRY_SESSIONS.get(id);

            // Rewrite path for the DO
            const doUrl = new URL(request.url);
            doUrl.pathname = doUrl.pathname.replace('/telemetry', '');

            return stub.fetch(new Request(doUrl.toString(), request));
        }

        return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });
    },
};
