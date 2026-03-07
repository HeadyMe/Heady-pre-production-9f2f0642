# @heady-ai/sdk

Official JavaScript/TypeScript SDK for the **HeadyOS Platform** and **HeadyMe AI**.

[![npm version](https://badge.fury.io/js/%40heady-ai%2Fsdk.svg)](https://www.npmjs.com/package/@heady-ai/sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)

---

## Installation

```bash
npm install @heady-ai/sdk
# or
pnpm add @heady-ai/sdk
# or
yarn add @heady-ai/sdk
```

---

## Quick Start

```typescript
import { HeadyClient } from '@heady-ai/sdk';

const heady = new HeadyClient({
  apiKey: process.env.HEADY_API_KEY!,
  tenantId: 'my-org', // Optional: for multi-tenant deployments
});

// Chat with HeadyOS AI
const response = await heady.brain.chat([
  { role: 'user', content: 'What is the golden ratio?' }
]);
console.log(response.message.content);
```

Get your API key at [headyme.com/settings/api-keys](https://headyme.com/settings/api-keys).

---

## API Reference

### HeadyClient Configuration

```typescript
const heady = new HeadyClient({
  apiKey: 'hdy_your_api_key',        // Required
  baseUrl: 'https://api.headyme.com/v1', // Optional: custom API URL
  tenantId: 'my-organization',       // Optional: multi-tenant support
  timeout: 11090,                    // Optional: request timeout ms (default: 1000 × φ^5)
  maxRetries: 5,                     // Optional: φ-backoff retries (default: fib(5)=5)
  debug: false,                      // Optional: enable debug logging
});
```

---

### `client.brain.chat(messages, options?)`

Send messages to the HeadyOS AI brain and receive a response.

```typescript
const response = await heady.brain.chat(
  [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain multi-agent orchestration.' }
  ],
  {
    model: 'gpt-4o',                 // Optional model override
    temperature: 0.618,             // Default: 1/φ ≈ 0.618
    maxTokens: 1440,                // Default: fib(12)=144 × 10
    memoryNamespace: 'user-context',// Load vector memory context
    agentId: 'my-agent-id',        // Route to specific agent
  }
);

console.log(response.message.content);
console.log(response.usage.totalTokens);
```

---

### `client.agents.create(config)`

Create a new AI agent on HeadyOS.

```typescript
const agent = await heady.agents.create({
  name: 'research-agent',
  description: 'Specialized research and analysis agent',
  systemPrompt: 'You are a professional research analyst. Provide detailed, cited analysis.',
  capabilities: ['mcp_tools', 'memory_read', 'memory_write', 'web_search'],
  tools: ['web_search', 'code_interpreter', 'document_reader'],
  memoryNamespace: 'research-context',
  maxIterations: 13, // fib(7)=13 default
});

console.log(agent.id); // Use this ID to route brain.chat requests
```

### `client.agents.list(filters?)`

```typescript
const { items, total } = await heady.agents.list({
  status: 'active',
  pageSize: 13, // fib(7)=13
});
```

### `client.agents.get(id)` / `client.agents.delete(id)`

```typescript
const agent = await heady.agents.get('agent-id');
await heady.agents.delete('agent-id');
```

---

### `client.memory.store(key, value, options?)`

Store data in HeadyOS vector memory with automatic embedding generation.

```typescript
await heady.memory.store(
  'project-context',
  'Project Alpha is a real-time multi-agent orchestration platform targeting enterprise DevOps teams.',
  {
    namespace: 'my-project',
    metadata: { category: 'project', confidence: 0.854 },
    ttlDays: 233, // fib(13)=233 days
  }
);
```

### `client.memory.search(query, options?)`

Semantic similarity search across vector memory.

```typescript
const results = await heady.memory.search('enterprise AI orchestration', {
  namespace: 'my-project',
  topK: 5,          // fib(5)=5 default
  minScore: 0.382,  // MODERATE CSL threshold (1/φ^2)
});

for (const entry of results.results) {
  console.log(`[Score: ${entry.score?.toFixed(3)}] ${entry.key}: ${entry.value.substring(0, 100)}`);
}
```

---

### `client.mcp.listTools()`

List all available Model Context Protocol (MCP) tools.

```typescript
const tools = await heady.mcp.listTools();
for (const tool of tools) {
  console.log(`${tool.name}: ${tool.description}`);
}
```

### `client.mcp.executeTool(name, args, options?)`

Execute an MCP tool directly.

```typescript
const result = await heady.mcp.executeTool('web_search', {
  query: 'HeadyOS multi-agent orchestration',
  maxResults: 5,
});

if (!result.isError) {
  console.log('Search results:', result.result);
}
```

---

### `client.conductor.submitTask(task)`

Submit a multi-agent orchestration task to the Heady Conductor.

```typescript
const task = await heady.conductor.submitTask({
  type: 'competitive_analysis',
  title: 'Q1 2026 Market Analysis',
  input: {
    industry: 'Enterprise AI',
    competitors: ['OpenAI', 'Anthropic', 'Google DeepMind'],
    outputFormat: 'markdown_report',
  },
  agentId: 'research-agent-id',
  priority: 'high',
  maxSteps: 21, // fib(8)=21 default
  webhookUrl: 'https://your-app.com/webhooks/heady-results',
});

// Poll for completion with φ-backoff
const completed = await heady.conductor.waitForCompletion(task.taskId);
console.log('Task result:', completed.result);
```

### `client.conductor.getStatus(taskId)`

```typescript
const status = await heady.conductor.getStatus('task-id');
console.log(`Status: ${status.status} (${Math.round((status.progress ?? 0) * 100)}%)`);
```

---

### `client.events.subscribe(channel, callback)`

Subscribe to real-time HeadyOS events via WebSocket with φ-backoff auto-reconnect.

```typescript
// Subscribe to task updates
const sub = await heady.events.subscribe(`task:${taskId}`, (event) => {
  console.log('Task update:', event.type, event.data);
});

// Subscribe to agent events
const agentSub = await heady.events.subscribe(`agent:${agentId}`, (event) => {
  if (event.type === 'step_completed') {
    console.log('Agent step:', event.data);
  }
});

// Subscribe to streaming brain output
const streamSub = await heady.events.subscribe(`brain:stream:${sessionId}`, (event) => {
  process.stdout.write((event.data as { token: string }).token);
});

// Unsubscribe when done
sub.unsubscribe();
agentSub.unsubscribe();
streamSub.unsubscribe();

// Clean up all connections
heady.destroy();
```

---

## Error Handling

The SDK provides typed error classes for precise error handling:

```typescript
import {
  HeadyClient,
  AuthError,
  RateLimitError,
  ValidationError,
  NetworkError,
  ServerError,
  AgentError,
} from '@heady-ai/sdk';

try {
  const response = await heady.brain.chat([{ role: 'user', content: 'Hello' }]);
} catch (err) {
  if (err instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${err.retryAfterMs}ms`);
    console.log(`Resets at: ${err.resetAt}`);
  } else if (err instanceof AuthError) {
    console.error('Authentication failed:', err.message);
    // Re-authenticate
  } else if (err instanceof NetworkError) {
    console.error('Network error (will auto-retry):', err.message);
  } else if (err instanceof ValidationError) {
    console.error('Validation errors:', err.issues);
  } else {
    throw err;
  }
}
```

---

## Interceptors

```typescript
// Log all requests
heady.addRequestInterceptor((config) => {
  console.log(`[${new Date().toISOString()}] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// Transform responses
heady.addResponseInterceptor((response) => {
  // Add custom metadata
  return response;
});
```

---

## Advanced: φ-Exponential Retry

The SDK automatically retries transient failures with φ-exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1000ms |
| 2 | 1618ms (1000 × φ) |
| 3 | 2618ms (1000 × φ²) |
| 4 | 4236ms (1000 × φ³) |
| 5 | 6854ms (1000 × φ⁴) |

Configure retries:
```typescript
const heady = new HeadyClient({
  apiKey: '...',
  maxRetries: 8,    // fib(6)=8 for more resilient connections
  timeout: 17944,   // 1000 × φ^6 for longer operations
});
```

---

## TypeScript Support

Full TypeScript type safety with Zod runtime validation:

```typescript
import type {
  HeadyConfig,
  Agent,
  AgentConfig,
  MemoryEntry,
  ConductorTask,
  ChatResponse,
  HeadyEvent,
} from '@heady-ai/sdk';
```

---

## φ (Golden Ratio) Design Principle

All numeric parameters in this SDK derive from φ = 1.618033988749895 and Fibonacci sequences.
Access these constants via:

```typescript
import { HeadyClient } from '@heady-ai/sdk';

console.log(HeadyClient.PHI);           // 1.618033988749895
console.log(HeadyClient.fibonacci(13)); // 233
```

---

## Links

- [API Reference Documentation](https://docs.headyme.com/sdk/javascript)
- [Getting Started Guide](https://docs.headyme.com/sdk/getting-started)
- [OpenAPI Spec](https://api.headyme.com/v1/openapi.yaml)
- [Postman Collection](https://docs.headyme.com/postman)
- [GitHub](https://github.com/heady-ai/sdk-javascript)
- [npm](https://www.npmjs.com/package/@heady-ai/sdk)
- [Status Page](https://status.headyme.com)

---

**HeadySystems Inc. (DBA Heady™)** | [headyme.com](https://headyme.com) | sdk@headyme.com
