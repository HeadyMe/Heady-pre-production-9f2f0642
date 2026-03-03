/**
 * OpenAI Bridge — Assistants API, Embeddings, Batch processing
 * Wraps OpenAI APIs to integrate with Heady ecosystem.
 */

const https = require("https");

class OpenAIBridge {
    constructor(opts = {}) {
        this.apiKey = opts.apiKey || process.env.OPENAI_API_KEY || "";
        this.assistantId = opts.assistantId || null;
        this.vectorStoreId = opts.vectorStoreId || null;
    }

    /** Raw OpenAI API request */
    _req(method, endpoint, body) {
        return new Promise((resolve, reject) => {
            const payload = body ? JSON.stringify(body) : null;
            const opts = {
                hostname: "api.openai.com", path: `/v1${endpoint}`, method,
                headers: {
                    "Authorization": `Bearer ${this.apiKey}`,
                    "Content-Type": "application/json",
                    "OpenAI-Beta": "assistants=v2",
                    ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
                },
                timeout: 60000,
            };
            const req = https.request(opts, (res) => {
                let data = "";
                res.on("data", (c) => (data += c));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode >= 400) reject(new Error(`OpenAI ${res.statusCode}: ${parsed.error?.message || data.substring(0, 200)}`));
                        else resolve(parsed);
                    } catch { reject(new Error(`Parse: ${data.substring(0, 200)}`)); }
                });
            });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
            if (payload) req.write(payload);
            req.end();
        });
    }

    // ─── Assistants API ─────────────────────────────────────────────

    /** Create a Heady-powered assistant */
    async createAssistant(name, instructions, opts = {}) {
        const res = await this._req("POST", "/assistants", {
            name, instructions, model: opts.model || "gpt-4o",
            tools: [{ type: "file_search" }, ...(opts.tools || [])],
        });
        this.assistantId = res.id;
        return res;
    }

    /** Upload a file for retrieval */
    async uploadFile(filePath) {
        // Use multipart — simplified for SDK
        const fs = require("fs");
        const content = fs.readFileSync(filePath, "utf8");
        return this._req("POST", "/files", {
            purpose: "assistants", filename: require("path").basename(filePath),
        });
    }

    /** Create a vector store */
    async createVectorStore(name) {
        const res = await this._req("POST", "/vector_stores", { name });
        this.vectorStoreId = res.id;
        return res;
    }

    /** File search / retrieval query */
    async fileSearch(query, opts = {}) {
        if (!this.assistantId) throw new Error("Create an assistant first");
        const thread = await this._req("POST", "/threads", {});
        await this._req("POST", `/threads/${thread.id}/messages`, {
            role: "user", content: query,
        });
        const run = await this._req("POST", `/threads/${thread.id}/runs`, {
            assistant_id: this.assistantId,
        });
        // Poll for completion
        let status = run;
        while (status.status === "queued" || status.status === "in_progress") {
            await new Promise(r => setTimeout(r, 1000));
            status = await this._req("GET", `/threads/${thread.id}/runs/${run.id}`);
        }
        const messages = await this._req("GET", `/threads/${thread.id}/messages?limit=1`);
        return messages.data?.[0]?.content || [];
    }

    // ─── Embeddings ─────────────────────────────────────────────────

    /** Generate embeddings */
    async embed(input, opts = {}) {
        return this._req("POST", "/embeddings", {
            input, model: opts.model || "text-embedding-3-small",
            dimensions: opts.dimensions || 1536,
        });
    }

    // ─── Batch API ──────────────────────────────────────────────────

    /** Submit a batch of requests */
    async batchSubmit(requests, opts = {}) {
        return this._req("POST", "/batches", {
            input_file_id: requests.fileId,
            endpoint: opts.endpoint || "/v1/chat/completions",
            completion_window: opts.window || "24h",
        });
    }

    /** Check batch status */
    async batchStatus(batchId) {
        return this._req("GET", `/batches/${batchId}`);
    }

    /** List models */
    async models() {
        return this._req("GET", "/models");
    }

    /** Health check */
    async health() {
        try {
            await this._req("GET", "/models");
            return { healthy: true, apiKey: !!this.apiKey };
        } catch (e) {
            return { healthy: false, error: e.message };
        }
    }
}

module.exports = OpenAIBridge;
