/*
 * © 2026 HeadySystems Inc.. PROPRIETARY AND CONFIDENTIAL.
 * MCP Bee — Covers heady-mcp-server.js (1183 lines)
 * MCP tool registration, protocol handling, tool execution
 */
const domain = 'mcp';
const description = 'MCP server: tool registration, protocol handling, tool execution';
const priority = 0.9;

function getWork(ctx = {}) {
    return [
        async () => {
            try {
                const mod = require('../mcp/heady-mcp-server');
                return { bee: domain, action: 'mcp-server', loaded: true };
            } catch { return { bee: domain, action: 'mcp-server', loaded: false }; }
        },
    ];
}

module.exports = { domain, description, priority, getWork };
