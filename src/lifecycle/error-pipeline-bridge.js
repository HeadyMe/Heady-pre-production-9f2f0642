/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ErrorPipelineBridge — Auto-Error → HCFP Pipeline Injection
 *
 * Singleton that receives errors from ALL sources and injects them
 * into the HeadySwarm flower field as high-priority error-recovery tasks.
 *
 * Sources:
 *   - Express error middleware (HTTP 5xx/4xx)
 *   - process.on('uncaughtException')
 *   - process.on('unhandledRejection')
 *   - HeadySwarm bee error-absorbed events
 *   - PM2 log scanner POST /swarm/ingest-error
 *
 * Deduplication:
 *   Same error fingerprint within DEDUP_TTL_MS → ignored (prevents flood).
 *
 * Output:
 *   - Injects error flowers into swarm.ingestError()
 *   - Persists audit trail to data/error-pipeline-ledger.jsonl
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const EventEmitter = require("events");

const LEDGER_PATH = path.join(__dirname, "..", "..", "data", "error-pipeline-ledger.jsonl");
const ERROR_FLOWERS_PATH = path.join(__dirname, "..", "..", "data", "error-flowers.json");
const DEDUP_TTL_MS = 60_000; // 60 seconds
const MAX_LEDGER_LINES = 2000;

class ErrorPipelineBridge extends EventEmitter {
    constructor() {
        super();
        this.swarm = null;
        this._fingerprints = new Map(); // fingerprint → timestamp
        this._pending = []; // errors queued before swarm is connected
        this._stats = {
            captured: 0,
            deduplicated: 0,
            injected: 0,
            flushed: 0,
        };
    }

    /**
     * Connect to the HeadySwarm instance.
     * Must be called after the swarm is initialized.
     */
    connectSwarm(swarm) {
        this.swarm = swarm;

        // Listen for bee error-absorbed events
        if (swarm) {
            swarm.on("error-absorbed", (data) => {
                this.capture({
                    source: "swarm-bee",
                    message: data.error || data.message || "Bee error absorbed",
                    context: { beeId: data.beeId, taskId: data.taskId, category: data.category },
                    severity: "warning",
                });
            });
        }

        // Flush any pending errors that arrived before swarm was ready
        if (this._pending.length > 0) {
            console.log(`  🔗 ErrorPipeline: flushing ${this._pending.length} pending errors to swarm`);
            for (const err of this._pending) {
                this._injectToSwarm(err);
            }
            this._pending = [];
        }

        // Load any error flowers saved to disk from a previous session
        this._loadPendingFlowers();

        console.log("  🔗 ErrorPipelineBridge → HeadySwarm CONNECTED");
    }

    /**
     * Capture an error from any source.
     * @param {Object} opts
     * @param {string} opts.source - 'express', 'uncaught', 'rejection', 'swarm-bee', 'log-scanner', 'external'
     * @param {string} opts.message - error message
     * @param {string} [opts.stack] - stack trace
     * @param {string} [opts.severity] - 'critical', 'warning', 'info'
     * @param {Object} [opts.context] - additional context (route, status code, etc.)
     */
    capture(opts) {
        const { source, message, stack, context } = opts;
        const severity = opts.severity || this._classifySeverity(opts);
        const fingerprint = this._fingerprint(source, message, context);

        this._stats.captured++;

        // Dedup check
        const lastSeen = this._fingerprints.get(fingerprint);
        if (lastSeen && (Date.now() - lastSeen) < DEDUP_TTL_MS) {
            this._stats.deduplicated++;
            return; // already captured recently
        }
        this._fingerprints.set(fingerprint, Date.now());

        // Clean old fingerprints periodically
        if (this._fingerprints.size > 500) {
            this._cleanFingerprints();
        }

        const errorRecord = {
            id: `err-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
            source,
            message: (message || "Unknown error").substring(0, 500),
            stack: (stack || "").substring(0, 1000),
            severity,
            context: context || {},
            fingerprint,
            status: "pending",
            ts: new Date().toISOString(),
        };

        // Write to audit ledger
        this._appendLedger(errorRecord);

        // Inject into swarm
        if (this.swarm) {
            this._injectToSwarm(errorRecord);
        } else {
            this._pending.push(errorRecord);
            this._savePendingFlowers();
        }

        this.emit("error-captured", errorRecord);

        // Only log critical/warning to avoid noise
        if (severity !== "info") {
            console.log(`  🚨 ErrorPipeline: [${severity.toUpperCase()}] ${source} → "${message.substring(0, 80)}" → injected to swarm`);
        }

        return errorRecord;
    }

    /**
     * Inject an error into the swarm as a high-priority flower.
     */
    _injectToSwarm(errorRecord) {
        if (!this.swarm) return;

        const flower = {
            id: errorRecord.id,
            name: `Auto-Fix: ${errorRecord.message.substring(0, 60)}`,
            category: "error-recovery",
            priority: errorRecord.severity === "critical" ? 10 : errorRecord.severity === "warning" ? 8 : 6,
            role: "guard",
            prompt: this._generateDiagnosticPrompt(errorRecord),
            effectivePriority: 10,
            lastForaged: null,
            forageCount: 0,
            cooldownUntil: 0,
        };

        // Use swarm.ingestError if available, otherwise addFlower
        if (typeof this.swarm.ingestError === "function") {
            this.swarm.ingestError(flower);
        } else {
            this.swarm.addFlower(flower);
        }

        this._stats.injected++;
    }

    /**
     * Generate an AI diagnostic prompt from an error record.
     */
    _generateDiagnosticPrompt(err) {
        const contextStr = err.context ? JSON.stringify(err.context, null, 2) : "none";
        return [
            `AUTOMATED ERROR CAPTURE — Diagnose and provide a fix for this error:`,
            ``,
            `Source: ${err.source}`,
            `Severity: ${err.severity}`,
            `Message: ${err.message}`,
            err.stack ? `Stack trace:\n${err.stack}` : "",
            `Context: ${contextStr}`,
            ``,
            `Provide:`,
            `1. Root cause analysis (why did this happen?)`,
            `2. Immediate fix (exact code change or config change)`,
            `3. Prevention strategy (how to stop this from recurring)`,
            `4. Any related systems that might be affected`,
        ].filter(Boolean).join("\n");
    }

    /**
     * Classify severity based on error characteristics.
     */
    _classifySeverity(opts) {
        const msg = (opts.message || "").toLowerCase();
        const status = opts.context?.statusCode || opts.context?.status;

        // Critical: crashes, 5xx, out of memory, ECONNREFUSED
        if (opts.source === "uncaught" || opts.source === "rejection") return "critical";
        if (status >= 500) return "critical";
        if (msg.includes("econnrefused") || msg.includes("enomem") || msg.includes("fatal")) return "critical";

        // Warning: 4xx, timeouts, connection issues
        if (status >= 400) return "warning";
        if (msg.includes("timeout") || msg.includes("econnreset") || msg.includes("epipe")) return "warning";

        return "info";
    }

    /**
     * Generate a fingerprint for deduplication.
     */
    _fingerprint(source, message, context) {
        const raw = `${source}:${(message || "").substring(0, 100)}:${context?.route || ""}:${context?.statusCode || ""}`;
        return crypto.createHash("md5").update(raw).digest("hex").substring(0, 12);
    }

    /**
     * Clean expired fingerprints.
     */
    _cleanFingerprints() {
        const now = Date.now();
        for (const [fp, ts] of this._fingerprints) {
            if (now - ts > DEDUP_TTL_MS * 2) {
                this._fingerprints.delete(fp);
            }
        }
    }

    /**
     * Append to the error ledger (JSONL file for audit).
     */
    _appendLedger(record) {
        try {
            const dir = path.dirname(LEDGER_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(LEDGER_PATH, JSON.stringify(record) + "\n");
        } catch { /* non-critical */ }
    }

    /**
     * Save pending error flowers to disk (for errors captured before swarm starts).
     */
    _savePendingFlowers() {
        try {
            const dir = path.dirname(ERROR_FLOWERS_PATH);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(ERROR_FLOWERS_PATH, JSON.stringify(this._pending, null, 2));
        } catch { /* non-critical */ }
    }

    /**
     * Load pending error flowers from disk (from previous session).
     */
    _loadPendingFlowers() {
        try {
            if (fs.existsSync(ERROR_FLOWERS_PATH)) {
                const data = JSON.parse(fs.readFileSync(ERROR_FLOWERS_PATH, "utf8"));
                if (Array.isArray(data) && data.length > 0) {
                    console.log(`  🔗 ErrorPipeline: loading ${data.length} saved error flowers from disk`);
                    for (const err of data) {
                        this._injectToSwarm(err);
                    }
                    // Clear the file after loading
                    fs.writeFileSync(ERROR_FLOWERS_PATH, "[]");
                }
            }
        } catch { /* non-critical */ }
    }

    /**
     * Read the error ledger for the API.
     */
    readLedger(limit = 50) {
        try {
            if (!fs.existsSync(LEDGER_PATH)) return [];
            const lines = fs.readFileSync(LEDGER_PATH, "utf8").trim().split("\n").filter(Boolean);
            return lines.slice(-limit).map(line => {
                try { return JSON.parse(line); }
                catch { return null; }
            }).filter(Boolean);
        } catch { return []; }
    }

    /**
     * Flush — write all pending state to disk. Called during graceful shutdown.
     */
    flush() {
        this._savePendingFlowers();
        this._stats.flushed++;
        console.log(`  🔗 ErrorPipeline: flushed (${this._stats.captured} captured, ${this._stats.injected} injected, ${this._stats.deduplicated} deduped)`);
    }

    /**
     * Stats for monitoring.
     */
    stats() {
        return {
            ...this._stats,
            pendingCount: this._pending.length,
            fingerprintCacheSize: this._fingerprints.size,
            swarmConnected: !!this.swarm,
        };
    }
}

// Singleton
const bridge = new ErrorPipelineBridge();
module.exports = bridge;
module.exports.ErrorPipelineBridge = ErrorPipelineBridge;
