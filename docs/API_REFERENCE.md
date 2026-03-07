# HeadySystems™ API Reference

## Service Endpoints

### HeadyBrain (:3001)

#### `POST /chat`

Send a chat message to the cognitive core.

```json
{
  "message": "Analyze this grant proposal",
  "model": "gpt-4",
  "context": [
    { "role": "system", "content": "You are a grant writing assistant" }
  ]
}
```

#### `POST /analyze`

Run deep analysis on content.

```json
{
  "content": "990 filing data...",
  "type": "data",
  "options": { "depth": "deep", "includeRecommendations": true }
}
```

#### `GET /health`

```json
{ "service": "heady-brain", "status": "healthy", "uptime": 3600 }
```

---

### HeadyConductor (:3002)

#### `POST /tasks`

Submit a task for orchestrated execution.

```json
{
  "type": "grant-writing",
  "priority": 0.95,
  "metadata": { "nonprofit": "example-org" }
}
```

Response:

```json
{
  "task": { "id": "task-1709...", "status": "pending" },
  "assignment": { "agentId": "heady-buddy-1", "latency": 12 },
  "latency": 12
}
```

---

### HeadyMCP (:3003)

#### MCP Protocol (JSON-RPC 2.0 over stdio/SSE)

**List Tools**

```json
{ "jsonrpc": "2.0", "method": "tools/list", "id": 1 }
```

**Call Tool**

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": { "name": "search_memory", "arguments": { "query": "grant data" } },
  "id": 2
}
```

---

## CLI Commands

### `heady` (bin/heady-cli.js)

| Command | Description |
|---------|-------------|
| `heady init` | Initialize project with Sacred Geometry config |
| `heady start` | Start all services |
| `heady dev` | Start dev mode with hot reload |
| `heady build` | Build all packages |
| `heady deploy` | Deploy to Cloud Run |
| `heady test` | Run test suite with coverage |
| `heady doctor` | Check system health |
| `heady rotate-keys` | Rotate API credentials |
| `heady migrate` | Run database migrations |
| `heady projection <x> <y> <z>` | Spawn projection at coordinates |
| `heady status` | Show system status |

### `create-heady-agent`

```bash
npx create-heady-agent my-agent --template ai-assistant
```

Templates: `basic`, `ai-assistant`, `data-processing`, `integration`

---

## Redis Spatial Index API

```javascript
const { RedisSpatialIndex } = require('./src/memory/redis-spatial-index');
const index = new RedisSpatialIndex(redisClient);

await index.upsert('agent-1', { x: 10, y: 20, z: 5 });
const nearby = await index.nearby({ x: 10, y: 20, z: 5 }, 50); // radius 50
const collisions = await index.detectCollisions('agent-1');
```

## HeadyRedisPool API

```javascript
const { HeadyRedisPool } = require('./src/services/heady-redis-pool');
const pool = new HeadyRedisPool({ createClient: () => createRedisClient() });
await pool.initialize();

await pool.exec('hset', 'key', 'field', 'value');
const [a, b] = await pool.hmget('key', 'field1', 'field2');
await pool.pipeline(pipe => { pipe.hset('k1','f','v'); pipe.zadd('q',0.9,'k1'); });
```

## Tenant Isolation API

```javascript
const { TenantIsolation } = require('./src/services/tenant-isolation');
const isolation = new TenantIsolation();

isolation.registerTenant('tenant-1', { plan: 'pro' });
const middleware = isolation.expressMiddleware();
app.use(middleware);

// Scoped keys
TenantIsolation.dbSchema('tenant-1');       // → heady_tenant_1
TenantIsolation.redisPrefix('tenant-1');    // → heady:tenant-1:
TenantIsolation.vectorCollection('tenant-1'); // → heady_tenant_1_vectors
```

---

*HeadySystems™ & HeadyConnection™ — Sacred Geometry :: Organic Systems*
