/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * HeadyAutoComplete — Outcome-Driven Task Completion Engine
 *
 * Surpasses Perplexity Computer by combining:
 *   1. DAG-based task decomposition (not flat queue)
 *   2. Automatic multi-model routing per subtask type
 *   3. Isolated execution sandboxes per subtask
 *   4. Contract-based verification with auto-retry
 *   5. Persistent vector memory state across sessions
 *
 * @module heady-autocomplete
 */

'use strict';

const { EventEmitter } = require('events');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ─── Constants ────────────────────────────────────────────────────────────────

const PHI = 1.6180339887;

const TASK_STATUS = Object.freeze({
    PENDING: 'pending',
    PLANNING: 'planning',
    DECOMPOSING: 'decomposing',
    EXECUTING: 'executing',
    VERIFYING: 'verifying',
    RETRYING: 'retrying',
    COMPLETED: 'completed',
    FAILED: 'failed',
    ESCALATED: 'escalated',
});

const SUBTASK_TYPE = Object.freeze({
    RESEARCH: 'research',
    PLANNING: 'planning',
    CODE_GEN: 'code_gen',
    CODE_REVIEW: 'code_review',
    TEST: 'test',
    DEPLOY: 'deploy',
    DOCUMENT: 'document',
    VERIFY: 'verify',
    DEBUG: 'debug',
    SYNTHESIZE: 'synthesize',
});

const MAX_RETRIES = 3;
const VERIFICATION_TIMEOUT_MS = 30_000;
const MAX_PARALLEL_SUBTASKS = Math.round(PHI ** 3); // φ³ ≈ 4

// ─── HeadyAutoComplete ────────────────────────────────────────────────────────

class HeadyAutoComplete extends EventEmitter {
    /**
     * @param {object} opts
     * @param {object} opts.modelRouter     - ModelRouter instance
     * @param {object} opts.dagBuilder      - TaskDAGBuilder instance
     * @param {object} opts.verifier        - VerificationEngine instance
     * @param {object} opts.sandbox         - ExecutionSandbox instance
     * @param {object} opts.stateStore      - TaskStateStore instance
     * @param {object} opts.orchestrator    - AgentOrchestrator instance (optional)
     * @param {object} opts.vectorMemory    - Vector memory service (optional)
     */
    constructor(opts = {}) {
        super();
        this.modelRouter = opts.modelRouter;
        this.dagBuilder = opts.dagBuilder;
        this.verifier = opts.verifier;
        this.sandbox = opts.sandbox;
        this.stateStore = opts.stateStore;
        this.orchestrator = opts.orchestrator;
        this.vectorMemory = opts.vectorMemory;

        this.activeTasks = new Map();
        this.taskHistory = [];
        this.stats = {
            totalTasks: 0,
            completed: 0,
            failed: 0,
            avgCompletionMs: 0,
            retries: 0,
        };
    }

    /**
     * Execute a goal end-to-end. This is the primary entry point.
     *
     * @param {string} goal     - Natural language description of the desired outcome
     * @param {object} [context] - Additional context (repo, files, user preferences)
     * @returns {Promise<TaskResult>}
     */
    async execute(goal, context = {}) {
        const taskId = this._generateTaskId();
        const startTime = Date.now();

        const task = {
            id: taskId,
            goal,
            context,
            status: TASK_STATUS.PENDING,
            dag: null,
            results: {},
            retries: 0,
            startTime,
            endTime: null,
            governanceStamp: null,
        };

        this.activeTasks.set(taskId, task);
        this.stats.totalTasks++;
        this.emit('task:start', { taskId, goal });

        try {
            // ── Phase 1: Plan ──────────────────────────────────────────────
            task.status = TASK_STATUS.PLANNING;
            this.emit('task:phase', { taskId, phase: 'planning' });

            const memoryContext = await this._queryVectorMemory(goal, context);
            const plan = await this._plan(goal, { ...context, memoryContext });

            // ── Phase 2: Decompose into DAG ────────────────────────────────
            task.status = TASK_STATUS.DECOMPOSING;
            this.emit('task:phase', { taskId, phase: 'decomposing' });

            task.dag = await this.dagBuilder.build(plan, context);
            await this.stateStore.save(taskId, { plan, dag: task.dag.serialize() });

            // ── Phase 3: Execute DAG ───────────────────────────────────────
            task.status = TASK_STATUS.EXECUTING;
            this.emit('task:phase', { taskId, phase: 'executing' });

            const executionResult = await this._executeDAG(task);

            // ── Phase 4: Verify ────────────────────────────────────────────
            task.status = TASK_STATUS.VERIFYING;
            this.emit('task:phase', { taskId, phase: 'verifying' });

            const verification = await this.verifier.verifyAll(task.dag, executionResult);

            if (!verification.passed) {
                return await this._handleVerificationFailure(task, verification);
            }

            // ── Phase 5: Stamp & Complete ──────────────────────────────────
            task.status = TASK_STATUS.COMPLETED;
            task.endTime = Date.now();
            task.governanceStamp = this._stampGovernance(task);
            task.results = executionResult;

            this.stats.completed++;
            this._updateAvgCompletion(task.endTime - startTime);
            await this.stateStore.save(taskId, { status: 'completed', results: executionResult });
            await this._embedTaskResult(task);

            this.emit('task:complete', { taskId, durationMs: task.endTime - startTime });
            return { success: true, taskId, results: executionResult, governance: task.governanceStamp };

        } catch (err) {
            task.status = TASK_STATUS.FAILED;
            task.endTime = Date.now();
            this.stats.failed++;

            logger.error({ taskId, err: err.message }, 'HeadyAutoComplete task failed');
            this.emit('task:failed', { taskId, error: err.message });
            await this.stateStore.save(taskId, { status: 'failed', error: err.message });

            return { success: false, taskId, error: err.message };
        } finally {
            this.taskHistory.push(task);
            this.activeTasks.delete(taskId);
        }
    }

    /**
     * Plan the approach using the optimal planning model.
     * @private
     */
    async _plan(goal, context) {
        const model = this.modelRouter.select(SUBTASK_TYPE.PLANNING);
        const prompt = [
            'You are HeadyAutoComplete, a task completion engine.',
            'Decompose this goal into concrete, ordered subtasks with types and dependencies.',
            `Goal: ${goal}`,
            context.memoryContext ? `Relevant context from memory:\n${context.memoryContext}` : '',
            '',
            'Output JSON: { subtasks: [{ id, name, type, depends_on: [ids], verification: { type, ... } }] }',
        ].filter(Boolean).join('\n');

        const result = await model.generate(prompt);
        return typeof result === 'string' ? JSON.parse(result) : result;
    }

    /**
     * Execute the DAG with parallel fan-out at independent nodes.
     * @private
     */
    async _executeDAG(task) {
        const dag = task.dag;
        const results = {};
        const completed = new Set();

        while (completed.size < dag.nodeCount) {
            // Find all nodes whose dependencies are satisfied
            const ready = dag.getReadyNodes(completed);

            if (ready.length === 0 && completed.size < dag.nodeCount) {
                throw new Error(`DAG deadlock: ${dag.nodeCount - completed.size} nodes remain but none are ready`);
            }

            // Execute ready nodes in parallel (bounded)
            const batch = ready.slice(0, MAX_PARALLEL_SUBTASKS);
            const batchResults = await Promise.allSettled(
                batch.map(node => this._executeSubtask(task.id, node, results))
            );

            for (let i = 0; i < batch.length; i++) {
                const node = batch[i];
                const result = batchResults[i];

                if (result.status === 'fulfilled') {
                    results[node.id] = result.value;
                    completed.add(node.id);
                    this.emit('subtask:complete', { taskId: task.id, subtaskId: node.id });
                } else {
                    // Attempt retry for failed subtask
                    const retryResult = await this._retrySubtask(task.id, node, results, result.reason);
                    if (retryResult.success) {
                        results[node.id] = retryResult.value;
                        completed.add(node.id);
                    } else {
                        throw new Error(`Subtask ${node.id} failed after retries: ${retryResult.error}`);
                    }
                }
            }
        }

        return results;
    }

    /**
     * Execute a single subtask in an isolated sandbox.
     * @private
     */
    async _executeSubtask(taskId, node, previousResults) {
        const model = this.modelRouter.select(node.type);

        // Gather dependency outputs as context
        const depContext = (node.dependsOn || [])
            .map(depId => previousResults[depId])
            .filter(Boolean);

        const sandboxCtx = await this.sandbox.create({
            taskId,
            subtaskId: node.id,
            type: node.type,
        });

        try {
            const result = await sandboxCtx.run(async (env) => {
                const prompt = this._buildSubtaskPrompt(node, depContext, env);
                return model.generate(prompt);
            });

            // Inline verification if the node has a verification contract
            if (node.verification) {
                const check = await this.verifier.verify(node.verification, result, sandboxCtx);
                if (!check.passed) {
                    throw new Error(`Verification failed: ${check.reason}`);
                }
            }

            return result;
        } finally {
            await sandboxCtx.cleanup();
        }
    }

    /**
     * Retry a failed subtask with error context injected.
     * @private
     */
    async _retrySubtask(taskId, node, previousResults, error, attempt = 1) {
        if (attempt > MAX_RETRIES) {
            return { success: false, error: error.message || String(error) };
        }

        this.stats.retries++;
        this.emit('subtask:retry', { taskId, subtaskId: node.id, attempt });

        // Use a debugging-specialized model for retries
        const debugModel = this.modelRouter.select(SUBTASK_TYPE.DEBUG);

        try {
            const depContext = (node.dependsOn || [])
                .map(depId => previousResults[depId])
                .filter(Boolean);

            const sandboxCtx = await this.sandbox.create({
                taskId, subtaskId: node.id, type: node.type, isRetry: true,
            });

            const result = await sandboxCtx.run(async (env) => {
                const prompt = [
                    `Previous attempt failed with error: ${error.message || error}`,
                    `Fix the issue and complete this subtask:`,
                    this._buildSubtaskPrompt(node, depContext, env),
                ].join('\n');
                return debugModel.generate(prompt);
            });

            await sandboxCtx.cleanup();

            if (node.verification) {
                const check = await this.verifier.verify(node.verification, result, sandboxCtx);
                if (!check.passed) {
                    return this._retrySubtask(taskId, node, previousResults, new Error(check.reason), attempt + 1);
                }
            }

            return { success: true, value: result };
        } catch (retryErr) {
            return this._retrySubtask(taskId, node, previousResults, retryErr, attempt + 1);
        }
    }

    /**
     * Handle verification failure at the task level.
     * @private
     */
    async _handleVerificationFailure(task, verification) {
        if (task.retries >= MAX_RETRIES) {
            task.status = TASK_STATUS.ESCALATED;
            this.emit('task:escalated', {
                taskId: task.id,
                reason: 'Verification failed after max retries',
                failures: verification.failures,
            });
            return {
                success: false,
                taskId: task.id,
                escalated: true,
                failures: verification.failures,
            };
        }

        task.retries++;
        task.status = TASK_STATUS.RETRYING;
        this.emit('task:retry', { taskId: task.id, attempt: task.retries });

        // Re-execute only failed subtasks
        for (const failure of verification.failures) {
            const node = task.dag.getNode(failure.subtaskId);
            if (node) {
                await this._retrySubtask(task.id, node, task.results, new Error(failure.reason));
            }
        }

        // Re-verify
        const recheck = await this.verifier.verifyAll(task.dag, task.results);
        if (recheck.passed) {
            task.status = TASK_STATUS.COMPLETED;
            task.endTime = Date.now();
            task.governanceStamp = this._stampGovernance(task);
            this.stats.completed++;
            return { success: true, taskId: task.id, results: task.results };
        }

        return this._handleVerificationFailure(task, recheck);
    }

    /**
     * Build prompt for a subtask with dependency context.
     * @private
     */
    _buildSubtaskPrompt(node, depContext, env) {
        const parts = [
            `Subtask: ${node.name}`,
            `Type: ${node.type}`,
        ];
        if (depContext.length > 0) {
            parts.push(`Previous results:\n${depContext.map((c, i) => `[${i + 1}] ${typeof c === 'string' ? c.slice(0, 500) : JSON.stringify(c).slice(0, 500)}`).join('\n')}`);
        }
        if (env && env.cwd) {
            parts.push(`Working directory: ${env.cwd}`);
        }
        return parts.join('\n');
    }

    /**
     * Query vector memory for relevant context.
     * @private
     */
    async _queryVectorMemory(goal, context) {
        if (!this.vectorMemory) return null;
        try {
            const results = await this.vectorMemory.search(goal, { limit: 5 });
            return results.map(r => r.content).join('\n---\n');
        } catch (err) {
            logger.warn({ err: err.message }, 'Vector memory query failed, continuing without context');
            return null;
        }
    }

    /**
     * Embed finished task result into vector memory for future reference.
     * @private
     */
    async _embedTaskResult(task) {
        if (!this.vectorMemory) return;
        try {
            await this.vectorMemory.store({
                content: JSON.stringify({
                    goal: task.goal,
                    status: task.status,
                    subtaskCount: task.dag?.nodeCount || 0,
                    durationMs: task.endTime - task.startTime,
                }),
                metadata: {
                    type: 'task_completion',
                    taskId: task.id,
                    timestamp: new Date().toISOString(),
                },
            });
        } catch (err) {
            logger.warn({ err: err.message }, 'Failed to embed task result');
        }
    }

    /**
     * Cryptographic governance stamp.
     * @private
     */
    _stampGovernance(task) {
        const payload = JSON.stringify({
            taskId: task.id,
            goal: task.goal,
            status: task.status,
            completedAt: task.endTime,
            subtaskCount: task.dag?.nodeCount || 0,
        });
        const hash = crypto.createHash('sha256').update(payload).digest('hex');
        return { hash, timestamp: new Date().toISOString(), version: '1.0.0' };
    }

    /** @private */
    _generateTaskId() {
        return `hac_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    /** @private */
    _updateAvgCompletion(durationMs) {
        const total = this.stats.completed;
        this.stats.avgCompletionMs = Math.round(
            ((this.stats.avgCompletionMs * (total - 1)) + durationMs) / total
        );
    }

    /**
     * Get engine stats.
     */
    getStats() {
        return {
            ...this.stats,
            activeTasks: this.activeTasks.size,
            historySize: this.taskHistory.length,
        };
    }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { HeadyAutoComplete, TASK_STATUS, SUBTASK_TYPE, MAX_RETRIES };
