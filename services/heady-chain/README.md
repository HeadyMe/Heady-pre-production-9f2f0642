# HeadyChain

Native agent orchestration framework for the Heady AI platform. A production-ready replacement for LangChain/LangGraph with graph-based workflows, tool calling, memory, and Sacred Geometry (PHI=1.618) scaling.

---

## Architecture

```
heady-chain/
├── index.js          # Main orchestrator & DAG execution engine
├── graph.js          # Fluent graph builder (DAG)
├── nodes.js          # Built-in node type executors
├── tools.js          # Tool registry & built-in tools
├── memory.js         # Memory: buffer, summary, vector, entity, working
├── prompts.js        # Prompt templates & output parsers
├── agents.js         # Pre-built agent patterns
├── routes.js         # Express router (all HTTP endpoints)
├── health.js         # Health check
├── config.js         # Config & PHI constants
├── server.js         # Express server entry point
├── Dockerfile
├── docker-compose.yml
└── __tests__/
    └── heady-chain.test.js
```

---

## Quick Start

### Install & Run

```bash
npm install
npm start
```

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HEADY_CHAIN_PORT` | `3007` | HTTP port |
| `HEADY_INFER_URL` | `http://heady-infer:3003` | LLM inference service |
| `HEADY_VECTOR_URL` | `http://heady-vector:3006` | Vector store service |
| `HEADY_INFER_DEFAULT_MODEL` | `claude-3-5-sonnet-20241022` | Default LLM model |
| `MAX_PARALLEL_NODES` | `10` | Max concurrent node executions |
| `DEFAULT_WORKFLOW_TIMEOUT_MS` | `300000` | Workflow timeout (5 min) |
| `DEFAULT_NODE_TIMEOUT_MS` | `30000` | Per-node timeout |
| `MAX_RETRY_ATTEMPTS` | `5` | Max retry attempts (PHI backoff) |
| `CHECKPOINT_ENABLED` | `true` | Enable workflow checkpointing |
| `CHECKPOINT_DIR` | `/tmp/heady-chain/checkpoints` | Checkpoint storage directory |
| `REACT_MAX_ITERATIONS` | `10` | ReAct agent loop limit |
| `HEADY_INFER_MOCK` | `false` | Use mock LLM responses (for testing) |

---

## Graph Builder

Build workflows as DAGs using the fluent `GraphBuilder` API.

### Basic Linear Graph

```js
const { GraphBuilder } = require('./graph');
const { NODE_TYPES } = require('./nodes');
const { HeadyChain } = require('./index');

const chain = new HeadyChain();

const graph = chain.createGraph('my-workflow')
  .addNode('fetch', NODE_TYPES.TOOL, {
    toolName: 'web_search',
    inputs: { query: '{userQuery}' },
    outputKey: 'searchResults',
  })
  .addNode('summarize', NODE_TYPES.LLM, {
    prompt: 'Summarize these search results: {searchResults}',
    outputKey: 'summary',
  })
  .addEdge('fetch', 'summarize')
  .setEntryPoint('fetch')
  .setExitPoint('summarize');

const result = await chain.execute(graph, { userQuery: 'latest AI news' });
console.log(result.state.summary);
```

### Conditional Routing

```js
const graph = chain.createGraph('conditional-workflow')
  .addNode('classify', NODE_TYPES.CONDITIONAL, {
    condition: async (state) => state.sentiment > 0 ? 'positive' : 'negative',
    branches: { positive: 'praise', negative: 'improve' },
  })
  .addNode('praise', NODE_TYPES.TRANSFORM, {
    transform: s => ({ ...s, response: 'Great work!' }),
  })
  .addNode('improve', NODE_TYPES.TRANSFORM, {
    transform: s => ({ ...s, response: 'Here are suggestions...' }),
  })
  .addEdge('classify', 'praise', null, 'positive')
  .addEdge('classify', 'improve', null, 'negative')
  .setEntryPoint('classify');

const result = await chain.execute(graph, { sentiment: 0.8 });
```

### Parallel Fan-out + Reduce

```js
const graph = chain.createGraph('parallel-research')
  .addNode('start', NODE_TYPES.TRANSFORM, { transform: s => s })
  .addNode('search_academic', NODE_TYPES.TOOL, {
    toolName: 'web_search',
    inputs: { query: '{topic} academic papers' },
    outputKey: 'academicResults',
  })
  .addNode('search_news', NODE_TYPES.TOOL, {
    toolName: 'web_search',
    inputs: { query: '{topic} latest news' },
    outputKey: 'newsResults',
  })
  .addNode('synthesize', NODE_TYPES.LLM, {
    prompt: 'Synthesize: Academic: {academicResults} News: {newsResults}',
    outputKey: 'synthesis',
  })
  .addEdge('start', 'search_academic')
  .addEdge('start', 'search_news')
  .addEdge('search_academic', 'synthesize')
  .addEdge('search_news', 'synthesize')
  .setEntryPoint('start')
  .setExitPoint('synthesize');

const result = await chain.execute(graph, { topic: 'quantum computing' });
```

### Human-in-the-Loop

```js
const graph = chain.createGraph('human-review')
  .addNode('draft', NODE_TYPES.LLM, {
    prompt: 'Draft a response to: {input}',
    outputKey: 'draft',
  })
  .addNode('review', NODE_TYPES.HUMAN, {
    prompt: 'Please review this draft:\n{draft}\n\nApprove, reject, or provide edits:',
    inputKey: 'humanFeedback',
    timeoutMs: 3600000, // 1 hour
  })
  .addNode('finalize', NODE_TYPES.LLM, {
    prompt: 'Finalize the draft based on feedback: {humanFeedback}\nDraft: {draft}',
    outputKey: 'finalResponse',
  })
  .addEdge('draft', 'review')
  .addEdge('review', 'finalize')
  .setEntryPoint('draft')
  .setExitPoint('finalize');

// Execute — will pause at 'review'
const executePromise = chain.execute(graph, { input: 'Tell me about AI.' });

// Resume with human input
setTimeout(() => {
  chain.resume(workflowId, 'Approved, but make it shorter.');
}, 5000);

const result = await executePromise;
```

### Retry with PHI Backoff

```js
const graph = chain.createGraph('retry-example')
  .addNode('reliable', NODE_TYPES.RETRY, {
    inner: {
      type: NODE_TYPES.TOOL,
      config: {
        toolName: 'http_request',
        inputs: { url: '{apiUrl}' },
        outputKey: 'apiResult',
      },
    },
    maxAttempts: 5,  // Delays: 1s, 1.618s, 2.618s, 4.236s, 6.854s
  })
  .setEntryPoint('reliable')
  .setExitPoint('reliable');
```

---

## Node Types

| Type | Config Keys | Description |
|---|---|---|
| `llm` | `prompt`, `systemPrompt`, `outputKey`, `model`, `maxTokens`, `parseJSON` | Call HeadyInfer |
| `tool` | `toolName`, `inputMapping`, `inputs`, `outputKey` | Execute registered tool |
| `conditional` | `condition: (state) => key`, `branches: {key: nodeId}` | Route to branch |
| `parallel` | `branches: [{type, config}]`, `mergeStrategy`, `outputKey` | Fan-out concurrent execution |
| `reduce` | `inputKey`, `reducer`, `initialValue`, `outputKey` | Aggregate array results |
| `transform` | `transform: (state, ctx) => partial`, `merge` | Pure state transformation |
| `human` | `prompt`, `inputKey`, `timeoutMs` | Pause for human input |
| `subchain` | `chainId` or `graph`, `inputMapping`, `outputMapping` | Nested workflow |
| `retry` | `inner: {type, config}`, `maxAttempts`, `retryOn`, `backoffMs` | PHI-backoff retry wrapper |

---

## Tools

### Built-in Tools

| Tool | Description |
|---|---|
| `web_search` | DuckDuckGo search — returns results array |
| `file_read` | Read file contents (with optional byte limit) |
| `file_write` | Write/append file (creates directories) |
| `http_request` | HTTP GET/POST/PUT/DELETE/PATCH |
| `code_execute` | Execute JavaScript or shell code |
| `math_eval` | Evaluate math expressions (PHI constant included) |

### Register a Custom Tool

```js
const { globalRegistry } = require('./tools');

globalRegistry.register('database_query', {
  description: 'Execute a SQL query against the Heady database',
  inputSchema: {
    type: 'object',
    required: ['sql'],
    properties: {
      sql: { type: 'string', description: 'SQL query' },
      params: { type: 'array', items: {}, description: 'Query parameters' },
    },
  },
  timeoutMs: 10000,
  handler: async ({ sql, params = [] }) => {
    // Your database logic here
    return { rows: [], rowCount: 0 };
  },
});
```

---

## Memory

### Buffer Memory (Short-term)

```js
const { BufferMemory } = require('./memory');

const mem = new BufferMemory({ maxSize: 50 });
mem.add('user', 'What is quantum entanglement?');
mem.add('assistant', 'Quantum entanglement is...');

const history = mem.getMessages();
const recent = mem.getMessages(10);           // last 10
const within = mem.getWithinTokenBudget(2000); // token-limited
```

### Working Memory (K-V Scratchpad)

```js
const { WorkingMemory } = require('./memory');

const working = new WorkingMemory({ ttlMs: 3600000 });
working.set('userGoal', 'Plan a trip to Japan', { importance: 3 });
working.set('tempData', { step: 1 }, { ttlMs: 60000 }); // 1-min TTL

const goal = working.get('userGoal');
const ctx = working.toObject(); // all non-expired entries
```

### Entity Memory

```js
const { EntityMemory } = require('./memory');

const entities = new EntityMemory({ maxEntities: 100 });
entities.upsert('Alice', { type: 'person', facts: ['CTO at Heady', 'prefers async comms'] });

const alice = entities.get('Alice');
const context = entities.getEntityContext(['Alice', 'Bob']); // for prompt injection
```

### Full Memory Manager

```js
const { MemoryManager, VectorMemory } = require('./memory');

const memory = new MemoryManager({
  vectorMemory: new VectorMemory({ namespace: 'session_123' }),
});

await memory.addMessage('user', 'hello');
await memory.addMessage('assistant', 'hi there');

const ctx = memory.getContextMessages(4096);    // token-budget-aware
const { buffer, vector } = await memory.retrieve('quantum computing', 5);
```

---

## Prompt Templates

```js
const { PromptTemplate, ChatPromptTemplate, OutputParsers } = require('./prompts');

// Simple template
const t = new PromptTemplate('Summarize {text} in {words} words.');
const rendered = t.format({ text: 'long article...', words: 50 });

// Chat template
const chat = new ChatPromptTemplate({
  system: 'You are a {role} for {company}.',
  fewShots: [
    { role: 'user', content: 'Example question?' },
    { role: 'assistant', content: 'Example answer.' },
  ],
  messages: [{ role: 'user', content: '{userInput}' }],
});
const messages = chat.format({ role: 'assistant', company: 'Heady', userInput: 'hello' }, history);

// Output parsers
const parsed = OutputParsers.json('```json\n{"key": "value"}\n```');
const items = OutputParsers.list('1. First\n2. Second\n3. Third');
const reactResult = OutputParsers.react('Thought: ...\nAction: search\nAction Input: {"q": "test"}');
```

---

## Agent Patterns

### ReAct Agent

```js
const { AgentFactory } = require('./agents');

const agent = AgentFactory.react({
  maxIterations: 10,
  model: 'claude-3-5-sonnet-20241022',
});

const result = await agent.run('What is the current price of Bitcoin?');
console.log(result.answer);    // Final answer
console.log(result.steps);     // All thought/action/observation steps
console.log(result.iterations);
```

### Plan & Execute Agent

```js
const agent = AgentFactory.planAndExecute();
const result = await agent.run('Build and deploy a simple Node.js API');
console.log(result.plan);   // Array of plan steps
console.log(result.steps);  // Execution results for each step
console.log(result.answer); // Synthesized final answer
```

### Tool Calling Agent

```js
const agent = AgentFactory.toolCalling({
  systemPrompt: 'You are a data analyst. Use tools to fetch and analyze data.',
});
const result = await agent.run('Fetch weather data for Denver and find the trend.');
console.log(result.answer);    // Final response
console.log(result.toolCalls); // Array of { tool, input, output, round }
```

### Conversational Agent

```js
const agent = AgentFactory.conversational({
  systemPrompt: 'You are a helpful coding assistant.',
  useTools: true,
});

// Multi-turn chat
const r1 = await agent.chat('How do I read a file in Node.js?');
const r2 = await agent.chat('What about writing to it?');

// Working memory
agent.remember('userLevel', 'beginner', { ttlMs: 3600000 });
```

### Supervisor Agent (HeadyBee-style coordination)

```js
const supervisor = AgentFactory.supervisor({
  name: 'heady-supervisor',
});

// Register specialist agents
supervisor.registerAgent('researcher', researchAgent, 'Web research', ['search', 'summarize']);
supervisor.registerAgent('coder', coderAgent, 'Code generation', ['python', 'javascript']);
supervisor.registerAgent('critic', criticAgent, 'Quality review', ['review', 'feedback']);

const result = await supervisor.run('Build a sentiment analysis pipeline');
console.log(result.answer);
console.log(result.agentResults); // What each agent returned
```

### Critic Agent

```js
const agent = AgentFactory.critic({
  criteria: ['accuracy', 'clarity', 'completeness'],
  passingScore: 8,
  maxRevisions: 3,
});

// Critique static content
const critique = await agent.critique(
  'The capital of France is Paris.',
  'State the capital of France'
);
console.log(critique.score);       // 1-10
console.log(critique.passed);      // boolean
console.log(critique.feedback);

// Auto-revise until passing
const result = await agent.critiqueAndRevise(
  async (task, ctx) => llm.generate(task),  // generator function
  'Explain quantum entanglement for a 10-year-old'
);
console.log(result.finalContent);
console.log(result.revisions);     // How many revisions were needed
```

---

## HTTP API

### Execute a Workflow

```bash
POST /chain/execute
Content-Type: application/json

{
  "graph": { ... },         # GraphBuilder.toJSON() output
  "state": { "input": "hello" },
  "dryRun": false,
  "timeoutMs": 60000,
  "metadata": { "userId": "u_123" }
}
```

### Stream Workflow via SSE

```bash
POST /chain/stream
Content-Type: application/json

{ "graph": {...}, "state": {...} }
```

Events streamed: `start`, `node:start`, `node:complete`, `node:error`, `pause`, `complete`, `error`

### Check Workflow Status

```bash
GET /chain/:workflowId/status
```

### Resume Human-in-the-Loop

```bash
POST /chain/:workflowId/resume
{ "input": "Approved" }
```

### Validate Graph

```bash
POST /chain/validate
{ "graph": { ... } }
```

### List Tools

```bash
GET /tools
GET /tools/for-llm      # OpenAI function-calling format
```

### Execute Tool Directly

```bash
POST /tools/math_eval/execute
{ "expression": "2 * PHI + 1" }
```

### Run ReAct Agent

```bash
POST /agents/react
{ "input": "What is the weather in Denver?", "maxIterations": 5 }
```

### Run Plan & Execute

```bash
POST /agents/plan-execute
{ "objective": "Research quantum computing trends", "model": "claude-3-5-sonnet-20241022" }
```

### Critique Content

```bash
POST /agents/critic
{ "content": "...", "task": "Explain X", "criteria": ["accuracy", "clarity"] }
```

### Health & Metrics

```bash
GET /health          # Full health check
GET /health/live     # Liveness probe
GET /health/ready    # Readiness probe
GET /metrics         # Execution metrics
```

---

## Graph Serialization & Visualization

```js
// Serialize to JSON for storage/transmission
const json = graph.toJSON();
const restored = GraphBuilder.fromJSON(json);

// Generate Mermaid diagram
const mermaid = graph.toMermaid();
// Paste into https://mermaid.live or markdown ```mermaid blocks

// Via API
POST /graph/mermaid
{ "graph": { ... } }
```

---

## Checkpointing & Resume

Workflows are automatically checkpointed after each node when `CHECKPOINT_ENABLED=true`.

```js
// Resume from checkpoint
const result = await chain.execute(graph, initialState, {
  workflowId: 'my-workflow-123',
  checkpointId: 'my-workflow-123',  // loads saved state
});
```

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Mock LLM (no real API calls)
HEADY_INFER_MOCK=true npm test
```

---

## Docker

```bash
# Build and run
docker-compose up heady-chain

# Run tests in container
docker-compose --profile test run heady-chain-test

# Build production image
docker build --target production -t heady-chain:1.0.0 .
```

---

## Sacred Geometry (PHI Scaling)

HeadyChain uses PHI (1.618) throughout:

| Usage | Value |
|---|---|
| Retry backoff base | `1000ms * PHI^attempt` |
| Max backoff cap | `30,000ms` |
| `phiScale(n, 1)` | `n * PHI` |
| `phiScale(n, 2)` | `n * PHI²` |
| Docker memory limit | `PHI³ * 256MB ≈ 1024MB` |

```js
const config = require('./config');
config.PHI          // 1.618033988749895
config.phiBackoff(0) // 1000ms
config.phiBackoff(1) // 1618ms
config.phiBackoff(2) // 2618ms
config.phiBackoff(3) // 4236ms
config.phiScale(100, 2) // 261.8
```

---

## Integration with HeadyBees

HeadyChain's `SupervisorAgent` maps directly to HeadyBees coordination:

```js
// Each HeadyBee domain becomes a registered sub-agent
const supervisor = AgentFactory.supervisor({ name: 'hive-coordinator' });

for (const [domain, bee] of headyBees) {
  supervisor.registerAgent(domain, bee, bee.description, bee.capabilities);
}

// The supervisor routes tasks to appropriate bees
const result = await supervisor.run('Analyze customer sentiment across all channels');
```

---

## Error Handling

All errors include context and are production-safe:

```js
try {
  const result = await chain.execute(graph, state);
} catch (err) {
  // err.message describes what failed and at which node
  // Workflow record is preserved: chain.getWorkflowStatus(workflowId)
}
```

Node-level errors emit `node:error` events and fail the workflow. Use `RetryNode` to wrap unreliable nodes.

---

## License

UNLICENSED — Private, Heady AI Platform internal use.
