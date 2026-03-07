'use strict';

/**
 * ─── HDY Parser ──────────────────────────────────────────────────────────────
 *
 * Parses .hdy (Heady Semantic Logic) files — a declarative scripting format
 * where control flow is defined as continuous semantic evaluation.
 *
 * The .hdy format is a YAML-like indentation-based document. This parser
 * handles the specific .hdy structure without requiring a full YAML library:
 *   - key: value  scalar pairs
 *   - key: [a, b]  inline arrays
 *   - nested objects via indentation
 *   - block arrays with leading dash (  - id: foo)
 *
 * @module hdy-parser
 */

const logger = require('../utils/logger');
const { PHI_INVERSE } = require('../core/phi-scales');

// ─── Constants ───────────────────────────────────────────────────────────────

const SCHEMA_VERSION  = 'heady_semantic_logic_v1';
const DEFAULT_EMBED_DIM = 384;
const DEFAULT_EVAL_INTERVAL_MS = 250;
const DEFAULT_THRESHOLD = PHI_INVERSE;           // 0.618
const DEFAULT_FUZZINESS = 1 - PHI_INVERSE;       // 0.382
const DEFAULT_RETRY    = 0;
const DEFAULT_TIMEOUT_MS = 5000;

// Supported CSL gate functions in weight formulas
const SUPPORTED_GATES = new Set([
    'resonance', 'superposition', 'orthogonal', 'soft_gate', 'ternary',
    'risk', 'phi_scale', 'min', 'max', 'threshold',
]);

// ─── HDYParseError ────────────────────────────────────────────────────────────

/**
 * Structured parse error with line number, section context, and helpful message.
 */
class HDYParseError extends Error {
    /**
     * @param {string} message
     * @param {object} [info={}]
     * @param {number} [info.line]      - 1-based line number
     * @param {string} [info.section]   - section name (e.g. 'semantic_states')
     * @param {string} [info.field]     - field name within section
     * @param {string} [info.hint]      - suggested fix
     */
    constructor(message, info = {}) {
        super(message);
        this.name    = 'HDYParseError';
        this.line    = info.line    ?? null;
        this.section = info.section ?? null;
        this.field   = info.field   ?? null;
        this.hint    = info.hint    ?? null;
    }

    toString() {
        const parts = [`HDYParseError: ${this.message}`];
        if (this.line    != null) parts.push(`  at line ${this.line}`);
        if (this.section != null) parts.push(`  in section '${this.section}'`);
        if (this.field   != null) parts.push(`  field '${this.field}'`);
        if (this.hint    != null) parts.push(`  hint: ${this.hint}`);
        return parts.join('\n');
    }
}

// ─── Tokenizer / line model ──────────────────────────────────────────────────

/**
 * Represents a single tokenised line from a .hdy source.
 * @typedef {{ raw: string, lineNo: number, indent: number, content: string,
 *             isDash: boolean, key: string|null, value: string|null }} HdyLine
 */

/**
 * Tokenise raw .hdy content into HdyLine objects.
 * @param {string} source
 * @returns {HdyLine[]}
 */
function tokenizeLines(source) {
    const raw = source.split('\n');
    const lines = [];

    for (let i = 0; i < raw.length; i++) {
        const rawLine = raw[i];
        // strip trailing whitespace / \r
        const stripped = rawLine.trimEnd().replace(/\r$/, '');

        // skip comments and blank lines for content lines
        const trimmed = stripped.trimStart();
        if (trimmed === '' || trimmed.startsWith('#')) {
            lines.push({ raw: rawLine, lineNo: i + 1, indent: 0, content: trimmed, isDash: false, key: null, value: null, blank: true });
            continue;
        }

        const indent = stripped.length - trimmed.length;
        const isDash = trimmed.startsWith('- ') || trimmed === '-';

        let key  = null;
        let value = null;

        const effective = isDash ? trimmed.slice(2).trimStart() : trimmed;

        const colonIdx = effective.indexOf(':');
        if (colonIdx !== -1) {
            key   = effective.slice(0, colonIdx).trim();
            value = effective.slice(colonIdx + 1).trim() || null;
        } else {
            // bare value — either a bare scalar on a plain line, or a bare dash item ("- deploy")
            value = effective || null;
        }

        lines.push({ raw: rawLine, lineNo: i + 1, indent, content: trimmed, isDash, key, value, blank: false });
    }
    return lines;
}

/**
 * Parse an inline array  "[a, b, c]"  into string items.
 * @param {string} str
 * @returns {string[]}
 */
function parseInlineArray(str) {
    const s = str.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
        return s.slice(1, -1).split(',').map(x => x.trim()).filter(Boolean);
    }
    return [s];
}

/**
 * Coerce a string value to its natural JS type.
 * @param {string} str
 * @returns {string|number|boolean|null}
 */
function coerce(str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    if (s === 'true')  return true;
    if (s === 'false') return false;
    if (s === 'null' || s === '~') return null;
    const n = Number(s);
    if (!isNaN(n) && s !== '') return n;
    // strip surrounding quotes
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}

/**
 * Check if a block of lines represents a bare-scalar list
 * (all non-blank dash items have no key, only a value — e.g. "  - deploy").
 * @param {HdyLine[]} lines
 * @returns {boolean}
 */
function isBareScalarList(lines) {
    const content = lines.filter(l => !l.blank);
    if (content.length === 0) return false;
    return content.every(l => l.isDash && l.key === null);
}

// ─── Section-level parser ────────────────────────────────────────────────────

/**
 * Given a slice of HdyLine[], parse it into a plain object or array.
 * Handles nested indentation recursively.
 *
 * @param {HdyLine[]} lines
 * @param {number}    baseIndent  - indent level of caller's block
 * @returns {object|Array}
 */
function parseBlock(lines, baseIndent = 0) {
    if (lines.length === 0) return {};

    // Determine if this block is a list (first non-blank content line is a dash)
    const firstContent = lines.find(l => !l.blank);
    if (!firstContent) return {};

    if (firstContent.isDash) {
        // bare scalar list: "- value" with no key
        if (isBareScalarList(lines)) {
            return lines.filter(l => !l.blank && l.isDash).map(l => coerce(l.value));
        }
        return parseListBlock(lines, baseIndent);
    }
    return parseObjectBlock(lines, baseIndent);
}

function parseObjectBlock(lines, baseIndent) {
    const obj = {};
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.blank) { i++; continue; }

        const { key, value } = line;
        if (key == null) { i++; continue; }

        // Child lines are lines strictly deeper than the current line's indent
        // AND deeper than baseIndent (so siblings are not consumed as children).
        // We require at least 1 extra space beyond line.indent to be a child.
        const childMinIndent = line.indent + 1;
        let j = i + 1;
        const childLines = [];
        while (j < lines.length) {
            const cl = lines[j];
            if (cl.blank) { childLines.push(cl); j++; continue; }
            if (cl.indent > line.indent) { childLines.push(cl); j++; }
            else break;
        }

        if (childLines.some(l => !l.blank)) {
            obj[key] = parseBlock(childLines, line.indent + 1);
        } else if (value !== null && value !== undefined) {
            // inline array?
            if (value.startsWith('[')) {
                obj[key] = parseInlineArray(value).map(coerce);
            } else {
                obj[key] = coerce(value);
            }
        } else {
            obj[key] = null;
        }

        i = j;
    }
    return obj;
}

function parseListBlock(lines, baseIndent) {
    const arr = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.blank) { i++; continue; }
        if (!line.isDash) { i++; continue; }

        // child lines: everything at indent > line.indent until next sibling dash or shallower
        const itemMinIndent = line.indent + 2;  // YAML: body of a dash item is 2 deeper
        let j = i + 1;
        const deeperLines = [];
        while (j < lines.length) {
            const cl = lines[j];
            if (cl.blank) { deeperLines.push(cl); j++; continue; }
            if (cl.indent >= itemMinIndent) { deeperLines.push(cl); j++; }
            else break;
        }

        // The dash line's own key:value (e.g. "- id: foo") forms the first entry.
        // Normalise all item lines to the same base indent (itemMinIndent) so that
        // parseObjectBlock sees them as siblings, not parent/child.
        const normalised = [
            // First line: shift indent to itemMinIndent so it's a peer of deeper lines
            { ...line, isDash: false, indent: itemMinIndent },
            ...deeperLines,
        ];

        arr.push(parseBlock(normalised, itemMinIndent));
        i = j;
    }
    return arr;
}

// ─── HDYParser ───────────────────────────────────────────────────────────────

class HDYParser {
    /**
     * @param {object} [opts={}]
     * @param {boolean} [opts.strict=true] - throw on unknown keys
     */
    constructor(opts = {}) {
        this.strict = opts.strict !== false;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    /**
     * Parse a full .hdy source string.
     *
     * @param {string} hdyContent - Raw .hdy file content
     * @returns {ParsedHDY}  validated, normalised parsed object
     * @throws {HDYParseError}
     */
    parse(hdyContent) {
        if (typeof hdyContent !== 'string') {
            throw new HDYParseError('hdyContent must be a string');
        }

        logger.debug('[HDYParser] parse() start, source length=' + hdyContent.length);

        const lines   = tokenizeLines(hdyContent);
        const rawDoc  = this._parseTopLevel(lines);

        // Parse each named section
        const parsed  = {
            schema:                rawDoc.schema                || null,
            name:                  rawDoc.name                  || null,
            version:               rawDoc.version               || null,
            target_node:           rawDoc.target_node           || null,
            description:           rawDoc.description           || null,
            semantic_states:       this.parseSection('semantic_states',       rawDoc.semantic_states       || []),
            continuous_evaluation: this.parseSection('continuous_evaluation', rawDoc.continuous_evaluation || {}),
            execution_graph:       this.parseSection('execution_graph',       rawDoc.execution_graph       || []),
            guardrails:            this.parseSection('guardrails',            rawDoc.guardrails            || []),
            metadata:              this.parseSection('metadata',              rawDoc.metadata              || {}),
        };

        this.validateSchema(parsed);
        this.normalizeConfig(parsed);

        logger.debug(`[HDYParser] parse() complete — ${parsed.semantic_states.length} states, ${parsed.execution_graph.length} actions`);
        return parsed;
    }

    /**
     * Parse a single named section from already-extracted raw data.
     *
     * @param {string} sectionName
     * @param {*}      content     - raw extracted value (array | object | string)
     * @returns {*}  typed section data
     * @throws {HDYParseError}
     */
    parseSection(sectionName, content) {
        switch (sectionName) {
            case 'semantic_states':
                return this._parseSemanticStates(content);
            case 'continuous_evaluation':
                return this._parseContinuousEvaluation(content);
            case 'execution_graph':
                return this._parseExecutionGraph(content);
            case 'guardrails':
                return this._parseGuardrails(content);
            case 'metadata':
                return this._parseMetadata(content);
            default:
                if (this.strict) {
                    throw new HDYParseError(`Unknown section '${sectionName}'`, { section: sectionName });
                }
                return content;
        }
    }

    /**
     * Validate a fully parsed .hdy document for schema correctness and
     * internal consistency (cross-references between states and actions).
     *
     * @param {object} parsed
     * @throws {HDYParseError}
     */
    validateSchema(parsed) {
        // Top-level required fields
        const required = ['schema', 'name', 'version', 'target_node'];
        for (const f of required) {
            if (!parsed[f]) {
                throw new HDYParseError(`Missing required top-level field '${f}'`, { field: f });
            }
        }

        if (parsed.schema !== SCHEMA_VERSION) {
            throw new HDYParseError(
                `Unsupported schema '${parsed.schema}'. Expected '${SCHEMA_VERSION}'`,
                { field: 'schema', hint: `Use schema: ${SCHEMA_VERSION}` }
            );
        }

        // Version semver pattern
        if (!/^\d+\.\d+\.\d+/.test(String(parsed.version))) {
            throw new HDYParseError(`Invalid semver '${parsed.version}'`, { field: 'version', hint: 'Use format: 1.0.0' });
        }

        // semantic_states must have unique ids and non-empty anchors
        const stateIds = new Set();
        for (const st of (parsed.semantic_states || [])) {
            if (!st.id)     throw new HDYParseError('semantic_states item missing id',     { section: 'semantic_states', field: 'id' });
            if (!st.anchor) throw new HDYParseError('semantic_states item missing anchor', { section: 'semantic_states', field: 'anchor', hint: 'anchor is the natural-language description of the semantic state' });
            if (stateIds.has(st.id)) {
                throw new HDYParseError(`Duplicate semantic_state id '${st.id}'`, { section: 'semantic_states', field: 'id' });
            }
            stateIds.add(st.id);
            if (typeof st.priority_weight !== 'number' || st.priority_weight < 0 || st.priority_weight > 1) {
                throw new HDYParseError(`priority_weight in state '${st.id}' must be a float in [0, 1]`, { section: 'semantic_states', field: 'priority_weight' });
            }
        }

        // execution_graph cross-references
        for (const node of (parsed.execution_graph || [])) {
            if (!node.id)     throw new HDYParseError('execution_graph node missing id',     { section: 'execution_graph', field: 'id' });
            if (!node.action) throw new HDYParseError(`execution_graph node '${node.id}' missing action`, { section: 'execution_graph', field: 'action' });
            for (const ref of (node.preconditions || [])) {
                if (!stateIds.has(ref)) {
                    throw new HDYParseError(
                        `execution_graph node '${node.id}' references unknown state '${ref}' in preconditions`,
                        { section: 'execution_graph', field: 'preconditions', hint: `Available states: ${[...stateIds].join(', ')}` }
                    );
                }
            }
            for (const ref of (node.postconditions || [])) {
                if (!stateIds.has(ref)) {
                    throw new HDYParseError(
                        `execution_graph node '${node.id}' references unknown state '${ref}' in postconditions`,
                        { section: 'execution_graph', field: 'postconditions', hint: `Available states: ${[...stateIds].join(', ')}` }
                    );
                }
            }
        }

        // guardrail fields
        for (const g of (parsed.guardrails || [])) {
            if (!g.id)         throw new HDYParseError('guardrails item missing id',         { section: 'guardrails', field: 'id' });
            if (!g.constraint) throw new HDYParseError(`guardrail '${g.id}' missing constraint`, { section: 'guardrails', field: 'constraint' });
            if (!['hard', 'soft', 'advisory'].includes(g.enforcement)) {
                throw new HDYParseError(`guardrail '${g.id}' enforcement must be hard|soft|advisory`, { section: 'guardrails', field: 'enforcement' });
            }
        }

        logger.debug('[HDYParser] validateSchema() passed');
    }

    /**
     * Parse a CSL weight formula expression string into an executable AST.
     *
     * Supported grammar:
     *   expr := call | binary | number | identifier
     *   call := name '(' arglist ')'
     *   binary := expr ('*' | '+') expr
     *   arglist := expr (',' expr)*
     *
     * @param {string} formulaStr  e.g. "resonance(state.deploy, context) * phi_scale(priority)"
     * @returns {ASTNode}
     * @throws {HDYParseError}
     */
    parseWeightFormula(formulaStr) {
        if (!formulaStr || typeof formulaStr !== 'string') {
            return { type: 'literal', value: 1.0 };
        }
        try {
            const tokens = this._tokenizeFormula(formulaStr.trim());
            const { node, pos } = this._parseExpr(tokens, 0);
            if (pos < tokens.length) {
                throw new Error(`Unexpected token '${tokens[pos].value}' at position ${pos}`);
            }
            return node;
        } catch (err) {
            throw new HDYParseError(
                `Invalid weight formula: "${formulaStr}" — ${err.message}`,
                { field: 'weight_formula', hint: 'Supported: resonance(), superposition(), orthogonal(), soft_gate(), ternary(), risk(), phi_scale(), min(), max(), threshold(), *, +' }
            );
        }
    }

    /**
     * Fill defaults and normalise values in a parsed document.
     * Resolves the special string "phi_equilibrium" to PHI_INVERSE.
     *
     * @param {object} parsed  - mutated in place
     */
    normalizeConfig(parsed) {
        // continuous_evaluation defaults
        const ce = parsed.continuous_evaluation;
        if (!ce.method) ce.method = 'cosine_similarity';
        if (ce.threshold_activation === 'phi_equilibrium' || ce.threshold_activation == null) {
            ce.threshold_activation = PHI_INVERSE;
        }
        if (ce.fuzziness == null) ce.fuzziness = DEFAULT_FUZZINESS;
        if (ce.evaluation_interval_ms == null) ce.evaluation_interval_ms = DEFAULT_EVAL_INTERVAL_MS;

        // state defaults
        for (const st of parsed.semantic_states) {
            if (st.category == null) st.category = 'general';
        }

        // execution_graph defaults
        for (const node of parsed.execution_graph) {
            if (node.timeout_ms == null) node.timeout_ms = DEFAULT_TIMEOUT_MS;
            if (node.retry      == null) node.retry      = DEFAULT_RETRY;
            if (!node.preconditions)  node.preconditions  = [];
            if (!node.postconditions) node.postconditions = [];

            // parse weight formula into AST if not already done
            if (typeof node.weight_formula === 'string') {
                node.weight_formula_ast = this.parseWeightFormula(node.weight_formula);
            } else {
                node.weight_formula_ast = { type: 'literal', value: 1.0 };
            }
        }

        // guardrail defaults
        for (const g of parsed.guardrails) {
            if (g.min_distance  == null) g.min_distance  = PHI_INVERSE * 0.5;
            if (g.enforcement   == null) g.enforcement   = 'soft';
            if (!g.message) g.message = `Guardrail '${g.id}' constraint violated`;
        }

        // metadata defaults
        if (!parsed.metadata) parsed.metadata = {};
        if (!parsed.metadata.tags) parsed.metadata.tags = [];

        logger.debug('[HDYParser] normalizeConfig() applied');
    }

    /**
     * Serialise a parsed document to a plain JSON-safe object.
     *
     * @param {object} parsed
     * @returns {object}
     */
    toJSON(parsed) {
        return JSON.parse(JSON.stringify(parsed, (key, val) => {
            if (val instanceof Float32Array) return { __float32: Array.from(val) };
            return val;
        }));
    }

    /**
     * Deserialise a JSON object (as produced by toJSON()) back to a parsed doc.
     *
     * @param {object} json
     * @returns {object}
     */
    fromJSON(json) {
        return JSON.parse(JSON.stringify(json), (key, val) => {
            if (val && typeof val === 'object' && val.__float32) {
                return new Float32Array(val.__float32);
            }
            return val;
        });
    }

    // ── Private — top-level document parse ──────────────────────────────────

    /**
     * Parse the top-level YAML-like document into a raw object where each
     * top-level key maps to its raw content.
     * @param {HdyLine[]} lines
     * @returns {object}
     */
    _parseTopLevel(lines) {
        const doc = {};
        const topLines = lines.filter(l => !l.blank);

        // Identify top-level keys (indent === 0, no dash)
        const topKeyIndices = [];
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (!l.blank && l.indent === 0 && !l.isDash && l.key) {
                topKeyIndices.push(i);
            }
        }

        for (let k = 0; k < topKeyIndices.length; k++) {
            const startIdx = topKeyIndices[k];
            const endIdx   = k + 1 < topKeyIndices.length ? topKeyIndices[k + 1] : lines.length;
            const line     = lines[startIdx];
            const key      = line.key;
            const value    = line.value;

            // gather child lines
            const childLines = lines.slice(startIdx + 1, endIdx).filter(l => !l.blank || true);
            const hasChildren = childLines.some(l => !l.blank);

            if (!hasChildren) {
                if (value !== null && value !== undefined && value !== '') {
                    doc[key] = coerce(value);
                } else {
                    doc[key] = null;
                }
            } else {
                // has nested content
                if (value !== null && value !== undefined && value !== '') {
                    doc[key] = coerce(value);
                } else {
                    doc[key] = parseBlock(childLines, 2);
                }
            }
        }

        return doc;
    }

    // ── Private — section parsers ────────────────────────────────────────────

    _parseSemanticStates(raw) {
        if (!Array.isArray(raw)) {
            throw new HDYParseError('semantic_states must be a list', { section: 'semantic_states' });
        }
        return raw.map((item, idx) => {
            return {
                id:              String(item.id      ?? ''),
                anchor:          String(item.anchor  ?? ''),
                priority_weight: typeof item.priority_weight === 'number' ? item.priority_weight : parseFloat(item.priority_weight) || 0.5,
                category:        String(item.category ?? 'general'),
            };
        });
    }

    _parseContinuousEvaluation(raw) {
        if (!raw || typeof raw !== 'object') return {};
        const thresh = raw.threshold_activation;
        return {
            method:                 String(raw.method || 'cosine_similarity'),
            threshold_activation:   thresh === 'phi_equilibrium' ? 'phi_equilibrium' : (typeof thresh === 'number' ? thresh : parseFloat(thresh) || PHI_INVERSE),
            fuzziness:              typeof raw.fuzziness === 'number' ? raw.fuzziness : parseFloat(raw.fuzziness) || DEFAULT_FUZZINESS,
            evaluation_interval_ms: parseInt(raw.evaluation_interval_ms, 10) || DEFAULT_EVAL_INTERVAL_MS,
        };
    }

    _parseExecutionGraph(raw) {
        if (!Array.isArray(raw)) {
            throw new HDYParseError('execution_graph must be a list', { section: 'execution_graph' });
        }
        return raw.map((item) => {
            const preconditions  = Array.isArray(item.preconditions)  ? item.preconditions.map(String)  : [];
            const postconditions = Array.isArray(item.postconditions) ? item.postconditions.map(String) : [];
            return {
                id:               String(item.id     ?? ''),
                action:           String(item.action ?? ''),
                weight_formula:   String(item.weight_formula ?? '1.0'),
                preconditions,
                postconditions,
                timeout_ms:       parseInt(item.timeout_ms, 10) || DEFAULT_TIMEOUT_MS,
                retry:            parseInt(item.retry,      10) || DEFAULT_RETRY,
            };
        });
    }

    _parseGuardrails(raw) {
        if (!Array.isArray(raw)) {
            throw new HDYParseError('guardrails must be a list', { section: 'guardrails' });
        }
        return raw.map((item) => {
            const enforcement = ['hard', 'soft', 'advisory'].includes(item.enforcement)
                ? item.enforcement : 'soft';
            return {
                id:           String(item.id         ?? ''),
                constraint:   String(item.constraint ?? ''),
                min_distance: typeof item.min_distance === 'number' ? item.min_distance : parseFloat(item.min_distance) || (PHI_INVERSE * 0.5),
                enforcement,
                message:      String(item.message ?? ''),
            };
        });
    }

    _parseMetadata(raw) {
        if (!raw || typeof raw !== 'object') return {};
        const tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
        return {
            author:  String(raw.author  || ''),
            created: String(raw.created || ''),
            tags,
        };
    }

    // ── Private — formula tokenizer & parser ─────────────────────────────────

    /**
     * Tokenise a formula string into an array of tokens.
     * @param {string} src
     * @returns {Array<{type:string, value:string}>}
     */
    _tokenizeFormula(src) {
        const tokens = [];
        let i = 0;
        while (i < src.length) {
            const ch = src[i];
            // whitespace
            if (/\s/.test(ch)) { i++; continue; }
            // number  (int or float)
            if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
                let num = '';
                while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
                tokens.push({ type: 'number', value: num });
                continue;
            }
            // identifier or keyword  (letters, digits, _, .)
            if (/[a-zA-Z_]/.test(ch)) {
                let id = '';
                while (i < src.length && /[a-zA-Z0-9_.]/.test(src[i])) id += src[i++];
                tokens.push({ type: 'identifier', value: id });
                continue;
            }
            // single-char operators / punctuation
            if ('(,)*+'.includes(ch)) {
                tokens.push({ type: 'punct', value: ch });
                i++;
                continue;
            }
            throw new Error(`Unexpected character '${ch}' in formula`);
        }
        return tokens;
    }

    /**
     * Recursive-descent expression parser.
     * @param {Array} tokens
     * @param {number} pos
     * @returns {{ node: ASTNode, pos: number }}
     */
    _parseExpr(tokens, pos) {
        let { node, pos: p } = this._parsePrimary(tokens, pos);

        // handle binary operators: * and +
        while (p < tokens.length && tokens[p].type === 'punct' && '* +'.includes(tokens[p].value.trim())) {
            const op = tokens[p].value;
            p++;
            const { node: right, pos: p2 } = this._parsePrimary(tokens, p);
            node = { type: 'binary', op, left: node, right };
            p = p2;
        }
        return { node, pos: p };
    }

    _parsePrimary(tokens, pos) {
        if (pos >= tokens.length) throw new Error('Unexpected end of formula');

        const tok = tokens[pos];

        // number literal
        if (tok.type === 'number') {
            return { node: { type: 'literal', value: parseFloat(tok.value) }, pos: pos + 1 };
        }

        // identifier or function call
        if (tok.type === 'identifier') {
            const name = tok.value;
            // function call?
            if (pos + 1 < tokens.length && tokens[pos + 1].value === '(') {
                const args = [];
                let p = pos + 2;  // skip name and '('
                // handle empty arg list
                if (p < tokens.length && tokens[p].value === ')') {
                    return { node: { type: 'call', name, args }, pos: p + 1 };
                }
                while (true) {
                    const { node: arg, pos: p2 } = this._parseExpr(tokens, p);
                    args.push(arg);
                    p = p2;
                    if (p >= tokens.length) throw new Error(`Unclosed '(' in call to '${name}'`);
                    if (tokens[p].value === ')') { p++; break; }
                    if (tokens[p].value === ',') { p++; continue; }
                    throw new Error(`Expected ',' or ')' in call to '${name}', got '${tokens[p].value}'`);
                }
                return { node: { type: 'call', name, args }, pos: p };
            }
            // plain identifier / dot-path reference
            return { node: { type: 'ref', name }, pos: pos + 1 };
        }

        // parenthesised expression
        if (tok.type === 'punct' && tok.value === '(') {
            const { node, pos: p } = this._parseExpr(tokens, pos + 1);
            if (p >= tokens.length || tokens[p].value !== ')') {
                throw new Error("Expected closing ')'");
            }
            return { node, pos: p + 1 };
        }

        throw new Error(`Unexpected token '${tok.value}'`);
    }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = { HDYParser, HDYParseError };
