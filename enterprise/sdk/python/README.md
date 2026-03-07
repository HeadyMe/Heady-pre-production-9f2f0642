# heady-sdk (Python)

Official Python SDK for the **HeadyOS Platform** and **HeadyMe AI**.

[![PyPI version](https://badge.fury.io/py/heady-sdk.svg)](https://pypi.org/project/heady-sdk/)
[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://python.org)
[![Pydantic v2](https://img.shields.io/badge/pydantic-v2-green.svg)](https://docs.pydantic.dev/latest/)

---

## Installation

```bash
pip install heady-sdk
# or
poetry add heady-sdk
# or
uv add heady-sdk
```

**Requirements:** Python 3.11+, `httpx`, `pydantic>=2.6`, `websockets>=12`

---

## Quick Start (Async)

```python
import asyncio
from heady import HeadyClient, HeadyConfig, Message

async def main():
    async with HeadyClient(HeadyConfig(api_key="hdy_your_api_key")) as heady:
        # Chat with AI
        response = await heady.brain.chat([
            Message(role="user", content="What is the golden ratio?")
        ])
        print(response.message.content)

asyncio.run(main())
```

## Quick Start (Sync)

```python
from heady import SyncHeadyClient, HeadyConfig, Message

with SyncHeadyClient(HeadyConfig(api_key="hdy_your_api_key")) as heady:
    response = heady.brain.chat([
        Message(role="user", content="Hello, HeadyOS!")
    ])
    print(response.message.content)
```

---

## API Reference

### Configuration

```python
from heady import HeadyConfig

config = HeadyConfig(
    api_key="hdy_your_api_key",     # Required
    tenant_id="my-organization",    # Optional: multi-tenant
    base_url="https://api.headyme.com/v1",  # Optional
    timeout=11.09,                  # Optional: seconds (default: 1000 × φ^5 / 1000)
    max_retries=5,                  # Optional: φ-backoff retries (default: fib(5)=5)
    debug=False,                    # Optional: enable debug logging
)
```

### `brain.chat(messages, options?)`

```python
from heady import Message, ChatOptions

response = await heady.brain.chat(
    messages=[
        Message(role="system", content="You are a helpful assistant."),
        Message(role="user", content="Explain multi-agent orchestration."),
    ],
    options=ChatOptions(
        model="gpt-4o",
        temperature=0.618,   # Default: 1/φ ≈ 0.618 — HIGH CSL threshold
        max_tokens=1440,
        memory_namespace="user-context",
        agent_id="my-agent-id",
    )
)

print(response.message.content)
print(f"Tokens: {response.usage.total_tokens}")
```

### `brain.analyze(text, options?)`

```python
from heady import AnalyzeOptions

result = await heady.brain.analyze(
    "This multi-agent system is revolutionary!",
    options=AnalyzeOptions(analysis_type="sentiment", confidence=True)
)
print(result.result)
print(f"Confidence: {result.confidence:.3f}")
```

### `agents.create(config)`

```python
from heady import AgentConfig, AgentCapability

agent = await heady.agents.create(AgentConfig(
    name="research-agent",
    system_prompt="You are a professional research analyst...",
    capabilities=[
        AgentCapability.MCP_TOOLS,
        AgentCapability.MEMORY_READ,
        AgentCapability.MEMORY_WRITE,
    ],
    tools=["web_search", "code_interpreter"],
    max_iterations=13,  # fib(7)=13 default
))
print(f"Agent ID: {agent.id}")
```

### `agents.list()` / `agents.get()` / `agents.delete()`

```python
from heady import AgentListFilters, AgentStatus

agents = await heady.agents.list(AgentListFilters(status=AgentStatus.ACTIVE))
agent = await heady.agents.get("agent-id")
await heady.agents.delete("agent-id")
```

### `memory.store(key, value, options?)`

```python
from heady import MemoryStoreOptions

await heady.memory.store(
    key="project-context",
    value="HeadyOS is a multi-agent orchestration platform for enterprise AI teams.",
    options=MemoryStoreOptions(
        namespace="my-project",
        ttl_days=233,  # fib(13)=233 days
        metadata={"source": "onboarding", "confidence": 0.854},
    )
)
```

### `memory.search(query, options?)`

```python
from heady import MemorySearchOptions

results = await heady.memory.search(
    "enterprise AI platform capabilities",
    options=MemorySearchOptions(
        namespace="my-project",
        top_k=5,        # fib(5)=5 default
        min_score=0.382,  # MODERATE CSL threshold
    )
)
for entry in results.results:
    print(f"[{entry.score:.3f}] {entry.key}: {entry.value[:80]}")
```

### `mcp.list_tools()` / `mcp.execute_tool(name, args)`

```python
tools = await heady.mcp.list_tools()
for tool in tools:
    print(f"{tool.name}: {tool.description}")

result = await heady.mcp.execute_tool(
    "web_search",
    {"query": "HeadyOS multi-agent orchestration", "maxResults": 5}
)
if not result.is_error:
    print(result.result)
```

### `conductor.submit_task(task)`

```python
from heady import ConductorTask, TaskPriority

task = await heady.conductor.submit_task(ConductorTask(
    type="competitive_analysis",
    title="Q1 2026 AI Market Report",
    input={"industry": "Enterprise AI", "depth": "comprehensive"},
    priority=TaskPriority.HIGH,
    agent_id="research-agent-id",
    max_steps=21,  # fib(8)=21 default
))

# Wait for completion with φ-backoff
completed = await heady.conductor.wait_for_completion(task.task_id)
print(f"Result: {completed.result}")
```

---

## Error Handling

```python
from heady import (
    HeadyError, AuthError, RateLimitError,
    ValidationError, NetworkError, ServerError,
)

try:
    response = await heady.brain.chat([Message(role="user", content="Hello")])
except RateLimitError as e:
    print(f"Rate limited. Retry after {e.retry_after_ms / 1000}s")
    print(f"Resets at: {e.reset_at}")
except AuthError as e:
    print(f"Auth failed ({e.status_code}): {e.message}")
except ValidationError as e:
    for issue in e.issues:
        print(f"  {issue['field']}: {issue['message']}")
except NetworkError as e:
    print(f"Network error (will auto-retry): {e.message}")
except HeadyError as e:
    print(f"Error [{e.code}]: {e.message}")
```

---

## φ (Golden Ratio) Constants

All numeric parameters derive from φ = 1.618033988749895:

```python
from heady import PHI, fibonacci

print(PHI)              # 1.618033988749895
print(fibonacci(13))    # 233 — default memory TTL (days)
print(fibonacci(8))     # 21  — default conductor max_steps
print(fibonacci(7))     # 13  — default agent max_iterations
print(1 / PHI)          # ≈ 0.618 — default temperature (HIGH CSL threshold)
print(1 / PHI**2)       # ≈ 0.382 — default min_score (MODERATE CSL threshold)
```

---

## Links

- [Full API Documentation](https://docs.headyme.com/sdk/python)
- [PyPI](https://pypi.org/project/heady-sdk/)
- [GitHub](https://github.com/heady-ai/sdk-python)
- [OpenAPI Spec](https://api.headyme.com/v1/openapi.yaml)
- [Status Page](https://status.headyme.com)

---

**HeadySystems Inc. (DBA Heady™)** | [headyme.com](https://headyme.com) | sdk@headyme.com
