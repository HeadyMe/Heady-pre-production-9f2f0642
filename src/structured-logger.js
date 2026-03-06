/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
/**
 * ═══ Structured Logger — SPEC-5 ═══
 * JSON logging with request IDs, secret redaction, child loggers, Express middleware.
 */
const crypto = require("crypto");

const REDACT_RE = [
    /(?:api[_-]?key|secret|token|password|credential|auth)["\s:=]+["']?([a-zA-Z0-9_\-./+=]{8,})/gi,
    /Bearer\s+[a-zA-Z0-9_\-./+=]{20,}/gi,
    /(?:sk|pk|pat|ghp|glpat|xox[bsap])-[a-zA-Z0-9_\-]{10,}/gi,
    /eyJ[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}\.[a-zA-Z0-9_\-]{10,}/g,
];
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };

class StructuredLogger {
    constructor(o = {}) {
        this.name = o.name || "heady";
        this.level = LEVELS[o.level || process.env.LOG_LEVEL || "info"] || 20;
        this.ctx = o.context || {};
        this.redact = o.redaction !== false && process.env.LOG_REDACTION !== "false";
        this.out = o.output || process.stdout;
        this.requestId = o.requestId || null;
    }
    debug(m, d) { this._log("debug", m, d); }
    info(m, d) { this._log("info", m, d); }
    warn(m, d) { this._log("warn", m, d); }
    error(m, d) { this._log("error", m, d); }
    fatal(m, d) { this._log("fatal", m, d); if (d) process.exitCode = 1; }

    _log(lvl, msg, data) {
        if (LEVELS[lvl] < this.level) return;
        const e = { ts: new Date().toISOString(), level: lvl, logger: this.name, msg, ...this.ctx };
        if (this.requestId) e.requestId = this.requestId;
        if (data) e.data = data;
        let line = JSON.stringify(e);
        if (this.redact) for (const p of REDACT_RE) { p.lastIndex = 0; line = line.replace(p, "***REDACTED***"); }
        this.out.write(line + "\n");
    }

    child(ctx = {}) {
        return new StructuredLogger({ name: this.name, level: Object.keys(LEVELS).find(k => LEVELS[k] === this.level), context: { ...this.ctx, ...ctx }, redaction: this.redact, output: this.out, requestId: ctx.requestId || this.requestId });
    }

    middleware() {
        return (req, res, next) => {
            const rid = req.headers["x-request-id"] || crypto.randomUUID();
            req.requestId = rid;
            res.setHeader("X-Request-Id", rid);
            req.log = this.child({ requestId: rid, method: req.method, path: req.path });
            const start = Date.now();
            req.log.info("request_start");
            res.on("finish", () => req.log.info("request_end", { statusCode: res.statusCode, durationMs: Date.now() - start }));
            next();
        };
    }

    status() { return { name: this.name, level: Object.keys(LEVELS).find(k => LEVELS[k] === this.level), redact: this.redact }; }
}
StructuredLogger.LEVELS = LEVELS;
module.exports = StructuredLogger;
