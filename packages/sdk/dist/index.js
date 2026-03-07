"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadyClient = void 0;
const core_1 = require("@heady-ai/core");
class HeadyClient {
    apiKey;
    baseUrl;
    constructor(apiKey, baseUrl = 'https://mcp.headymcp.com') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }
    async callTool(name, args) {
        const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: Date.now(),
                method: 'tools/call',
                params: { name, arguments: args }
            })
        });
        const data = await response.json();
        if (data.error) {
            throw new core_1.HeadyError(data.error.message, 'MCP_ERROR');
        }
        return data.result;
    }
    async storeMemory(userId, x, y, z, embedding, metadata) {
        return this.callTool('memory.store', { userId, x, y, z, embedding, metadata });
    }
    async queryMemory(userId, embedding, limit = 10) {
        return this.callTool('memory.query', { userId, embedding, limit });
    }
    async getMemoryStats(userId) {
        return this.callTool('memory.stats', { userId });
    }
    async healthCheck() {
        return this.callTool('server.health', {});
    }
}
exports.HeadyClient = HeadyClient;
//# sourceMappingURL=index.js.map