# HeadyStack MCP Server Documentation

**Protocol:** Model Context Protocol (MCP)  
**Transport:** HTTP (Streamable HTTP) + stdio  
**Version:** 3.0.1 "Aether"  
**Tools:** 31

---

## Overview

HeadyStack implements an MCP server at `/mcp`, exposing all platform capabilities as typed tools. Compatible with Claude Desktop, Cursor, and any MCP client.

### Server Info

```
GET /mcp
```

```json
{
  "name": "HeadyStack",
  "version": "3.0.1",
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {},
    "resources": {},
    "prompts": {}
  }
}
```

---

## Authentication

```http
Authorization: Bearer <accessToken>
```

Or API key:

```http
X-Heady-Key: hdy_live_xxxxxx
```

---

## Tool Invocation

```http
POST /mcp/tools/call
Content-Type: application/json
Authorization: Bearer <token>
```

```json
{
  "name": "<tool_name>",
  "arguments": { ... }
}
```

Response:

```json
{
  "content": [
    { "type": "text", "text": "..." }
  ],
  "isError": false
}
```

---

## Tool List

```http
GET /mcp/tools/list
```

Returns array of all 31 tool definitions with JSON schemas.

---

## Tool Reference

### 1. `heady_chat`

Route a message to the best-fit LLM engine.

**Input:**
```json
{
  "message": { "type": "string" },
  "model": { "type": "string", "optional": true },
  "systemPrompt": { "type": "string", "optional": true },
  "temperature": { "type": "number", "optional": true },
  "maxTokens": { "type": "integer", "optional": true },
  "stream": { "type": "boolean", "default": false }
}
```

---

### 2. `heady_memory_store`

Store text as a vector in HeadyMemory.

**Input:**
```json
{
  "namespace": { "type": "string" },
  "key": { "type": "string" },
  "content": { "type": "string" },
  "metadata": { "type": "object", "optional": true }
}
```

---

### 3. `heady_memory_search`

Semantic search in vector memory.

**Input:**
```json
{
  "query": { "type": "string" },
  "namespace": { "type": "string", "optional": true },
  "topK": { "type": "integer", "default": 10 },
  "minScore": { "type": "number", "default": 0.7 }
}
```

---

### 4. `heady_memory_delete`

Delete a vector memory entry by ID.

**Input:**
```json
{
  "id": { "type": "string" }
}
```

---

### 5. `heady_bee_invoke`

Invoke a bee domain agent for specialized tasks.

**Input:**
```json
{
  "domain": {
    "type": "string",
    "enum": ["research", "coding", "writing", "analysis", "planning",
             "memory", "retrieval", "synthesis", "critique", "validation",
             "design", "data", "finance", "legal", "security", "devops",
             "testing", "documentation", "api", "database", "ux",
             "marketing", "support", "orchestration"]
  },
  "task": { "type": "string" },
  "context": { "type": "string", "optional": true },
  "engine": { "type": "string", "optional": true }
}
```

---

### 6. `heady_bee_list`

List all available bee domains and their status.

**Input:** `{}`

---

### 7. `heady_pipeline_enqueue`

Enqueue a task into the 12-stage pipeline.

**Input:**
```json
{
  "type": { "type": "string", "enum": ["chat", "agent", "tool", "batch"] },
  "data": { "type": "object" },
  "priority": { "type": "string", "enum": ["low", "normal", "high", "critical"], "default": "normal" }
}
```

---

### 8. `heady_pipeline_status`

Get status of a pipeline task.

**Input:**
```json
{
  "taskId": { "type": "string" }
}
```

---

### 9. `heady_agent_spawn`

Spawn a new autonomous agent.

**Input:**
```json
{
  "goal": { "type": "string" },
  "engine": { "type": "string", "optional": true },
  "tools": { "type": "array", "items": { "type": "string" }, "optional": true },
  "beeDomains": { "type": "array", "items": { "type": "string" }, "optional": true },
  "maxSteps": { "type": "integer", "default": 20 },
  "timeout_ms": { "type": "integer", "default": 300000 }
}
```

---

### 10. `heady_agent_list`

List all active agents.

**Input:** `{}`

---

### 11. `heady_agent_terminate`

Terminate an agent by ID.

**Input:**
```json
{
  "agentId": { "type": "string" }
}
```

---

### 12. `heady_tool_execute`

Execute a registered HeadyTool by name.

**Input:**
```json
{
  "toolName": { "type": "string" },
  "args": { "type": "object" }
}
```

---

### 13. `heady_tool_list`

List all registered HeadyTools.

**Input:** `{}`

---

### 14. `heady_file_upload`

Upload and vector-index a file (base64 encoded).

**Input:**
```json
{
  "filename": { "type": "string" },
  "content": { "type": "string", "description": "base64-encoded file content" },
  "mimeType": { "type": "string" },
  "namespace": { "type": "string", "default": "document" }
}
```

---

### 15. `heady_file_search`

Semantic search across indexed files.

**Input:**
```json
{
  "query": { "type": "string" },
  "namespace": { "type": "string", "optional": true },
  "topK": { "type": "integer", "default": 10 }
}
```

---

### 16. `heady_notion_page_create`

Create a Notion page in a specified parent.

**Input:**
```json
{
  "parentId": { "type": "string" },
  "title": { "type": "string" },
  "content": { "type": "string", "description": "Markdown content" },
  "properties": { "type": "object", "optional": true }
}
```

---

### 17. `heady_notion_page_read`

Read a Notion page by ID.

**Input:**
```json
{
  "pageId": { "type": "string" }
}
```

---

### 18. `heady_notion_db_query`

Query a Notion database with filters.

**Input:**
```json
{
  "databaseId": { "type": "string" },
  "filter": { "type": "object", "optional": true },
  "sorts": { "type": "array", "optional": true },
  "pageSize": { "type": "integer", "default": 100 }
}
```

---

### 19. `heady_github_repo_read`

Get repository metadata and statistics.

**Input:**
```json
{
  "owner": { "type": "string" },
  "repo": { "type": "string" }
}
```

---

### 20. `heady_github_file_read`

Read a file from a GitHub repository.

**Input:**
```json
{
  "owner": { "type": "string" },
  "repo": { "type": "string" },
  "path": { "type": "string" },
  "ref": { "type": "string", "default": "main" }
}
```

---

### 21. `heady_github_issue_create`

Create a GitHub issue.

**Input:**
```json
{
  "owner": { "type": "string" },
  "repo": { "type": "string" },
  "title": { "type": "string" },
  "body": { "type": "string" },
  "labels": { "type": "array", "items": { "type": "string" }, "optional": true },
  "assignees": { "type": "array", "items": { "type": "string" }, "optional": true }
}
```

---

### 22. `heady_github_pr_create`

Create a GitHub pull request.

**Input:**
```json
{
  "owner": { "type": "string" },
  "repo": { "type": "string" },
  "title": { "type": "string" },
  "body": { "type": "string" },
  "head": { "type": "string" },
  "base": { "type": "string", "default": "main" },
  "draft": { "type": "boolean", "default": false }
}
```

---

### 23. `heady_perplexity_search`

Search the web using Perplexity AI sonar.

**Input:**
```json
{
  "query": { "type": "string" },
  "model": {
    "type": "string",
    "enum": ["sonar-large-online", "sonar-medium-online", "sonar-small-online"],
    "default": "sonar-medium-online"
  },
  "maxTokens": { "type": "integer", "default": 1024 }
}
```

---

### 24. `heady_cloudflare_dns_list`

List Cloudflare DNS records for the configured zone.

**Input:**
```json
{
  "type": { "type": "string", "optional": true, "enum": ["A", "AAAA", "CNAME", "TXT", "MX", "NS"] },
  "name": { "type": "string", "optional": true }
}
```

---

### 25. `heady_cloudflare_dns_create`

Create a Cloudflare DNS record.

**Input:**
```json
{
  "type": { "type": "string", "enum": ["A", "AAAA", "CNAME", "TXT", "MX"] },
  "name": { "type": "string" },
  "content": { "type": "string" },
  "ttl": { "type": "integer", "default": 3600 },
  "proxied": { "type": "boolean", "default": false }
}
```

---

### 26. `heady_cloudflare_zone_purge`

Purge Cloudflare cache (by URLs or everything).

**Input:**
```json
{
  "purgeEverything": { "type": "boolean", "default": false },
  "files": { "type": "array", "items": { "type": "string" }, "optional": true }
}
```

---

### 27. `heady_render_deploy`

Trigger a Render.com deployment.

**Input:**
```json
{
  "serviceId": { "type": "string" },
  "clearCache": { "type": "boolean", "default": false }
}
```

---

### 28. `heady_render_service_list`

List all Render.com services.

**Input:** `{}`

---

### 29. `heady_stripe_customer_create`

Create a Stripe customer.

**Input:**
```json
{
  "email": { "type": "string" },
  "name": { "type": "string", "optional": true },
  "metadata": { "type": "object", "optional": true }
}
```

---

### 30. `heady_stripe_subscription_list`

List Stripe subscriptions with optional filters.

**Input:**
```json
{
  "customerId": { "type": "string", "optional": true },
  "status": {
    "type": "string",
    "optional": true,
    "enum": ["active", "past_due", "canceled", "trialing", "all"]
  },
  "limit": { "type": "integer", "default": 100 }
}
```

---

### 31. `heady_system_pulse`

Get full system health status across all subsystems.

**Input:** `{}`

**Returns:** Complete system status (same as `GET /pulse`)

---

## Streaming

Some tools support streaming responses (e.g., `heady_chat` with `stream: true`).

Streaming MCP responses use `text/event-stream` with `Content-Type: text/event-stream`.

```
data: {"type":"start","toolCallId":"xxx"}
data: {"type":"delta","content":"Partial response..."}
data: {"type":"end","usage":{"inputTokens":42,"outputTokens":180}}
```

---

## Error Handling

```json
{
  "content": [
    { "type": "text", "text": "Error: TOOL_NOT_FOUND — 'invalid_tool' is not registered" }
  ],
  "isError": true
}
```

---

## Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "headystack": {
      "command": "npx",
      "args": ["@headysystems/heady-mcp-proxy", "https://your-deployment/mcp"],
      "env": {
        "HEADY_API_KEY": "hdy_live_xxxxxx"
      }
    }
  }
}
```
