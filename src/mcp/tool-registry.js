/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */
'use strict';

// ─── ToolRegistry ─────────────────────────────────────────────────────────────

/**
 * MCP Tool Registry
 *
 * Manages registration, listing, retrieval, validation, and execution
 * of all MCP tools in the Heady AI Platform.
 */
class ToolRegistry {
  /**
   * @param {object} [opts]
   * @param {object} [opts.logger]   - Pino/Winston-compatible logger
   */
  constructor({ logger } = {}) {
    /** @type {Map<string, ToolEntry>} */
    this._tools = new Map();
    this._log = logger || this._defaultLogger();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _defaultLogger() {
    return {
      info:  (...a) => console.error('[ToolRegistry:INFO]',  ...a),
      warn:  (...a) => console.error('[ToolRegistry:WARN]',  ...a),
      error: (...a) => console.error('[ToolRegistry:ERROR]', ...a),
    };
  }

  /**
   * Validate a value against a JSON Schema property definition.
   * @private
   */
  _validateValue(value, schema, path) {
    const errors = [];

    // Type check (allow arrays for multi-type schemas)
    if (schema.type) {
      const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (!allowedTypes.includes(actualType)) {
        errors.push(`${path}: expected ${allowedTypes.join('|')}, got ${actualType}`);
        return errors; // No point continuing on type mismatch
      }
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`${path}: '${value}' is not one of [${schema.enum.join(', ')}]`);
    }

    // String-specific
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`${path}: length ${value.length} < minLength ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path}: length ${value.length} > maxLength ${schema.maxLength}`);
      }
    }

    // Number-specific
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: ${value} < minimum ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: ${value} > maximum ${schema.maximum}`);
      }
    }

    // Array-specific
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: array length ${value.length} < minItems ${schema.minItems}`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: array length ${value.length} > maxItems ${schema.maxItems}`);
      }
    }

    // Object-specific: recurse into properties
    if (typeof value === 'object' && !Array.isArray(value) && value !== null && schema.properties) {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (value[propKey] !== undefined) {
          const nestedErrors = this._validateValue(value[propKey], propSchema, `${path}.${propKey}`);
          errors.push(...nestedErrors);
        }
      }
    }

    return errors;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a tool definition.
   *
   * @param {object} tool
   * @param {string} tool.name            - Unique tool name
   * @param {string} tool.description     - Human-readable description
   * @param {object} tool.inputSchema     - JSON Schema for tool arguments
   * @param {Function} [tool.handler]     - Optional direct execution handler
   * @throws {Error} If tool name is already registered
   */
  register(tool) {
    if (!tool || !tool.name) {
      throw new Error('Tool must have a name');
    }
    if (!tool.inputSchema) {
      throw new Error(`Tool '${tool.name}' must have an inputSchema`);
    }
    if (this._tools.has(tool.name)) {
      this._log.warn(`Tool '${tool.name}' already registered — overwriting`);
    }

    const entry = {
      name: tool.name,
      description: tool.description || '',
      inputSchema: tool.inputSchema,
      handler: tool.handler || null,
      registeredAt: new Date().toISOString(),
    };

    this._tools.set(tool.name, entry);
    this._log.info(`Registered tool: ${tool.name}`);
  }

  /**
   * List all registered tools in MCP-compatible format.
   *
   * @returns {Array<{name: string, description: string, inputSchema: object}>}
   */
  list() {
    return Array.from(this._tools.values()).map((entry) => ({
      name: entry.name,
      description: entry.description,
      inputSchema: entry.inputSchema,
    }));
  }

  /**
   * Get a single tool entry by name.
   *
   * @param {string} name
   * @returns {object|null}
   */
  get(name) {
    return this._tools.get(name) || null;
  }

  /**
   * Check whether a tool is registered.
   *
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._tools.has(name);
  }

  /**
   * Validate arguments against a tool's input schema.
   *
   * @param {string} name  - Tool name
   * @param {object} args  - Arguments to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate(name, args) {
    const entry = this._tools.get(name);
    if (!entry) {
      return { valid: false, errors: [`Unknown tool: '${name}'`] };
    }

    const schema = entry.inputSchema;
    const errors = [];

    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const required of schema.required) {
        if (args[required] === undefined || args[required] === null) {
          errors.push(`Missing required argument: '${required}'`);
        }
      }
    }

    // Validate each provided arg
    if (schema.properties) {
      for (const [key, value] of Object.entries(args)) {
        const propSchema = schema.properties[key];
        if (!propSchema) {
          // Additional properties are allowed unless additionalProperties: false
          if (schema.additionalProperties === false) {
            errors.push(`Unknown argument: '${key}'`);
          }
          continue;
        }
        const propErrors = this._validateValue(value, propSchema, key);
        errors.push(...propErrors);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a tool by name with the given arguments.
   * Uses the tool's registered handler, or throws if none is attached.
   *
   * @param {string} name
   * @param {object} args
   * @returns {Promise<*>}
   */
  async execute(name, args) {
    const entry = this._tools.get(name);
    if (!entry) {
      throw new Error(`Unknown tool: '${name}'`);
    }

    const validation = this.validate(name, args);
    if (!validation.valid) {
      throw new Error(`Validation failed for '${name}': ${validation.errors.join('; ')}`);
    }

    if (typeof entry.handler !== 'function') {
      throw new Error(`Tool '${name}' has no handler — use HeadyConductor to route`);
    }

    return await entry.handler(args);
  }

  /**
   * Attach a handler to an already-registered tool.
   *
   * @param {string} name
   * @param {Function} handler
   */
  attachHandler(name, handler) {
    const entry = this._tools.get(name);
    if (!entry) {
      throw new Error(`Cannot attach handler — unknown tool: '${name}'`);
    }
    entry.handler = handler;
    this._log.info(`Handler attached to tool: ${name}`);
  }

  /**
   * Remove a registered tool.
   *
   * @param {string} name
   * @returns {boolean} true if removed, false if not found
   */
  unregister(name) {
    return this._tools.delete(name);
  }

  /**
   * Return registry statistics.
   *
   * @returns {{ total: number, withHandlers: number, withoutHandlers: number }}
   */
  stats() {
    const tools = Array.from(this._tools.values());
    const withHandlers = tools.filter((t) => typeof t.handler === 'function').length;
    return {
      total: tools.length,
      withHandlers,
      withoutHandlers: tools.length - withHandlers,
    };
  }

  /**
   * Export all tool names as a sorted list.
   *
   * @returns {string[]}
   */
  names() {
    return Array.from(this._tools.keys()).sort();
  }
}

module.exports = ToolRegistry;
