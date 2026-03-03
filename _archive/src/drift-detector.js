/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Drift Detection Engine — SPEC-5 ═══
 *
 * Monitors: registry changes, service connectivity, config mutations.
 * Produces drift_events with before/after hashes and recommended actions.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

class DriftDetector {
    constructor(opts = {}) {
        this.snapshots = new Map();   // key → { hash, ts, data }
        this.events = [];
        this.maxEvents = opts.maxEvents || 1000;
    }

    // ─── Hash content deterministically ──────────────────────────
    _hash(data) {
        return crypto.createHash("sha256")
            .update(typeof data === "string" ? data : JSON.stringify(data))
            .digest("hex")
            .substring(0, 16);
    }

    // ─── Take a snapshot of a key (registry, config, etc.) ───────
    snapshot(key, data) {
        const hash = this._hash(data);
        const prev = this.snapshots.get(key);

        if (prev && prev.hash !== hash) {
            const event = {
                id: crypto.randomUUID(),
                kind: this._classifyKind(key),
                key,
                beforeHash: prev.hash,
                afterHash: hash,
                status: "detected",
                detectedAt: new Date().toISOString(),
                details: {
                    previousTs: prev.ts,
                    changeType: "mutation",
                },
            };
            this.events.push(event);
            if (this.events.length > this.maxEvents) this.events.shift();
        }

        this.snapshots.set(key, { hash, ts: new Date().toISOString(), data });
        return hash;
    }

    // ─── Classify drift kind ─────────────────────────────────────
    _classifyKind(key) {
        if (key.includes("registry")) return "REGISTRY";
        if (key.includes("connectivity") || key.includes("service")) return "CONNECTIVITY";
        return "CONFIG";
    }

    // ─── Scan a directory for config file changes ────────────────
    scanDirectory(dir, extensions = [".json", ".yaml", ".yml", ".toml", ".env"]) {
        const drifts = [];
        try {
            const files = fs.readdirSync(dir, { recursive: true });
            for (const file of files) {
                const filePath = path.join(dir, file.toString());
                if (!fs.statSync(filePath).isFile()) continue;
                const ext = path.extname(filePath);
                if (!extensions.includes(ext)) continue;

                try {
                    const content = fs.readFileSync(filePath, "utf-8");
                    const prevHash = this.snapshots.get(filePath)?.hash;
                    const newHash = this.snapshot(filePath, content);
                    if (prevHash && prevHash !== newHash) {
                        drifts.push({ file: filePath, prevHash, newHash });
                    }
                } catch { /* skip unreadable files */ }
            }
        } catch (err) {
            return { error: err.message, drifts: [] };
        }
        return { drifts, scanned: this.snapshots.size };
    }

    // ─── Check service connectivity ──────────────────────────────
    async checkConnectivity(services = []) {
        const results = [];
        for (const svc of services) {
            const start = Date.now();
            try {
                const res = await fetch(svc.healthEndpoint || svc.endpoint, {
                    signal: AbortSignal.timeout(5000),
                });
                const latency = Date.now() - start;
                const status = res.ok ? "healthy" : "degraded";
                const prev = this.snapshots.get(`connectivity:${svc.id}`);

                if (prev?.data?.status !== status) {
                    this.snapshot(`connectivity:${svc.id}`, { status, latency });
                }

                results.push({ id: svc.id, status, latency, httpStatus: res.status });
            } catch (err) {
                const prev = this.snapshots.get(`connectivity:${svc.id}`);
                if (prev?.data?.status !== "down") {
                    this.snapshot(`connectivity:${svc.id}`, { status: "down", error: err.message });
                }
                results.push({ id: svc.id, status: "down", error: err.message });
            }
        }
        return results;
    }

    // ─── Get latest drift events ─────────────────────────────────
    getLatest(limit = 20) {
        return this.events.slice(-limit);
    }

    // ─── Status ──────────────────────────────────────────────────
    status() {
        return {
            snapshotsTracked: this.snapshots.size,
            driftEventsTotal: this.events.length,
            lastEvent: this.events[this.events.length - 1] || null,
        };
    }
}

module.exports = DriftDetector;
