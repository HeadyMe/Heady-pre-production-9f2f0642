export class BuddyCore extends EventEmitter<[never]> {
    constructor(opts?: {});
    identity: {
        id: string;
        fingerprint: string;
        createdAt: string;
    };
    version: string;
    metacognition: MetacognitionEngine;
    taskLocks: TaskLockManager;
    mcpTools: MCPToolRegistry;
    errorInterceptor: DeterministicErrorInterceptor;
    _conductor: any;
    _pipeline: any;
    _realtimeEngine: any;
    started: number;
    decisionCount: number;
    status: string;
    setConductor(conductor: any): void;
    setPipeline(pipeline: any): void;
    setVectorMemory(vectorMemory: any): void;
    setRedis(redisClient: any): void;
    setRealtimeEngine(realtimeEngine: any): void;
    /**
     * Make a decision with metacognitive awareness.
     * This is the primary entry point for all Buddy-routed operations.
     *
     * @param {Object} task - { action, payload, agentId, priority }
     * @returns {Object} - Decision result with metacognitive context
     */
    decide(task: Object): Object;
    orchestrateLive(task?: {}): Promise<{
        ok: boolean;
        error: string;
        ingested?: undefined;
        flushed?: undefined;
        ts?: undefined;
    } | {
        ok: boolean;
        ingested: any;
        flushed: any;
        ts: string;
        error?: undefined;
    }>;
    /**
     * Handle an MCP tool call from a sub-agent.
     * This is Buddy acting as MCP Server.
     */
    handleMCPCall(toolName: any, input: any): Promise<any>;
    /**
     * List available MCP tools.
     */
    listMCPTools(): {
        name: any;
        description: any;
        category: any;
        inputSchema: any;
    }[];
    /**
     * Register a custom MCP tool.
     */
    registerMCPTool(name: any, tool: any): void;
    getStatus(): {
        ok: boolean;
        identity: {
            id: string;
            fingerprint: string;
            version: string;
            createdAt: string;
        };
        uptime: number;
        decisionCount: number;
        metacognition: {
            confidence: number;
            totalErrors: number;
            activeContexts: number;
            topErrors: {
                context: any;
                count: any;
            }[];
        };
        taskLocks: {
            activeLocks: number;
            acquired: number;
            released: number;
            collisions: number;
            expired: number;
        };
        mcpTools: number;
        conductorWired: boolean;
        pipelineWired: boolean;
        realtimeWired: boolean;
        recentDecisions: any[];
    };
    registerRoutes(app: any): void;
    _audit(type: any, data: any): void;
}
export function getBuddy(): any;
export class MetacognitionEngine {
    decisionLog: any[];
    MAX_LOG: number;
    /**
     * Before a high-stakes decision, assess the system's recent health.
     * Returns a confidence modifier (0.0 - 1.0) and context string for LLM injection.
     */
    assessConfidence(): {
        confidence: number;
        contextStr: string;
        totalErrors: number;
        totalContexts: number;
        topErrors: {
            context: any;
            count: any;
        }[];
    };
    /**
     * Log a decision with its metacognitive context.
     */
    logDecision(decision: any): void;
    getRecentDecisions(limit?: number): any[];
}
export class TaskLockManager {
    _locks: Map<any, any>;
    _redisClient: any;
    stats: {
        acquired: number;
        released: number;
        collisions: number;
        expired: number;
    };
    /**
     * Wire Redis client for distributed locking.
     */
    setRedisClient(client: any): void;
    /**
     * Acquire a task lock. Returns true if lock acquired, false if collision.
     * @param {string} agentId - The agent requesting the lock
     * @param {string} taskId - The task to lock
     * @param {number} ttlMs - Lock TTL in ms (default: 30s)
     */
    acquire(agentId: string, taskId: string, ttlMs?: number): Promise<boolean>;
    /**
     * Release a task lock.
     */
    release(agentId: any, taskId: any): Promise<boolean>;
    /**
     * Get all active locks — the swarm activity map.
     */
    getActiveLocks(): any[];
    getStats(): {
        activeLocks: number;
        acquired: number;
        released: number;
        collisions: number;
        expired: number;
    };
}
export class MCPToolRegistry {
    tools: Map<any, any>;
    _registerBuiltinTools(): void;
    register(name: any, tool: any): void;
    invoke(name: any, input?: {}): Promise<any>;
    listTools(): {
        name: any;
        description: any;
        category: any;
        inputSchema: any;
    }[];
}
/**
 * Implements the Buddy Deterministic Optimization Protocol from AGENTS.md.
 * When an anomaly is detected, executes the 5-phase loop:
 *   Phase 1: Error Detection & Probabilistic Halt
 *   Phase 2: Deterministic State Extraction
 *   Phase 3: Semantic Equivalence Analysis
 *   Phase 4: Root-Cause Derivation via Constraint Analysis
 *   Phase 5: Upstream Rule Synthesis & Baseline Update
 */
export class DeterministicErrorInterceptor {
    interceptLog: any[];
    MAX_LOG: number;
    learnedRules: any[];
    _vectorMemory: any;
    setVectorMemory(vm: any): void;
    /**
     * Phase 1: Error Detection & Probabilistic Halt
     * Intercepts the error and freezes execution state.
     * Returns a structured interception record.
     */
    _phase1_halt(error: any, context?: {}): {
        id: string;
        phase: number;
        action: string;
        error: {
            message: any;
            stack: any;
            name: any;
            code: any;
        };
        context: {
            source: any;
            stage: any;
            runId: any;
            agentId: any;
        };
        ts: string;
        halted: boolean;
    };
    /**
     * Phase 2: Deterministic State Extraction
     * Captures the pure computational state at the point of failure.
     */
    _phase2_extractState(interception: any): any;
    /**
     * Phase 3: Semantic Equivalence Analysis
     * Checks if this error matches a previously resolved pattern.
     */
    _phase3_semanticAnalysis(interception: any): Promise<any>;
    /**
     * Phase 4: Root-Cause Derivation
     * Traces the control flow to identify the specific constraint violation.
     */
    _phase4_rootCause(interception: any): any;
    /**
     * Phase 5: Upstream Rule Synthesis
     * Persists the resolution and permanently immunizes against recurrence.
     */
    _phase5_synthesizeRule(interception: any, resolution?: null): Promise<any>;
    /**
     * Execute the full 5-phase interception loop.
     * @param {Error} error - The caught error
     * @param {Object} context - { source, stage, runId, agentId }
     * @param {string} resolution - Optional resolution description
     * @returns {Object} Complete interception record
     */
    intercept(error: Error, context?: Object, resolution?: string): Object;
    /**
     * Check if an error has a known resolution before executing.
     * Returns the resolution if found, null otherwise.
     */
    checkPreemptive(errorKey: any): any;
    getStats(): {
        totalInterceptions: number;
        learnedRules: number;
        recentInterceptions: any[];
        topConstraintViolations: {
            type: string;
            count: any;
        }[];
    };
    _getTopViolations(): {
        type: string;
        count: any;
    }[];
    _loadLearnedRules(): void;
    _persistLearnedRules(): void;
}
import EventEmitter = require("events");
//# sourceMappingURL=buddy-core.d.ts.map