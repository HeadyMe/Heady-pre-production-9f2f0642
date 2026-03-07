'use strict';

/**
 * ─── HDY Compiler ────────────────────────────────────────────────────────────
 *
 * Compiles .hdy scripts into optimised runtime representations.
 *
 * Compilation pipeline:
 *   1. Parse source via HDYParser
 *   2. Pre-compute all anchor/guardrail embeddings (deterministic hash)
 *   3. Resolve all cross-references between states, actions, guardrails
 *   4. Pre-parse all weight_formula strings into optimised ASTs
 *   5. Validate all CSL gate references
 *   6. Return a CompiledHDYScript — or optionally serialise to .hdyc binary buffer
 *
 * The binary .hdyc format:
 *   [4]  magic:  0x48 0x44 0x59 0x43  ("HDYC")
 *   [1]  format version:  0x01
 *   [1]  flags:           bit0=embeddings, bit1=optimized
 *   [4]  sourceHash (uint32 big-endian)
 *   [4]  embeddingsOffset (uint32 big-endian) — byte offset from file start
 *   [4]  graphOffset      (uint32 big-endian)
 *   [4]  formulaOffset    (uint32 big-endian)
 *   [4]  guardrailOffset  (uint32 big-endian)
 *   --- embeddings section ---
 *   [4]  count
 *   for each embedding: [2] idLen, [idLen] id bytes, [4*dim] float32 bytes
 *   --- graph section ---
 *   [4]  jsonLen, [jsonLen] UTF-8 JSON bytes
 *   --- formula section ---
 *   [4]  jsonLen, [jsonLen] UTF-8 JSON bytes
 *   --- guardrail section ---
 *   [4]  jsonLen, [jsonLen] UTF-8 JSON bytes
 *
 * @module hdy-compiler
 */

const { HDYParser }   = require('./hdy-parser');
const CSL             = require('../core/semantic-logic');
const { PHI, PHI_INVERSE } = require('../core/phi-scales');
const logger          = require('../utils/logger');

// ─── Constants ─────────────────────────────────────────────────────────────

const EMBED_DIM    = 384;
const MAGIC        = Buffer.from([0x48, 0x44, 0x59, 0x43]);   // "HDYC"
const FORMAT_VER   = 0x01;
const HEADER_SIZE  = 4 + 1 + 1 + 4 + 4 + 4 + 4 + 4;          // 22 bytes

/** Supported CSL gate names for formula validation */
const VALID_GATES = new Set([
    'resonance', 'superposition', 'orthogonal', 'soft_gate', 'ternary',
    'risk', 'phi_scale', 'min', 'max', 'threshold',
]);

// ─── Deterministic embedder (same as runtime, no external dependency) ──────

/**
 * Deterministic LCG-based Float32Array embedding for a text string.
 * @param {string} text
 * @param {number} [dim=384]
 * @returns {Float32Array}
 */
function deterministicEmbed(text, dim = EMBED_DIM) {
    const vec = new Float32Array(dim);
    let seed = 5381;
    for (let i = 0; i < text.length; i++) {
        seed = ((seed << 5) + seed) ^ text.charCodeAt(i);
        seed = seed >>> 0;
    }
    let s = seed;
    for (let i = 0; i < dim; i++) {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        vec[i] = (s / 0xFFFFFFFF) * 2 - 1;
    }
    return CSL.normalize(vec);
}

// ─── CompiledHDYScript ───────────────────────────────────────────────────────

/**
 * Compiled representation of a .hdy script.
 * All heavy work (embedding, formula parsing, cross-reference resolution) is
 * done once at compile time so the runtime can run lean.
 */
class CompiledHDYScript {
    /**
     * @param {object} opts
     * @param {Map<string, Float32Array>} opts.precomputedEmbeddings
     * @param {object}                    opts.resolvedGraph
     * @param {Map<string, object>}       opts.formulaCache
     * @param {Map<string, Float32Array>} opts.guardrailVectors
     * @param {object}                    opts.parsedDoc       - full parsed .hdy document
     * @param {object}                    opts.metadata
     */
    constructor(opts) {
        /** @type {Map<string, Float32Array>} stateId → embedding vector */
        this.precomputedEmbeddings = opts.precomputedEmbeddings;

        /** @type {object} resolved & linked execution graph */
        this.resolvedGraph         = opts.resolvedGraph;

        /** @type {Map<string, object>} actionId → parsed formula AST */
        this.formulaCache          = opts.formulaCache;

        /** @type {Map<string, Float32Array>} guardrailId → embedding vector */
        this.guardrailVectors      = opts.guardrailVectors;

        /** @type {object} full normalised parsed document */
        this.parsedDoc             = opts.parsedDoc;

        /**
         * Compilation metadata.
         * @type {{ compiledAt: string, sourceHash: number, version: string,
         *          anchorCount: number, actionCount: number, optimized: boolean }}
         */
        this.metadata              = opts.metadata;
    }

    /**
     * Serialise compilation metadata to a plain object (for logging/inspection).
     * @returns {object}
     */
    toSummary() {
        return {
            name:         this.parsedDoc.name,
            version:      this.parsedDoc.version,
            target_node:  this.parsedDoc.target_node,
            ...this.metadata,
            embeddingDim: this.precomputedEmbeddings.size > 0
                ? [...this.precomputedEmbeddings.values()][0].length
                : 0,
        };
    }
}

// ─── HDYCompiler ─────────────────────────────────────────────────────────────

class HDYCompiler {
    /**
     * @param {object} [opts={}]
     * @param {number}  [opts.embeddingDimension=384]
     * @param {boolean} [opts.optimize=true]  - run optimisation passes
     * @param {boolean} [opts.strict=true]    - strict schema validation
     */
    constructor(opts = {}) {
        this._dim      = opts.embeddingDimension ?? EMBED_DIM;
        this._optimize = opts.optimize !== false;
        this._strict   = opts.strict   !== false;
        this._parser   = new HDYParser({ strict: this._strict });
    }

    // ── Public API ────────────────────────────────────────────────────────

    /**
     * Compile a raw .hdy source string into a CompiledHDYScript.
     *
     * @param {string} hdySource
     * @returns {CompiledHDYScript}
     * @throws {HDYParseError|Error}
     */
    compile(hdySource) {
        logger.debug('[HDYCompiler] compile() start');

        const sourceHash = this.generateSourceHash(hdySource);

        // Step 1: Parse
        const parsedDoc = this._parser.parse(hdySource);

        // Step 2: Pre-compute embeddings
        const precomputedEmbeddings = new Map();
        for (const st of parsedDoc.semantic_states) {
            precomputedEmbeddings.set(st.id, deterministicEmbed(st.anchor, this._dim));
        }

        // Step 3: Pre-compute guardrail vectors
        const guardrailVectors = new Map();
        for (const g of (parsedDoc.guardrails || [])) {
            guardrailVectors.set(g.id, deterministicEmbed(g.constraint, this._dim));
        }

        // Step 4: Build resolved graph with pre-linked state references
        const resolvedGraph = this._resolveGraph(parsedDoc, precomputedEmbeddings);

        // Step 5: Build formula cache (ASTs already parsed by normalizeConfig; copy them out)
        const formulaCache = new Map();
        for (const node of parsedDoc.execution_graph) {
            formulaCache.set(node.id, node.weight_formula_ast || { type: 'literal', value: 1.0 });
        }

        // Step 6: Validate CSL gate references
        this._validateGateReferences(formulaCache);

        const compiled = new CompiledHDYScript({
            precomputedEmbeddings,
            resolvedGraph,
            formulaCache,
            guardrailVectors,
            parsedDoc,
            metadata: {
                compiledAt:   new Date().toISOString(),
                sourceHash,
                version:      parsedDoc.version,
                anchorCount:  precomputedEmbeddings.size,
                actionCount:  parsedDoc.execution_graph.length,
                optimized:    false,
            },
        });

        // Step 7: Optional optimisation passes
        if (this._optimize) {
            this.optimize(compiled);
        }

        this.validate(compiled);

        logger.info(`[HDYCompiler] compile() done — ${compiled.metadata.anchorCount} anchors, ${compiled.metadata.actionCount} actions`);
        return compiled;
    }

    /**
     * Compile a .hdy source and serialise the result to a binary Buffer (.hdyc).
     *
     * @param {string} hdySource
     * @returns {Buffer}
     */
    compileToBuffer(hdySource) {
        const compiled = this.compile(hdySource);
        return this._serialiseToBuffer(compiled);
    }

    /**
     * Deserialise a .hdyc buffer back into a CompiledHDYScript.
     *
     * @param {Buffer} buffer
     * @returns {CompiledHDYScript}
     * @throws {Error}
     */
    loadFromBuffer(buffer) {
        logger.debug('[HDYCompiler] loadFromBuffer() start, length=' + buffer.length);

        if (!Buffer.isBuffer(buffer) || buffer.length < HEADER_SIZE) {
            throw new Error('[HDYCompiler] loadFromBuffer: invalid or truncated buffer');
        }

        // Verify magic bytes
        for (let i = 0; i < 4; i++) {
            if (buffer[i] !== MAGIC[i]) {
                throw new Error('[HDYCompiler] loadFromBuffer: invalid magic bytes — not a .hdyc file');
            }
        }

        const formatVer = buffer[4];
        if (formatVer !== FORMAT_VER) {
            throw new Error(`[HDYCompiler] loadFromBuffer: unsupported format version 0x${formatVer.toString(16)}`);
        }

        const flags            = buffer[5];
        const sourceHash       = buffer.readUInt32BE(6);
        const embeddingsOffset = buffer.readUInt32BE(10);
        const graphOffset      = buffer.readUInt32BE(14);
        const formulaOffset    = buffer.readUInt32BE(18);
        const guardrailOffset  = buffer.readUInt32BE(22);   // total header = 26 bytes for 4 sections

        // Read embeddings
        const precomputedEmbeddings = new Map();
        let pos = embeddingsOffset;
        const embCount = buffer.readUInt32BE(pos); pos += 4;
        for (let i = 0; i < embCount; i++) {
            const idLen = buffer.readUInt16BE(pos); pos += 2;
            const id    = buffer.slice(pos, pos + idLen).toString('utf8'); pos += idLen;
            const dim   = this._dim;
            const floats = new Float32Array(dim);
            for (let d = 0; d < dim; d++) {
                floats[d] = buffer.readFloatBE(pos); pos += 4;
            }
            precomputedEmbeddings.set(id, floats);
        }

        // Read graph
        const graphLen  = buffer.readUInt32BE(graphOffset);
        const graphJSON = buffer.slice(graphOffset + 4, graphOffset + 4 + graphLen).toString('utf8');
        const resolvedGraph = JSON.parse(graphJSON);

        // Read formula cache
        const formulaLen  = buffer.readUInt32BE(formulaOffset);
        const formulaJSON = buffer.slice(formulaOffset + 4, formulaOffset + 4 + formulaLen).toString('utf8');
        const formulaEntries = JSON.parse(formulaJSON);
        const formulaCache = new Map(formulaEntries);

        // Read guardrail vectors
        const guardrailVectors = new Map();
        let gPos = guardrailOffset;
        const gLen  = buffer.readUInt32BE(gPos); gPos += 4;
        const gJSON = buffer.slice(gPos, gPos + gLen).toString('utf8');
        const guardrailData = JSON.parse(gJSON);
        for (const [id, arr] of guardrailData) {
            guardrailVectors.set(id, new Float32Array(arr));
        }

        // parsedDoc and metadata are stored in the graph JSON under __meta
        const parsedDoc = resolvedGraph.__parsedDoc || {};
        const metadata  = resolvedGraph.__metadata   || {};
        metadata.sourceHash = sourceHash;

        delete resolvedGraph.__parsedDoc;
        delete resolvedGraph.__metadata;

        logger.debug('[HDYCompiler] loadFromBuffer() done');
        return new CompiledHDYScript({
            precomputedEmbeddings,
            resolvedGraph,
            formulaCache,
            guardrailVectors,
            parsedDoc,
            metadata,
        });
    }

    /**
     * Verify integrity of a CompiledHDYScript.
     * Checks: embeddings present for all states, references resolve, formulas valid.
     *
     * @param {CompiledHDYScript} compiled
     * @throws {Error}
     */
    validate(compiled) {
        const { parsedDoc, precomputedEmbeddings, formulaCache, guardrailVectors } = compiled;

        // All states must have embeddings
        for (const st of parsedDoc.semantic_states) {
            if (!precomputedEmbeddings.has(st.id)) {
                throw new Error(`[HDYCompiler] validate: missing embedding for state '${st.id}'`);
            }
            const emb = precomputedEmbeddings.get(st.id);
            if (!(emb instanceof Float32Array) || emb.length !== this._dim) {
                throw new Error(`[HDYCompiler] validate: embedding for state '${st.id}' has wrong shape`);
            }
        }

        // All actions must have formula cache entries
        for (const node of parsedDoc.execution_graph) {
            if (!formulaCache.has(node.id)) {
                throw new Error(`[HDYCompiler] validate: missing formula cache entry for action '${node.id}'`);
            }
        }

        // Guardrails must have vectors
        for (const g of (parsedDoc.guardrails || [])) {
            if (!guardrailVectors.has(g.id)) {
                throw new Error(`[HDYCompiler] validate: missing guardrail vector for '${g.id}'`);
            }
        }

        // Validate gate references in formulas
        this._validateGateReferences(formulaCache);

        logger.debug('[HDYCompiler] validate() passed');
    }

    /**
     * Run optimisation passes over a compiled script (mutates in place).
     *
     * Passes:
     *   1. Dead action elimination — actions that can never activate (weight formula
     *      always evaluates to 0 regardless of state scores) are flagged.
     *   2. Guardrail pre-evaluation — guardrails where cosine similarity to any
     *      state anchor is always above min_distance are flagged as skippable.
     *   3. Embedding deduplication — identical vectors (cosine = 1.0) share storage.
     *   4. Formula simplification — constant sub-expressions collapsed to literals.
     *
     * @param {CompiledHDYScript} compiled  - mutated in place
     */
    optimize(compiled) {
        logger.debug('[HDYCompiler] optimize() start');

        // Pass 1: Dead action elimination
        const deadActions = new Set();
        for (const node of compiled.parsedDoc.execution_graph) {
            const ast = compiled.formulaCache.get(node.id);
            if (ast && this._isConstantZero(ast)) {
                deadActions.add(node.id);
                logger.debug(`[HDYCompiler] optimize: dead action '${node.id}' (formula always 0)`);
            }
        }
        if (deadActions.size > 0) {
            compiled.resolvedGraph.deadActions = [...deadActions];
        }

        // Pass 2: Guardrail pre-evaluation
        const skippableGuardrails = new Set();
        for (const g of (compiled.parsedDoc.guardrails || [])) {
            const gVec = compiled.guardrailVectors.get(g.id);
            if (!gVec) continue;

            // Check if all state embeddings are already sufficiently distant
            let alwaysSafe = true;
            for (const [stId, stVec] of compiled.precomputedEmbeddings) {
                const sim  = CSL.cosine_similarity(stVec, gVec);
                const dist = 1 - sim;
                if (dist < g.min_distance) { alwaysSafe = false; break; }
            }
            if (alwaysSafe) {
                skippableGuardrails.add(g.id);
                logger.debug(`[HDYCompiler] optimize: guardrail '${g.id}' is statically safe, skippable`);
            }
        }
        if (skippableGuardrails.size > 0) {
            compiled.resolvedGraph.skippableGuardrails = [...skippableGuardrails];
        }

        // Pass 3: Embedding deduplication
        const seenHashes = new Map();
        const canonical  = new Map();
        for (const [id, vec] of compiled.precomputedEmbeddings) {
            const h = this._vecHash(vec);
            if (seenHashes.has(h)) {
                canonical.set(id, seenHashes.get(h));   // point to existing
            } else {
                seenHashes.set(h, id);
            }
        }
        if (canonical.size > 0) {
            compiled.resolvedGraph.embeddingAliases = Object.fromEntries(canonical);
            logger.debug(`[HDYCompiler] optimize: ${canonical.size} embedding(s) deduplicated`);
        }

        // Pass 4: Formula simplification — collapse constant binary ops
        for (const [id, ast] of compiled.formulaCache) {
            compiled.formulaCache.set(id, this._simplifyAST(ast));
        }

        compiled.metadata.optimized = true;
        logger.debug('[HDYCompiler] optimize() done');
    }

    /**
     * Generate a deterministic uint32 hash of a .hdy source string.
     * Used for cache invalidation: if the source changes, the hash changes.
     *
     * @param {string} source
     * @returns {number}  unsigned 32-bit integer
     */
    generateSourceHash(source) {
        // FNV-1a 32-bit
        let hash = 0x811c9dc5;
        for (let i = 0; i < source.length; i++) {
            hash ^= source.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        return hash >>> 0;
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /**
     * Resolve execution_graph cross-references, injecting direct object references
     * to the state objects referenced in pre/postconditions.
     *
     * @param {object}                    parsedDoc
     * @param {Map<string, Float32Array>} embeddings
     * @returns {object}  resolved graph structure
     */
    _resolveGraph(parsedDoc, embeddings) {
        const stateIndex = new Map(parsedDoc.semantic_states.map(s => [s.id, s]));

        const actions = parsedDoc.execution_graph.map(node => {
            const preStates  = node.preconditions.map(id  => stateIndex.get(id)).filter(Boolean);
            const postStates = node.postconditions.map(id => stateIndex.get(id)).filter(Boolean);

            return {
                ...node,
                preStateRefs:  preStates,
                postStateRefs: postStates,
            };
        });

        return {
            actions,
            stateCount:  parsedDoc.semantic_states.length,
            actionCount: actions.length,
        };
    }

    /**
     * Walk all formula ASTs in the cache and verify all call nodes reference
     * known gate functions.
     *
     * @param {Map<string, object>} formulaCache
     * @throws {Error}
     */
    _validateGateReferences(formulaCache) {
        for (const [id, ast] of formulaCache) {
            this._walkAST(ast, (node) => {
                if (node.type === 'call' && !VALID_GATES.has(node.name)) {
                    throw new Error(`[HDYCompiler] Unknown gate '${node.name}' in formula for action '${id}'. Valid gates: ${[...VALID_GATES].join(', ')}`);
                }
            });
        }
    }

    /**
     * Recursively walk an AST, calling visitor on every node.
     * @param {object}   node
     * @param {Function} visitor
     */
    _walkAST(node, visitor) {
        if (!node) return;
        visitor(node);
        if (node.type === 'binary') { this._walkAST(node.left, visitor); this._walkAST(node.right, visitor); }
        if (node.type === 'call')   { (node.args || []).forEach(a => this._walkAST(a, visitor)); }
    }

    /**
     * Determine if an AST node always evaluates to 0 (dead formula).
     * @param {object} ast
     * @returns {boolean}
     */
    _isConstantZero(ast) {
        if (!ast) return true;
        if (ast.type === 'literal') return ast.value === 0;
        if (ast.type === 'binary' && ast.op === '*') {
            return this._isConstantZero(ast.left) || this._isConstantZero(ast.right);
        }
        return false;
    }

    /**
     * Recursively simplify constant subexpressions in an AST.
     * E.g. 0 * anything → literal(0), 1 * x → x, 0 + x → x.
     *
     * @param {object} ast
     * @returns {object}  simplified AST (new object, original unchanged)
     */
    _simplifyAST(ast) {
        if (!ast) return ast;
        if (ast.type !== 'binary') return ast;

        const left  = this._simplifyAST(ast.left);
        const right = this._simplifyAST(ast.right);

        const lLit = left.type  === 'literal';
        const rLit = right.type === 'literal';

        if (ast.op === '*') {
            if (lLit && left.value  === 0) return { type: 'literal', value: 0 };
            if (rLit && right.value === 0) return { type: 'literal', value: 0 };
            if (lLit && left.value  === 1) return right;
            if (rLit && right.value === 1) return left;
            if (lLit && rLit) return { type: 'literal', value: left.value * right.value };
        }
        if (ast.op === '+') {
            if (lLit && left.value  === 0) return right;
            if (rLit && right.value === 0) return left;
            if (lLit && rLit) return { type: 'literal', value: Math.min(1, left.value + right.value) };
        }

        return { ...ast, left, right };
    }

    /**
     * Compute a cheap hash of a Float32Array for deduplication.
     * @param {Float32Array} vec
     * @returns {string}
     */
    _vecHash(vec) {
        let h = 0x811c9dc5;
        // Sample every 16th element for speed — good enough for dedup check
        for (let i = 0; i < vec.length; i += 16) {
            const bits = Math.round(vec[i] * 65535) & 0xFFFF;
            h ^= bits;
            h = Math.imul(h, 0x01000193) >>> 0;
        }
        return h.toString(16);
    }

    /**
     * Serialise a CompiledHDYScript into a binary Buffer.
     * @param {CompiledHDYScript} compiled
     * @returns {Buffer}
     */
    _serialiseToBuffer(compiled) {
        // Build each section as a Buffer
        const embBuf      = this._serialiseEmbeddings(compiled.precomputedEmbeddings);
        const guardrailBuf = this._serialiseGuardrailVectors(compiled.guardrailVectors);

        // Graph + parsedDoc + metadata as JSON
        const graphPayload = {
            ...compiled.resolvedGraph,
            __parsedDoc: compiled.parsedDoc,
            __metadata:  compiled.metadata,
        };
        const graphBuf    = this._jsonSection(graphPayload);
        const formulaBuf  = this._jsonSection([...compiled.formulaCache.entries()]);

        // Calculate offsets  (header is 4+1+1+4 + 4*4 = 26 bytes)
        const HEADER = 26;
        const embOff      = HEADER;
        const graphOff    = embOff      + embBuf.length;
        const formulaOff  = graphOff    + graphBuf.length;
        const guardrailOff = formulaOff + formulaBuf.length;

        const header = Buffer.alloc(HEADER);
        MAGIC.copy(header, 0);
        header[4] = FORMAT_VER;
        header[5] = 0x03;  // flags: bit0=embeddings, bit1=optimized
        header.writeUInt32BE(compiled.metadata.sourceHash, 6);
        header.writeUInt32BE(embOff,       10);
        header.writeUInt32BE(graphOff,     14);
        header.writeUInt32BE(formulaOff,   18);
        header.writeUInt32BE(guardrailOff, 22);

        return Buffer.concat([header, embBuf, graphBuf, formulaBuf, guardrailBuf]);
    }

    _serialiseEmbeddings(embeddingMap) {
        const count = embeddingMap.size;
        const parts = [Buffer.alloc(4)];
        parts[0].writeUInt32BE(count, 0);

        for (const [id, vec] of embeddingMap) {
            const idBytes = Buffer.from(id, 'utf8');
            const lenBuf  = Buffer.alloc(2);
            lenBuf.writeUInt16BE(idBytes.length, 0);
            const floatBuf = Buffer.alloc(vec.length * 4);
            for (let i = 0; i < vec.length; i++) {
                floatBuf.writeFloatBE(vec[i], i * 4);
            }
            parts.push(lenBuf, idBytes, floatBuf);
        }
        return Buffer.concat(parts);
    }

    _serialiseGuardrailVectors(guardrailMap) {
        const entries = [...guardrailMap.entries()].map(([id, vec]) => [id, Array.from(vec)]);
        return this._jsonSection(entries);
    }

    _jsonSection(data) {
        const json = JSON.stringify(data);
        const jsonBuf = Buffer.from(json, 'utf8');
        const lenBuf  = Buffer.alloc(4);
        lenBuf.writeUInt32BE(jsonBuf.length, 0);
        return Buffer.concat([lenBuf, jsonBuf]);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { HDYCompiler, CompiledHDYScript };
