import { VectorMemoryStore, Vector3D } from '@heady-ai/vector-memory';

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: { code: number; message: string };
}

export class MCPServer {
  private memoryStore = new VectorMemoryStore();
  private tools = new Map<string, Function>();
  private startTime = Date.now();

  constructor() {
    this.registerTools();
  }

  private registerTools() {
    this.tools.set('memory.store', (params: any) => {
      const { userId, x, y, z, embedding, metadata } = params;
      const memory: Vector3D = { x, y, z, embedding, metadata, timestamp: Date.now() };
      this.memoryStore.store(userId, memory);
      return { success: true, timestamp: memory.timestamp };
    });

    this.tools.set('memory.query', (params: any) => {
      const { userId, embedding, limit } = params;
      const results = this.memoryStore.query(userId, embedding, limit);
      return { results, count: results.length };
    });

    this.tools.set('memory.stats', (params: any) => {
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

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
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
      } catch (error: any) {
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
