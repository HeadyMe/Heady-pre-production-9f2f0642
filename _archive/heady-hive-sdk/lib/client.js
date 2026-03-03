/**
 * HeadyClient — Main SDK entry point
 * Unified connection to any Heady instance with sub-clients for each service.
 */

const https = require("https");
const http = require("http");
const HeadyBrain = require("./brain");
const HeadyBattle = require("./battle");
const HeadyCreative = require("./creative");
const HeadyMCP = require("./mcp");
const HeadyAuth = require("./auth");
const HeadyEvents = require("./events");
const HeadyGateway = require("./gateway");
const HeadySwarm = require("./swarm");
const { createProviders } = require("./providers");

class HeadyClient {
    /**
     * @param {Object} opts
     * @param {string} opts.url - Heady Manager URL (e.g., "https://headyme.com" or "http://127.0.0.1:3301" for local dev)
     * @param {string} [opts.apiKey] - API key for authentication
     * @param {number} [opts.timeout=30000] - Request timeout in ms
     */
    constructor(opts = {}) {
        this.baseUrl = (opts.url || process.env.HEADY_URL || "https://headyme.com").replace(/\/$/, "");
        this.apiKey = opts.apiKey || process.env.HEADY_API_KEY || "";
        this.timeout = opts.timeout || 30000;
        this.version = require("../package.json").version;

        // Parse URL
        const parsed = new URL(this.baseUrl);
        this._isHttps = parsed.protocol === "https:";
        this._hostname = parsed.hostname;
        this._port = parsed.port || (this._isHttps ? 443 : 80);
        this._basePath = parsed.pathname === "/" ? "" : parsed.pathname;

        // Initialize liquid gateway
        this.gateway = new HeadyGateway({
            budget: opts.budget || { daily: 10, monthly: 100 },
            cacheTTL: opts.cacheTTL || 300000,
        });

        // Register providers from environment
        const providers = createProviders(opts.env || process.env);
        for (const p of providers) this.gateway.registerProvider(p);

        // Initialize sub-clients
        this.brain = new HeadyBrain(this);
        this.battle = new HeadyBattle(this);
        this.creative = new HeadyCreative(this);
        this.mcp = new HeadyMCP(this);
        this.auth = new HeadyAuth(this);
        this.events = new HeadyEvents(this);

        // Initialize HeadySwarm — the bee colony
        this.swarm = new HeadySwarm(this.gateway, {
            beeCount: opts.beeCount || 5,
            roundInterval: opts.roundInterval || 60000,
        });
    }

    /** Raw HTTP request to Heady Manager */
    request(method, path, body) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const opts = {
                hostname: this._hostname,
                port: this._port,
                path: `${this._basePath}${path}`,
                method,
                headers: {
                    "Content-Type": "application/json",
                    "X-Heady-SDK": `hive/${this.version}`,
                    ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
                    ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
                },
                timeout: this.timeout,
            };

            const mod = this._isHttps ? https : http;
            const req = mod.request(opts, (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 400) {
                            const err = new Error(parsed.error || parsed.message || `HTTP ${res.statusCode}`);
                            err.status = res.statusCode;
                            err.body = parsed;
                            reject(err);
                        } else {
                            resolve(parsed);
                        }
                    } catch {
                        resolve({ raw: data, status: res.statusCode });
                    }
                });
            });

            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
            if (payload) req.write(payload);
            req.end();
        });
    }

    /** GET shorthand */
    get(path) { return this.request("GET", path); }

    /** POST shorthand */
    post(path, body) { return this.request("POST", path, body); }

    /** PATCH shorthand */
    patch(path, body) { return this.request("PATCH", path, body); }

    /** System health check */
    async health() { return this.get("/api/health"); }

    /** Auto-success engine status */
    async autoSuccess() { return this.get("/api/auto-success/status"); }

    /** Gateway-direct chat — bypasses HeadyManager, routes through liquid gateway */
    async chat(message, opts = {}) { return this.gateway.chat(message, opts); }

    /** Gateway-direct embed */
    async embed(text, opts = {}) { return this.gateway.embed(text, opts); }

    /** Decompose a complex task across all available providers */
    async decompose(task, opts = {}) { return this.gateway.decompose(task, opts); }

    /** Gateway stats and provider health */
    gatewayStats() { return this.gateway.getStats(); }

    /** Gateway optimization recommendations */
    gatewayOptimizations() { return this.gateway.getOptimizations(); }

    /** Gateway race audit log */
    gatewayAudit(limit = 20) { return this.gateway.getAudit(limit); }

    /** Full system info */
    async info() {
        const [health, as] = await Promise.allSettled([this.health(), this.autoSuccess()]);
        return {
            connected: health.status === "fulfilled",
            health: health.value || health.reason?.message,
            autoSuccess: as.value || as.reason?.message,
            gateway: this.gateway.getStats(),
            sdk: { version: this.version, url: this.baseUrl },
        };
    }
}

module.exports = HeadyClient;
