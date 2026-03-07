'use strict';

/**
 * regenerative-meta-prompt.js — Heady Regenerative Meta-Prompt Engine
 *
 * Enables stateless but context-aware cold-start orchestration. A
 * RegenerativePrompt is a self-contained document that carries semantic
 * anchors, an execution graph, tool registrations, and system prerequisites
 * so that ANY HeadyNode can bootstrap itself from zero context.
 *
 * The prompt is both machine-executable (bootstrap()) and human-readable
 * (toPromptText()), making it suitable for LLM consumption as well as
 * programmatic orchestration.
 *
 * @module prompts/regenerative-meta-prompt
 */

const CSL    = require('../core/semantic-logic');
const { PhiScale, PhiRange, PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum readiness confidence to report ready=true */
const READINESS_THRESHOLD = PHI_INVERSE;           // 0.618

/** Default timeout (ms) for tool/prerequisite health checks */
const CHECK_TIMEOUT_MS = 5_000;

/** How many Fibonacci-spaced retry attempts to allow during bootstrap */
const MAX_BOOTSTRAP_RETRIES = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic-ish 384-dim Float32Array "fingerprint" vector from
 * a plain string.  In production this would call a real embedding model; here
 * we seed a simple LCG so tests are reproducible without any network call.
 *
 * @param {string} text
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function _embedText(text, dim = 384) {
    const vec = new Float32Array(dim);
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
        seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    }
    let s = seed || 1;
    for (let i = 0; i < dim; i++) {
        s = (s * 1664525 + 1013904223) >>> 0;
        vec[i] = (s / 0xffffffff) * 2 - 1;
    }
    return CSL.normalize(vec);
}

/**
 * Simulate a network reachability check.  Returns a Promise that resolves to
 * { reachable: bool, latencyMs: number }.  In real deployments replace with
 * an actual HTTP GET / TCP probe.
 *
 * @param {string} endpoint
 * @param {number} [timeoutMs]
 * @returns {Promise<{ reachable: boolean, latencyMs: number }>}
 */
function _probeEndpoint(endpoint, timeoutMs = CHECK_TIMEOUT_MS) {
    return new Promise(resolve => {
        const start = Date.now();
        // Simulate ~95 % reachability; unreachable if endpoint contains 'DEAD'
        const reachable = !String(endpoint).includes('DEAD');
        const latencyMs = reachable ? Math.floor(Math.random() * 80) + 20 : timeoutMs;
        setTimeout(
            () => resolve({ reachable, latencyMs }),
            reachable ? latencyMs : 100,
        );
    });
}

// ── RegenerativePrompt ────────────────────────────────────────────────────────

/**
 * A self-contained, serialisable orchestration document that carries
 * everything a HeadyNode needs to bootstrap from cold start.
 */
class RegenerativePrompt {

    // -------------------------------------------------------------------------
    // Construction
    // -------------------------------------------------------------------------

    /**
     * @param {object} config
     * @param {string}   config.name               - Human-readable prompt name
     * @param {string}   [config.version='1.0.0']  - Semver string
     * @param {string}   [config.description='']   - Purpose description
     * @param {string}   [config.targetNode='*']   - Node ID or wildcard
     * @param {number}   [config.embeddingDimension=384]
     */
    constructor(config = {}) {
        this.name               = config.name               ?? 'unnamed-prompt';
        this.version            = config.version            ?? '1.0.0';
        this.description        = config.description        ?? '';
        this.targetNode         = config.targetNode         ?? '*';
        this.embeddingDimension = config.embeddingDimension ?? 384;
        this.createdAt          = config.createdAt          ?? new Date().toISOString();

        /** @type {Array<{ id: string, description: string, vector: Float32Array }>} */
        this.semanticAnchors = [];

        /** @type {object}  HDY-compatible execution graph */
        this.executionGraph = {};

        /** @type {Array<{ key: string, description: string, required: boolean }>} */
        this.contextRequirements = [];

        /** @type {Array<{ name: string, type: 'mcp'|'api'|'local', endpoint: string, authRequired: boolean }>} */
        this.toolRegistrations = [];

        /** @type {Array<{ service: string, minVersion: string, healthEndpoint: string }>} */
        this.systemPrerequisites = [];

        // Phi-scaled confidence threshold for readiness gate
        this._readinessScale = new PhiScale({
            name:          'readiness',
            baseValue:     READINESS_THRESHOLD,
            min:           0,
            max:           1,
            phiNormalized: true,
            sensitivity:   PHI_INVERSE,
            unit:          'confidence',
            category:      'bootstrap',
        });

        // Event hook callbacks
        this._hooks = {
            onBootstrapStart:    null,
            onBootstrapComplete: null,
            onBootstrapFailed:   null,
        };

        logger.debug('RegenerativePrompt created', {
            name: this.name,
            version: this.version,
            targetNode: this.targetNode,
        });
    }

    // -------------------------------------------------------------------------
    // Event Hooks
    // -------------------------------------------------------------------------

    /** @param {function} fn */
    set onBootstrapStart(fn)    { this._hooks.onBootstrapStart    = fn; }
    /** @param {function} fn */
    set onBootstrapComplete(fn) { this._hooks.onBootstrapComplete = fn; }
    /** @param {function} fn */
    set onBootstrapFailed(fn)   { this._hooks.onBootstrapFailed   = fn; }

    _fireHook(name, payload) {
        const fn = this._hooks[name];
        if (typeof fn === 'function') {
            try { fn(payload); } catch (e) {
                logger.warn('Hook threw', { hook: name, err: e.message });
            }
        }
    }

    // -------------------------------------------------------------------------
    // bootstrap(options={}) — THE CORE METHOD
    // -------------------------------------------------------------------------

    /**
     * Bootstrap this prompt into a live HeadyNode context.
     *
     * Steps:
     *  1. Parse embedded semantic anchors → AnchorRegistry entries
     *  2. Load execution graph as HDY-compatible structure
     *  3. Verify tool connections (async endpoint probes)
     *  4. Validate system prerequisites (async health checks)
     *  5. Compute readiness score via CSL.consensus_superposition
     *
     * @param {object}   [options={}]
     * @param {boolean}  [options.skipToolChecks=false]
     * @param {boolean}  [options.skipPrereqChecks=false]
     * @param {number}   [options.timeoutMs=5000]
     * @returns {Promise<{
     *   ready: boolean,
     *   confidence: number,
     *   missingRequirements: string[],
     *   failedPrerequisites: string[],
     *   bootstrapTime: number,
     * }>}
     */
    async bootstrap(options = {}) {
        const t0 = Date.now();
        const timeout = options.timeoutMs ?? CHECK_TIMEOUT_MS;

        this._fireHook('onBootstrapStart', { name: this.name, version: this.version });
        logger.info('Bootstrap started', { prompt: this.name, version: this.version });

        const missingRequirements = [];
        const failedPrerequisites = [];
        const validationVectors   = [];

        // ── Step 1: Parse and register semantic anchors ──────────────────────
        const anchorRegistry = new Map();
        for (const anchor of this.semanticAnchors) {
            const vector = anchor.vector instanceof Float32Array
                ? anchor.vector
                : _embedText(anchor.description, this.embeddingDimension);

            anchorRegistry.set(anchor.id, {
                id:          anchor.id,
                description: anchor.description,
                vector:      CSL.normalize(vector),
                registeredAt: Date.now(),
            });

            // Use the normalised magnitude as a proxy "quality" signal
            const quality = CSL.norm(vector);
            const qualityVec = new Float32Array(this.embeddingDimension).fill(
                Math.min(1, quality / Math.sqrt(this.embeddingDimension)),
            );
            validationVectors.push(qualityVec);
        }
        logger.debug('Step 1: Anchors registered', { count: anchorRegistry.size });

        // ── Step 2: Load execution graph ─────────────────────────────────────
        const liveGraph = this._loadExecutionGraph(this.executionGraph);
        const graphVector = _embedText(
            JSON.stringify(Object.keys(liveGraph)),
            this.embeddingDimension,
        );
        validationVectors.push(graphVector);
        logger.debug('Step 2: Execution graph loaded', {
            nodes: Object.keys(liveGraph).length,
        });

        // ── Step 3: Verify tool connections ───────────────────────────────────
        if (!options.skipToolChecks) {
            const toolChecks = this.toolRegistrations.map(async tool => {
                try {
                    const { reachable, latencyMs } = await _probeEndpoint(tool.endpoint, timeout);
                    const score = reachable ? Math.min(1, 1 - latencyMs / (timeout * PHI)) : 0;
                    logger.debug('Tool check', { name: tool.name, reachable, latencyMs, score });
                    if (!reachable) failedPrerequisites.push(`tool:${tool.name}`);
                    const scoreVec = new Float32Array(this.embeddingDimension).fill(score);
                    return CSL.normalize(scoreVec);
                } catch (err) {
                    logger.warn('Tool check error', { name: tool.name, err: err.message });
                    failedPrerequisites.push(`tool:${tool.name}`);
                    return new Float32Array(this.embeddingDimension).fill(0.1);
                }
            });
            const toolVectors = await Promise.all(toolChecks);
            validationVectors.push(...toolVectors);
            logger.debug('Step 3: Tool checks complete', {
                total: toolChecks.length,
                failed: failedPrerequisites.length,
            });
        }

        // ── Step 4: Validate system prerequisites ────────────────────────────
        if (!options.skipPrereqChecks) {
            const prereqChecks = this.systemPrerequisites.map(async prereq => {
                try {
                    const { reachable } = await _probeEndpoint(prereq.healthEndpoint, timeout);
                    if (!reachable) failedPrerequisites.push(`prereq:${prereq.service}`);
                    const score = reachable ? PHI_INVERSE + (1 - PHI_INVERSE) * Math.random() * 0.2 : 0;
                    const scoreVec = new Float32Array(this.embeddingDimension).fill(score);
                    return CSL.normalize(scoreVec);
                } catch (err) {
                    logger.warn('Prereq check error', { service: prereq.service, err: err.message });
                    failedPrerequisites.push(`prereq:${prereq.service}`);
                    return new Float32Array(this.embeddingDimension).fill(0.05);
                }
            });
            const prereqVectors = await Promise.all(prereqChecks);
            validationVectors.push(...prereqVectors);
            logger.debug('Step 4: Prereq checks complete', {
                total: prereqChecks.length,
            });
        }

        // Check required context keys
        for (const req of this.contextRequirements) {
            if (req.required && !req.value) {
                missingRequirements.push(req.key);
            }
        }

        // ── Step 5: Compute readiness via consensus_superposition ─────────────
        let confidence = 0;
        if (validationVectors.length > 0) {
            const consensusVec = CSL.consensus_superposition(validationVectors);
            // Project onto a unit scalar: mean of absolute values gives a quality signal
            const absSum = Array.from(consensusVec).reduce((s, v) => s + Math.abs(v), 0);
            confidence = Math.min(1, absSum / (consensusVec.length * Math.sqrt(PHI_INVERSE)));

            // Adjust our readiness scale based on how many failures occurred
            const failureRatio = failedPrerequisites.length /
                Math.max(1, this.toolRegistrations.length + this.systemPrerequisites.length);
            this._readinessScale.adjust({ cpuPressure: failureRatio });
        }

        const threshold  = this._readinessScale.value;
        const ready      = confidence >= threshold && missingRequirements.length === 0;
        const bootstrapTime = Date.now() - t0;

        const result = { ready, confidence, missingRequirements, failedPrerequisites, bootstrapTime };

        if (ready) {
            this._fireHook('onBootstrapComplete', result);
            logger.info('Bootstrap complete', result);
        } else {
            this._fireHook('onBootstrapFailed', result);
            logger.warn('Bootstrap failed readiness gate', result);
        }

        return result;
    }

    // ── Internal: load execution graph into live structure ────────────────────

    /**
     * Convert a plain execution_graph object into a live HDY-compatible
     * structure with typed node references.
     *
     * @param {object} rawGraph
     * @returns {object}
     */
    _loadExecutionGraph(rawGraph) {
        const live = {};
        for (const [key, node] of Object.entries(rawGraph)) {
            live[key] = {
                ...node,
                _live: true,
                _loadedAt: Date.now(),
                _vector: _embedText(
                    `${key} ${JSON.stringify(node)}`.slice(0, 256),
                    this.embeddingDimension,
                ),
            };
        }
        return live;
    }

    // -------------------------------------------------------------------------
    // static generate(hdyScript, runtimeState={})
    // -------------------------------------------------------------------------

    /**
     * Generate a RegenerativePrompt from a parsed .hdy script and optional
     * runtime state snapshot.
     *
     * @param {object} hdyScript     - Parsed .hdy object with semantic_states + execution_graph
     * @param {object} [runtimeState={}] - Optional live PhiScale snapshots / current values
     * @returns {RegenerativePrompt}
     */
    static generate(hdyScript, runtimeState = {}) {
        const prompt = new RegenerativePrompt({
            name:        hdyScript.name        ?? 'generated-prompt',
            version:     hdyScript.version     ?? '1.0.0',
            description: hdyScript.description ?? 'Auto-generated from .hdy script',
            targetNode:  hdyScript.targetNode  ?? '*',
        });

        // Extract anchors from semantic_states
        const states = hdyScript.semantic_states ?? {};
        for (const [id, state] of Object.entries(states)) {
            prompt.semanticAnchors.push({
                id,
                description: state.description ?? state.label ?? id,
                vector: _embedText(state.description ?? id, prompt.embeddingDimension),
            });
        }

        // Extract graph from execution_graph
        prompt.executionGraph = hdyScript.execution_graph ?? {};

        // Capture PhiScale values as context requirements
        for (const [key, val] of Object.entries(runtimeState)) {
            prompt.contextRequirements.push({
                key,
                description: `Runtime snapshot of ${key}`,
                required: false,
                value: val,
            });
        }

        // Generate tool registrations from action_handlers
        const handlers = hdyScript.action_handlers ?? {};
        for (const [name, handler] of Object.entries(handlers)) {
            prompt.toolRegistrations.push({
                name,
                type:         handler.type         ?? 'local',
                endpoint:     handler.endpoint     ?? `local://${name}`,
                authRequired: handler.authRequired ?? false,
            });
        }

        logger.info('RegenerativePrompt generated from HDY script', {
            name: prompt.name,
            anchors: prompt.semanticAnchors.length,
            tools: prompt.toolRegistrations.length,
        });

        return prompt;
    }

    // -------------------------------------------------------------------------
    // serialize() / static deserialize(json)
    // -------------------------------------------------------------------------

    /**
     * Serialize to a self-contained JSON document for cold-start delivery.
     * Float32Arrays are converted to plain arrays for JSON compatibility.
     *
     * @returns {object}
     */
    serialize() {
        return {
            _type:              'RegenerativePrompt',
            _schemaVersion:     '1.0.0',
            name:               this.name,
            version:            this.version,
            description:        this.description,
            targetNode:         this.targetNode,
            embeddingDimension: this.embeddingDimension,
            createdAt:          this.createdAt,
            semanticAnchors: this.semanticAnchors.map(a => ({
                id:          a.id,
                description: a.description,
                vector:      Array.from(a.vector instanceof Float32Array ? a.vector : _embedText(a.description, this.embeddingDimension)),
            })),
            executionGraph:      this.executionGraph,
            contextRequirements: this.contextRequirements,
            toolRegistrations:   this.toolRegistrations,
            systemPrerequisites: this.systemPrerequisites,
        };
    }

    /**
     * Reconstruct a RegenerativePrompt from a serialised JSON document.
     *
     * @param {object|string} json
     * @returns {RegenerativePrompt}
     */
    static deserialize(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;

        if (data._type !== 'RegenerativePrompt') {
            throw new TypeError(`Expected _type 'RegenerativePrompt', got '${data._type}'`);
        }

        const prompt = new RegenerativePrompt({
            name:               data.name,
            version:            data.version,
            description:        data.description,
            targetNode:         data.targetNode,
            embeddingDimension: data.embeddingDimension ?? 384,
            createdAt:          data.createdAt,
        });

        prompt.semanticAnchors = (data.semanticAnchors ?? []).map(a => ({
            id:          a.id,
            description: a.description,
            vector:      a.vector ? new Float32Array(a.vector) : _embedText(a.description, prompt.embeddingDimension),
        }));

        prompt.executionGraph      = data.executionGraph      ?? {};
        prompt.contextRequirements = data.contextRequirements ?? [];
        prompt.toolRegistrations   = data.toolRegistrations   ?? [];
        prompt.systemPrerequisites = data.systemPrerequisites ?? [];

        logger.debug('RegenerativePrompt deserialized', { name: prompt.name });
        return prompt;
    }

    // -------------------------------------------------------------------------
    // toPromptText()
    // -------------------------------------------------------------------------

    /**
     * Generate a human-readable prompt text for LLM consumption.
     *
     * @returns {string}
     */
    toPromptText() {
        const lines = [];

        lines.push(`# Heady Regenerative Meta-Prompt: ${this.name} v${this.version}`);
        lines.push(`## Purpose: ${this.description}`);
        lines.push(`## Target Node: ${this.targetNode}`);
        lines.push('');

        lines.push('## Semantic Anchors:');
        if (this.semanticAnchors.length === 0) {
            lines.push('  (none)');
        } else {
            for (const a of this.semanticAnchors) {
                lines.push(`  - [${a.id}] ${a.description}`);
            }
        }
        lines.push('');

        lines.push('## Execution Graph:');
        const nodes = Object.keys(this.executionGraph);
        if (nodes.length === 0) {
            lines.push('  (empty)');
        } else {
            lines.push(`  Nodes: ${nodes.join(' → ')}`);
            for (const [key, node] of Object.entries(this.executionGraph)) {
                const next = node.next ?? node.transitions ?? [];
                const nextStr = Array.isArray(next) ? next.join(', ') : String(next);
                lines.push(`  • ${key}${nextStr ? ` → [${nextStr}]` : ''}: ${node.description ?? node.type ?? ''}`);
            }
        }
        lines.push('');

        lines.push('## Required Tools:');
        if (this.toolRegistrations.length === 0) {
            lines.push('  (none)');
        } else {
            for (const t of this.toolRegistrations) {
                lines.push(`  - ${t.name} (${t.type}) @ ${t.endpoint}${t.authRequired ? ' [auth required]' : ''}`);
            }
        }
        lines.push('');

        lines.push('## Prerequisites:');
        if (this.systemPrerequisites.length === 0) {
            lines.push('  (none)');
        } else {
            for (const p of this.systemPrerequisites) {
                lines.push(`  - ${p.service} >= ${p.minVersion} — health: ${p.healthEndpoint}`);
            }
        }
        lines.push('');

        lines.push('## Bootstrap Instructions:');
        lines.push('  1. Parse semantic anchors and register them in the local AnchorRegistry.');
        lines.push('  2. Load the execution graph as a live HDY-compatible structure.');
        lines.push('  3. Probe each tool endpoint; mark unreachable tools as failed prerequisites.');
        lines.push('  4. Run health checks for all system prerequisites; log failures.');
        lines.push('  5. Compute readiness score via CSL consensus_superposition of validation vectors.');
        lines.push(`  6. If confidence >= ${READINESS_THRESHOLD.toFixed(4)} (PHI_INVERSE) and no required`);
        lines.push('     context is missing, set ready=true and proceed with execution.');
        lines.push('  7. Otherwise surface the missing/failed items and halt or degrade gracefully.');
        lines.push('');

        lines.push(`## Context Requirements: (${this.contextRequirements.length} items)`);
        for (const c of this.contextRequirements) {
            lines.push(`  - ${c.key}${c.required ? ' [REQUIRED]' : ''}: ${c.description}`);
        }

        return lines.join('\n');
    }

    // -------------------------------------------------------------------------
    // validate()
    // -------------------------------------------------------------------------

    /**
     * Self-validation: check internal consistency of all sections.
     *
     * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
     */
    validate() {
        const errors   = [];
        const warnings = [];

        if (!this.name)    errors.push('name is required');
        if (!this.version) errors.push('version is required');

        // Check anchor IDs are unique
        const anchorIds = new Set();
        for (const a of this.semanticAnchors) {
            if (!a.id)          errors.push(`anchor missing id: ${JSON.stringify(a)}`);
            if (!a.description) warnings.push(`anchor '${a.id}' has no description`);
            if (anchorIds.has(a.id)) errors.push(`duplicate anchor id: ${a.id}`);
            anchorIds.add(a.id);
        }

        // Check tool registrations
        const validTypes = new Set(['mcp', 'api', 'local']);
        for (const t of this.toolRegistrations) {
            if (!t.name)     errors.push(`tool missing name`);
            if (!t.endpoint) errors.push(`tool '${t.name}' missing endpoint`);
            if (!validTypes.has(t.type)) {
                warnings.push(`tool '${t.name}' has unknown type '${t.type}'`);
            }
        }

        // Check required context requirements have values
        for (const c of this.contextRequirements) {
            if (c.required && (c.value === undefined || c.value === null)) {
                warnings.push(`required context '${c.key}' has no value`);
            }
        }

        // Verify execution graph references valid anchors if nodes specify states
        for (const [key, node] of Object.entries(this.executionGraph)) {
            if (node.semanticState && !anchorIds.has(node.semanticState)) {
                warnings.push(`graph node '${key}' references unknown anchor '${node.semanticState}'`);
            }
        }

        logger.debug('Validation result', {
            prompt: this.name,
            errors: errors.length,
            warnings: warnings.length,
        });

        return { valid: errors.length === 0, errors, warnings };
    }

    // -------------------------------------------------------------------------
    // merge(otherPrompt)
    // -------------------------------------------------------------------------

    /**
     * Merge two RegenerativePrompts via CSL superposition of their anchors.
     * The resulting prompt contains the union of both prompts' anchors, graphs,
     * tools, and prerequisites.  Duplicate anchor IDs are merged by
     * vector superposition.
     *
     * @param {RegenerativePrompt} otherPrompt
     * @returns {RegenerativePrompt}
     */
    merge(otherPrompt) {
        const merged = new RegenerativePrompt({
            name:               `${this.name}+${otherPrompt.name}`,
            version:            '1.0.0',
            description:        `Merged: ${this.description} | ${otherPrompt.description}`,
            targetNode:         this.targetNode === otherPrompt.targetNode
                                    ? this.targetNode : '*',
            embeddingDimension: this.embeddingDimension,
        });

        // Merge anchors: combine by ID, superpose vectors for duplicates
        const anchorMap = new Map();
        for (const a of [...this.semanticAnchors, ...otherPrompt.semanticAnchors]) {
            const vecA = a.vector instanceof Float32Array ? a.vector
                : _embedText(a.description, this.embeddingDimension);
            if (anchorMap.has(a.id)) {
                const existing = anchorMap.get(a.id);
                anchorMap.set(a.id, {
                    id:          a.id,
                    description: `${existing.description} / ${a.description}`,
                    vector:      CSL.superposition_gate(existing.vector, vecA),
                });
            } else {
                anchorMap.set(a.id, { id: a.id, description: a.description, vector: vecA });
            }
        }
        merged.semanticAnchors = Array.from(anchorMap.values());

        // Merge execution graphs (shallow union — this takes precedence on conflict)
        merged.executionGraph = { ...otherPrompt.executionGraph, ...this.executionGraph };

        // Union context requirements (deduplicate by key)
        const reqMap = new Map();
        for (const r of [...this.contextRequirements, ...otherPrompt.contextRequirements]) {
            reqMap.set(r.key, r);
        }
        merged.contextRequirements = Array.from(reqMap.values());

        // Union tools (deduplicate by name)
        const toolMap = new Map();
        for (const t of [...this.toolRegistrations, ...otherPrompt.toolRegistrations]) {
            toolMap.set(t.name, t);
        }
        merged.toolRegistrations = Array.from(toolMap.values());

        // Union prerequisites (deduplicate by service)
        const prereqMap = new Map();
        for (const p of [...this.systemPrerequisites, ...otherPrompt.systemPrerequisites]) {
            prereqMap.set(p.service, p);
        }
        merged.systemPrerequisites = Array.from(prereqMap.values());

        logger.info('Prompts merged', {
            a: this.name,
            b: otherPrompt.name,
            mergedAnchors: merged.semanticAnchors.length,
        });
        return merged;
    }

    // -------------------------------------------------------------------------
    // diff(otherPrompt)
    // -------------------------------------------------------------------------

    /**
     * Semantic diff: report what anchors, actions, and tools differ between
     * this prompt and another.
     *
     * @param {RegenerativePrompt} otherPrompt
     * @returns {{
     *   anchors:  { added: string[], removed: string[], changed: string[] },
     *   tools:    { added: string[], removed: string[] },
     *   prereqs:  { added: string[], removed: string[] },
     *   graphKeys:{ added: string[], removed: string[] },
     * }}
     */
    diff(otherPrompt) {
        const setA   = new Map(this.semanticAnchors.map(a => [a.id, a]));
        const setB   = new Map(otherPrompt.semanticAnchors.map(a => [a.id, a]));

        const anchors = {
            added:   [...setB.keys()].filter(id => !setA.has(id)),
            removed: [...setA.keys()].filter(id => !setB.has(id)),
            changed: [],
        };

        // Detect semantically changed anchors via cosine similarity
        for (const id of [...setA.keys()].filter(id => setB.has(id))) {
            const vecA = setA.get(id).vector instanceof Float32Array
                ? setA.get(id).vector
                : _embedText(setA.get(id).description, this.embeddingDimension);
            const vecB = setB.get(id).vector instanceof Float32Array
                ? setB.get(id).vector
                : _embedText(setB.get(id).description, this.embeddingDimension);
            const sim = CSL.cosine_similarity(vecA, vecB);
            if (sim < READINESS_THRESHOLD) {
                anchors.changed.push({ id, similarity: sim });
            }
        }

        const toolsA = new Set(this.toolRegistrations.map(t => t.name));
        const toolsB = new Set(otherPrompt.toolRegistrations.map(t => t.name));

        const graphA = new Set(Object.keys(this.executionGraph));
        const graphB = new Set(Object.keys(otherPrompt.executionGraph));

        const prereqA = new Set(this.systemPrerequisites.map(p => p.service));
        const prereqB = new Set(otherPrompt.systemPrerequisites.map(p => p.service));

        return {
            anchors,
            tools: {
                added:   [...toolsB].filter(n => !toolsA.has(n)),
                removed: [...toolsA].filter(n => !toolsB.has(n)),
            },
            prereqs: {
                added:   [...prereqB].filter(s => !prereqA.has(s)),
                removed: [...prereqA].filter(s => !prereqB.has(s)),
            },
            graphKeys: {
                added:   [...graphB].filter(k => !graphA.has(k)),
                removed: [...graphA].filter(k => !graphB.has(k)),
            },
        };
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { RegenerativePrompt };
