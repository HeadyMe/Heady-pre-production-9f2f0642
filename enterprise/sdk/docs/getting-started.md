# Zero to First Agent in Under 10 Minutes
**HeadyOS Developer Getting Started Guide**

---

## What You'll Build

In this guide you'll:
1. Get your API key from headyme.com
2. Install the HeadyOS SDK
3. Create your first AI agent
4. Send your first task to the Heady Conductor
5. Check results in real-time via WebSocket events

**Time:** ~8 minutes | **Prerequisites:** Node.js 20+ or Python 3.11+

---

## Step 1: Get Your API Key (1 minute)

1. Go to [headyme.com/settings/api-keys](https://headyme.com/settings/api-keys)
2. Click **Create New API Key**
3. Name it (e.g., `my-first-agent`) and select scopes: `brain:read`, `agents:write`, `memory:write`, `conductor:write`
4. Copy the key — it's shown **once only**

Store it securely:
```bash
export HEADY_API_KEY="hdy_your_key_here"
```

---

## Step 2: Install the SDK (1 minute)

**JavaScript / TypeScript:**
```bash
npm install @heady-ai/sdk
# or
pnpm add @heady-ai/sdk
```

**Python:**
```bash
pip install heady-sdk
# or
poetry add heady-sdk
```

---

## Step 3: Health Check (30 seconds)

Verify your API key works:

**JavaScript:**
```javascript
import { HeadyClient } from '@heady-ai/sdk';

const heady = new HeadyClient({
  apiKey: process.env.HEADY_API_KEY,
});

const health = await heady.healthCheck();
console.log('Status:', health.status); // 'healthy'
console.log('Latency:', health.latencyMs, 'ms');
```

**Python:**
```python
import asyncio
from heady import HeadyClient, HeadyConfig

async def main():
    async with HeadyClient(HeadyConfig(api_key=os.environ['HEADY_API_KEY'])) as heady:
        health = await heady.health_check()
        print(f"Status: {health['status']}")  # 'healthy'

asyncio.run(main())
```

---

## Step 4: Create Your First Agent (2 minutes)

An **agent** is an AI model configured with a specific persona, capabilities, and optional MCP tool access.

**JavaScript:**
```javascript
const agent = await heady.agents.create({
  name: 'my-first-agent',
  description: 'Research and analysis agent',
  systemPrompt: `You are a professional research analyst specializing in technology markets.
You provide detailed, evidence-based analysis with clear citations.
Always structure your responses with: Summary, Key Findings, and Recommendations.`,
  capabilities: ['mcp_tools', 'memory_read', 'memory_write', 'web_search'],
  tools: ['web_search'],
  memoryNamespace: 'research-context',
  maxIterations: 13, // fib(7)=13 — the agent can take up to 13 steps
});

console.log('Agent created!');
console.log('Agent ID:', agent.id);
console.log('Status:', agent.status); // 'active'

// Save for later
const AGENT_ID = agent.id;
```

**Python:**
```python
from heady import AgentConfig, AgentCapability

agent = await heady.agents.create(AgentConfig(
    name="my-first-agent",
    description="Research and analysis agent",
    system_prompt="""You are a professional research analyst specializing in technology markets.
Provide detailed, evidence-based analysis with clear citations.
Always structure responses with: Summary, Key Findings, and Recommendations.""",
    capabilities=[
        AgentCapability.MCP_TOOLS,
        AgentCapability.MEMORY_READ,
        AgentCapability.MEMORY_WRITE,
    ],
    tools=["web_search"],
    memory_namespace="research-context",
    max_iterations=13,  # fib(7)=13
))

print(f"Agent created! ID: {agent.id}")
AGENT_ID = agent.id
```

---

## Step 5: Store Context in Vector Memory (1 minute)

Give your agent persistent knowledge with HeadyOS Vector Memory:

**JavaScript:**
```javascript
// Store some context your agent can retrieve
await heady.memory.store(
  'company-context',
  'HeadySystems Inc. (DBA Heady™) builds multi-agent AI orchestration platforms. ' +
  'Focus areas: enterprise DevOps, AI automation, multi-agent workflows.',
  {
    namespace: 'research-context',
    metadata: {
      type: 'context',
      importance: 0.854, // HIGH CSL threshold
    },
    ttlDays: 233, // fib(13)=233 days
  }
);

// Search your memory
const results = await heady.memory.search('multi-agent platform capabilities', {
  namespace: 'research-context',
  topK: 5,
  minScore: 0.382, // MODERATE CSL threshold (1/φ²)
});

console.log('Found', results.totalFound, 'relevant memories');
for (const entry of results.results) {
  console.log(`[${entry.score?.toFixed(3)}] ${entry.key}: ${entry.value.substring(0, 80)}...`);
}
```

---

## Step 6: Send Your First Task (2 minutes)

The **Heady Conductor** orchestrates multi-step tasks across agents.

**JavaScript:**
```javascript
// Submit a research task to the Conductor
const task = await heady.conductor.submitTask({
  type: 'research_report',
  title: 'Multi-Agent AI Competitive Landscape',
  input: {
    topic: 'Enterprise multi-agent AI orchestration platforms',
    depth: 'comprehensive',
    competitors: ['LangChain', 'AutoGen', 'CrewAI'],
    outputFormat: 'markdown_report',
  },
  agentId: AGENT_ID,
  priority: 'high',
  maxSteps: 21, // fib(8)=21 — agent can take up to 21 orchestration steps
});

console.log('Task submitted!');
console.log('Task ID:', task.taskId);
console.log('Status:', task.status); // 'queued'
```

---

## Step 7: Monitor with Real-Time Events (1 minute)

Subscribe to live task updates via WebSocket:

**JavaScript:**
```javascript
// Subscribe to task events
const subscription = await heady.events.subscribe(
  `task:${task.taskId}`,
  (event) => {
    switch (event.type) {
      case 'task_started':
        console.log('Task started!');
        break;
      case 'step_completed':
        console.log(`Step ${event.data.step}/${event.data.maxSteps} completed`);
        break;
      case 'task_completed':
        console.log('Task completed!');
        console.log('Result preview:', JSON.stringify(event.data.result).substring(0, 200));
        subscription.unsubscribe();
        break;
      case 'task_failed':
        console.error('Task failed:', event.data.error);
        subscription.unsubscribe();
        break;
    }
  }
);

// Alternatively, wait for completion with φ-backoff polling
const completed = await heady.conductor.waitForCompletion(task.taskId);
console.log('Final status:', completed.status);
if (completed.result) {
  console.log('Result:', completed.result);
}

// Clean up
heady.destroy();
```

---

## Complete Example

Here's the full working example in one file:

**JavaScript (ES Modules):**
```javascript
// first-agent.mjs
import { HeadyClient } from '@heady-ai/sdk';

async function main() {
  const heady = new HeadyClient({
    apiKey: process.env.HEADY_API_KEY,
    debug: true, // Log all requests for learning
  });

  // 1. Health check
  const { status, latencyMs } = await heady.healthCheck();
  console.log(`✓ API healthy (${latencyMs}ms)`);

  // 2. Quick chat
  const chatResponse = await heady.brain.chat([
    { role: 'user', content: 'In one sentence, what is HeadyOS?' }
  ]);
  console.log(`✓ Brain response: ${chatResponse.message.content}`);

  // 3. Create agent
  const agent = await heady.agents.create({
    name: 'quickstart-agent',
    systemPrompt: 'You are a helpful research assistant.',
    capabilities: ['memory_read', 'memory_write'],
    maxIterations: 13,
  });
  console.log(`✓ Agent created: ${agent.id}`);

  // 4. Store memory
  await heady.memory.store(
    'quickstart-fact',
    'HeadyOS uses φ = 1.618033988749895 for all numeric parameters',
    { namespace: 'quickstart' }
  );
  console.log('✓ Memory stored');

  // 5. Submit task
  const task = await heady.conductor.submitTask({
    type: 'analysis',
    input: { query: 'Explain the golden ratio in AI systems' },
    agentId: agent.id,
    maxSteps: 5,
  });
  console.log(`✓ Task submitted: ${task.taskId}`);

  // 6. Wait for result
  const result = await heady.conductor.waitForCompletion(task.taskId);
  console.log(`✓ Task ${result.status}!`);

  // 7. Clean up
  await heady.agents.delete(agent.id);
  heady.destroy();
  console.log('✓ Done! Your first Heady agent has completed a task.');
}

main().catch(console.error);
```

Run it:
```bash
HEADY_API_KEY=hdy_your_key node first-agent.mjs
```

---

## What's Next?

| Topic | Link |
|-------|------|
| Full API Reference | [docs.headyme.com/api](https://docs.headyme.com/api) |
| SDK JavaScript Docs | [sdk/javascript/README.md](../javascript/README.md) |
| SDK Python Docs | [sdk/python/README.md](../python/README.md) |
| Example: Slack Bot | [sdk/examples/slack-bot.js](../examples/slack-bot.js) |
| Example: GitHub Webhook | [sdk/examples/github-webhook.js](../examples/github-webhook.js) |
| Example: Custom MCP Tool | [sdk/examples/custom-mcp-tool.js](../examples/custom-mcp-tool.js) |
| OpenAPI Spec | [sdk/openapi/openapi.yaml](../openapi/openapi.yaml) |
| Postman Collection | [sdk/postman/heady-api-collection.json](../postman/heady-api-collection.json) |
| Enterprise Features | [compliance/legal/terms-of-service.md](../../compliance/legal/terms-of-service.md) |

---

**Support:** sdk@headyme.com | [headyme.com/docs](https://docs.headyme.com) | [status.headyme.com](https://status.headyme.com)

*HeadySystems Inc. (DBA Heady™) | headyme.com*
