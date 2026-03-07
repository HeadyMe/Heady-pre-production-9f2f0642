export = ToolRegistry;
/**
 * MCP Tool Registry
 *
 * Manages registration, listing, retrieval, validation, and execution
 * of all MCP tools in the Heady AI Platform.
 */
declare class ToolRegistry {
    /**
     * @param {object} [opts]
     * @param {object} [opts.logger]   - Pino/Winston-compatible logger
     */
    constructor({ logger }?: {
        logger?: object | undefined;
    });
    /** @type {Map<string, ToolEntry>} */
    _tools: Map<string, ToolEntry>;
    _log: object;
    _defaultLogger(): {
        info: (...a: any[]) => void;
        warn: (...a: any[]) => void;
        error: (...a: any[]) => void;
    };
    /**
     * Validate a value against a JSON Schema property definition.
     * @private
     */
    private _validateValue;
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
    register(tool: {
        name: string;
        description: string;
        inputSchema: object;
        handler?: Function | undefined;
    }): void;
    /**
     * List all registered tools in MCP-compatible format.
     *
     * @returns {Array<{name: string, description: string, inputSchema: object}>}
     */
    list(): Array<{
        name: string;
        description: string;
        inputSchema: object;
    }>;
    /**
     * Get a single tool entry by name.
     *
     * @param {string} name
     * @returns {object|null}
     */
    get(name: string): object | null;
    /**
     * Check whether a tool is registered.
     *
     * @param {string} name
     * @returns {boolean}
     */
    has(name: string): boolean;
    /**
     * Validate arguments against a tool's input schema.
     *
     * @param {string} name  - Tool name
     * @param {object} args  - Arguments to validate
     * @returns {{ valid: boolean, errors: string[] }}
     */
    validate(name: string, args: object): {
        valid: boolean;
        errors: string[];
    };
    /**
     * Execute a tool by name with the given arguments.
     * Uses the tool's registered handler, or throws if none is attached.
     *
     * @param {string} name
     * @param {object} args
     * @returns {Promise<*>}
     */
    execute(name: string, args: object): Promise<any>;
    /**
     * Attach a handler to an already-registered tool.
     *
     * @param {string} name
     * @param {Function} handler
     */
    attachHandler(name: string, handler: Function): void;
    /**
     * Remove a registered tool.
     *
     * @param {string} name
     * @returns {boolean} true if removed, false if not found
     */
    unregister(name: string): boolean;
    /**
     * Return registry statistics.
     *
     * @returns {{ total: number, withHandlers: number, withoutHandlers: number }}
     */
    stats(): {
        total: number;
        withHandlers: number;
        withoutHandlers: number;
    };
    /**
     * Export all tool names as a sorted list.
     *
     * @returns {string[]}
     */
    names(): string[];
}
//# sourceMappingURL=tool-registry.d.ts.map