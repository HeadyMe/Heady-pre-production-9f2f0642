/*
* © 2026 Heady Systems LLC.
* PROPRIETARY AND CONFIDENTIAL.
* Unauthorized copying, modification, or distribution is strictly prohibited.
*/
/**
* ═══ HCFullPipeline — 9-Stage State Machine — SPEC-1 ═══
*
* The core orchestration pipeline that every critical task flows through.
* Stages: INTAKE → TRIAGE → MONTE_CARLO → ARENA → JUDGE → APPROVE → EXECUTE → VERIFY → RECEIPT
*
* Each stage has: entry guard, execution logic, exit validation, rollback hook.
* Emits events via EventEmitter for SSE/WebSocket consumers.
*/
const { EventEmitter } = require("events");
const crypto = require("crypto");

const STAGES = [
    "INTAKE",       // 1. Parse & validate incoming request
    "TRIAGE",       // 2. Classify priority, route to correct node pool
    "MONTE_CARLO",  // 3. Risk assessment simulation
    "ARENA",        // 4. Multi-node competition (if enabled)
    "JUDGE",        // 5. Score & rank outputs
    "APPROVE",      // 6. Human approval gate (for HIGH/CRITICAL risk)
    "EXECUTE",      // 7. Run the winning strategy
    "VERIFY",       // 8. Post-execution validation
    "RECEIPT",      // 9. Emit trust receipt + audit log
];

const STATUS = {
    PENDING: "pending",
    RUNNING: "running",
    COMPLETED: "completed",
    FAILED: "failed",
    PAUSED: "paused",
    SKIPPED: "skipped",
    ROLLED_BACK: "rolled_back",
};

class HCFullPipeline extends EventEmitter {
    constructor(opts = {}) {
        super();
        // Dynamic concurrency — derived from real-time system resources, not a fixed number
        const mem = process.memoryUsage();
        const availableMB = (mem.heapTotal - mem.heapUsed) / (1024 * 1024);
        this.maxConcurrent = opts.maxConcurrent || Math.max(4, Math.floor(availableMB / 10));
        this.runs = new Map();
        this.monteCarlo = opts.monteCarlo || null;
        this.policyEngine = opts.policyEngine || null;
        this.incidentManager = opts.incidentManager || null;
        this.errorInterceptor = opts.errorInterceptor || null;
        this.vectorMemory = opts.vectorMemory || null;
        this.selfAwareness = opts.selfAwareness || null;
        this.buddyMetacognition = opts.buddyMetacognition || null;
        this.selfHealStats = { attempts: 0, successes: 0, failures: 0 };
        // Wire telemetry into self-awareness loop if available
        this._wireAutoTelemetry();
    }
