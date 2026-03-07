/**
 * ═══════════════════════════════════════════════════════════════
 * EDGE-001: Cloudflare Worker Edge Composer
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * ═══════════════════════════════════════════════════════════════
 *
 * Handles edge routing, caching, and rate limiting for all Heady
 * domains. Runs on Cloudflare Workers for sub-50ms global latency.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const hostname = url.hostname;
        const path = url.pathname;

        // ─── Rate Limiting ─────────────────────────────────────
        const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateLimitKey = `rl:${clientIP}:${hostname}`;

        if (env.RATE_LIMIT_KV) {
            const count = parseInt(await env.RATE_LIMIT_KV.get(rateLimitKey) || '0');
            if (count > 100) {
                return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
                    status: 429,
                    headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
                });
            }
            ctx.waitUntil(env.RATE_LIMIT_KV.put(rateLimitKey, String(count + 1), { expirationTtl: 60 }));
        }

        // ─── Health Endpoint ───────────────────────────────────
        if (path === '/health' || path === '/health/live') {
            return new Response(JSON.stringify({
                status: 'healthy',
                edge: true,
                colo: request.cf?.colo || 'unknown',
                country: request.cf?.country || 'unknown',
                timestamp: new Date().toISOString(),
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ─── Edge Cache ────────────────────────────────────────
        if (request.method === 'GET' && env.CACHE_KV) {
            const cacheKey = `cache:${hostname}:${path}`;
            const cached = await env.CACHE_KV.get(cacheKey);
            if (cached) {
                return new Response(cached, {
                    headers: {
                        'Content-Type': 'text/html',
                        'X-Cache': 'HIT',
                        'X-Edge-Colo': request.cf?.colo || 'unknown',
                    },
                });
            }
        }

        // ─── Domain Router ─────────────────────────────────────
        const ORIGINS = {
            'headyme.com': 'https://heady-manager-xxxxx.run.app',
            'www.headyme.com': 'https://heady-manager-xxxxx.run.app',
            'headyapi.com': 'https://heady-gateway-xxxxx.run.app',
            'www.headyapi.com': 'https://heady-gateway-xxxxx.run.app',
            'headymcp.com': 'https://heady-mcp-xxxxx.run.app',
            'headysystems.com': 'https://heady-web-xxxxx.run.app',
            'headyconnection.org': 'https://heady-web-xxxxx.run.app',
            'headybuddy.org': 'https://heady-buddy-xxxxx.run.app',
            'headyio.com': 'https://heady-web-xxxxx.run.app',
            'headybot.com': 'https://heady-web-xxxxx.run.app',
            'heady-ai.com': 'https://heady-web-xxxxx.run.app',
        };

        const origin = ORIGINS[hostname];
        if (!origin) {
            return new Response('Domain not configured', { status: 404 });
        }

        // ─── Proxy to Cloud Run ────────────────────────────────
        const originUrl = new URL(path, origin);
        originUrl.search = url.search;

        const proxyRequest = new Request(originUrl.toString(), {
            method: request.method,
            headers: {
                ...Object.fromEntries(request.headers),
                'X-Forwarded-Host': hostname,
                'X-Forwarded-Proto': 'https',
                'X-Real-IP': clientIP,
            },
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        });

        try {
            const response = await fetch(proxyRequest);

            // ─── Security Headers ──────────────────────────────
            const headers = new Headers(response.headers);
            headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
            headers.set('X-Content-Type-Options', 'nosniff');
            headers.set('X-Frame-Options', 'SAMEORIGIN');
            headers.set('X-XSS-Protection', '1; mode=block');
            headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
            headers.set('X-Edge-Colo', request.cf?.colo || 'unknown');
            headers.set('X-Cache', 'MISS');

            // Cache successful GET responses
            if (request.method === 'GET' && response.ok && env.CACHE_KV) {
                const body = await response.text();
                ctx.waitUntil(
                    env.CACHE_KV.put(`cache:${hostname}:${path}`, body, { expirationTtl: 300 })
                );
                return new Response(body, { status: response.status, headers });
            }

            return new Response(response.body, { status: response.status, headers });
        } catch (err) {
            return new Response(JSON.stringify({
                error: 'Origin unreachable',
                domain: hostname,
                detail: err.message,
            }), {
                status: 502,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    },
};
