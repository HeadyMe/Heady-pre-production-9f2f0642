/*
 * © 2026 HeadySystems Inc..
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Heady™ Swarm Bee — Ephemeral Agent Template ═══
 *
 * Lifecycle: init → execute → report → self-destruct
 * - Boots from Pub/Sub trigger
 * - Pulls AST context from pgvector
 * - Executes task in RAM
 * - Reports results back to Overmind
 * - Container self-destructs (zero trace)
 */

'use strict';

const { PubSub } = require('@google-cloud/pubsub');
const { Pool } = require('pg');

// ── Configuration ───────────────────────────────────────────────
const BEE_CONFIG = require('../bee-config.json');
const BEE_ID = `${BEE_CONFIG.beeClass}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID || 'heady-liquid-architecture' });

let _startTime = Date.now();
let _taskResult = null;

// ── Phase 1: Init ───────────────────────────────────────────────
async function init() {
    console.log(`[${BEE_ID}] 🐝 Bee spawned: ${BEE_CONFIG.beeClass} v${BEE_CONFIG.version}`);
    console.log(`[${BEE_ID}] LLM routing: primary=${BEE_CONFIG.llmRouting.primary}, fallback=${BEE_CONFIG.llmRouting.fallback}`);

    // Verify DB connection
    try {
        await db.query('SELECT 1');
        console.log(`[${BEE_ID}] ✅ pgvector connection verified`);
    } catch (err) {
        console.error(`[${BEE_ID}] ❌ DB connection failed: ${err.message}`);
        await destruct(1);
    }
}

// ── Phase 2: Execute ────────────────────────────────────────────
async function execute(taskPayload) {
    console.log(`[${BEE_ID}] 🔨 Executing task: ${taskPayload.taskType || 'unknown'}`);

    try {
        // Pull relevant AST nodes from vector space
        const contextNodes = await db.query(
            `SELECT id, node_path, node_name, ast_json, embedding <=> $1::vector AS distance
             FROM ast_nodes
             WHERE status = 'active'
             ORDER BY distance ASC
             LIMIT $2`,
            [taskPayload.queryEmbedding || generatePlaceholderEmbedding(), taskPayload.contextLimit || 20]
        );

        console.log(`[${BEE_ID}] 📡 Loaded ${contextNodes.rows.length} context nodes from vector space`);

        // ┌──────────────────────────────────────────────────────────────┐
        // │  YOUR BEE LOGIC GOES HERE                                    │
        // │  Override this section with your bee's specific task.        │
        // │  contextNodes.rows contains the relevant AST nodes.          │
        // └──────────────────────────────────────────────────────────────┘

        _taskResult = {
            beeId: BEE_ID,
            beeClass: BEE_CONFIG.beeClass,
            taskType: taskPayload.taskType,
            status: 'completed',
            nodesProcessed: contextNodes.rows.length,
            durationMs: Date.now() - _startTime,
            output: null, // Replace with actual output
        };

        console.log(`[${BEE_ID}] ✅ Task completed in ${_taskResult.durationMs}ms`);
    } catch (err) {
        console.error(`[${BEE_ID}] ❌ Execution failed: ${err.message}`);
        _taskResult = {
            beeId: BEE_ID,
            beeClass: BEE_CONFIG.beeClass,
            status: 'failed',
            error: err.message,
            durationMs: Date.now() - _startTime,
        };
    }
}

// ── Phase 3: Report ─────────────────────────────────────────────
async function report() {
    if (!_taskResult) return;

    try {
        // Publish results back to the Overmind via Pub/Sub
        const topic = pubsub.topic(BEE_CONFIG.reporting.resultTopic || 'heady-bee-results');
        await topic.publishMessage({
            json: _taskResult,
            attributes: { beeClass: BEE_CONFIG.beeClass, beeId: BEE_ID },
        });
        console.log(`[${BEE_ID}] 📤 Results published to ${BEE_CONFIG.reporting.resultTopic}`);

        // Log to governance ledger
        await db.query(
            `INSERT INTO ast_governance (node_id, action, actor, details)
             VALUES (NULL, 'bee_execution', $1, $2)`,
            [BEE_ID, JSON.stringify(_taskResult)]
        ).catch(() => { }); // Non-fatal
    } catch (err) {
        console.error(`[${BEE_ID}] ⚠️ Report failed (non-fatal): ${err.message}`);
    }
}

// ── Phase 4: Self-Destruct ──────────────────────────────────────
async function destruct(exitCode = 0) {
    console.log(`[${BEE_ID}] 💀 Self-destructing. Lived for ${Date.now() - _startTime}ms.`);
    await db.end().catch(() => { });
    process.exit(exitCode);
}

// ── Pub/Sub Listener (Pull Mode) ────────────────────────────────
async function listenForTasks() {
    const subscription = pubsub.subscription(
        BEE_CONFIG.trigger.subscription || 'heady-swarm-tasks-sub'
    );

    subscription.on('message', async (message) => {
        console.log(`[${BEE_ID}] 📩 Task received: ${message.id}`);
        const payload = JSON.parse(message.data.toString());

        await execute(payload);
        await report();
        message.ack();

        if (BEE_CONFIG.ephemeral) {
            await destruct(0);
        }
    });

    subscription.on('error', (err) => {
        console.error(`[${BEE_ID}] ❌ Subscription error: ${err.message}`);
    });

    console.log(`[${BEE_ID}] 👂 Listening for tasks on ${BEE_CONFIG.trigger.subscription}...`);
}

// ── Direct Execution (for Cloud Run Jobs / one-shot) ────────────
async function runDirect(payload) {
    await init();
    await execute(payload);
    await report();
    await destruct(0);
}

// ── Helpers ─────────────────────────────────────────────────────
function generatePlaceholderEmbedding() {
    return '[' + Array.from({ length: 1536 }, () => (Math.random() * 2 - 1).toFixed(4)).join(',') + ']';
}

// ── Entrypoint ──────────────────────────────────────────────────
(async () => {
    await init();

    // Check if running as one-shot (env var) or persistent listener
    if (process.env.HEADY_TASK_PAYLOAD) {
        const payload = JSON.parse(process.env.HEADY_TASK_PAYLOAD);
        await runDirect(payload);
    } else {
        await listenForTasks();
    }
})();

module.exports = { init, execute, report, destruct, runDirect };
