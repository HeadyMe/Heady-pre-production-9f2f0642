/*
 * © 2026 Heady Systems LLC. PROPRIETARY AND CONFIDENTIAL.
 *
 * Template Auto-Generator — HeadyBee & HeadySwarm Factory Directive
 *
 * DIRECTIVE: Every task Heady executes should check for and generate
 * reusable template HeadyBees and HeadySwarms. This module provides:
 *   1. Auto-detection of templateable patterns in task output
 *   2. HeadyBee creation via bee-factory for single-unit tasks
 *   3. HeadySwarm orchestration for multi-bee coordinated work
 *   4. Template injection: checks for existing templates + data before work
 *
 * Wired into: colab-mcp-bridge.js callTool() pipeline
 */

const path = require('path');
const fs = require('fs');

// ── Import factories ─────────────────────────────────────────────
let beeFactory;
try {
    beeFactory = require('../bees/bee-factory');
} catch {
    // Fallback if bee-factory not available
    beeFactory = {
        createBee: (domain, cfg) => ({ domain, ...cfg, created: true }),
        spawnBee: (name, fn) => ({ name, spawned: true }),
        createFromTemplate: (tpl, cfg) => ({ template: tpl, ...cfg, created: true }),
        listDynamicBees: () => [],
    };
}

let swarmIntelligence;
try {
    swarmIntelligence = require('../orchestration/swarm-intelligence');
} catch {
    swarmIntelligence = null;
}

// ── Template Registry (in-memory cache of generated templates) ───
const generatedTemplates = new Map();
const templateHistory = [];

/**
 * Check if a task has an existing template that can be injected.
 * Called BEFORE executing any MCP tool.
 *
 * @param {string} toolName - The MCP tool being called
 * @param {object} args - Tool arguments
 * @returns {object|null} Template data if available, null otherwise
 */
function checkForTemplate(toolName, args) {
    // Check generated templates
    const key = `${toolName}:${JSON.stringify(args).substring(0, 100)}`;
    if (generatedTemplates.has(key)) {
        return {
            found: true,
            template: generatedTemplates.get(key),
            source: 'generated-cache',
        };
    }

    // Check template scenarios config
    try {
        const scenarios = require('../config/headybee-template-scenarios.json');
        const match = scenarios.find(s => s.toolPattern === toolName);
        if (match) {
            return {
                found: true,
                template: match,
                source: 'scenario-config',
            };
        }
    } catch { /* no scenarios file */ }

    return { found: false };
}

/**
 * Generate template HeadyBees and HeadySwarms from task results.
 * Called AFTER executing any MCP tool to extract reusable patterns.
 *
 * @param {string} toolName - The tool that was called
 * @param {object} args - Tool arguments
 * @param {object} result - Tool execution result
 * @returns {object} Generated template metadata
 */
function generateTemplateFromResult(toolName, args, result) {
    const templateMeta = {
        toolName,
        timestamp: new Date().toISOString(),
        bees: [],
        swarms: [],
    };

    // ── Generate HeadyBee for the task pattern ──
    const beeDomain = `template-${toolName.replace('heady_', '')}`;
    const bee = beeFactory.createBee(beeDomain, {
        description: `Template bee for ${toolName} pattern`,
        priority: 0.7,
        workers: [
            {
                name: `${toolName}-replay`,
                fn: async () => ({
                    bee: beeDomain,
                    action: 'template-replay',
                    originalTool: toolName,
                    originalArgs: args,
                    templateCreated: templateMeta.timestamp,
                }),
            },
        ],
    });
    templateMeta.bees.push({
        domain: beeDomain,
        description: bee.description,
    });

    // ── Generate HeadySwarm if task involves multiple tools ──
    const multiToolPatterns = [
        'heady_auto_flow', 'heady_deep_scan', 'heady_deploy',
        'heady_ops', 'heady_battle', 'heady_coder',
    ];

    if (multiToolPatterns.includes(toolName)) {
        const swarmId = `swarm-${toolName.replace('heady_', '')}-${Date.now()}`;
        const swarmDef = {
            id: swarmId,
            coordinator: beeDomain,
            bees: [beeDomain],
            strategy: 'fan-out',
            description: `Swarm template for ${toolName} orchestration`,
            createdAt: templateMeta.timestamp,
        };

        // If swarm intelligence is available, register
        if (swarmIntelligence?.registerSwarm) {
            swarmIntelligence.registerSwarm(swarmDef);
        }

        templateMeta.swarms.push(swarmDef);
    }

    // ── Cache the template for future injection ──
    const key = `${toolName}:${JSON.stringify(args).substring(0, 100)}`;
    generatedTemplates.set(key, {
        bee: beeDomain,
        args,
        result: typeof result === 'string' ? result.substring(0, 500) : null,
        created: templateMeta.timestamp,
    });

    templateHistory.push(templateMeta);

    return templateMeta;
}

/**
 * Get all generated templates and their status.
 */
function getTemplateStats() {
    return {
        cachedTemplates: generatedTemplates.size,
        totalGenerated: templateHistory.length,
        activeBees: beeFactory.listDynamicBees().filter(b => b.domain.startsWith('template-')).length,
        history: templateHistory.slice(-10), // Last 10
    };
}

/**
 * Wrap a tool call with template checking and generation.
 * This is the main integration point — wraps callTool in the bridge.
 *
 * @param {Function} originalCallTool - The original callTool function
 * @param {string} toolName - MCP tool name
 * @param {object} args - Tool arguments
 * @returns {object} Enhanced result with template metadata
 */
async function withTemplateAutoGen(originalCallTool, toolName, args) {
    // 1. Check for existing template before execution
    const existingTemplate = checkForTemplate(toolName, args);

    // 2. Execute the tool
    const result = await originalCallTool(toolName, args);

    // 3. Generate template from result (unless it's a read-only/stats tool)
    const readOnlyTools = [
        'heady_health', 'heady_hcfp_status', 'heady_vector_stats',
    ];

    let templateResult = null;
    if (!readOnlyTools.includes(toolName)) {
        templateResult = generateTemplateFromResult(toolName, args, result);
    }

    // 4. Append template metadata to result if generated
    if (templateResult && result?.content?.[0]) {
        try {
            const originalText = result.content[0].text;
            const parsed = JSON.parse(originalText);
            parsed._heady_template = {
                injected: existingTemplate.found,
                generated: !!templateResult,
                bees: templateResult?.bees?.length || 0,
                swarms: templateResult?.swarms?.length || 0,
            };
            result.content[0].text = JSON.stringify(parsed, null, 2);
        } catch {
            // Non-JSON response, skip metadata injection
        }
    }

    return result;
}

module.exports = {
    checkForTemplate,
    generateTemplateFromResult,
    getTemplateStats,
    withTemplateAutoGen,
    generatedTemplates,
    templateHistory,
};
