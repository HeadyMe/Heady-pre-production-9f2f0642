/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 *
 * Comprehensive Telemetry — Full Audit Trail + Optimization Engine
 *
 * Captures EVERYTHING:
 *   - User interactions (tool calls, arguments, results, timing)
 *   - Project state (files modified, git status, branch)
 *   - Environmental data (system metrics, memory, CPU, network)
 *   - Session context (active documents, browser state, terminals)
 *   - Temporal patterns (time-of-day, frequency, duration)
 *
 * All data:
 *   1. Logged to disk as append-only JSONL (audit trail)
 *   2. Embedded into 3D vector space (semantic search)
 *   3. Analyzed for optimization opportunities
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, '..', '..', 'data', 'telemetry');
const AUDIT_FILE = path.join(LOG_DIR, 'audit-trail.jsonl');
const METRICS_FILE = path.join(LOG_DIR, 'system-metrics.jsonl');
const OPTIMIZATION_FILE = path.join(LOG_DIR, 'optimizations.jsonl');

// Ensure log directory exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch { }

class HeadyTelemetry {
    constructor(vectorStore, learner) {
        this.vectorStore = vectorStore;
        this.learner = learner;
        this.sessionId = crypto.randomBytes(8).toString('hex');
        this.sessionStart = Date.now();
        this.toolCalls = [];
        this.errors = [];
        this.optimizations = [];
        this._metricsInterval = null;

        // Start background environmental monitoring
        this._startEnvironmentalCapture();
    }

    // ── AUDIT TRAIL ─────────────────────────────────────────────

    /**
     * Log a tool call with full context — the core audit entry.
     */
    logToolCall(toolName, args, result, durationMs, context = {}) {
        const entry = {
            type: 'tool_call',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            epochMs: Date.now(),
            tool: toolName,
            args: this._sanitize(args),
            resultSize: JSON.stringify(result).length,
            resultPreview: this._preview(result),
            durationMs,
            success: !result?.isError,
            // Environmental snapshot at call time
            env: this._captureEnvSnapshot(),
            // User context
            context: {
                sessionUptime: Date.now() - this.sessionStart,
                callIndex: this.toolCalls.length,
                ...context,
            },
        };

        this.toolCalls.push(entry);
        this._appendLog(AUDIT_FILE, entry);

        // Embed in vector space for semantic recall
        if (this.learner) {
            this.learner.learn(
                `Tool: ${toolName} | Duration: ${durationMs}ms | Args: ${JSON.stringify(args).substring(0, 200)}`,
                'interaction',
                { toolName, durationMs, success: entry.success }
            );
        }

        // Check for optimization opportunities
        this._checkOptimizations(entry);

        return entry;
    }

    /**
     * Log an error with full stack trace.
     */
    logError(source, error, context = {}) {
        const entry = {
            type: 'error',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            source,
            message: error.message || String(error),
            stack: error.stack,
            env: this._captureEnvSnapshot(),
            context,
        };

        this.errors.push(entry);
        this._appendLog(AUDIT_FILE, entry);

        if (this.learner) {
            this.learner.learn(`Error in ${source}: ${entry.message}`, 'pattern', { errorSource: source });
        }
    }

    /**
     * Log a user directive or preference change.
     */
    logDirective(directive, source = 'user') {
        const entry = {
            type: 'directive',
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            directive,
            source,
            env: this._captureEnvSnapshot(),
        };
        this._appendLog(AUDIT_FILE, entry);
    }

    // ── ENVIRONMENTAL CAPTURE ───────────────────────────────────

    /**
     * Capture a snapshot of environmental data.
     */
    _captureEnvSnapshot() {
        const mem = process.memoryUsage();
        return {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 100) / 100,
            rssMB: Math.round(mem.rss / 1024 / 1024 * 100) / 100,
            uptimeS: Math.round(process.uptime()),
            cpuUser: process.cpuUsage().user,
            cpuSystem: process.cpuUsage().system,
            loadAvg: os.loadavg(),
            freeMemGB: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100,
            totalMemGB: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100,
            platform: os.platform(),
            nodeVersion: process.version,
            vectorCount: this.vectorStore?.vectors?.length || 0,
        };
    }

    /**
     * Start periodic environmental metric capture (every 30s).
     */
    _startEnvironmentalCapture() {
        this._metricsInterval = setInterval(() => {
            const snapshot = {
                type: 'env_metrics',
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                ...this._captureEnvSnapshot(),
                toolCallsSinceLastCapture: this.toolCalls.length,
                errorsSinceLastCapture: this.errors.length,
            };
            this._appendLog(METRICS_FILE, snapshot);
        }, 30000); // Every 30 seconds

        // Don't block process exit
        if (this._metricsInterval.unref) this._metricsInterval.unref();
    }

    // ── OPTIMIZATION ENGINE ─────────────────────────────────────

    /**
     * Analyze tool calls for optimization opportunities.
     */
    _checkOptimizations(entry) {
        // Pattern: repeated identical tool calls → cache opportunity
        const recentSame = this.toolCalls
            .slice(-20)
            .filter(t => t.tool === entry.tool && JSON.stringify(t.args) === JSON.stringify(entry.args));

        if (recentSame.length >= 3) {
            this._recordOptimization({
                type: 'cache_opportunity',
                tool: entry.tool,
                reason: `Tool '${entry.tool}' called ${recentSame.length}x with identical args — cache result`,
                impact: 'high',
                avgDuration: Math.round(recentSame.reduce((s, t) => s + t.durationMs, 0) / recentSame.length),
            });
        }

        // Pattern: slow tool calls → performance optimization
        if (entry.durationMs > 5000) {
            this._recordOptimization({
                type: 'slow_tool',
                tool: entry.tool,
                reason: `Tool '${entry.tool}' took ${entry.durationMs}ms — optimize or parallelize`,
                impact: entry.durationMs > 10000 ? 'critical' : 'medium',
                durationMs: entry.durationMs,
            });
        }

        // Pattern: high error rate → reliability issue
        const recentErrors = this.toolCalls.slice(-10).filter(t => !t.success);
        if (recentErrors.length >= 3) {
            this._recordOptimization({
                type: 'reliability_issue',
                tool: entry.tool,
                reason: `${recentErrors.length}/10 recent tool calls failed — investigate reliability`,
                impact: 'critical',
                failedTools: recentErrors.map(t => t.tool),
            });
        }

        // Pattern: memory growth → leak detection
        if (entry.env.heapUsedMB > 500) {
            this._recordOptimization({
                type: 'memory_warning',
                reason: `Heap at ${entry.env.heapUsedMB}MB — potential memory pressure`,
                impact: 'high',
                heapMB: entry.env.heapUsedMB,
            });
        }
    }

    _recordOptimization(opt) {
        opt.timestamp = new Date().toISOString();
        opt.sessionId = this.sessionId;
        this.optimizations.push(opt);
        this._appendLog(OPTIMIZATION_FILE, opt);

        if (this.learner) {
            this.learner.learn(`Optimization: ${opt.type} — ${opt.reason}`, 'pattern', { optimizationType: opt.type });
        }
    }

    // ── STATS & REPORTING ───────────────────────────────────────

    /**
     * Get comprehensive telemetry stats.
     */
    getStats() {
        const totalDuration = this.toolCalls.reduce((s, t) => s + t.durationMs, 0);
        const avgDuration = this.toolCalls.length ? Math.round(totalDuration / this.toolCalls.length) : 0;

        // Tool frequency map
        const toolFreq = {};
        for (const t of this.toolCalls) {
            toolFreq[t.tool] = (toolFreq[t.tool] || 0) + 1;
        }

        // Sort by frequency
        const topTools = Object.entries(toolFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tool, count]) => ({ tool, count }));

        return {
            session: {
                id: this.sessionId,
                startedAt: new Date(this.sessionStart).toISOString(),
                uptimeS: Math.round((Date.now() - this.sessionStart) / 1000),
            },
            toolCalls: {
                total: this.toolCalls.length,
                successful: this.toolCalls.filter(t => t.success).length,
                failed: this.toolCalls.filter(t => !t.success).length,
                totalDurationMs: totalDuration,
                avgDurationMs: avgDuration,
                topTools,
            },
            errors: {
                total: this.errors.length,
                recent: this.errors.slice(-3).map(e => ({
                    source: e.source,
                    message: e.message.substring(0, 100),
                    at: e.timestamp,
                })),
            },
            optimizations: {
                total: this.optimizations.length,
                active: this.optimizations.slice(-5).map(o => ({
                    type: o.type,
                    reason: o.reason.substring(0, 100),
                    impact: o.impact,
                })),
            },
            environment: this._captureEnvSnapshot(),
            auditTrail: {
                file: AUDIT_FILE,
                metricsFile: METRICS_FILE,
                optimizationsFile: OPTIMIZATION_FILE,
            },
        };
    }

    // ── UTILITIES ────────────────────────────────────────────────

    _sanitize(obj) {
        // Remove sensitive keys from audit log
        const sensitive = ['apiKey', 'api_key', 'token', 'password', 'secret'];
        const str = JSON.stringify(obj);
        let sanitized = str;
        for (const key of sensitive) {
            const regex = new RegExp(`"${key}"\\s*:\\s*"[^"]*"`, 'gi');
            sanitized = sanitized.replace(regex, `"${key}":"[REDACTED]"`);
        }
        try { return JSON.parse(sanitized); } catch { return obj; }
    }

    _preview(result) {
        try {
            const text = result?.content?.[0]?.text || JSON.stringify(result);
            return text.substring(0, 200);
        } catch { return '[unparseable]'; }
    }

    _appendLog(file, entry) {
        try {
            fs.appendFileSync(file, JSON.stringify(entry) + '\n');
        } catch { /* non-fatal */ }
    }

    destroy() {
        if (this._metricsInterval) clearInterval(this._metricsInterval);
    }
}

module.exports = { HeadyTelemetry };
