import { HeadyError } from '@heady-ai/core';

export class HeadyClient {
  constructor(private apiKey: string, private baseUrl = 'https://mcp.headymcp.com') {}

  async callTool(name: string, args: any): Promise<any> {
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
      throw new HeadyError(data.error.message, 'MCP_ERROR');
    }

    return data.result;
  }

  async storeMemory(userId: string, x: number, y: number, z: number, embedding: number[], metadata: any) {
    return this.callTool('memory.store', { userId, x, y, z, embedding, metadata });
  }

  async queryMemory(userId: string, embedding: number[], limit = 10) {
    return this.callTool('memory.query', { userId, embedding, limit });
  }

  async getMemoryStats(userId: string) {
    return this.callTool('memory.stats', { userId });
  }

  async healthCheck() {
    return this.callTool('server.health', {});
  }
}
