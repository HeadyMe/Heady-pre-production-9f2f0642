/**
 * HeadyEvents — Real-time SSE event streaming client
 */

const http = require("http");
const https = require("https");
const EventEmitter = require("events");

class HeadyEvents extends EventEmitter {
    constructor(client) {
        super();
        this._c = client;
        this._req = null;
        this._connected = false;
        this._reconnectDelay = 1000;
        this._maxReconnectDelay = 30000;
    }

    /** Subscribe to SSE events */
    connect(opts = {}) {
        const mod = this._c._isHttps ? https : http;
        const reqOpts = {
            hostname: this._c._hostname,
            port: this._c._port,
            path: `${this._c._basePath}/api/events/stream`,
            method: "GET",
            headers: {
                Accept: "text/event-stream",
                "Cache-Control": "no-cache",
                ...(this._c.apiKey ? { Authorization: `Bearer ${this._c.apiKey}` } : {}),
            },
        };

        this._req = mod.request(reqOpts, (res) => {
            if (res.statusCode !== 200) {
                this.emit("error", new Error(`SSE: HTTP ${res.statusCode}`));
                return;
            }
            this._connected = true;
            this._reconnectDelay = 1000;
            this.emit("connected");

            let buffer = "";
            res.on("data", (chunk) => {
                buffer += chunk.toString();
                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";
                for (const part of parts) {
                    const event = this._parseSSE(part);
                    if (event) this.emit(event.type, event.data);
                }
            });

            res.on("end", () => {
                this._connected = false;
                this.emit("disconnected");
                if (opts.autoReconnect !== false) this._reconnect(opts);
            });
        });

        this._req.on("error", (err) => {
            this._connected = false;
            this.emit("error", err);
            if (opts.autoReconnect !== false) this._reconnect(opts);
        });

        this._req.end();
        return this;
    }

    /** Disconnect */
    disconnect() {
        if (this._req) { this._req.destroy(); this._req = null; }
        this._connected = false;
        this.emit("disconnected");
    }

    /** Parse SSE format */
    _parseSSE(raw) {
        let type = "message", data = "";
        for (const line of raw.split("\n")) {
            if (line.startsWith("event:")) type = line.slice(6).trim();
            else if (line.startsWith("data:")) {
                const val = line.slice(5).trim();
                try { data = JSON.parse(val); } catch { data = val; }
            }
        }
        return data ? { type, data } : null;
    }

    /** Auto-reconnect with exponential backoff */
    _reconnect(opts) {
        setTimeout(() => {
            this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
            this.connect(opts);
        }, this._reconnectDelay);
    }

    get connected() { return this._connected; }
}

module.exports = HeadyEvents;
