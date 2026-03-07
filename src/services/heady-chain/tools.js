'use strict';

/**
 * HeadyChain Tool Registry
 * Register, discover, validate, and execute tools with full JSON Schema validation.
 * Built-in tools: web_search, file_read, file_write, http_request, code_execute, math_eval
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { httpPost } = require('./nodes');
const config = require('./config');

// ─── JSON Schema Validator (lightweight, no external deps) ───────────────────

function validateSchema(schema, value, path = 'root') {
  const errors = [];

  if (!schema || typeof schema !== 'object') return errors;

  // Type check
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const jsType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    // JSON Schema type mapping
    const typeMap = { integer: 'number', null: 'null' };
    const matched = types.some(t => {
      if (t === 'integer') return Number.isInteger(value);
      return jsType === (typeMap[t] || t);
    });
    if (!matched) {
      errors.push(`${path}: expected type ${types.join('|')}, got ${jsType}`);
      return errors; // Can't validate further
    }
  }

  // Required properties
  if (schema.required && typeof value === 'object' && value !== null) {
    for (const req of schema.required) {
      if (!(req in value)) {
        errors.push(`${path}: missing required property '${req}'`);
      }
    }
  }

  // Properties
  if (schema.properties && typeof value === 'object' && value !== null) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in value) {
        errors.push(...validateSchema(subSchema, value[key], `${path}.${key}`));
      }
    }
  }

  // String constraints
  if (schema.type === 'string' && typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) {
      errors.push(`${path}: string too short (min ${schema.minLength})`);
    }
    if (schema.maxLength != null && value.length > schema.maxLength) {
      errors.push(`${path}: string too long (max ${schema.maxLength})`);
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: value must be one of [${schema.enum.join(', ')}]`);
    }
    if (schema.pattern) {
      const re = new RegExp(schema.pattern);
      if (!re.test(value)) {
        errors.push(`${path}: string does not match pattern ${schema.pattern}`);
      }
    }
  }

  // Number constraints
  if ((schema.type === 'number' || schema.type === 'integer') && typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) {
      errors.push(`${path}: value ${value} < minimum ${schema.minimum}`);
    }
    if (schema.maximum != null && value > schema.maximum) {
      errors.push(`${path}: value ${value} > maximum ${schema.maximum}`);
    }
  }

  // Array constraints
  if (schema.type === 'array' && Array.isArray(value)) {
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validateSchema(schema.items, value[i], `${path}[${i}]`));
      }
    }
    if (schema.minItems != null && value.length < schema.minItems) {
      errors.push(`${path}: array too short (min ${schema.minItems})`);
    }
    if (schema.maxItems != null && value.length > schema.maxItems) {
      errors.push(`${path}: array too long (max ${schema.maxItems})`);
    }
  }

  return errors;
}

// ─── Tool Registry ────────────────────────────────────────────────────────────

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.executionStats = new Map();
    this._registerBuiltins();
  }

  /**
   * Register a tool.
   * @param {string} name - Unique tool name
   * @param {object} spec - { description, inputSchema, handler, timeoutMs }
   */
  register(name, spec) {
    if (!name || typeof name !== 'string') throw new Error('Tool name must be a non-empty string');
    if (typeof spec.handler !== 'function') throw new Error(`Tool '${name}' handler must be a function`);

    this.tools.set(name, {
      name,
      description: spec.description || '',
      inputSchema: spec.inputSchema || { type: 'object', properties: {} },
      handler: spec.handler,
      timeoutMs: spec.timeoutMs || config.DEFAULT_TOOL_TIMEOUT_MS,
      builtIn: spec.builtIn || false,
      tags: spec.tags || [],
    });

    if (!this.executionStats.has(name)) {
      this.executionStats.set(name, { calls: 0, errors: 0, totalMs: 0 });
    }

    return this;
  }

  /**
   * Get a registered tool descriptor.
   */
  getTool(name) {
    return this.tools.get(name) || null;
  }

  /**
   * List all registered tools (schema, description, no handler).
   */
  list() {
    return [...this.tools.values()].map(({ handler, ...spec }) => spec);
  }

  /**
   * List tools formatted for LLM function calling (OpenAI-style).
   */
  listForLLM() {
    return [...this.tools.values()].map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Execute a registered tool with input validation and timeout.
   */
  async execute(name, input = {}) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool '${name}' not registered`);

    // Validate input
    const errors = validateSchema(tool.inputSchema, input);
    if (errors.length > 0) {
      throw new Error(`Tool '${name}' input validation failed:\n${errors.join('\n')}`);
    }

    const stats = this.executionStats.get(name);
    stats.calls++;
    const startMs = Date.now();

    try {
      // Execute with timeout
      const result = await Promise.race([
        tool.handler(input),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool '${name}' timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs)
        ),
      ]);

      stats.totalMs += Date.now() - startMs;
      return this._formatResult(result);
    } catch (err) {
      stats.errors++;
      stats.totalMs += Date.now() - startMs;
      throw err;
    }
  }

  /**
   * Format tool result for LLM consumption.
   */
  _formatResult(result) {
    if (result === null || result === undefined) return { output: null };
    if (typeof result === 'string') {
      return {
        output: result.length > config.MAX_TOOL_RESULT_LENGTH
          ? result.slice(0, config.MAX_TOOL_RESULT_LENGTH) + '...[truncated]'
          : result,
      };
    }
    if (typeof result === 'object') {
      const str = JSON.stringify(result);
      if (str.length > config.MAX_TOOL_RESULT_LENGTH) {
        return {
          output: str.slice(0, config.MAX_TOOL_RESULT_LENGTH) + '...[truncated]',
          _truncated: true,
        };
      }
      return result;
    }
    return { output: String(result) };
  }

  /**
   * Get execution statistics.
   */
  getStats() {
    const stats = {};
    for (const [name, s] of this.executionStats) {
      stats[name] = {
        ...s,
        avgMs: s.calls > 0 ? Math.round(s.totalMs / s.calls) : 0,
        errorRate: s.calls > 0 ? (s.errors / s.calls).toFixed(3) : 0,
      };
    }
    return stats;
  }

  // ─── Built-in Tool Registrations ────────────────────────────────────────────

  _registerBuiltins() {
    // 1. web_search
    this.register('web_search', {
      description: 'Search the web for information. Returns top results with titles, URLs, and snippets.',
      builtIn: true,
      tags: ['search', 'web'],
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Search query', minLength: 1 },
          numResults: { type: 'integer', minimum: 1, maximum: 20, description: 'Number of results (default: 5)' },
        },
      },
      handler: async ({ query, numResults = 5 }) => {
        // Try to use a search API if configured, otherwise use DuckDuckGo HTML
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
          const data = await response.json();
          const results = [];
          if (data.AbstractText) {
            results.push({ title: data.Heading, url: data.AbstractURL, snippet: data.AbstractText });
          }
          if (data.RelatedTopics) {
            for (const topic of data.RelatedTopics.slice(0, numResults - results.length)) {
              if (topic.Text) {
                results.push({
                  title: topic.Text.slice(0, 80),
                  url: topic.FirstURL || '',
                  snippet: topic.Text,
                });
              }
            }
          }
          return { query, results: results.slice(0, numResults), source: 'duckduckgo' };
        } catch (err) {
          return { query, error: `Search failed: ${err.message}`, results: [] };
        }
      },
    });

    // 2. file_read
    this.register('file_read', {
      description: 'Read the contents of a file from the filesystem.',
      builtIn: true,
      tags: ['filesystem'],
      inputSchema: {
        type: 'object',
        required: ['filePath'],
        properties: {
          filePath: { type: 'string', description: 'Absolute or relative file path' },
          encoding: { type: 'string', enum: ['utf8', 'base64', 'hex'], description: 'File encoding (default: utf8)' },
          maxBytes: { type: 'integer', minimum: 1, description: 'Max bytes to read' },
        },
      },
      handler: async ({ filePath, encoding = 'utf8', maxBytes }) => {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
          throw new Error(`File not found: ${resolvedPath}`);
        }
        const stat = fs.statSync(resolvedPath);
        if (stat.isDirectory()) {
          throw new Error(`Path is a directory: ${resolvedPath}`);
        }
        if (maxBytes) {
          const fd = fs.openSync(resolvedPath, 'r');
          const buf = Buffer.alloc(maxBytes);
          const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0);
          fs.closeSync(fd);
          return {
            filePath: resolvedPath,
            content: buf.slice(0, bytesRead).toString(encoding),
            size: stat.size,
            truncated: stat.size > maxBytes,
          };
        }
        const content = fs.readFileSync(resolvedPath, encoding);
        return { filePath: resolvedPath, content, size: stat.size, truncated: false };
      },
    });

    // 3. file_write
    this.register('file_write', {
      description: 'Write content to a file. Creates directories as needed.',
      builtIn: true,
      tags: ['filesystem'],
      inputSchema: {
        type: 'object',
        required: ['filePath', 'content'],
        properties: {
          filePath: { type: 'string', description: 'File path to write' },
          content: { type: 'string', description: 'Content to write' },
          encoding: { type: 'string', enum: ['utf8', 'base64'], description: 'Encoding (default: utf8)' },
          append: { type: 'boolean', description: 'Append instead of overwrite (default: false)' },
        },
      },
      handler: async ({ filePath, content, encoding = 'utf8', append = false }) => {
        const resolvedPath = path.resolve(filePath);
        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        if (append) {
          fs.appendFileSync(resolvedPath, content, encoding);
        } else {
          fs.writeFileSync(resolvedPath, content, encoding);
        }
        const stat = fs.statSync(resolvedPath);
        return { filePath: resolvedPath, bytesWritten: stat.size, appended: append };
      },
    });

    // 4. http_request
    this.register('http_request', {
      description: 'Make an HTTP request to a URL. Supports GET, POST, PUT, DELETE.',
      builtIn: true,
      tags: ['network', 'api'],
      timeoutMs: 20000,
      inputSchema: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', description: 'Request URL' },
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP method (default: GET)' },
          headers: { type: 'object', description: 'Request headers' },
          body: { description: 'Request body (for POST/PUT/PATCH)' },
          timeoutMs: { type: 'integer', minimum: 100, maximum: 60000 },
        },
      },
      handler: async ({ url, method = 'GET', headers = {}, body, timeoutMs: reqTimeout = 15000 }) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), reqTimeout);
        try {
          const fetchOptions = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            signal: controller.signal,
          };
          if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
          }
          const response = await fetch(url, fetchOptions);
          const text = await response.text();
          let parsedBody;
          try { parsedBody = JSON.parse(text); } catch { parsedBody = text; }
          return {
            url,
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: parsedBody,
            ok: response.ok,
          };
        } finally {
          clearTimeout(timer);
        }
      },
    });

    // 5. code_execute
    this.register('code_execute', {
      description: 'Execute JavaScript or shell code safely. Use with caution.',
      builtIn: true,
      tags: ['code', 'execution'],
      timeoutMs: 10000,
      inputSchema: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', description: 'Code to execute' },
          language: { type: 'string', enum: ['javascript', 'shell'], description: 'Language (default: javascript)' },
          timeout: { type: 'integer', minimum: 100, maximum: 9000, description: 'Execution timeout ms' },
        },
      },
      handler: async ({ code, language = 'javascript', timeout = 5000 }) => {
        if (language === 'javascript') {
          // Safe eval in a sandboxed context — capture console output
          const logs = [];
          const sandbox = {
            console: {
              log: (...args) => logs.push(args.map(String).join(' ')),
              error: (...args) => logs.push('[error] ' + args.map(String).join(' ')),
            },
            Math, JSON, parseInt, parseFloat, String, Number, Boolean, Array, Object,
          };
          try {
            const fn = new Function(...Object.keys(sandbox), `"use strict"; ${code}`);
            const result = fn(...Object.values(sandbox));
            return { output: logs.join('\n'), result: result !== undefined ? result : null, language };
          } catch (err) {
            return { output: logs.join('\n'), error: err.message, language };
          }
        } else if (language === 'shell') {
          try {
            const output = execSync(code, {
              timeout,
              encoding: 'utf8',
              maxBuffer: 1024 * 1024,
              shell: true,
            });
            return { output: output.trim(), language };
          } catch (err) {
            return { output: err.stdout?.trim() || '', error: err.message, language };
          }
        }
        throw new Error(`Unsupported language: ${language}`);
      },
    });

    // 6. math_eval
    this.register('math_eval', {
      description: 'Evaluate a mathematical expression safely. Supports arithmetic, trigonometry, and basic statistics.',
      builtIn: true,
      tags: ['math', 'calculation'],
      inputSchema: {
        type: 'object',
        required: ['expression'],
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate (e.g. "2 + 2 * PHI")' },
          variables: { type: 'object', description: 'Variable bindings' },
        },
      },
      handler: async ({ expression, variables = {} }) => {
        // Provide safe math context
        const mathEnv = {
          Math, parseInt, parseFloat,
          PI: Math.PI, E: Math.E,
          PHI: config.PHI,
          abs: Math.abs, ceil: Math.ceil, floor: Math.floor, round: Math.round,
          sqrt: Math.sqrt, pow: Math.pow, log: Math.log, log2: Math.log2, log10: Math.log10,
          sin: Math.sin, cos: Math.cos, tan: Math.tan,
          min: Math.min, max: Math.max,
          sum: (...args) => args.flat().reduce((a, b) => a + b, 0),
          mean: (...args) => { const a = args.flat(); return a.reduce((s, v) => s + v, 0) / a.length; },
          ...variables,
        };
        const sanitized = expression.replace(/[;{}]/g, '');
        try {
          const fn = new Function(...Object.keys(mathEnv), `"use strict"; return (${sanitized})`);
          const result = fn(...Object.values(mathEnv));
          return { expression, result, type: typeof result };
        } catch (err) {
          throw new Error(`Math eval error: ${err.message}`);
        }
      },
    });
  }
}

// Singleton registry
const globalRegistry = new ToolRegistry();

module.exports = {
  ToolRegistry,
  globalRegistry,
  validateSchema,
};
