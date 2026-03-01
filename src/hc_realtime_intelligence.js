/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Realtime Intelligence Orchestration Engine
 * Unified MIDI event ingestion → fan-out to multiple transports:
 *   - Vector Memory (persist embeddings)
 *   - API / HTTPS (third-party webhooks)
 *   - TCP (low-level data plane)
 *   - MCP (Model Context Protocol for LLM tool-calling)
 *
 * V2 — Merged: V1 Ableton triggers + V2 adaptive flush + multi-transport.
 */

const EventEmitter = require("node:events");

const DEFAULTS = {
    flushIntervalMs: parseInt(process.env.HEADY_REALTIME_FLUSH_INTERVAL, 10) || 2000,
    maxQueueDepth: parseInt(process.env.HEADY_REALTIME_MAX_QUEUE, 10) || 4096,
    apiEndpoint: process.env.HEADY_REALTIME_API_ENDPOINT || null,
    httpsEndpoint: process.env.HEADY_REALTIME_HTTPS_ENDPOINT || null,
    tcpHost: process.env.HEADY_REALTIME_TCP_HOST || null,
    tcpPort: parseInt(process.env.HEADY_REALTIME_TCP_PORT, 10) || 0,
    mcpEndpoint: process.env.HEADY_REALTIME_MCP_ENDPOINT || null,
};

class RealtimeIntelligenceEngine extends EventEmitter {
    constructor(opts = {}) {
        super();
        this.cfg = { ...DEFAULTS, ...opts };
        this.queue = [];
        this.metrics = { queued: 0, dropped: 0, persisted: 0, delivered: 0, failed: 0, flushes: 0 };
        this._timer = null;
        this._vectorMemory = opts.vectorMemory || null;

        // ─── Ableton Live integration state ─────────────────────────
        this.abletonSession = null;
    }

    // ─── Lifecycle ───────────────────────────────────────────────────
    start() {
        if (this._timer) return;
        this._timer = setInterval(() => this._flush(), this.cfg.flushIntervalMs);
        this.emit("started");
    }

    stop() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._flush(); // drain remaining
        this.emit("stopped");
    }

    getStatus() {
        return {
            running: !!this._timer,
            queueDepth: this.queue.length,
            metrics: { ...this.metrics },
            config: {
                flushIntervalMs: this.cfg.flushIntervalMs,
                mode: "dynamic-full-drain",
                maxQueueDepth: this.cfg.maxQueueDepth,
            },
            transports: {
                vectorMemory: !!this._vectorMemory,
                api: !!this.cfg.apiEndpoint,
                https: !!this.cfg.httpsEndpoint,
                tcp: !!(this.cfg.tcpHost && this.cfg.tcpPort),
                mcp: !!this.cfg.mcpEndpoint,
            },
            abletonSession: this.abletonSession ? {
                active: true,
                startedAt: this.abletonSession.startedAt,
                midiEvents: this.abletonSession.midiEvents,
            } : null,
        };
    }

    // ─── Event Normalization & Ingestion ─────────────────────────────
    ingest(event) {
        if (this.queue.length >= this.cfg.maxQueueDepth) {
            this.metrics.dropped++;
            return false;
        }

        const normalized = {
            id: `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            type: event.type || "midi",
            channel: event.channel ?? 0,
            note: event.note ?? null,
            velocity: event.velocity ?? 0,
            cc: event.cc ?? null,
            value: event.value ?? null,
            source: event.source || "unknown",
            ts: Date.now(),
            meta: event.meta || {},
        };

        this.queue.push(normalized);
        this.metrics.queued++;
        return true;
    }

    // ─── Ableton Live Session Management ─────────────────────────────
    startAbletonSession(config = {}) {
        this.abletonSession = {
            id: `ableton-${Date.now().toString(36)}`,
            startedAt: new Date().toISOString(),
            bpm: config.bpm || 120,
            quantize: config.quantize || "1/4",
            midiEvents: 0,
            tracks: config.tracks || [],
            latencyMs: 0,
        };
        // Signal session start on MIDI bus
        if (global.midiBus) {
            global.midiBus.taskStarted("ableton:session", 0);
        }
        this.emit("ableton:session:started", this.abletonSession);
        return this.abletonSession;
    }

    stopAbletonSession() {
        if (!this.abletonSession) return null;
        const session = { ...this.abletonSession, endedAt: new Date().toISOString() };
        if (global.midiBus) {
            global.midiBus.taskCompleted("ableton:session", 0);
        }
        this.abletonSession = null;
        this.emit("ableton:session:stopped", session);
        return session;
    }

    routeAbletonMidi(event) {
        if (!this.abletonSession) return { ok: false, error: "No active Ableton session" };
        this.abletonSession.midiEvents++;
        // Ingest into the realtime pipeline
        this.ingest({ ...event, source: "ableton", meta: { sessionId: this.abletonSession.id } });
        // Forward CC metrics on the MIDI bus
        if (global.midiBus && event.cc != null) {
            global.midiBus.ccMetric(event.cc, event.value || 0, event.channel || 0);
        }
        return { ok: true, sessionMidiCount: this.abletonSession.midiEvents };
    }

    // ─── Feed (recent events for UI polling) ─────────────────────────
    getFeed(limit = 50) {
        return this.queue.slice(-limit);
    }

    // ─── Runtime Config Update ───────────────────────────────────────
    updateConfig(patch = {}) {
        if (patch.flushIntervalMs) {
            this.cfg.flushIntervalMs = patch.flushIntervalMs;
            if (this._timer) {
                clearInterval(this._timer);
                this._timer = setInterval(() => this._flush(), this.cfg.flushIntervalMs);
            }
        }
        if (patch.maxQueueDepth) this.cfg.maxQueueDepth = patch.maxQueueDepth;
        return this.cfg;
    }

    // ─── Flush Pipeline ──────────────────────────────────────────────
    async _flush() {
        if (this.queue.length === 0) return;

        // Dynamic: drain entire queue — no batch limit
        const batch = this.queue.splice(0);
        this.metrics.flushes++;

        // 1. Vector Memory persistence (primary)
        if (this._vectorMemory) {
            try {
                for (const evt of batch) {
                    this._vectorMemory.store(
                        `realtime:${evt.id}`,
                        { type: evt.type, note: evt.note, channel: evt.channel, source: evt.source },
                        { structural: 0.7, behavioral: 0.8, quality: 0.9 }
                    );
                }
                this.metrics.persisted += batch.length;
            } catch { this.metrics.failed += batch.length; }
        }

        // 2. API transport (non-blocking)
        if (this.cfg.apiEndpoint) {
            this._sendApi(batch).catch(() => { this.metrics.failed += batch.length; });
        }

        // 3. HTTPS transport
        if (this.cfg.httpsEndpoint) {
            this._sendHttps(batch).catch(() => { this.metrics.failed += batch.length; });
        }

        // 4. TCP transport
        if (this.cfg.tcpHost && this.cfg.tcpPort) {
            this._sendTcp(batch).catch(() => { this.metrics.failed += batch.length; });
        }

        // 5. MCP transport
        if (this.cfg.mcpEndpoint) {
            this._sendMcp(batch).catch(() => { this.metrics.failed += batch.length; });
        }

        this.metrics.delivered += batch.length;
        this.emit("flushed", { count: batch.length, metrics: { ...this.metrics } });
    }

    // ─── Transport Implementations ───────────────────────────────────
    async _sendApi(batch) {
        await fetch(this.cfg.apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: batch }),
            signal: AbortSignal.timeout(5000),
        });
    }

    async _sendHttps(batch) {
        const https = require("https");
        const url = new URL(this.cfg.httpsEndpoint);
        const payload = JSON.stringify({ events: batch });
        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: url.hostname,
                path: url.pathname,
                method: "POST",
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
                timeout: 5000,
            }, (res) => { res.resume(); resolve(); });
            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
            req.write(payload);
            req.end();
        });
    }

    async _sendTcp(batch) {
        const net = require("node:net");
        return new Promise((resolve, reject) => {
            const client = net.createConnection({ host: this.cfg.tcpHost, port: this.cfg.tcpPort }, () => {
                client.write(JSON.stringify(batch) + "\n");
                client.end();
                resolve();
            });
            client.on("error", reject);
            client.setTimeout(5000, () => { client.destroy(); reject(new Error("timeout")); });
        });
    }

    async _sendMcp(batch) {
        await fetch(this.cfg.mcpEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "realtime/ingest", params: { events: batch } }),
            signal: AbortSignal.timeout(5000),
        });
    }
}

module.exports = { RealtimeIntelligenceEngine };
