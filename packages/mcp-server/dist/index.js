"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const vector_memory_1 = require("@heady-ai/vector-memory");
class MCPServer {
    memoryStore = new vector_memory_1.VectorMemoryStore();
    tools = new Map();
    startTime = Date.now();
    constructor() {
        this.registerTools();
    }
    registerTools() {
        this.tools.set('memory.store', (params) => {
            const { userId, x, y, z, embedding, metadata } = params;
            const memory = { x, y, z, embedding, metadata, timestamp: Date.now() };
            this.memoryStore.store(userId, memory);
            return { success: true, timestamp: memory.timestamp };
        });
        this.tools.set('memory.query', (params) => {
            const { userId, embedding, limit } = params;
            const results = this.memoryStore.query(userId, embedding, limit);
            return { results, count: results.length };
        });
        this.tools.set('memory.stats', (params) => {
            const { userId } = params;
            return this.memoryStore.getStats(userId);
        });
        this.tools.set('server.health', () => {
            const uptimeMs = Date.now() - this.startTime;
            return {
                status: 'healthy',
                version: '3.2.0',
                uptime: uptimeMs / 1000,
                timestamp: Date.now()
            };
        });
    }
    async handleRequest(request) {
        if (request.method === 'tools/list') {
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    tools: Array.from(this.tools.keys()).map(name => ({
                        name,
                        description: `Tool: ${name}`,
                        inputSchema: { type: 'object' }
                    }))
                }
            };
        }
        if (request.method === 'tools/call') {
            const { name, arguments: args } = request.params;
            const tool = this.tools.get(name);
            if (!tool) {
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32601, message: `Tool not found: ${name}` }
                };
            }
            try {
                const result = await tool(args);
                return { jsonrpc: '2.0', id: request.id, result };
            }
            catch (error) {
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    error: { code: -32603, message: error.message }
                };
            }
        }
        return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: 'Method not found' }
        };
    }
}
exports.MCPServer = MCPServer;
//# sourceMappingURL=index.js.map