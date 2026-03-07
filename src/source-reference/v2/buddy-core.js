/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * BUDDY-CORE — The Central Intelligence Node
 * ═══════════════════════════════════════════════════════════════
 *
 * Buddy is the sovereign orchestrator of the Sacred Geometry network.
 * It sits at the nexus of HeadyConductor + HCFullPipeline with:
 *   1. Unique cryptographic agent identity
 *   2. MCP dual-role (Client for vector DB, Server for sub-agent directives)
 *   3. Metacognitive self-awareness (queries own error history before decisions)
 *   4. Redis state-locking for task collision prevention
 *   5. Watchdog integration for self-healing
 *
 * Buddy is NOT a load balancer. It is the Human Composer & AI Orchestra
 * metaphor made manifest — coordinating specialized instruments into
 * singular, coherent output.
 * ═══════════════════════════════════════════════════════════════
 */

"use strict";

const crypto = require("crypto");
const EventEmitter = require("events");
const path = require("path");
const fs = require("fs");
const { getErrorSummary, trackError, safeOp } = require("../config/errors");
const logger = require("../utils/logger");

// ─── Constants ──────────────────────────────────────────────────────
const PHI = 1.6180339887;
const BUDDY_VERSION = "1.0.0";
const AUDIT_DIR = path.join(__dirname, "..", "..", "data");
const BUDDY_STATE_PATH = path.join(AUDIT_DIR, "buddy-state.json");
const BUDDY_AUDIT_PATH = path.join(AUDIT_DIR, "buddy-audit.jsonl");


function clampMidiValue(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(127, Math.round(numeric)));
}

function clampMidiChannel(channel) {
    const numeric = Number(channel);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(15, Math.floor(numeric)));
}

// ─── Buddy Identity ────────────────────────────────────────────────
function generateBuddyId() {
    const seed = `buddy-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    return {
        id: crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24),
        fingerprint: crypto.createHash("sha256").update(seed + "-fp").digest("hex").slice(0, 12),
        createdAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// METACOGNITION ENGINE — Query own error history before high-stakes ops
// ═══════════════════════════════════════════════════════════════════════
class MetacognitionEngine {
    constructor() {
        this.decisionLog = [];
        this.MAX_LOG = 200;
    }

    /**
     * Before a high-stakes decision, assess the system's recent health.
     * Returns a confidence modifier (0.0 - 1.0) and context string for LLM injection.
     */
    assessConfidence() {
        const errorSummary = getErrorSummary();
        const totalErrors = errorSummary.totalErrors || 0;
        const totalContexts = errorSummary.totalContexts || 0;

        // Base confidence starts at 1.0 and degrades with errors
        let confidence = 1.0;
        if (totalErrors > 0) confidence -= Math.min(0.3, totalErrors * 0.01);
        if (totalContexts > 5) confidence -= Math.min(0.2, totalContexts * 0.02);

        // Build context string for LLM injection
        const topErrors = errorSummary.top?.slice(0, 5) || [];
        let contextStr = `[Buddy Metacognition — System Health Assessment]\n`;
        contextStr += `Confidence: ${(confidence * 100).toFixed(1)}%\n`;
        contextStr += `Active error contexts: ${totalContexts}\n`;
        contextStr += `Total error occurrences: ${totalErrors}\n`;

        if (topErrors.length > 0) {
            contextStr += `Top error sources:\n`;
            for (const e of topErrors) {
                contextStr += `  - ${e.context}: ${e.count} occurrences\n`;
            }
            contextStr += `Strategy adjustment: Prefer cached/known-good paths. Avoid retry-heavy operations.\n`;
        } else {
            contextStr += `No active errors. Full confidence in all execution paths.\n`;
        }
        contextStr += `[End Metacognition]\n`;

        return { confidence, contextStr, totalErrors, totalContexts, topErrors };
    }

    /**
     * Log a decision with its metacognitive context.
     */
    logDecision(decision) {
        this.decisionLog.push({
            ...decision,
            ts: new Date().toISOString(),
        });
        if (this.decisionLog.length > this.MAX_LOG) {
            this.decisionLog = this.decisionLog.slice(-Math.round(this.MAX_LOG * 0.75));
        }
    }

    getRecentDecisions(limit = 20) {
        return this.decisionLog.slice(-limit);
    }
}

// ═══════════════════════════════════════════════════════════════════════
// DETERMINISTIC ERROR INTERCEPTOR — 5-Phase Optimization Loop
// ═══════════════════════════════════════════════════════════════════════
/**
 * Implements the Buddy Deterministic Optimization Protocol from AGENTS.md.
 * When an anomaly is detected, executes the 5-phase loop:
 *   Phase 1: Error Detection & Probabilistic Halt
 *   Phase 2: Deterministic State Extraction
 *   Phase 3: Semantic Equivalence Analysis
 *   Phase 4: Root-Cause Derivation via Constraint Analysis
 *   Phase 5: Upstream Rule Synthesis & Baseline Update
 */
class DeterministicErrorInterceptor {
    constructor() {
        this.interceptLog = [];
        this.MAX_LOG = 500;
        this.learnedRules = [];
        this._vectorMemory = null;
        this._loadLearnedRules();
    }

    setVectorMemory(vm) {
        this._vectorMemory = vm;
    }

    /**
     * Phase 1: Error Detection & Probabilistic Halt
     * Intercepts the error and freezes execution state.
     * Returns a structured interception record.
     */
    _phase1_halt(error, context = {}) {
        const interception = {
            id: `INT_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
            phase: 1,
            action: "PROBABILISTIC_HALT",
            error: {
                message: error.message || String(error),
                stack: error.stack?.split("\n").slice(0, 10) || [],
                name: error.name || "UnknownError",
                code: error.code || null,
            },
            context: {
                source: context.source || "unknown",
                stage: context.stage || null,
                runId: context.runId || null,
                agentId: context.agentId || null,
            },
            ts: new Date().toISOString(),
            halted: true,
        };

        logger.logError("BUDDY:INTERCEPTOR", `Phase 1: HALT — ${interception.error.message}`, error);
        return interception;
    }

    /**
     * Phase 2: Deterministic State Extraction
     * Captures the pure computational state at the point of failure.
     */
    _phase2_extractState(interception) {
        const stateSnapshot = {
            phase: 2,
            action: "STATE_EXTRACTION",
            system: {
                nodeVersion: process.version,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                pid: process.pid,
                platform: process.platform,
                arch: process.arch,
            },
            errorSummary: getErrorSummary(),
            environment: {
                NODE_ENV: process.env.NODE_ENV || "development",
                hasRedis: !!process.env.REDIS_URL,
                hasHF: !!process.env.HF_TOKEN,
                hasOpenAI: !!process.env.OPENAI_API_KEY,
            },
            callStack: interception.error.stack,
            ts: new Date().toISOString(),
        };

        // Load active AGENTS.md rules count
        try {
            const agentsMd = fs.readFileSync(path.join(__dirname, "..", "..", "AGENTS.md"), "utf-8");
            stateSnapshot.activeRulesCount = (agentsMd.match(/^### LR-/gm) || []).length;
        } catch { stateSnapshot.activeRulesCount = 0; }

        interception.stateSnapshot = stateSnapshot;
        logger.logSystem(`Phase 2: STATE_EXTRACTION — ${stateSnapshot.errorSummary.totalErrors} total errors tracked, ${stateSnapshot.activeRulesCount} learned rules`);
        return interception;
    }

    /**
     * Phase 3: Semantic Equivalence Analysis
     * Checks if this error matches a previously resolved pattern.
     */
    async _phase3_semanticAnalysis(interception) {
        interception.phase3 = {
            phase: 3,
            action: "SEMANTIC_EQUIVALENCE",
            matchFound: false,
            matchedRule: null,
            confidence: 0,
        };

        // Search vector memory for similar past errors
        if (this._vectorMemory) {
            try {
                const query = `error: ${interception.error.message} source: ${interception.context.source}`;
                const results = await this._vectorMemory.queryMemory(query, 3, { type: "error_resolution" });
                if (results.length > 0 && results[0].score > 0.75) {
                    interception.phase3.matchFound = true;
                    interception.phase3.matchedResolution = results[0];
                    interception.phase3.confidence = results[0].score;
                    logger.logSystem(`Phase 3: MATCH FOUND — similar error resolved previously (score: ${results[0].score.toFixed(3)})`);
                } else {
                    logger.logSystem(`Phase 3: NO MATCH — novel error class (best score: ${results[0]?.score?.toFixed(3) || 0})`);
                }
            } catch (err) {
                logger.logError("BUDDY:INTERCEPTOR", "Phase 3: vector memory query failed", err);
            }
        }

        // Check learned rules for exact match
        const errorKey = `${interception.error.name}:${interception.context.source}`;
        const matchedRule = this.learnedRules.find(r => r.errorKey === errorKey);
        if (matchedRule) {
            interception.phase3.matchFound = true;
            interception.phase3.matchedRule = matchedRule;
            interception.phase3.confidence = 1.0;
            logger.logSystem(`Phase 3: EXACT RULE MATCH — ${matchedRule.id}`);
        }

        return interception;
    }

    /**
     * Phase 4: Root-Cause Derivation
     * Traces the control flow to identify the specific constraint violation.
     */
    _phase4_rootCause(interception) {
        const rootCause = {
            phase: 4,
            action: "ROOT_CAUSE_DERIVATION",
            errorClass: interception.error.name,
            errorKey: `${interception.error.name}:${interception.context.source}`,
            failedModule: null,
            failedFunction: null,
            constraintViolation: null,
        };

        // Parse stack trace to extract module and function
        const stack = interception.error.stack || [];
        if (stack.length > 1) {
            const callerLine = stack[1] || "";
            const moduleMatch = callerLine.match(/at\s+(?:(\S+)\s+)?\(?([^:)]+):(\d+)/);
            if (moduleMatch) {
                rootCause.failedFunction = moduleMatch[1] || "anonymous";
                rootCause.failedModule = moduleMatch[2] ? path.basename(moduleMatch[2]) : "unknown";
                rootCause.failedLine = parseInt(moduleMatch[3], 10) || null;
            }
        }

        // Classify the constraint violation type
        const msg = interception.error.message.toLowerCase();
        if (msg.includes("timeout") || msg.includes("timed out")) {
            rootCause.constraintViolation = "TIMEOUT_EXCEEDED";
        } else if (msg.includes("econnrefused") || msg.includes("enotfound")) {
            rootCause.constraintViolation = "CONNECTION_FAILED";
        } else if (msg.includes("unauthorized") || msg.includes("forbidden")) {
            rootCause.constraintViolation = "AUTH_VIOLATION";
        } else if (msg.includes("not found") || msg.includes("cannot find")) {
            rootCause.constraintViolation = "RESOURCE_MISSING";
        } else if (msg.includes("budget") || msg.includes("rate limit") || msg.includes("quota")) {
            rootCause.constraintViolation = "BUDGET_EXCEEDED";
        } else if (msg.includes("validation") || msg.includes("invalid") || msg.includes("schema")) {
            rootCause.constraintViolation = "VALIDATION_FAILED";
        } else {
            rootCause.constraintViolation = "LOGIC_DIVERGENCE";
        }

        interception.rootCause = rootCause;
        logger.logSystem(`Phase 4: ROOT_CAUSE — ${rootCause.constraintViolation} in ${rootCause.failedModule || "unknown"}:${rootCause.failedFunction || "?"} (key: ${rootCause.errorKey})`);
        return interception;
    }

    /**
     * Phase 5: Upstream Rule Synthesis
     * Persists the resolution and permanently immunizes against recurrence.
     */
    async _phase5_synthesizeRule(interception, resolution = null) {
        const rule = {
            id: `LR-AUTO-${Date.now()}`,
            errorKey: interception.rootCause.errorKey,
            constraintViolation: interception.rootCause.constraintViolation,
            failedModule: interception.rootCause.failedModule,
            errorMessage: interception.error.message,
            resolution: resolution || "Auto-detected; monitoring for recurrence",
            synthesizedAt: new Date().toISOString(),
            occurrences: 1,
        };

        // Deduplicate — if rule already exists for this errorKey, increment count
        const existing = this.learnedRules.find(r => r.errorKey === rule.errorKey);
        if (existing) {
            existing.occurrences++;
            existing.lastSeen = rule.synthesizedAt;
            logger.logSystem(`Phase 5: RULE UPDATE — ${existing.id} now at ${existing.occurrences} occurrences`);
        } else {
            this.learnedRules.push(rule);
            logger.logSystem(`Phase 5: NEW RULE SYNTHESIZED — ${rule.id}: ${rule.constraintViolation} in ${rule.failedModule}`);
        }

        // Persist to vector memory for semantic retrieval
        if (this._vectorMemory) {
            try {
                await this._vectorMemory.ingestMemory({
                    content: `Error resolution: ${rule.errorMessage} → ${rule.resolution}. Constraint: ${rule.constraintViolation}. Module: ${rule.failedModule}.`,
                    metadata: {
                        type: "error_resolution",
                        ruleId: rule.id,
                        errorKey: rule.errorKey,
                        constraintViolation: rule.constraintViolation,
                    },
                });
            } catch (err) {
                logger.logError("BUDDY:INTERCEPTOR", "Phase 5: vector memory ingest failed", err);
            }
        }

        // Persist learned rules to disk
        this._persistLearnedRules();

        interception.synthesizedRule = existing || rule;
        interception.phase = 5;
        interception.completed = true;
        return interception;
    }

    /**
     * Execute the full 5-phase interception loop.
     * @param {Error} error - The caught error
     * @param {Object} context - { source, stage, runId, agentId }
     * @param {string} resolution - Optional resolution description
     * @returns {Object} Complete interception record
     */
    async intercept(error, context = {}, resolution = null) {
        let interception = this._phase1_halt(error, context);
        interception = this._phase2_extractState(interception);
        interception = await this._phase3_semanticAnalysis(interception);
        interception = this._phase4_rootCause(interception);
        interception = await this._phase5_synthesizeRule(interception, resolution);

        // Log to interception history
        this.interceptLog.push({
            id: interception.id,
            errorKey: interception.rootCause.errorKey,
            constraintViolation: interception.rootCause.constraintViolation,
            matchFound: interception.phase3.matchFound,
            ruleId: interception.synthesizedRule?.id,
            ts: interception.ts,
        });
        if (this.interceptLog.length > this.MAX_LOG) {
            this.interceptLog = this.interceptLog.slice(-Math.round(this.MAX_LOG * 0.75));
        }

        return interception;
    }

    /**
     * Check if an error has a known resolution before executing.
     * Returns the resolution if found, null otherwise.
     */
    checkPreemptive(errorKey) {
        return this.learnedRules.find(r => r.errorKey === errorKey) || null;
    }

    getStats() {
        return {
            totalInterceptions: this.interceptLog.length,
            learnedRules: this.learnedRules.length,
            recentInterceptions: this.interceptLog.slice(-10),
            topConstraintViolations: this._getTopViolations(),
        };
    }

    _getTopViolations() {
        const counts = {};
        this.interceptLog.forEach(i => {
            counts[i.constraintViolation] = (counts[i.constraintViolation] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => ({ type, count }));
    }

    _loadLearnedRules() {
        try {
            const rulesPath = path.join(__dirname, "..", "..", "data", "buddy-learned-rules.json");
            if (fs.existsSync(rulesPath)) {
                this.learnedRules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
            }
        } catch { /* no persisted rules yet */ }
    }

    _persistLearnedRules() {
        safeOp("buddy:persist-rules", () => {
            const rulesPath = path.join(__dirname, "..", "..", "data", "buddy-learned-rules.json");
            fs.writeFileSync(rulesPath, JSON.stringify(this.learnedRules, null, 2));
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════
// REDIS TASK LOCK MANAGER — Prevents task collision in the swarm
// ═══════════════════════════════════════════════════════════════════════
class TaskLockManager {
    constructor() {
        this._locks = new Map(); // In-memory fallback when Redis unavailable
        this._redisClient = null;
        this.stats = { acquired: 0, released: 0, collisions: 0, expired: 0 };
    }

    /**
     * Wire Redis client for distributed locking.
     */
    setRedisClient(client) {
        this._redisClient = client;
        logger.logSystem("  🔒 [Buddy] Redis task-lock manager wired.");
    }

    /**
     * Acquire a task lock. Returns true if lock acquired, false if collision.
     * @param {string} agentId - The agent requesting the lock
     * @param {string} taskId - The task to lock
     * @param {number} ttlMs - Lock TTL in ms (default: 30s)
     */
    async acquire(agentId, taskId, ttlMs = 30000) {
        const lockKey = `task:status:${taskId}`;
        const lockValue = JSON.stringify({
            agentId,
            status: "IN_PROGRESS",
            lockedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        });

        // Try Redis first
        if (this._redisClient) {
            try {
                const result = await this._redisClient.set(lockKey, lockValue, "NX", "PX", ttlMs);
                if (result === "OK") {
                    this.stats.acquired++;
                    return true;
                }
                this.stats.collisions++;
                return false;
            } catch (err) {
                trackError("buddy:redis-lock", err);
                // Fall through to in-memory
            }
        }

        // In-memory fallback
        const existing = this._locks.get(lockKey);
        if (existing && existing.expiresAt > Date.now()) {
            this.stats.collisions++;
            return false;
        }

        this._locks.set(lockKey, {
            agentId,
            status: "IN_PROGRESS",
            lockedAt: Date.now(),
            expiresAt: Date.now() + ttlMs,
        });
        this.stats.acquired++;

        // Auto-expire
        setTimeout(() => {
            const current = this._locks.get(lockKey);
            if (current && current.agentId === agentId) {
                this._locks.delete(lockKey);
                this.stats.expired++;
            }
        }, ttlMs);

        return true;
    }

    /**
     * Release a task lock.
     */
    async release(agentId, taskId) {
        const lockKey = `task:status:${taskId}`;

        if (this._redisClient) {
            try {
                const current = await this._redisClient.get(lockKey);
                if (current) {
                    const parsed = JSON.parse(current);
                    if (parsed.agentId === agentId) {
                        await this._redisClient.del(lockKey);
                        this.stats.released++;
                        return true;
                    }
                }
                return false;
            } catch (err) {
                trackError("buddy:redis-unlock", err);
            }
        }

        // In-memory fallback
        const existing = this._locks.get(lockKey);
        if (existing && existing.agentId === agentId) {
            this._locks.delete(lockKey);
            this.stats.released++;
            return true;
        }
        return false;
    }

    /**
     * Get all active locks — the swarm activity map.
     */
    getActiveLocks() {
        const now = Date.now();
        const active = [];
        for (const [key, lock] of this._locks.entries()) {
            if (lock.expiresAt > now) {
                active.push({ key, ...lock, remainingMs: lock.expiresAt - now });
            }
        }
        return active;
    }

    getStats() {
        return { ...this.stats, activeLocks: this._locks.size };
    }
}

// ═══════════════════════════════════════════════════════════════════════
// MCP TOOL REGISTRY — Encapsulation of peripheral capabilities
// ═══════════════════════════════════════════════════════════════════════
class MCPToolRegistry {
    constructor() {
        this.tools = new Map();
        this._registerBuiltinTools();
    }

    _registerBuiltinTools() {
        // MIDI tools
        this.register("midi_send", {
            description: "Send MIDI message to configured output port",
            category: "audio",
            inputSchema: { type: "object", properties: { channel: { type: "number" }, note: { type: "number" }, velocity: { type: "number" } } },
            handler: async (input) => {
                try {
                    const bridge = require("../services/daw-mcp-bridge");
                    return await bridge.sendNote(input.channel, input.note, input.velocity);
                } catch (err) {
                    trackError("mcp:midi_send", err);
                    return { ok: false, error: err.message };
                }
            },
        });

        // Email tools
        this.register("email_fetch", {
            description: "Fetch recent emails from configured IMAP source",
            category: "communication",
            inputSchema: { type: "object", properties: { limit: { type: "number", default: 10 }, folder: { type: "string", default: "INBOX" } } },
            handler: async (input) => {
                try {
                    const emailService = require("../services/heady-email");
                    return await emailService.fetchRecent(input.limit || 10, input.folder || "INBOX");
                } catch (err) {
                    trackError("mcp:email_fetch", err);
                    return { ok: false, error: err.message };
                }
            },
        });

        // Image tools
        this.register("image_analyze", {
            description: "Analyze image dimensions and metadata",
            category: "vision",
            inputSchema: { type: "object", properties: { path: { type: "string" } } },
            handler: async (input) => {
                try {
                    const imageSize = require("image-size");
                    const dims = imageSize(input.path);
                    return { ok: true, width: dims.width, height: dims.height, type: dims.type };
                } catch (err) {
                    trackError("mcp:image_analyze", err);
                    return { ok: false, error: err.message };
                }
            },
        });

        // Vector memory tools
        this.register("memory_search", {
            description: "Search vector memory for semantically relevant context",
            category: "memory",
            inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } } },
            handler: async (input) => {
                try {
                    const vectorMem = require("../vector-memory");
                    const results = await vectorMem.queryMemory(input.query, input.limit || 5);
                    return { ok: true, results, count: results.length };
                } catch (err) {
                    trackError("mcp:memory_search", err);
                    return { ok: false, error: err.message };
                }
            },
        });

        // System health tools
        this.register("system_health", {
            description: "Get comprehensive system health including error summary",
            category: "ops",
            inputSchema: { type: "object", properties: {} },
            handler: async () => {
                const errorSummary = getErrorSummary();
                return {
                    ok: true,
                    errors: errorSummary,
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    ts: new Date().toISOString(),
                };
            },
        });
    }

    register(name, tool) {
        this.tools.set(name, {
            name,
            description: tool.description,
            category: tool.category || "general",
            inputSchema: tool.inputSchema || {},
            handler: tool.handler,
            registeredAt: new Date().toISOString(),
        });
    }

    async invoke(name, input = {}) {
        const tool = this.tools.get(name);
        if (!tool) {
            return { ok: false, error: `Unknown MCP tool: ${name}` };
        }
        try {
            return await tool.handler(input);
        } catch (err) {
            trackError(`mcp:invoke:${name}`, err);
            return { ok: false, error: err.message };
        }
    }

    listTools() {
        const list = [];
        for (const [name, tool] of this.tools) {
            list.push({
                name,
                description: tool.description,
                category: tool.category,
                inputSchema: tool.inputSchema,
            });
        }
        return list;
    }
}

// ═══════════════════════════════════════════════════════════════════════
// BUDDY CORE — The Sovereign Orchestrator
// ═══════════════════════════════════════════════════════════════════════
class BuddyCore extends EventEmitter {
    constructor(opts = {}) {
        super();

        // Cryptographic identity
        this.identity = generateBuddyId();
        this.version = BUDDY_VERSION;

        // Subsystems
        this.metacognition = new MetacognitionEngine();
        this.taskLocks = new TaskLockManager();
        this.mcpTools = new MCPToolRegistry();
        this.errorInterceptor = new DeterministicErrorInterceptor();

        // Wire conductor
        this._conductor = null;
        this._pipeline = null;
        this._realtimeEngine = null;

        // State
        this.started = Date.now();
        this.decisionCount = 0;
        this.status = "initializing";

        // Ensure data dir
        safeOp("buddy:init-dir", () => {
            if (!fs.existsSync(AUDIT_DIR)) fs.mkdirSync(AUDIT_DIR, { recursive: true });
        });

        logger.logSystem(`  🎼 [Buddy] Core initialized — ID: ${this.identity.id}`);
        logger.logSystem(`  🎼 [Buddy] Fingerprint: ${this.identity.fingerprint} | Version: ${this.version}`);
    }

    // ─── Wiring ────────────────────────────────────────────────────
    setConductor(conductor) {
        this._conductor = conductor;
        logger.logSystem("  🎼 [Buddy] Conductor wired — Sacred Geometry routing active.");
    }

    setPipeline(pipeline) {
        this._pipeline = pipeline;
        logger.logSystem("  🎼 [Buddy] HCFullPipeline wired — end-to-end orchestration active.");
    }

    setVectorMemory(vectorMemory) {
        this.errorInterceptor.setVectorMemory(vectorMemory);
        logger.logSystem("  🎼 [Buddy] Vector memory wired for error interceptor.");
    }

    setRedis(redisClient) {
        this.taskLocks.setRedisClient(redisClient);
    }

    setRealtimeEngine(realtimeEngine) {
        this._realtimeEngine = realtimeEngine;
        logger.logSystem("  🎼 [Buddy] Realtime engine wired — live orchestration active.");
    }

    // ─── Core Decision Engine ──────────────────────────────────────
    /**
     * Make a decision with metacognitive awareness.
     * This is the primary entry point for all Buddy-routed operations.
     *
     * @param {Object} task - { action, payload, agentId, priority }
     * @returns {Object} - Decision result with metacognitive context
     */
    async decide(task) {
        if (!task || !task.action) {
            return { ok: false, error: "task.action is required", buddyId: this.identity.id };
        }
        const start = Date.now();
        this.decisionCount++;

        // 1. Metacognitive assessment — am I healthy enough to make this decision?
        const meta = this.metacognition.assessConfidence();

        // 2. If confidence is critically low, flag the decision
        if (meta.confidence < 0.5) {
            logger.logError("BUDDY", `Low confidence (${(meta.confidence * 100).toFixed(1)}%) for task: ${task.action}`, new Error("low_confidence"));
            this.emit("low-confidence", { task, confidence: meta.confidence, errors: meta.topErrors });
        }

        // 3. Acquire task lock (prevent collision)
        const agentId = task.agentId || this.identity.id;
        const taskId = task.taskId || `${task.action}-${Date.now()}`;
        const lockAcquired = await this.taskLocks.acquire(agentId, taskId);

        if (!lockAcquired) {
            const collision = {
                ok: false,
                error: "Task collision — another agent holds this lock",
                taskId,
                agentId,
            };
            this.metacognition.logDecision({ action: task.action, result: "collision", taskId });
            this._audit("collision", collision);
            return collision;
        }

        try {
            // 4. Route through conductor if available
            let routeDecision = null;
            if (this._conductor) {
                routeDecision = await this._conductor.route(task, task.requestIp || "");
            }

            // 5. Build the decision payload with metacognitive context
            // 5a. Realtime orchestration (if live flag is set)
            let liveResult = null;
            if ((task.live === true || task.mode === "live" || task.realtime === true) && this._realtimeEngine) {
                liveResult = await this.orchestrateLive({
                    action: task.action,
                    source: task.source || "buddy-decision",
                    channel: task.channel ?? routeDecision?.vectorZone?.zone ?? 0,
                    data1: task.data1,
                    data2: task.data2,
                    note: task.payload?.note,
                    velocity: task.payload?.velocity,
                    metadata: {
                        requestId: task.requestId || null,
                        priority: task.priority || "normal",
                    },
                });
            }

            // 5. Build the decision payload with metacognitive context
            const decision = {
                ok: true,
                buddyId: this.identity.id,
                decisionNumber: this.decisionCount,
                task: task.action,
                route: routeDecision,
                live: liveResult,
                metacognition: {
                    confidence: meta.confidence,
                    totalErrors: meta.totalErrors,
                    contextInjected: meta.confidence < 0.9,
                },
                latencyMs: Date.now() - start,
                ts: new Date().toISOString(),
            };

            // 6. If metacognition flagged issues, attach the context string for LLM injection
            if (meta.confidence < 0.9 && task.payload) {
                decision.metacognitionContext = meta.contextStr;
                // Augment the payload with self-awareness
                if (task.payload.message) {
                    task.payload.message = meta.contextStr + "\n" + task.payload.message;
                } else if (task.payload.content) {
                    task.payload.content = meta.contextStr + "\n" + task.payload.content;
                }
            }

            // 7. Log the decision
            this.metacognition.logDecision({
                action: task.action,
                result: "routed",
                taskId,
                confidence: meta.confidence,
                route: routeDecision?.serviceGroup,
                latencyMs: decision.latencyMs,
            });

            this._audit("decision", decision);
            this.emit("decision", decision);

            return decision;
        } catch (err) {
            trackError("buddy:decide", err);
            this.metacognition.logDecision({ action: task.action, result: "error", error: err.message });
            // Trigger 5-Phase Deterministic Error Interceptor
            await this.errorInterceptor.intercept(err, {
                source: "buddy:decide",
                agentId,
                stage: task.action,
            });
            return { ok: false, error: err.message, buddyId: this.identity.id };
        } finally {
            // 8. Release the task lock
            await this.taskLocks.release(agentId, taskId);
        }
    }

    async orchestrateLive(task = {}) {
        if (!this._realtimeEngine) {
            return { ok: false, error: "Realtime engine not wired" };
        }

        const livePayload = {
            source: task.source || "buddy-live",
            eventType: task.action || "live-orchestration",
            channel: clampMidiChannel(task.channel ?? 0),
            data1: clampMidiValue(task.data1 ?? task.note ?? 64, 64),
            data2: clampMidiValue(task.data2 ?? task.velocity ?? 127, 127),
            metadata: {
                ...(task.metadata || {}),
                mode: "live-realtime",
                orchestrator: "buddy-core",
            },
        };

        const ingested = typeof this._realtimeEngine.ingestExternalEvent === "function"
            ? await Promise.resolve(this._realtimeEngine.ingestExternalEvent(livePayload, { highPriority: true }))
            : { ok: false, error: "Realtime engine missing ingestExternalEvent" };

        const flushResult = typeof this._realtimeEngine.flush === "function"
            ? await this._realtimeEngine.flush()
            : { ok: false, error: "Realtime engine missing flush" };

        return {
            ok: !!(ingested?.ok && flushResult?.ok),
            ingested,
            flushed: flushResult,
            ts: new Date().toISOString(),
        };
    }


    // ─── MCP Server Interface ─────────────────────────────────────
    /**
     * Handle an MCP tool call from a sub-agent.
     * This is Buddy acting as MCP Server.
     */
    async handleMCPCall(toolName, input) {
        return await this.mcpTools.invoke(toolName, input);
    }

    /**
     * List available MCP tools.
     */
    listMCPTools() {
        return this.mcpTools.listTools();
    }

    /**
     * Register a custom MCP tool.
     */
    registerMCPTool(name, tool) {
        this.mcpTools.register(name, tool);
    }

    // ─── Status ────────────────────────────────────────────────────
    getStatus() {
        const meta = this.metacognition.assessConfidence();
        return {
            ok: true,
            identity: {
                id: this.identity.id,
                fingerprint: this.identity.fingerprint,
                version: this.version,
                createdAt: this.identity.createdAt,
            },
            uptime: Date.now() - this.started,
            decisionCount: this.decisionCount,
            metacognition: {
                confidence: meta.confidence,
                totalErrors: meta.totalErrors,
                activeContexts: meta.totalContexts,
                topErrors: meta.topErrors,
            },
            taskLocks: this.taskLocks.getStats(),
            mcpTools: this.mcpTools.listTools().length,
            conductorWired: !!this._conductor,
            pipelineWired: !!this._pipeline,
            realtimeWired: !!this._realtimeEngine,
            recentDecisions: this.metacognition.getRecentDecisions(5),
        };
    }

    // ─── Express Routes ────────────────────────────────────────────
    registerRoutes(app) {
        app.get("/api/buddy/status", (req, res) => {
            res.json(this.getStatus());
        });

        app.get("/api/buddy/health", (req, res) => {
            const meta = this.metacognition.assessConfidence();
            res.json({
                ok: meta.confidence > 0.3,
                confidence: meta.confidence,
                uptime: Date.now() - this.started,
                decisions: this.decisionCount,
                errors: meta.totalErrors,
            });
        });

        app.get("/api/buddy/identity", (req, res) => {
            res.json({ ok: true, identity: this.identity, version: this.version });
        });
        app.get("/api/buddy/live/health", (req, res) => {
            const realtimeStatus = this._realtimeEngine && typeof this._realtimeEngine.getStatus === "function"
                ? this._realtimeEngine.getStatus()
                : null;
            res.json({
                ok: !!(realtimeStatus && (realtimeStatus.running || realtimeStatus.queueDepth >= 0)),
                realtimeWired: !!this._realtimeEngine,
                realtime: realtimeStatus,
                ts: new Date().toISOString(),
            });
        });

        app.post("/api/buddy/live/orchestrate", async (req, res) => {
            try {
                const result = await this.orchestrateLive(req.body || {});
                if (!result.ok) return res.status(503).json(result);
                res.json(result);
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });


        app.post("/api/buddy/decide", async (req, res) => {
            try {
                const decision = await this.decide(req.body);
                res.json(decision);
            } catch (err) {
                res.status(500).json({ ok: false, error: err.message });
            }
        });

        app.get("/api/buddy/locks", (req, res) => {
            res.json({
                ok: true,
                active: this.taskLocks.getActiveLocks(),
                stats: this.taskLocks.getStats(),
            });
        });

        app.get("/api/buddy/mcp-tools", (req, res) => {
            res.json({ ok: true, tools: this.mcpTools.listTools() });
        });

        app.post("/api/buddy/mcp-invoke", async (req, res) => {
            const { tool, input } = req.body;
            if (!tool) return res.status(400).json({ error: "tool name required" });
            const result = await this.handleMCPCall(tool, input || {});
            res.json(result);
        });

        app.get("/api/buddy/metacognition", (req, res) => {
            const meta = this.metacognition.assessConfidence();
            res.json({
                ok: true,
                ...meta,
                recentDecisions: this.metacognition.getRecentDecisions(20),
            });
        });

        // Error interceptor status & manual trigger
        app.get("/api/buddy/interceptor", (req, res) => {
            res.json({ ok: true, ...this.errorInterceptor.getStats() });
        });

        app.get("/api/buddy/learned-rules", (req, res) => {
            res.json({ ok: true, rules: this.errorInterceptor.learnedRules });
        });

        logger.logSystem("  🎼 [Buddy] Routes registered:");
        logger.logSystem("    → /api/buddy/status, /health, /identity, /live/health");
        logger.logSystem("    → /api/buddy/decide, /locks, /mcp-tools, /mcp-invoke");
        logger.logSystem("    → /api/buddy/metacognition, /interceptor, /learned-rules, /live/orchestrate");
    }

    // ─── Audit ─────────────────────────────────────────────────────
    _audit(type, data) {
        safeOp("buddy:audit", () => {
            const entry = JSON.stringify({ type, ...data, ts: data.ts || new Date().toISOString() });
            fs.appendFileSync(BUDDY_AUDIT_PATH, entry + "\n");
        });
    }
}

// ─── Singleton ──────────────────────────────────────────────────────
let _buddy = null;
function getBuddy() {
    if (!_buddy) {
        _buddy = new BuddyCore();
    }
    return _buddy;
}

module.exports = { BuddyCore, getBuddy, MetacognitionEngine, TaskLockManager, MCPToolRegistry, DeterministicErrorInterceptor };
