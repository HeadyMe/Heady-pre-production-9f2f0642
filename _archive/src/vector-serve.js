/**
 * Vector-Serve: Deploy & Serve UIs from Vector Space
 * 
 * Everything lives in vector memory. Deploying = storing vectors.
 * Serving = reading vectors. No files, no git, no CI/CD.
 * 
 * Cloudflare Workers → GET /api/vector-serve?domain=X&path=Y → returns HTML
 * Deploy via POST /api/vector-serve/deploy → stores content in vector memory
 */

const PHI = 1.618033988749895;

class VectorServe {
    constructor(vectorMemory, logger) {
        this.memory = vectorMemory;
        this.logger = logger || console;
        this.cache = new Map(); // edge cache: domain:path → { content, contentType, ts }
        this.cacheTTL = 300_000; // 5 min cache
        this.deployHistory = []; // audit trail
    }

    /**
     * Wire Express routes onto the app
     */
    wireRoutes(app) {
        // Serve: Cloudflare Workers call this
        app.get('/api/vector-serve', async (req, res) => {
            const { domain, path: urlPath } = req.query;
            if (!domain) return res.status(400).json({ error: 'domain required' });
            const servePath = urlPath || '/';

            try {
                const result = await this.serve(domain, servePath);
                if (!result) {
                    return res.status(404).send(this._generate404(domain, servePath));
                }
                res.setHeader('Content-Type', result.contentType || 'text/html; charset=utf-8');
                res.setHeader('X-Served-From', 'vector-space');
                res.setHeader('X-Vector-Ts', result.ts || Date.now());
                res.setHeader('Cache-Control', 'public, max-age=300');
                res.send(result.content);
            } catch (err) {
                this.logger.error?.(`[VectorServe] serve error: ${err.message}`) || console.error(err);
                res.status(500).json({ error: 'vector-serve failed', detail: err.message });
            }
        });

        // Deploy: store content into vector space
        app.post('/api/vector-serve/deploy', async (req, res) => {
            const { domain, path: urlPath, content, contentType } = req.body;
            if (!domain || !content) {
                return res.status(400).json({ error: 'domain and content required' });
            }

            try {
                const result = await this.deploy(domain, urlPath || '/', content, contentType);
                res.json(result);
            } catch (err) {
                this.logger.error?.(`[VectorServe] deploy error: ${err.message}`) || console.error(err);
                res.status(500).json({ error: 'deploy failed', detail: err.message });
            }
        });

        // Batch deploy: deploy multiple pages at once
        app.post('/api/vector-serve/deploy-batch', async (req, res) => {
            const { pages } = req.body; // [{ domain, path, content, contentType }]
            if (!Array.isArray(pages)) {
                return res.status(400).json({ error: 'pages array required' });
            }

            const results = [];
            for (const page of pages) {
                try {
                    const r = await this.deploy(page.domain, page.path || '/', page.content, page.contentType);
                    results.push({ ...r, status: 'ok' });
                } catch (err) {
                    results.push({ domain: page.domain, path: page.path, status: 'error', error: err.message });
                }
            }
            res.json({ deployed: results.filter(r => r.status === 'ok').length, total: pages.length, results });
        });

        // List all deployed pages
        app.get('/api/vector-serve/pages', async (req, res) => {
            const pages = await this.listPages(req.query.domain);
            res.json({ count: pages.length, pages });
        });

        // Invalidate cache
        app.post('/api/vector-serve/invalidate', (req, res) => {
            const { domain, path: urlPath } = req.body;
            if (domain && urlPath) {
                this.cache.delete(`${domain}:${urlPath}`);
            } else if (domain) {
                for (const key of this.cache.keys()) {
                    if (key.startsWith(`${domain}:`)) this.cache.delete(key);
                }
            } else {
                this.cache.clear();
            }
            res.json({ status: 'invalidated' });
        });

        // Deploy history
        app.get('/api/vector-serve/history', (req, res) => {
            const limit = parseInt(req.query.limit) || 50;
            res.json({ history: this.deployHistory.slice(-limit) });
        });

        this.logger.info?.(`[VectorServe] Routes wired: /api/vector-serve/*`) ||
            console.log('🌐 VectorServe: Routes wired');
    }

    /**
     * Serve content from vector space (with cache)
     */
    async serve(domain, path) {
        const cacheKey = `${domain}:${path}`;

        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.ts) < this.cacheTTL) {
            return cached;
        }

        // Query vector memory for the page
        const searchQuery = `ui-page ${domain} ${path}`;
        let results;

        if (this.memory?.search) {
            results = await this.memory.search(searchQuery, 5);
        } else if (this.memory?.recall) {
            results = await this.memory.recall(searchQuery, 5);
        }

        if (!results?.length) return null;

        // Find exact match by metadata
        const match = results.find(r => {
            const meta = r.metadata || r.meta || {};
            return meta.type === 'ui-page' && meta.domain === domain && meta.path === path;
        }) || results[0]; // fallback to best match

        if (!match) return null;

        const content = match.metadata?.content || match.content || match.text;
        const contentType = match.metadata?.contentType || 'text/html; charset=utf-8';
        const ts = match.metadata?.deployedAt || match.timestamp || Date.now();

        const result = { content, contentType, ts, domain, path };

        // Cache it
        this.cache.set(cacheKey, { ...result, ts: Date.now() });

        return result;
    }

    /**
     * Deploy content to vector space
     */
    async deploy(domain, path, content, contentType = 'text/html; charset=utf-8') {
        const metadata = {
            type: 'ui-page',
            domain,
            path,
            contentType,
            contentLength: content.length,
            deployedAt: Date.now(),
            version: this.deployHistory.filter(d => d.domain === domain && d.path === path).length + 1,
        };

        // Store in vector memory
        const text = `UI page for ${domain}${path}: ${content.slice(0, 200)}`;

        if (this.memory?.store) {
            await this.memory.store(text, { ...metadata, content });
        } else if (this.memory?.memorize) {
            await this.memory.memorize(text, { ...metadata, content });
        } else {
            // Fallback: in-memory store
            if (!this._fallbackStore) this._fallbackStore = [];
            this._fallbackStore.push({ text, metadata: { ...metadata, content }, timestamp: Date.now() });
        }

        // Invalidate cache
        this.cache.delete(`${domain}:${path}`);

        // Record history
        const record = { domain, path, contentLength: content.length, deployedAt: new Date().toISOString(), version: metadata.version };
        this.deployHistory.push(record);

        this.logger.info?.(`[VectorServe] Deployed ${domain}${path} (${content.length} bytes, v${metadata.version})`) ||
            console.log(`🌐 Deployed: ${domain}${path} (${content.length} bytes)`);

        return record;
    }

    /**
     * List all deployed pages
     */
    async listPages(domain) {
        // Deduplicate from history
        const seen = new Set();
        return this.deployHistory
            .filter(d => !domain || d.domain === domain)
            .filter(d => {
                const key = `${d.domain}:${d.path}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .reverse(); // newest first
    }

    /**
     * Generate a styled 404 page
     */
    _generate404(domain, path) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>404 — ${domain}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
      font-family: 'Inter', system-ui, sans-serif; color: #e0e0e0;
    }
    .card {
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px; padding: 60px; text-align: center; max-width: 500px;
      backdrop-filter: blur(20px);
    }
    .bee { font-size: 64px; margin-bottom: 20px; }
    h1 { font-size: 48px; background: linear-gradient(135deg, #ffd700 0%, #ff8c00 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 12px; }
    p { color: rgba(255,255,255,0.5); font-size: 16px; line-height: 1.6; }
    code { background: rgba(255,215,0,0.1); padding: 2px 8px; border-radius: 6px; color: #ffd700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bee">🐝</div>
    <h1>404</h1>
    <p>No vector found for <code>${domain}${path}</code></p>
    <p style="margin-top: 16px; font-size: 13px;">Deploy with: POST /api/vector-serve/deploy</p>
  </div>
</body>
</html>`;
    }
}

module.exports = { VectorServe };
