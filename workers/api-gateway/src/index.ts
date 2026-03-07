/**
 * Heady API Gateway — Cloudflare Worker
 * Request routing + rate limiting for all Heady domains.
 */

export interface Env {
    RATE_LIMIT_KV: KVNamespace;
    UPSTREAM_URL: string;
}

const DOMAIN_ROUTES: Record<string, string> = {
    'headyme.com': '/app/command-center',
    'headyio.com': '/app/heady-io-docs',
    'headymcp.com': '/app/heady-mcp-portal',
    'headysystems.com': '/app/heady-systems',
    'headyconnection.org': '/app/heady-connection',
    'headybuddy.org': '/app/heady-buddy',
    'headybot.com': '/app/heady-bot',
    'headyapi.com': '/app/heady-api',
    'headyai.com': '/app/heady-ai',
};

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === '/health') {
            return Response.json({ ok: true, service: 'api-gateway', domains: Object.keys(DOMAIN_ROUTES).length });
        }

        // Rate limiting
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitKey = `rl:${clientIP}:${Math.floor(Date.now() / 60000)}`;
        const current = parseInt(await env.RATE_LIMIT_KV.get(rateLimitKey) || '0');

        if (current > 600) {
            return Response.json({ error: 'Rate limit exceeded' }, {
                status: 429,
                headers: { 'Retry-After': '60' }
            });
        }

        await env.RATE_LIMIT_KV.put(rateLimitKey, String(current + 1), { expirationTtl: 120 });

        // Domain routing
        const hostname = url.hostname;
        const route = DOMAIN_ROUTES[hostname];

        if (!route) {
            return Response.json({ error: 'Unknown domain', hostname }, { status: 404 });
        }

        // Proxy to upstream
        const upstream = new URL(env.UPSTREAM_URL || 'https://heady-manager-609590223909.us-central1.run.app');
        upstream.pathname = route + url.pathname;
        upstream.search = url.search;

        const proxyReq = new Request(upstream.toString(), {
            method: request.method,
            headers: request.headers,
            body: request.body,
        });

        try {
            const response = await fetch(proxyReq);
            const newHeaders = new Headers(response.headers);
            newHeaders.set('X-Heady-Gateway', 'cf-worker');
            newHeaders.set('X-Heady-Domain', hostname);
            return new Response(response.body, { status: response.status, headers: newHeaders });
        } catch (err) {
            return Response.json({ error: 'Upstream unavailable' }, { status: 502 });
        }
    },
};
