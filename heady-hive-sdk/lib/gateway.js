/**
 * HeadyGateway — HeadyStack Client SDK
 * Connects to all HeadyStack API endpoints.
 *
 * Usage:
 *   const { HeadyGateway } = require('@headysystems/heady-hive-sdk');
 *   const heady = new HeadyGateway({ baseUrl: 'https://api.headysystems.ai', apiKey: 'hdy_live_...' });
 *   const result = await heady.chat.send({ message: 'Hello!' });
 *
 * © 2026 HeadySystems Inc. — Proprietary
 */

'use strict';

class HeadyGateway {
    /**
     * @param {Object} options
     * @param {string} options.baseUrl - HeadyStack API base URL
     * @param {string} [options.apiKey] - API key (X-Heady-Key header)
     * @param {string} [options.accessToken] - Bearer access token
     * @param {number} [options.timeout] - Request timeout in ms (default: 30000)
     * @param {boolean} [options.debug] - Enable debug logging
     */
    constructor({ baseUrl, apiKey, accessToken, timeout = 30000, debug = false } = {}) {
        if (!baseUrl) { throw new Error('HeadyGateway: baseUrl is required'); }
        this._baseUrl = baseUrl.replace(/\/$/, '');
        this._apiKey = apiKey;
        this._accessToken = accessToken;
        this._timeout = timeout;
        this._debug = debug;

        // Bind domain proxies
        this.auth = this._buildAuthDomain();
        this.chat = this._buildChatDomain();
        this.agents = this._buildAgentsDomain();
        this.bees = this._buildBeesDomain();
        this.memory = this._buildMemoryDomain();
        this.pipeline = this._buildPipelineDomain();
        this.files = this._buildFilesDomain();
        this.notion = this._buildNotionDomain();
        this.github = this._buildGithubDomain();
        this.stripe = this._buildStripeDomain();
        this.cloudflare = this._buildCloudflareDomain();
        this.render = this._buildRenderDomain();
        this.mcp = this._buildMcpDomain();
        this.system = this._buildSystemDomain();
    }

    // ── HTTP Core ──────────────────────────────────────────────

    async _request(method, path, { body, query, headers = {}, stream = false } = {}) {
        const url = new URL(this._baseUrl + path);

        if (query) {
            for (const [k, v] of Object.entries(query)) {
                if (v !== undefined && v !== null) { url.searchParams.set(k, String(v)); }
            }
        }

        const reqHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': 'heady-hive-sdk/3.0.1',
            ...headers,
        };

        if (this._accessToken) {
            reqHeaders['Authorization'] = `Bearer ${this._accessToken}`;
        } else if (this._apiKey) {
            reqHeaders['X-Heady-Key'] = this._apiKey;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this._timeout);

        if (this._debug) {
            console.error(`[HeadyGateway] ${method} ${url.toString()}`);
        }

        try {
            const res = await fetch(url.toString(), {
                method,
                headers: reqHeaders,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            clearTimeout(timer);

            if (stream) { return res; }

            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                data = { raw: text };
            }

            if (!res.ok) {
                const err = new Error(data?.error?.message || `HTTP ${res.status}`);
                err.status = res.status;
                err.code = data?.error?.code;
                err.response = data;
                throw err;
            }

            return data;
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new Error(`HeadyGateway: request timed out after ${this._timeout}ms`);
            }
            throw err;
        }
    }

    _get(path, opts) { return this._request('GET', path, opts); }
    _post(path, body, opts) { return this._request('POST', path, { body, ...opts }); }
    _put(path, body, opts) { return this._request('PUT', path, { body, ...opts }); }
    _delete(path, opts) { return this._request('DELETE', path, opts); }

    /**
     * Update the access token (e.g., after token refresh)
     * @param {string} token
     */
    setAccessToken(token) { this._accessToken = token; }

    // ── Domain Builders ────────────────────────────────────────

    _buildAuthDomain() {
        const gw = this;
        return {
            register: (data) => gw._post('/api/auth/register', data),
            login: (credentials) => gw._post('/api/auth/login', credentials),
            logout: (data) => gw._post('/api/auth/logout', data),
            refresh: (refreshToken) => gw._post('/api/auth/refresh', { refreshToken }),
        };
    }

    _buildChatDomain() {
        const gw = this;
        return {
            /**
             * Send a chat message.
             * @param {Object} opts
             * @param {string} opts.message
             * @param {string} [opts.model]
             * @param {boolean} [opts.stream]
             * @returns {Promise<Object>}
             */
            send: ({ message, model, systemPrompt, history, temperature, maxTokens, namespace, stream = false } = {}) => {
                return gw._post('/api/chat' + (stream ? '/stream' : ''), {
                    message, model, systemPrompt, history, temperature, maxTokens, namespace, stream,
                }, { stream });
            },
        };
    }

    _buildAgentsDomain() {
        const gw = this;
        return {
            spawn: (opts) => gw._post('/api/agents/spawn', opts),
            list: () => gw._get('/api/agents'),
            get: (agentId) => gw._get(`/api/agents/${agentId}`),
            terminate: (agentId) => gw._delete(`/api/agents/${agentId}`),
            stream: (agentId) => gw._get(`/api/agents/${agentId}/stream`, { stream: true }),
        };
    }

    _buildBeesDomain() {
        const gw = this;
        return {
            /**
             * Invoke a bee domain agent.
             * @param {string} domain - bee domain ID
             * @param {Object} opts - { task, context, engine, stream }
             */
            invoke: (domain, opts) => gw._post(`/api/bees/${domain}`, opts),
            list: () => gw._get('/api/bees'),
        };
    }

    _buildMemoryDomain() {
        const gw = this;
        return {
            store: ({ namespace, key, content, metadata } = {}) =>
                gw._post('/api/memory', { namespace, key, content, metadata }),

            search: ({ query, namespace, topK, minScore } = {}) =>
                gw._get('/api/memory/search', { query: { q: query, namespace, topK, minScore } }),

            get: (id) => gw._get(`/api/memory/${id}`),
            delete: (id) => gw._delete(`/api/memory/${id}`),
        };
    }

    _buildPipelineDomain() {
        const gw = this;
        return {
            enqueue: ({ type, data, priority = 'normal' } = {}) =>
                gw._post('/api/pipeline/enqueue', { type, data, priority }),

            status: (taskId) => gw._get(`/api/pipeline/${taskId}`),

            list: ({ status, limit } = {}) =>
                gw._get('/api/pipeline', { query: { status, limit } }),
        };
    }

    _buildFilesDomain() {
        const gw = this;
        return {
            upload: ({ filename, content, mimeType, namespace = 'document' } = {}) =>
                gw._post('/api/files/upload', { filename, content, mimeType, namespace }),

            search: ({ query, namespace, topK } = {}) =>
                gw._get('/api/files/search', { query: { q: query, namespace, topK } }),

            get: (fileId) => gw._get(`/api/files/${fileId}`),
            delete: (fileId) => gw._delete(`/api/files/${fileId}`),
        };
    }

    _buildNotionDomain() {
        const gw = this;
        return {
            createPage: ({ parentId, title, content, properties } = {}) =>
                gw._post('/api/notion/pages', { parentId, title, content, properties }),

            getPage: (pageId) => gw._get(`/api/notion/pages/${pageId}`),

            queryDatabase: (databaseId, { filter, sorts, pageSize } = {}) =>
                gw._post(`/api/notion/databases/${databaseId}/query`, { filter, sorts, pageSize }),
        };
    }

    _buildGithubDomain() {
        const gw = this;
        return {
            getRepo: (owner, repo) => gw._get(`/api/github/repos/${owner}/${repo}`),

            getFile: (owner, repo, path, ref = 'main') =>
                gw._get(`/api/github/repos/${owner}/${repo}/contents/${path}`, { query: { ref } }),

            createIssue: (owner, repo, data) =>
                gw._post(`/api/github/repos/${owner}/${repo}/issues`, data),

            createPR: (owner, repo, data) =>
                gw._post(`/api/github/repos/${owner}/${repo}/pulls`, data),
        };
    }

    _buildStripeDomain() {
        const gw = this;
        return {
            createCustomer: (data) => gw._post('/api/stripe/customers', data),

            listSubscriptions: ({ customerId, status, limit } = {}) =>
                gw._get('/api/stripe/subscriptions', { query: { customerId, status, limit } }),
        };
    }

    _buildCloudflareDomain() {
        const gw = this;
        return {
            listDns: ({ type, name } = {}) =>
                gw._get('/api/cloudflare/dns', { query: { type, name } }),

            createDns: (data) => gw._post('/api/cloudflare/dns', data),

            deleteDns: (id) => gw._delete(`/api/cloudflare/dns/${id}`),

            purgeCache: ({ purgeEverything = false, files } = {}) =>
                gw._post('/api/cloudflare/purge', { purgeEverything, files }),
        };
    }

    _buildRenderDomain() {
        const gw = this;
        return {
            listServices: () => gw._get('/api/render/services'),

            deploy: (serviceId, { clearCache = false } = {}) =>
                gw._post(`/api/render/services/${serviceId}/deploys`, { clearCache }),
        };
    }

    _buildMcpDomain() {
        const gw = this;
        return {
            info: () => gw._get('/mcp'),

            listTools: () => gw._get('/mcp/tools/list'),

            callTool: (name, args) =>
                gw._post('/mcp/tools/call', { name, arguments: args }),
        };
    }

    _buildSystemDomain() {
        const gw = this;
        return {
            health: () => gw._get('/health'),
            ready: () => gw._get('/ready'),
            pulse: () => gw._get('/pulse'),
            metrics: () => gw._get('/metrics'),
            version: () => gw._get('/version'),
        };
    }
}

module.exports = { HeadyGateway };
