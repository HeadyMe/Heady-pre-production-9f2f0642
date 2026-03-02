/**
 * Universal Heady Worker — Vector-First Deployment
 * 
 * One Worker for ALL domains. Every request:
 * 1. Extract domain + path
 * 2. Fetch from heady-manager /api/vector-serve?domain=X&path=Y
 * 3. Return the HTML from vector space
 * 
 * Deploying = writing to vector memory. This Worker never changes.
 * 
 * Domains: headyme.com, headysystems.com, headyconnection.org, headymcp.com, heady.io
 */

const HEADY_MANAGER_URL = 'https://heady-manager-434867578931.us-central1.run.app';
const CACHE_TTL = 300; // 5 min edge cache

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const domain = url.hostname;
        const path = url.pathname;

        // Skip non-page requests
        if (path.startsWith('/api/')) {
            // Proxy API calls directly to heady-manager
            const apiUrl = `${env.HEADY_MANAGER_URL || HEADY_MANAGER_URL}${path}`;
            return fetch(apiUrl, {
                method: request.method,
                headers: request.headers,
                body: request.method !== 'GET' ? request.body : undefined,
            });
        }

        // Check edge cache first
        const cacheKey = new Request(`https://vector-cache/${domain}${path}`, request);
        const cache = caches.default;
        let response = await cache.match(cacheKey);
        if (response) return response;

        // Fetch from vector space via heady-manager
        try {
            const managerUrl = env.HEADY_MANAGER_URL || HEADY_MANAGER_URL;
            const vectorUrl = `${managerUrl}/api/vector-serve?domain=${encodeURIComponent(domain)}&path=${encodeURIComponent(path)}`;

            const vectorResponse = await fetch(vectorUrl, {
                headers: { 'Accept': 'text/html, application/json' },
                cf: { cacheTtl: CACHE_TTL },
            });

            if (vectorResponse.ok) {
                // Build response with proper headers
                response = new Response(vectorResponse.body, {
                    status: 200,
                    headers: {
                        'Content-Type': vectorResponse.headers.get('Content-Type') || 'text/html; charset=utf-8',
                        'Cache-Control': `public, max-age=${CACHE_TTL}`,
                        'X-Served-From': 'heady-vector-space',
                        'X-Domain': domain,
                        'X-Path': path,
                    },
                });

                // Store in edge cache
                ctx.waitUntil(cache.put(cacheKey, response.clone()));
                return response;
            }

            // Vector space returned non-200 (404 from vector-serve includes styled page)
            return new Response(await vectorResponse.text(), {
                status: vectorResponse.status,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });

        } catch (err) {
            // heady-manager is down — serve a fallback
            return new Response(fallbackPage(domain, path, err.message), {
                status: 503,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }
    },
};

function fallbackPage(domain, path, error) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>🐝 ${domain} — Connecting...</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
      font-family: 'Inter', system-ui, sans-serif; color: #e0e0e0;
    }
    .card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px; padding: 48px; text-align: center; max-width: 480px;
      backdrop-filter: blur(20px);
    }
    .bee { font-size: 56px; animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
    h1 { font-size: 28px; background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: 16px 0; }
    p { color: rgba(255,255,255,0.4); font-size: 14px; }
  </style>
  <script>setTimeout(() => location.reload(), 5000);</script>
</head>
<body>
  <div class="card">
    <div class="bee">🐝</div>
    <h1>Connecting to Vector Space</h1>
    <p>${domain}${path}</p>
    <p style="margin-top: 12px;">Auto-retrying in 5s...</p>
  </div>
</body>
</html>`;
}
