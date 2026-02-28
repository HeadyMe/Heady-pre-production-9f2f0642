/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 */
/**
 * ═══ HCFP Task Dispatcher ═══
 *
 * Classifies tasks by type and routes to the optimal sub-agent.
 * Uses service_group field from task-manifest-schema + keyword analysis.
 *
 * Sub-Agent Topology:
 *   HeadyIO         → I/O-bound tasks (file, stream, network)
 *   HeadyBot         → Automation scripting, ephemeral workers
 *   HeadyMCP         → Machine-to-machine context protocols
 *   HeadyConnection  → Persistent connections, long-lived sessions
 *   Core Platform    → Default brain orchestration
 *
 * Pipeline Tasks: buddy-dist-001, buddy-dist-003
 */

const path = require('path');
const fs = require('fs');
const { midiBus, CHANNELS } = require("../engines/midi-event-bus");

// ═══ Pipeline Source ═══
const PIPELINE_FILE = path.join(__dirname, '..', 'auto-flow-200-tasks.json');

// ═══ Sub-Agent Registry (Cloud-Only Endpoints) ═══
const SUB_AGENTS = {
    "heady-io": {
        name: "HeadyIO",
        endpoint: process.env.HEADY_IO_URL || "https://heady-io.headyme.com/api",
        capabilities: ["file", "stream", "network", "upload", "download", "parse"],
        keywords: ["file", "read", "write", "stream", "upload", "download", "parse", "csv", "json", "xml", "buffer", "fs"],
    },
    "heady-bot": {
        name: "HeadyBot",
        endpoint: process.env.HEADY_BOT_URL || "https://heady-bot.headyme.com/api",
        capabilities: ["automate", "script", "cron", "worker", "spawn", "batch"],
        keywords: ["automate", "script", "cron", "schedule", "batch", "worker", "spawn", "run", "execute", "deploy", "build"],
    },
    "heady-mcp": {
        name: "HeadyMCP",
        endpoint: process.env.HEADY_MCP_URL || "https://heady-mcp.headyme.com/api",
        capabilities: ["protocol", "m2m", "context", "bridge", "translate"],
        keywords: ["protocol", "machine", "m2m", "bridge", "translate", "context", "mcp", "middleware", "adapter"],
    },
    "heady-connection": {
        name: "HeadyConnection",
        endpoint: process.env.HEADY_CONNECTION_URL || "https://heady-connection.headyme.com/api",
        capabilities: ["persistent", "session", "websocket", "sse", "keepalive"],
        keywords: ["persistent", "session", "websocket", "sse", "keepalive", "long-running", "subscribe", "watch", "monitor"],
    },
    "heady-cloudrun": {
        name: "Cloud Run Failover",
        endpoint: process.env.HEADY_CLOUDRUN_URL || "https://heady-edge-gateway-609590223909.us-central1.run.app",
        capabilities: ["chat", "analyze", "code", "reasoning", "buddy"],
        keywords: ["failover", "cloudrun", "gcloud", "liquid", "backup"],
    },
    "core": {
        name: "Core Platform",
        endpoint: process.env.HEADY_BRAIN_URL || "https://127.0.0.1:3301/api/brain/chat",
        capabilities: ["chat", "analyze", "code", "reasoning", "think", "generate"],
        keywords: [], // Default — catches everything else
    },
};

/**
 * Classify a task and determine the optimal sub-agent.
 *
 * @param {object} task - Task from manifest (has name, action, service_group, inputs)
 * @returns {{ agent: string, endpoint: string, reason: string }}
 */
function classify(task) {
    // Priority 1: Explicit service_group mapping
    if (task.service_group && task.service_group !== "brain") {
        const agentKey = Object.keys(SUB_AGENTS).find(key =>
            key === task.service_group ||
            SUB_AGENTS[key].name.toLowerCase() === task.service_group.toLowerCase()
        );
        if (agentKey) {
            const agent = SUB_AGENTS[agentKey];
            midiBus.agentSpawned(agent.name, CHANNELS.DISPATCHER);
            return {
                agent: agentKey,
                name: agent.name,
                endpoint: agent.endpoint,
                reason: `Explicit service_group: "${task.service_group}" → ${agent.name}`,
            };
        }
    }

    // Priority 2: Keyword matching against task name + action + inputs
    const searchText = [
        task.name || "",
        task.action || "",
        JSON.stringify(task.inputs || {}),
    ].join(" ").toLowerCase();

    let bestMatch = null;
    let bestScore = 0;

    for (const [key, agent] of Object.entries(SUB_AGENTS)) {
        if (key === "core") continue; // Skip default
        const matches = agent.keywords.filter(kw => searchText.includes(kw));
        if (matches.length > bestScore) {
            bestScore = matches.length;
            bestMatch = { key, agent, matches };
        }
    }

    if (bestMatch && bestScore >= 1) {
        midiBus.agentSpawned(bestMatch.agent.name, CHANNELS.DISPATCHER);
        return {
            agent: bestMatch.key,
            name: bestMatch.agent.name,
            endpoint: bestMatch.agent.endpoint,
            reason: `Keyword match (${bestScore} hits: ${bestMatch.matches.join(", ")}) → ${bestMatch.agent.name}`,
        };
    }

    // Fallback: Core Platform
    const core = SUB_AGENTS["core"];
    return {
        agent: "core",
        name: core.name,
        endpoint: core.endpoint,
        reason: `Default routing → Core Platform (no sub-agent keywords matched)`,
    };
}

/**
 * Classify multiple tasks and return a dispatch plan.
 *
 * @param {Array} tasks - Array of task objects
 * @returns {Array} Array of { task, dispatch } objects
 */
function createDispatchPlan(tasks) {
    return tasks.map(task => ({
        task_name: task.name,
        task_id: task.id,
        dispatch: classify(task),
    }));
}

/**
 * Get agent registry summary.
 */
function getAgentRegistry() {
    return Object.entries(SUB_AGENTS).map(([key, agent]) => ({
        key,
        name: agent.name,
        endpoint: agent.endpoint,
        capabilities: agent.capabilities,
        keyword_count: agent.keywords.length,
    }));
}

/**
 * Load the auto-flow pipeline from disk and return tasks sorted by priority.
 * @param {object} opts - { pool: 'hot'|'warm'|'cold'|'all', minWeight: 1-5, limit: number }
 * @returns {Array} Sorted task array
 */
function loadPipeline(opts = {}) {
    const pool = opts.pool || 'hot';
    const minWeight = opts.minWeight || 4;
    const limit = opts.limit || 50;

    try {
        const raw = fs.readFileSync(PIPELINE_FILE, 'utf8');
        let tasks = JSON.parse(raw);

        // Filter by pool
        if (pool !== 'all') {
            tasks = tasks.filter(t => t.pool === pool);
        }

        // Filter by minimum weight
        tasks = tasks.filter(t => (t.w || 0) >= minWeight);

        // Sort: weight desc, then by id for stability
        tasks.sort((a, b) => (b.w || 0) - (a.w || 0) || (a.id || '').localeCompare(b.id || ''));

        return tasks.slice(0, limit);
    } catch (err) {
        console.error(`[TaskDispatcher] Pipeline load error: ${err.message}`);
        return [];
    }
}

/**
 * Create a prioritized dispatch plan from the auto-flow pipeline.
 * @param {object} opts - { pool, minWeight, limit }
 * @returns {Array} Array of { task, dispatch } objects
 */
function createPipelinePlan(opts = {}) {
    const tasks = loadPipeline(opts);
    return createDispatchPlan(tasks);
}

module.exports = { classify, createDispatchPlan, createPipelinePlan, loadPipeline, getAgentRegistry, SUB_AGENTS };
