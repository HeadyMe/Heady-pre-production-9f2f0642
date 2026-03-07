# HeadySystems — Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2026-03-07  

---

## How to Use This Guide

Find your symptom in the table of contents, follow the diagnostic steps, and apply the resolution. If your issue isn't listed, check the [FAQ](./faq.md) or contact support@headyme.com.

---

## Table of Contents

1. [API Timeout](#1-api-timeout)
2. [Rate Limiting (HTTP 429)](#2-rate-limiting)
3. [Agent Stuck / Not Responding](#3-agent-stuck--not-responding)
4. [Memory Full / Quota Exceeded](#4-memory-full--quota-exceeded)
5. [Authentication Errors (401/403)](#5-authentication-errors)
6. [WebSocket Disconnect](#6-websocket-disconnect)
7. [Task Failed with Error](#7-task-failed-with-error)
8. [Agent Not Finding Relevant Memories](#8-agent-not-finding-relevant-memories)
9. [MCP Tool Call Failing](#9-mcp-tool-call-failing)
10. [Billing / Quota Issues](#10-billing--quota-issues)

---

## 1. API Timeout

### Symptoms
- HTTP 504 Gateway Timeout
- `Error: timeout of 55000ms exceeded` in SDK
- Long-running requests never complete

### Causes & Resolutions

**Cause A: Request processing time > fib(10)=55s default timeout**

Resolution: For long-running tasks, use the async task API:
```javascript
// Instead of waiting for completion:
const result = await heady.tasks.create({ agentId, input });  // ❌ May timeout

// Use async pattern:
const task = await heady.tasks.submit({ agentId, input, async: true });
const result = await heady.tasks.poll(task.id, { timeout: 300_000 });  // ✅ 5 min poll
```

**Cause B: Large input payload (>1MB)**

Resolution: Compress or chunk your input:
```javascript
// Split large documents
const chunks = splitDocument(longDocument, { maxChunks: 8 });  // fib(6)=8 chunks
for (const chunk of chunks) {
  await heady.memory.store({ content: chunk, namespace: 'doc-analysis' });
}
await heady.tasks.create({ agentId, input: 'Analyze the stored document chunks' });
```

**Cause C: Cold start latency**

The first request after a long idle period may take 1–3 seconds due to Cloud Run cold start. Resolution: Use the Pro plan (minInstances: 2 keeps instances warm).

**Cause D: External tool call timeout**

MCP tools like `web_search` or `http_fetch` may timeout if external services are slow.

Resolution: Set per-tool timeout in your agent config:
```json
{
  "tools": {
    "web_search": { "timeoutMs": 21000 },
    "http_fetch":  { "timeoutMs": 13000 }
  }
}
```

---

## 2. Rate Limiting

### Symptoms
- HTTP 429 Too Many Requests
- `Retry-After: 34` header in response
- `X-RateLimit-Remaining: 0`

### Causes & Resolutions

**Check your current limits:**
```bash
curl -I https://api.headyme.com/api/v1/health \
  -H "Authorization: Bearer YOUR_API_KEY"
# Look for: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Tier
```

**Implement φ-backoff retry:**
```javascript
const PHI = 1.618033988749895;

async function withRetry(fn, maxAttempts = 5) {  // fib(5)=5 attempts
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status !== 429) throw err;
      const delay = Math.round(1000 * Math.pow(PHI, i));
      // φ delays: 1000, 1618, 2618, 4236, 6854ms
      await new Promise(r => setTimeout(r, delay));
    }
  }
}
```

**Batch requests to reduce API calls:**
```javascript
// Instead of 89 individual requests:
const results = await Promise.all(tasks.map(t => heady.tasks.create(t)));  // ❌

// Use batch endpoint (max fib(12)=144 per batch):
const results = await heady.tasks.createBatch(tasks.slice(0, 144));  // ✅
```

**Upgrade plan** if consistently hitting limits. Pro plan: 89 req/min vs Free: 34 req/min.

---

## 3. Agent Stuck / Not Responding

### Symptoms
- Task status stays `processing` for > fib(9)=34 minutes
- Agent health endpoint returns CSL LOW
- No updates in streaming response

### Diagnostic Steps

```bash
# Check task status
curl "https://api.headyme.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '{status, cslScore, lastUpdated, toolCallCount}'

# Check agent health
curl "https://api.headyme.com/api/v1/agents/AGENT_ID/health" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq .
```

### Resolutions

**Resolution A: Cancel and retry the stuck task**
```javascript
await heady.tasks.cancel('TASK_ID');
const newTask = await heady.tasks.create({ agentId, input, timeout: 300_000 });
```

**Resolution B: Reduce task complexity**

If an agent is getting stuck on overly complex tasks:
- Split the task into smaller sub-tasks using the `agent_delegate` MCP tool
- Reduce the number of MCP tools available (fewer choices = faster planning)
- Provide more explicit instructions in the system prompt

**Resolution C: Check for tool call loops**

Agents can get stuck in tool call loops if the LLM keeps trying the same failing tool. Add a tool call limit:
```json
{
  "maxToolCalls": 21,
  "onToolLimitReached": "return_partial"
}
```

**Resolution D: Memory overload**

If the agent's context is full of irrelevant memories:
```javascript
// Search and clean stale memories
const stale = await heady.memory.search({
  namespace: `agent:${AGENT_ID}`,
  filter: { createdBefore: Date.now() - 30 * 86400000 }
});
await heady.memory.deleteMany(stale.map(m => m.id));
```

---

## 4. Memory Full / Quota Exceeded

### Symptoms
- `Error: Memory quota exceeded (5GB on Pro plan)`
- Memory writes failing with HTTP 507
- Vector search returning no results

### Check Memory Usage

```bash
curl "https://api.headyme.com/api/v1/memory/usage" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '{used, total, percent, cslLevel}'
```

### Resolutions

**Free up memory space:**
```javascript
// List memories by size
const memories = await heady.memory.list({ 
  namespace: 'global',
  sortBy: 'size',
  order: 'desc',
  limit: 55  // fib(10)=55
});

// Delete least-important memories (CSL < 0.382)
const lowCsl = memories.filter(m => m.cslImportance < 0.382);
await heady.memory.deleteMany(lowCsl.map(m => m.id));
```

**Adjust memory retention:**
```javascript
// Set memory TTL for non-critical information
await heady.memory.store({
  content: 'Temporary project notes',
  namespace: 'project:acme',
  ttlDays: 13  // fib(7)=13 days auto-expire
});
```

**Upgrade plan** — Pro includes 5GB, Enterprise is custom.

---

## 5. Authentication Errors

### HTTP 401 Unauthorized

```
{"error": "invalid_token", "message": "JWT token expired or invalid"}
```

**Cause:** API key is invalid, expired, or revoked.

**Resolution:**
```bash
# Verify API key is valid
curl "https://api.headyme.com/api/v1/auth/verify" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Generate a new API key in the dashboard:
# Settings → API Keys → New Key
```

For SDK users:
```javascript
const heady = new HeadyClient({ 
  apiKey: process.env.HEADY_API_KEY  // Never hardcode keys!
});
```

### HTTP 403 Forbidden

```
{"error": "insufficient_permissions", "cslScore": 0.3, "required": 0.618}
```

**Cause:** Your API key lacks the required capability for this operation.

**Resolution:** Check the required capabilities in the API docs and upgrade your key's permissions:
1. Dashboard → Settings → API Keys → Edit Key
2. Enable the required capability flag
3. Or create a new key with the correct permissions

---

## 6. WebSocket Disconnect

### Symptoms
- Streaming responses cut off mid-message
- `WebSocket: connection closed unexpectedly`
- Reconnection loops

### Cause A: Heartbeat timeout (fib(9)=34s)

If the client doesn't respond to ping within fib(7)=13 seconds, the connection is terminated.

**Resolution:** Implement ping/pong handling:
```javascript
const ws = new WebSocket('wss://ws.headyme.com/api/v1/stream');

ws.on('ping', () => ws.pong());  // Respond to heartbeat

// Or use the HeadyWebSocket client with built-in reconnect:
import { HeadyWebSocket } from '@heady-ai/sdk';
const ws = new HeadyWebSocket('wss://ws.headyme.com/api/v1/stream', {
  autoReconnect: true,
  phiBackoff: true  // Uses φ-exponential backoff
});
```

### Cause B: Instance migration (server maintenance)

You may receive a `server:migrate` message before disconnect:
```javascript
ws.on('message', (msg) => {
  if (msg.type === 'server:migrate') {
    // Server is draining — reconnect after suggested delay
    setTimeout(() => ws.reconnect(), msg.reconnectMs || 5000);
    return;
  }
  // Handle normal messages
});
```

### Cause C: Network issues

Check your network's WebSocket support. Some corporate firewalls block WebSocket upgrades. Use the polling fallback:
```javascript
const heady = new HeadyClient({ 
  transport: 'polling',  // SSE-based fallback
  pollingInterval: 5000  // fib(5)=5s
});
```

---

## 7. Task Failed with Error

### Diagnose the Error

```bash
curl "https://api.headyme.com/api/v1/tasks/TASK_ID" \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '{status, error, cslScore, toolCallCount, lastToolCall}'
```

### Common Error Codes

| Error Code | Meaning | Resolution |
|-----------|---------|------------|
| `TOOL_CALL_FAILED` | MCP tool returned an error | Check tool permissions and input format |
| `CONTEXT_OVERFLOW` | Input + memory > model context limit | Reduce input or clear old memories |
| `MODEL_ERROR` | Upstream LLM API error | Retry after fib(6)=8 seconds |
| `SANDBOX_VIOLATION` | Code execution tried restricted operation | Review agent tool permissions |
| `MAX_TOOL_CALLS` | Agent hit tool call limit (default: fib(8)=21) | Increase limit or simplify task |
| `CSL_BLOCKED` | Security system blocked the request | Review input for threat patterns |

---

## 8. Agent Not Finding Relevant Memories

### Symptoms
- Agent doesn't seem to "remember" previous work
- Memory search returns empty results
- Agent repeating work already done

### Diagnostic

```javascript
// Test memory search directly
const results = await heady.memory.search({
  query: 'what you expect the agent to remember',
  namespace: `agent:${AGENT_ID}`,
  limit: 5,
  debug: true  // Returns similarity scores
});
console.log(results.map(r => ({ content: r.content.slice(0, 100), score: r.similarity })));
```

### Resolutions

**Resolution A: Check namespace**
Memories are namespace-scoped. If stored in `agent:A` but searched in `global`, they won't be found.

**Resolution B: Low similarity scores**
If all scores < 0.382, the query doesn't match stored content. Try:
- More specific query text
- Storing memories with richer context during storage
- Using hybrid search (semantic + keyword)

**Resolution C: Memory not being stored**
Check the agent's `memoryEnabled` setting:
```javascript
const agent = await heady.agents.get(AGENT_ID);
console.log(agent.memoryEnabled);  // Should be true
```

---

## 9. MCP Tool Call Failing

### Diagnose

```bash
# Check tool call logs
curl "https://api.headyme.com/api/v1/tools/calls?taskId=TASK_ID" \
  -H "Authorization: Bearer YOUR_API_KEY" | jq '.calls[] | {tool, success, error, durationMs}'
```

### Common Issues

**`web_search` failing:** Check rate limit on search provider. Default: fib(7)=13 searches/minute per agent.

**`code_execution` failing:** Check for restricted operations (network calls, file system outside sandbox). Enable debugging:
```json
{
  "tools": {
    "code_execution": {
      "sandbox": "strict",
      "allowNetwork": false,
      "debugMode": true
    }
  }
}
```

**`http_fetch` failing:** Check target URL is not in the blocklist (private IP ranges, internal hosts).

---

## 10. Billing / Quota Issues

### Check Current Usage

```bash
curl "https://api.headyme.com/api/v1/billing/usage" \
  -H "Authorization: Bearer YOUR_API_KEY" | \
  jq '{plan, tasksUsed, tasksLimit, memoryUsedGb, memoryLimitGb, cycleEndsAt}'
```

### Task Quota Exceeded

If you've exceeded your monthly task quota:
1. Upgrade to the next plan tier
2. Purchase add-on task packs (available in multiples of fib(9)=34)
3. Or wait until the next billing cycle

### Unexpected Charges

If you see unexpected usage:
1. Check for API keys shared with multiple applications
2. Review task logs for unexpected agent invocations
3. Set usage alerts: Dashboard → Billing → Alert at 61.8% of limit (1/φ early warning)

---

## Still Stuck?

- **Docs:** https://docs.headyme.com
- **Status page:** https://status.headyme.com
- **Support email:** support@headyme.com (Pro/Enterprise: priority queue)
- **Discord community:** https://discord.gg/headysystems
- **GitHub issues:** https://github.com/headysystems/heady-systems/issues
