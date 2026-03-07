/**
 * Check if a task has an existing template that can be injected.
 * Called BEFORE executing any MCP tool.
 *
 * @param {string} toolName - The MCP tool being called
 * @param {object} args - Tool arguments
 * @returns {object|null} Template data if available, null otherwise
 */
export function checkForTemplate(toolName: string, args: object): object | null;
/**
 * Generate template HeadyBees and HeadySwarms from task results.
 * Called AFTER executing any MCP tool to extract reusable patterns.
 *
 * @param {string} toolName - The tool that was called
 * @param {object} args - Tool arguments
 * @param {object} result - Tool execution result
 * @returns {object} Generated template metadata
 */
export function generateTemplateFromResult(toolName: string, args: object, result: object): object;
/**
 * Get all generated templates and their status.
 */
export function getTemplateStats(): {
    cachedTemplates: number;
    totalGenerated: number;
    activeBees: any;
    history: any[];
};
/**
 * Wrap a tool call with template checking and generation.
 * This is the main integration point — wraps callTool in the bridge.
 *
 * @param {Function} originalCallTool - The original callTool function
 * @param {string} toolName - MCP tool name
 * @param {object} args - Tool arguments
 * @returns {object} Enhanced result with template metadata
 */
export function withTemplateAutoGen(originalCallTool: Function, toolName: string, args: object): object;
export const generatedTemplates: Map<any, any>;
export const templateHistory: any[];
//# sourceMappingURL=template-auto-gen.d.ts.map