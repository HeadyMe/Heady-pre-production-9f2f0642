export function createMcpRegistry({ memoryStore }) {
  const tools = [
    {
      name: 'system.health',
      description: 'Return the current system health payload.',
      inputSchema: { type: 'object', properties: {} },
      run: async (_args, ctx) => ({ ok: true, userId: ctx.user.id, service: 'heady-gateway' })
    },
    {
      name: 'auth.me',
      description: 'Return the current authenticated user.',
      inputSchema: { type: 'object', properties: {} },
      run: async (_args, ctx) => ctx.user
    },
    {
      name: 'memories.upsert',
      description: 'Store or update a user memory.',
      inputSchema: {
        type: 'object',
        required: ['content'],
        properties: {
          id: { type: 'string' },
          namespace: { type: 'string' },
          content: { type: 'string' },
          metadata: { type: 'object' }
        }
      },
      run: async (args, ctx) => memoryStore.upsertMemory({
        id: args.id,
        userId: ctx.user.id,
        namespace: args.namespace || 'default',
        content: args.content,
        metadata: args.metadata || {}
      })
    },
    {
      name: 'memories.search',
      description: 'Search the authenticated user memory space.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          namespace: { type: 'string' },
          query: { type: 'string' },
          limit: { type: 'number' }
        }
      },
      run: async (args, ctx) => memoryStore.searchMemories({
        userId: ctx.user.id,
        namespace: args.namespace || null,
        query: args.query,
        limit: Number(args.limit || 10)
      })
    },
    {
      name: 'memories.timeline',
      description: 'Return the ordered memory timeline for the authenticated user.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          limit: { type: 'number' }
        }
      },
      run: async (args, ctx) => memoryStore.timeline({
        userId: ctx.user.id,
        namespace: args.namespace || null,
        limit: Number(args.limit || 100)
      })
    }
  ];

  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    listTools() {
      return tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));
    },
    async callTool(name, args, ctx) {
      const tool = byName.get(name);
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      return tool.run(args || {}, ctx);
    }
  };
}

export async function handleRpc(registry, body, ctx) {
  const request = body || {};
  if (!request.method) {
    return { jsonrpc: '2.0', id: request.id || null, error: { code: -32600, message: 'Invalid request' } };
  }

  try {
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id || null,
        result: {
          serverInfo: { name: 'heady-mcp', version: '1.0.0' },
          capabilities: { tools: { listChanged: false }, streaming: true }
        }
      };
    }

    if (request.method === 'tools/list') {
      return { jsonrpc: '2.0', id: request.id || null, result: { tools: registry.listTools() } };
    }

    if (request.method === 'tools/call') {
      const { name, arguments: args } = request.params || {};
      const result = await registry.callTool(name, args, ctx);
      return { jsonrpc: '2.0', id: request.id || null, result };
    }

    if (request.method === 'ping') {
      return { jsonrpc: '2.0', id: request.id || null, result: { pong: true } };
    }

    return { jsonrpc: '2.0', id: request.id || null, error: { code: -32601, message: 'Method not found' } };
  } catch (error) {
    return { jsonrpc: '2.0', id: request.id || null, error: { code: -32000, message: error.message } };
  }
}
