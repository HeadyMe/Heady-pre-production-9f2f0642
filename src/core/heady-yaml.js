/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

/**
 * @fileoverview YAML parser and stringifier for the Heady™ AI Platform.
 * Replaces js-yaml. Supports a broad subset of YAML 1.2:
 *   - Scalars: strings, numbers, booleans, null
 *   - Block sequences (- item)
 *   - Block mappings (key: value)
 *   - Inline/flow sequences and mappings ([...], {...})
 *   - Quoted strings (single and double)
 *   - Multi-line strings (| literal, > folded)
 *   - Comments (#)
 *   - Nested structures (indentation-based)
 *   - Multiple documents (---) — returns first doc by default
 *
 * Not supported: anchors/aliases, tags, complex keys.
 * @module src/core/heady-yaml
 */

// ---------------------------------------------------------------------------
// Scalar coercion
// ---------------------------------------------------------------------------

/** @type {Record<string, boolean|null>} */
const BOOL_VALUES = {
  'true': true, 'yes': true, 'on': true,
  'false': false, 'no': false, 'off': false,
};

const NULL_VALUES = new Set(['null', 'Null', 'NULL', '~', '']);

/**
 * Coerces a raw YAML scalar string to its JavaScript value.
 * @param {string} raw
 * @returns {*}
 */
function _coerceScalar(raw) {
  if (NULL_VALUES.has(raw)) return null;

  const lower = raw.toLowerCase();
  if (lower in BOOL_VALUES) return BOOL_VALUES[lower];

  // Integer
  if (/^-?0x[0-9a-f]+$/i.test(raw)) return parseInt(raw, 16);
  if (/^-?0o[0-7]+$/.test(raw)) return parseInt(raw.replace('0o', ''), 8);
  if (/^-?[0-9]+$/.test(raw)) return parseInt(raw, 10);

  // Float
  if (/^-?[0-9]*\.[0-9]+([eE][+-]?[0-9]+)?$/.test(raw)) return parseFloat(raw);
  if (/^-?[0-9]+[eE][+-]?[0-9]+$/.test(raw)) return parseFloat(raw);
  if (raw === '.inf' || raw === '.Inf' || raw === '.INF') return Infinity;
  if (raw === '-.inf' || raw === '-.Inf' || raw === '-.INF') return -Infinity;
  if (raw === '.nan' || raw === '.NaN' || raw === '.NAN') return NaN;

  return raw;
}

// ---------------------------------------------------------------------------
// Tokeniser / line parser
// ---------------------------------------------------------------------------

/**
 * Strips a comment from an unquoted value.
 * @param {string} str
 * @returns {string}
 */
function _stripInlineComment(str) {
  // Only strip if # is preceded by whitespace
  return str.replace(/\s+#.*$/, '');
}

/**
 * Parses a flow scalar (handles quoted strings).
 * @param {string} str - Trimmed value string
 * @returns {{ value: *, rest: string }}
 */
function _parseFlowScalar(str) {
  if (str.startsWith('"')) {
    // Double-quoted
    let i = 1;
    let result = '';
    while (i < str.length) {
      const ch = str[i];
      if (ch === '\\') {
        const esc = str[i + 1];
        const escMap = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', '0': '\0', 'a': '\x07', 'b': '\b', 'f': '\f', 'v': '\x0B' };
        result += escMap[esc] !== undefined ? escMap[esc] : esc;
        i += 2;
      } else if (ch === '"') {
        return { value: result, rest: str.slice(i + 1).trimStart() };
      } else {
        result += ch;
        i++;
      }
    }
    return { value: result, rest: '' };
  } else if (str.startsWith("'")) {
    // Single-quoted (no escape processing except '' = ')
    let i = 1;
    let result = '';
    while (i < str.length) {
      if (str[i] === "'" && str[i + 1] === "'") {
        result += "'";
        i += 2;
      } else if (str[i] === "'") {
        return { value: result, rest: str.slice(i + 1).trimStart() };
      } else {
        result += str[i++];
      }
    }
    return { value: result, rest: '' };
  }

  // Unquoted
  const end = str.search(/\s*[,}\]#]/);
  const raw = end === -1 ? str : str.slice(0, end);
  const rest = end === -1 ? '' : str.slice(end).trimStart();
  return { value: _coerceScalar(raw.trim()), rest };
}

// ---------------------------------------------------------------------------
// Flow collection parsers
// ---------------------------------------------------------------------------

/**
 * Parses a YAML flow sequence: [a, b, c]
 * @param {string} str - String starting after '['
 * @returns {{ value: Array, rest: string }}
 */
function _parseFlowSequence(str) {
  const result = [];
  let s = str.trimStart();

  while (s.length > 0 && !s.startsWith(']')) {
    if (s.startsWith(',')) { s = s.slice(1).trimStart(); continue; }
    if (s.startsWith('[')) {
      const inner = _parseFlowSequence(s.slice(1));
      result.push(inner.value);
      s = inner.rest.trimStart();
    } else if (s.startsWith('{')) {
      const inner = _parseFlowMapping(s.slice(1));
      result.push(inner.value);
      s = inner.rest.trimStart();
    } else {
      const { value, rest } = _parseFlowScalar(s);
      result.push(value);
      s = rest.trimStart();
    }
  }
  return { value: result, rest: s.startsWith(']') ? s.slice(1) : s };
}

/**
 * Parses a YAML flow mapping: {a: 1, b: 2}
 * @param {string} str - String starting after '{'
 * @returns {{ value: Object, rest: string }}
 */
function _parseFlowMapping(str) {
  const result = {};
  let s = str.trimStart();

  while (s.length > 0 && !s.startsWith('}')) {
    if (s.startsWith(',')) { s = s.slice(1).trimStart(); continue; }

    // Parse key — flow mapping keys must stop at ':'
    let key;
    if (s.startsWith('"') || s.startsWith("'")) {
      const parsed = _parseFlowScalar(s);
      key = parsed.value;
      s = parsed.rest.trimStart();
    } else {
      // Unquoted key: read until first ':' that's not followed by ':'  
      const colonIdx = s.search(/:\s/);
      if (colonIdx === -1) {
        // try simple colon at end
        const ci = s.indexOf(':');
        if (ci === -1) break;
        key = s.slice(0, ci).trimEnd();
        s = s.slice(ci).trimStart();
      } else {
        key = s.slice(0, colonIdx).trimEnd();
        s = s.slice(colonIdx).trimStart();
      }
    }
    if (!s.startsWith(':')) { s = s.trimStart(); continue; }
    s = s.slice(1).trimStart();

    // Parse value
    if (s.startsWith('[')) {
      const inner = _parseFlowSequence(s.slice(1));
      result[String(key)] = inner.value;
      s = inner.rest.trimStart();
    } else if (s.startsWith('{')) {
      const inner = _parseFlowMapping(s.slice(1));
      result[String(key)] = inner.value;
      s = inner.rest.trimStart();
    } else {
      const { value, rest } = _parseFlowScalar(s);
      result[String(key)] = value;
      s = rest.trimStart();
    }
  }
  return { value: result, rest: s.startsWith('}') ? s.slice(1) : s };
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

/**
 * Returns the indentation level of a line (number of leading spaces).
 * @param {string} line
 * @returns {number}
 */
function _indent(line) {
  return line.match(/^( *)/)[1].length;
}

/**
 * Parses YAML lines starting at index i with a minimum indentation of baseIndent.
 * @param {string[]} lines
 * @param {number} i - Current line index
 * @param {number} baseIndent - Expected indentation level
 * @returns {{ value: *, nextI: number }}
 */
function _parseBlock(lines, i, baseIndent) {
  // Skip blank and comment lines
  while (i < lines.length && (!lines[i].trim() || lines[i].trimStart().startsWith('#'))) i++;
  if (i >= lines.length) return { value: null, nextI: i };

  const line = lines[i];
  const ind = _indent(line);
  const trimmed = line.trimStart();

  // Block sequence
  if (trimmed.startsWith('- ') || trimmed === '-') {
    return _parseBlockSequence(lines, i, ind);
  }

  // Block mapping
  const mappingMatch = trimmed.match(/^([^:\s][^:]*|"[^"]*"|'[^']*'):\s*(.*)?$/);
  if (mappingMatch) {
    return _parseBlockMapping(lines, i, ind);
  }

  // Plain scalar
  return { value: _coerceScalar(_stripInlineComment(trimmed)), nextI: i + 1 };
}

/**
 * Parses a block sequence (list items starting with "- ").
 */
function _parseBlockSequence(lines, i, baseIndent) {
  const result = [];

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }

    const ind = _indent(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) break; // Over-indented — shouldn't happen at this level

    const trimmed = line.trimStart();
    if (!trimmed.startsWith('- ') && trimmed !== '-') break;

    const valueStr = trimmed.slice(2).trimStart();
    i++;

    if (!valueStr || valueStr.startsWith('#')) {
      // Value is on the next lines
      const { value, nextI } = _parseBlock(lines, i, baseIndent + 2);
      result.push(value);
      i = nextI;
    } else if (valueStr.startsWith('[')) {
      result.push(_parseFlowSequence(valueStr.slice(1)).value);
    } else if (valueStr.startsWith('{')) {
      result.push(_parseFlowMapping(valueStr.slice(1)).value);
    } else if (valueStr.startsWith('|') || valueStr.startsWith('>')) {
      const { value, nextI } = _parseMultilineString(lines, i, baseIndent + 2, valueStr[0]);
      result.push(value);
      i = nextI;
    } else {
      // Check if next non-empty line is a mapping or sequence child
      const nextNonBlank = _nextNonBlankLine(lines, i);
      if (nextNonBlank !== -1 && _indent(lines[nextNonBlank]) > baseIndent) {
        const { value, nextI } = _parseBlock(lines, i, _indent(lines[nextNonBlank]));
        result.push(value);
        i = nextI;
      } else {
        result.push(_coerceScalar(_stripInlineComment(valueStr)));
      }
    }
  }

  return { value: result, nextI: i };
}

/**
 * Parses a block mapping.
 */
function _parseBlockMapping(lines, i, baseIndent) {
  /** @type {Object} */
  const result = {};

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trimStart().startsWith('#')) { i++; continue; }

    const ind = _indent(line);
    if (ind < baseIndent) break;
    if (ind > baseIndent) break;

    const trimmed = line.trimStart();
    const mappingMatch = trimmed.match(/^("(?:[^"\\]|\\.)*"|'[^']*'|[^:\s][^:]*?)\s*:\s*(.*)?$/);
    if (!mappingMatch) break;

    let key = mappingMatch[1];
    // Unquote key if quoted
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      key = key.slice(1, -1);
    }

    const valueStr = (mappingMatch[2] || '').trimStart();
    i++;

    if (!valueStr || valueStr.startsWith('#')) {
      // Value is on next lines
      const nextNonBlank = _nextNonBlankLine(lines, i);
      if (nextNonBlank !== -1 && _indent(lines[nextNonBlank]) > baseIndent) {
        const childIndent = _indent(lines[nextNonBlank]);
        const { value, nextI } = _parseBlock(lines, i, childIndent);
        result[key] = value;
        i = nextI;
      } else {
        result[key] = null;
      }
    } else if (valueStr.startsWith('[')) {
      result[key] = _parseFlowSequence(valueStr.slice(1)).value;
    } else if (valueStr.startsWith('{')) {
      result[key] = _parseFlowMapping(valueStr.slice(1)).value;
    } else if (valueStr.startsWith('|') || valueStr.startsWith('>')) {
      const { value, nextI } = _parseMultilineString(lines, i, baseIndent + 2, valueStr[0]);
      result[key] = value;
      i = nextI;
    } else {
      result[key] = _coerceScalar(_stripInlineComment(valueStr));
    }
  }

  return { value: result, nextI: i };
}

/**
 * Parses a multi-line block scalar (| or >).
 */
function _parseMultilineString(lines, i, baseIndent, style) {
  const parts = [];
  let detectedIndent = -1;

  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      parts.push('');
      i++;
      continue;
    }
    const ind = _indent(line);
    if (detectedIndent === -1) detectedIndent = ind;
    if (ind < detectedIndent) break;
    parts.push(line.slice(detectedIndent));
    i++;
  }

  // Trim trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

  let value;
  if (style === '>') {
    // Folded: join with spaces, blank lines become newlines
    value = parts.join(' ').replace(/ {2,}/g, '\n') + '\n';
  } else {
    // Literal: preserve newlines
    value = parts.join('\n') + '\n';
  }

  return { value, nextI: i };
}

/** @param {string[]} lines @param {number} i @returns {number} */
function _nextNonBlankLine(lines, i) {
  while (i < lines.length) {
    if (lines[i].trim() && !lines[i].trimStart().startsWith('#')) return i;
    i++;
  }
  return -1;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a YAML string and returns a JavaScript value.
 * @param {string} yamlStr
 * @returns {*}
 * @throws {Error} On parse errors
 */
function parse(yamlStr) {
  if (typeof yamlStr !== 'string') throw new TypeError('Input must be a string');

  // Strip document separator and directives
  const stripped = yamlStr
    .replace(/^---\s*\n?/, '')
    .replace(/\.\.\.\s*$/, '');

  const lines = stripped.split('\n');
  const { value } = _parseBlock(lines, 0, 0);
  return value;
}

/**
 * Parses all YAML documents from a string separated by ---.
 * @param {string} yamlStr
 * @returns {Array<*>}
 */
function parseAll(yamlStr) {
  const docs = yamlStr.split(/^---\s*$/m).filter((d) => d.trim());
  return docs.map((d) => parse(d));
}

// ---------------------------------------------------------------------------
// Stringifier
// ---------------------------------------------------------------------------

/**
 * Converts a JavaScript value to a YAML string.
 * @param {*} value
 * @param {Object} [options={}]
 * @param {number} [options.indent=2] - Spaces per indentation level
 * @param {boolean} [options.noRefs=true] - Ignore circular ref checks
 * @returns {string}
 */
function stringify(value, options = {}) {
  const { indent = 2 } = options;
  return _dump(value, 0, indent);
}

/**
 * @param {*} val
 * @param {number} level
 * @param {number} indentSize
 * @returns {string}
 */
function _dump(val, level, indentSize) {
  const pad = ' '.repeat(level * indentSize);
  const childPad = ' '.repeat((level + 1) * indentSize);

  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return String(val);
  if (typeof val === 'number') {
    if (Number.isNaN(val)) return '.nan';
    if (!isFinite(val)) return val > 0 ? '.inf' : '-.inf';
    return String(val);
  }
  if (typeof val === 'string') return _dumpString(val);

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    return val.map((item) => {
      const dumped = _dump(item, level + 1, indentSize);
      const isMultiLine = dumped.includes('\n');
      if (isMultiLine) {
        return `${pad}- \n${childPad}${dumped.split('\n').join('\n' + childPad)}`;
      }
      return `${pad}- ${dumped}`;
    }).join('\n');
  }

  if (typeof val === 'object') {
    const keys = Object.keys(val);
    if (keys.length === 0) return '{}';
    return keys.map((key) => {
      const dumpedKey = _dumpString(key);
      const childVal = val[key];
      const dumped = _dump(childVal, level + 1, indentSize);
      const isMultiLine = dumped.includes('\n') && (Array.isArray(childVal) || (childVal && typeof childVal === 'object'));
      if (isMultiLine) {
        return `${pad}${dumpedKey}:\n${dumped}`;
      }
      return `${pad}${dumpedKey}: ${dumped}`;
    }).join('\n');
  }

  return String(val);
}

/**
 * Serialises a string with quoting if necessary.
 * @param {string} str
 * @returns {string}
 */
function _dumpString(str) {
  // Strings that need quoting
  const needsQuoting =
    /^[-?:,[\]{}#&*!|>'"%@`]/.test(str) ||
    /[:\n\t]/.test(str) ||
    str.trim() !== str ||
    str.toLowerCase() in BOOL_VALUES ||
    NULL_VALUES.has(str) ||
    /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(str) ||
    str === '' ||
    str.startsWith('0x') ||
    str.startsWith('0o');

  if (!needsQuoting) return str;

  // Use double quotes with escape sequences
  return '"' + str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t') + '"';
}

module.exports = {
  parse,
  parseAll,
  stringify,
  // Aliases
  load: parse,
  dump: stringify,
};
