/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Hologram Router — Cloudflare Edge Worker ═══
 *
 * The edge worker that intercepts traffic to all 9 Heady domains,
 * checks the KV edge cache, and triggers the Colab compiler
 * if the UI isn't materialized. Serves holographic projections
 * from KV with strict TTL — files evaporate after 1 hour.
 *
 * Domains: headymcp.com, headysystems.com, headyconnection.org,
 *          headyme.com, headyapi.com, headyio.com, headytrader.com,
 *          headymusic.com, headyfoundation.org, myheady.ai
 */

// Domain → UI module mapping
const DOMAIN_MODULES = {
    'headymcp.com': 'mcp-dashboard',
    'www.headymcp.com': 'mcp-dashboard',
    'headysystems.com': 'systems-portal',
    'www.headysystems.com': 'systems-portal',
    'headyme.com': 'personal-hub',
    'www.headyme.com': 'personal-hub',
    'headyapi.com': 'api-docs',
    'headyio.com': 'io-platform',
    'headytrader.com': 'trading-desk',
    'headymusic.com': 'music-studio',
    'headyfoundation.org': 'foundation-portal',
    'headyconnection.org': 'connection-hub',
    'myheady.ai': 'ai-assistant',
    'heady.headyme.com': 'edge-mcp',
};

const CACHE_TTL = 3600; // 1 hour — UI projections evaporate after this
const COLAB_COMPILER_WEBHOOK = 'https://heady-manager-1073792900703.us-east1.run.app/api/hologram/compile';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const hostname = url.hostname;
        const module = DOMAIN_MODULES[hostname];

        if (!module) {
            return new Response('Unknown domain', { status: 404 });
        }

        // Check KV edge cache for pre-compiled UI
        const cacheKey = `hologram:${module}:${url.pathname}`;
        const cached = await env.HEADY_UI_MANIFEST.get(cacheKey, { type: 'text' });

        if (cached) {
            const contentType = url.pathname.endsWith('.js') ? 'application/javascript'
                : url.pathname.endsWith('.css') ? 'text/css'
                    : url.pathname.endsWith('.json') ? 'application/json'
                        : 'text/html';

            return new Response(cached, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': `public, max-age=${CACHE_TTL}`,
                    'X-Heady-Source': 'edge-cache',
                    'X-Heady-Module': module,
                },
            });
        }

        // UI not materialized — trigger Colab compiler
        try {
            const compileResponse = await fetch(COLAB_COMPILER_WEBHOOK, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${env.HEADY_INTERNAL_TOKEN}`,
                },
                body: JSON.stringify({
                    domain: hostname,
                    module,
                    path: url.pathname,
                    timestamp: new Date().toISOString(),
                }),
            });

            if (compileResponse.ok) {
                const compiled = await compileResponse.text();

                // Cache the compiled UI in KV with TTL
                await env.HEADY_UI_MANIFEST.put(cacheKey, compiled, {
                    expirationTtl: CACHE_TTL,
                });

                return new Response(compiled, {
                    headers: {
                        'Content-Type': 'text/html',
                        'X-Heady-Source': 'just-compiled',
                        'X-Heady-Module': module,
                    },
                });
            }
        } catch (err) {
            // Fall through to Cloud Run origin
        }

        // Fallback: proxy to Cloud Run origin
        const originUrl = `https://heady-manager-1073792900703.us-east1.run.app${url.pathname}`;
        return fetch(originUrl, {
            headers: {
                'Host': hostname,
                'X-Forwarded-Host': hostname,
                'X-Heady-Module': module,
            },
        });
    },
};
