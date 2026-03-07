# @heady/sdk

> TypeScript client SDK for the Heady™ AI Platform — MCP tool calls, vector memory, and health checks.

## Install

```bash
npm install @heady/sdk
```

## Quick Start

```ts
import { HeadyClient } from '@heady/sdk';

const client = new HeadyClient('your-api-key');

// Store a memory
await client.storeMemory('user-1', 0.5, 1.2, -0.3, [0.1, 0.2, 0.3], { topic: 'ai' });

// Query memories
const results = await client.queryMemory('user-1', [0.1, 0.2, 0.3], 10);

// Health check
const health = await client.healthCheck();
```

## API

| Method | Description |
|--------|-------------|
| `callTool(name, args)` | Call any MCP tool by name |
| `storeMemory(...)` | Store a 3D vector memory |
| `queryMemory(...)` | Query by embedding similarity |
| `getMemoryStats(userId)` | Get user memory statistics |
| `healthCheck()` | Server health probe |

## License

Proprietary — © 2026 HeadySystems Inc.
