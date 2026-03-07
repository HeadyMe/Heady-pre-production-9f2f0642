# @heady/mcp-server

> Model Context Protocol (MCP) server for the Heady™ AI Platform — tool registration, memory operations, and JSON-RPC 2.0 handling.

## Install

```bash
npm install @heady/mcp-server
```

## Quick Start

```ts
import { MCPServer } from '@heady/mcp-server';

const server = new MCPServer();

// Handle an MCP request
const response = await server.handleRequest({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'memory.store',
    arguments: { userId: 'user-1', x: 0, y: 0, z: 0, embedding: [1,2,3], metadata: {} }
  }
});
```

## Built-in Tools

| Tool | Description |
|------|-------------|
| `memory.store` | Store a 3D vector memory |
| `memory.query` | Cosine-similarity search |
| `memory.stats` | User memory statistics |
| `server.health` | Server health check |

## License

Proprietary — © 2026 HeadySystems Inc.
