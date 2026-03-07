/*
 * © 2026 Heady Systems LLC.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * ═══ Token Budget Allocator — Model-Aware Dynamic Packing ═══
 *
 * Greedy packing engine that assembles the optimal prompt payload
 * for any LLM, packing Si-scored AST nodes until the model's
 * context window is exactly filled (minus output reservation).
 *
 * Payload structure:
 *   ### INTENT        (non-negotiable — always included)
 *   ### TARGET        (non-negotiable — the node being mutated)
 *   ### CONTEXT       (Si-ranked, greedily packed)
 *
 * Token counting: len/4 heuristic (within 5% of cl100k_base).
 */

'use strict';

const logger = require('../utils/logger').child('token-allocator');

// ── Model context window ceilings ──────────────────────────────
const MODEL_LIMITS = {
    // Claude family
    'claude-3-5-sonnet': 195000,
    'claude-3-opus': 195000,
    'claude-3-haiku': 195000,
    'claude': 195000,
    // OpenAI family
    'gpt-4': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-3.5-turbo': 16000,
    // Google family
    'gemini-2.0-flash': 1000000,
    'gemini-1.5-pro': 2000000,
    'gemini': 1000000,
    // Groq (fast but shorter window)
    'groq': 32000,
    'llama-3.1-70b': 128000,
    'mixtral-8x7b': 32000,
    // Defaults
    'default': 128000,
};

const DEFAULT_RESERVED_OUTPUT = 4000;

/**
 * Count tokens in a text string.
 * Uses len/4 heuristic — within ~5% of cl100k_base for English text.
 *
 * @param {string} text
 * @returns {number} estimated token count
 */
function countTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Resolve the context window limit for a given model routing string.
 *
 * @param {string} modelRouting — model identifier
 * @returns {number} max context tokens
 */
function resolveModelLimit(modelRouting) {
    if (!modelRouting) return MODEL_LIMITS.default;

    const key = modelRouting.toLowerCase();

    // Exact match
    if (MODEL_LIMITS[key]) return MODEL_LIMITS[key];

    // Prefix match (e.g., "claude-3-5-sonnet-20241022" → "claude")
    for (const [model, limit] of Object.entries(MODEL_LIMITS)) {
        if (key.includes(model) || model.includes(key)) return limit;
    }

    return MODEL_LIMITS.default;
}

/**
 * Assemble an optimal prompt payload by greedily packing Si-scored nodes.
 *
 * @param {string} intentText — the mutation intent / command
 * @param {Object} targetNode — the target AST node being mutated
 * @param {string} targetNode.code — source code of the target (or stringified AST)
 * @param {string} targetNode.filepath — file path
 * @param {string} targetNode.signature — function/class signature
 * @param {Object[]} scoredNodes — Si-scored dependency nodes (pre-sorted desc)
 * @param {string} modelRouting — model identifier for token limit
 * @param {Object} options
 * @param {number} options.reservedOutput — tokens reserved for AI output
 * @returns {Object} { payload, metrics }
 */
function allocate(intentText, targetNode, scoredNodes, modelRouting = 'default', options = {}) {
    const {
        reservedOutput = DEFAULT_RESERVED_OUTPUT,
    } = options;

    const start = Date.now();
    const maxContextTokens = resolveModelLimit(modelRouting);
    const availableTokens = maxContextTokens - reservedOutput;

    // ── Section 1: INTENT (non-negotiable) ─────────────────────
    const intentSection = `### INTENT ###\n${intentText}\n\n`;

    // ── Section 2: TARGET (non-negotiable) ─────────────────────
    const targetCode = targetNode.code
        || (targetNode.ast ? JSON.stringify(targetNode.ast) : '')
        || '// [Target node code unavailable]';

    const targetSection = `### TARGET AST TO MUTATE ###\n`
        + `// File: ${targetNode.filepath || targetNode.path || 'unknown'}`
        + ` | Node: ${targetNode.signature || targetNode.name || 'target'}\n`
        + `${targetCode}\n\n`;

    // ── Section 3: CONTEXT (greedily packed) ───────────────────
    let contextHeader = `### RELEVANT SYSTEM CONTEXT ###\n`;

    const coreTokens = countTokens(intentSection)
        + countTokens(targetSection)
        + countTokens(contextHeader);

    if (coreTokens >= availableTokens) {
        // Intent + target already exceed budget — truncate target
        logger.warn(`Core sections (${coreTokens} tokens) exceed budget (${availableTokens}). Truncating target.`);
        const truncatedTarget = targetCode.substring(0, (availableTokens - countTokens(intentSection) - 100) * 4);
        const payload = intentSection + `### TARGET (TRUNCATED) ###\n${truncatedTarget}\n`;
        return {
            payload,
            metrics: _metrics(payload, 0, scoredNodes.length, maxContextTokens, reservedOutput, modelRouting, start),
        };
    }

    let currentTokens = coreTokens;
    let payload = intentSection + targetSection + contextHeader;
    let includedNodes = 0;
    let skippedNodes = 0;
    const includedScores = [];

    // Greedy packing — nodes are already sorted by Si descending
    for (const node of scoredNodes) {
        const nodeCode = node.code
            || (node.ast?._rawSource)
            || (node.ast ? JSON.stringify(node.ast) : '')
            || '';

        const nodeText = `// File: ${node.filepath || node.path || 'unknown'}`
            + ` | Node: ${node.signature || node.name || 'node'}`
            + ` | Si: ${node.composite_score}\n`
            + `${nodeCode}\n\n`;

        const nodeTokens = countTokens(nodeText);

        // Budget check — if adding this node exceeds available, stop
        if (currentTokens + nodeTokens > availableTokens) {
            skippedNodes++;
            continue; // Try next (smaller) nodes before giving up
        }

        payload += nodeText;
        currentTokens += nodeTokens;
        includedNodes++;
        includedScores.push(node.composite_score);

        // Hard stop — no point continuing if we're at 95%+ capacity
        if (currentTokens > availableTokens * 0.95) break;
    }

    skippedNodes += scoredNodes.length - includedNodes - skippedNodes;

    return {
        payload,
        metrics: _metrics(payload, includedNodes, scoredNodes.length, maxContextTokens, reservedOutput, modelRouting, start, includedScores),
    };
}

/**
 * Preview allocation metrics without assembling the full payload.
 */
function preview(intentText, targetNode, scoredNodes, modelRouting = 'default') {
    const maxContextTokens = resolveModelLimit(modelRouting);
    const available = maxContextTokens - DEFAULT_RESERVED_OUTPUT;

    const coreTokens = countTokens(intentText)
        + countTokens(targetNode.code || JSON.stringify(targetNode.ast || {}))
        + 100; // headers

    let running = coreTokens;
    let wouldInclude = 0;

    for (const node of scoredNodes) {
        const nodeCode = node.code || node.ast?._rawSource || JSON.stringify(node.ast || {});
        const nt = countTokens(nodeCode) + 50; // header
        if (running + nt <= available) {
            running += nt;
            wouldInclude++;
        }
    }

    return {
        model: modelRouting,
        maxTokens: maxContextTokens,
        available,
        coreTokens,
        estimatedTotal: running,
        wouldInclude,
        wouldExclude: scoredNodes.length - wouldInclude,
        packEfficiency: +(running / available * 100).toFixed(1),
    };
}

function _metrics(payload, included, total, maxTokens, reserved, model, startTime, scores = []) {
    const usedTokens = countTokens(payload);
    const available = maxTokens - reserved;
    return {
        modelRouting: model,
        maxContextTokens: maxTokens,
        reservedOutput: reserved,
        availableTokens: available,
        usedTokens,
        remainingTokens: available - usedTokens,
        packEfficiency: +(usedTokens / available * 100).toFixed(1),
        nodesIncluded: included,
        nodesTotal: total,
        nodesExcluded: total - included,
        siScoreRange: scores.length > 0
            ? { min: Math.min(...scores), max: Math.max(...scores) }
            : null,
        assemblyTimeMs: Date.now() - startTime,
    };
}

module.exports = {
    allocate,
    preview,
    countTokens,
    resolveModelLimit,
    MODEL_LIMITS,
    DEFAULT_RESERVED_OUTPUT,
};
