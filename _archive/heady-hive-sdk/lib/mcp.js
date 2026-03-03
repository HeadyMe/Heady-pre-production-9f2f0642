/**
 * HeadyMCP — MCP tool aggregator client
 * Connects to the Heady MCP server AND upstream MCP servers.
 */
class HeadyMCP {
    constructor(client) {
        this._c = client;
        this._upstreams = new Map();
    }

    /** List all available MCP tools */
    async listTools() {
        return this._c.get("/api/mcp/tools");
    }

    /** Call a specific MCP tool */
    async callTool(name, args = {}) {
        return this._c.post("/api/mcp/call", { tool: name, arguments: args });
    }

    /** Register an upstream MCP server */
    addUpstream(name, config) {
        this._upstreams.set(name, {
            name, url: config.url, transport: config.transport || "stdio",
            tools: config.tools || [], connected: false,
        });
        return this;
    }

    /** List registered upstream servers */
    listUpstreams() {
        return Array.from(this._upstreams.values());
    }

    /** Deep scan through MCP */
    async deepScan(task, opts = {}) {
        return this._c.post("/api/mcp/call", {
            tool: "heady_deep_scan",
            arguments: { task, ...opts },
        });
    }

    /** Research via HeadyPerplexity MCP tool */
    async research(query, opts = {}) {
        return this._c.post("/api/mcp/call", {
            tool: "heady_perplexity_research",
            arguments: { action: "research", query, ...opts },
        });
    }

    /** Soul interaction via MCP */
    async soul(message, opts = {}) {
        return this._c.post("/api/mcp/call", {
            tool: "heady_soul",
            arguments: { message, action: opts.action || "reflect" },
        });
    }

    /** Risk assessment via MCP */
    async risks(target, opts = {}) {
        return this._c.post("/api/mcp/call", {
            tool: "heady_risks",
            arguments: { target, action: opts.action || "scan", ...opts },
        });
    }

    /** Deploy action via MCP */
    async deploy(action, opts = {}) {
        return this._c.post("/api/mcp/call", {
            tool: "heady_deploy",
            arguments: { action, ...opts },
        });
    }
}

module.exports = HeadyMCP;
