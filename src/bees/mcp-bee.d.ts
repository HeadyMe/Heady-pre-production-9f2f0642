export const domain: "mcp";
export const description: "MCP server: tool registration, protocol handling, tool execution";
export const priority: 0.9;
export function getWork(ctx?: {}): (() => Promise<{
    bee: string;
    action: string;
    loaded: boolean;
}>)[];
//# sourceMappingURL=mcp-bee.d.ts.map