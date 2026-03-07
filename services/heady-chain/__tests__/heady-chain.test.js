'use strict';

/**
 * HeadyChain Test Suite
 * Tests: graph building, execution, tools, memory, prompts, agents
 */

process.env.NODE_ENV = 'test';
process.env.HEADY_INFER_MOCK = 'true';

const { GraphBuilder } = require('../graph');
const { NODE_TYPES, interpolate, mergeState, getPath, setPath } = require('../nodes');
const { HeadyChain, WORKFLOW_STATUS } = require('../index');
const { ToolRegistry, validateSchema } = require('../tools');
const {
  BufferMemory,
  SummaryMemory,
  EntityMemory,
  WorkingMemory,
  MemoryManager,
} = require('../memory');
const {
  PromptTemplate,
  ChatPromptTemplate,
  OutputParsers,
  ContextWindowManager,
} = require('../prompts');
const { AgentFactory } = require('../agents');
const config = require('../config');

// ─── Graph Builder Tests ──────────────────────────────────────────────────────

describe('GraphBuilder', () => {
  test('creates a graph with nodes and edges', () => {
    const g = new GraphBuilder('test-graph');
    g.addNode('start', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('end', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addEdge('start', 'end')
     .setEntryPoint('start')
     .setExitPoint('end');

    expect(g.nodes.size).toBe(2);
    expect(g.edges.length).toBe(1);
    expect(g.entryPoint).toBe('start');
  });

  test('compile() returns valid compiled graph', () => {
    const g = new GraphBuilder('compile-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('b', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addEdge('a', 'b')
     .setEntryPoint('a')
     .setExitPoint('b');

    const compiled = g.compile();
    expect(compiled.entryPoint).toBe('a');
    expect(compiled.topoOrder).toEqual(['a', 'b']);
    expect([...compiled.exitPoints]).toContain('b');
  });

  test('compile() detects cycles', () => {
    const g = new GraphBuilder('cycle-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('b', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addEdge('a', 'b')
     .addEdge('b', 'a')  // cycle
     .setEntryPoint('a');

    expect(() => g.compile()).toThrow(/cycle/i);
  });

  test('compile() detects unreachable nodes', () => {
    const g = new GraphBuilder('unreachable-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('b', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('orphan', NODE_TYPES.TRANSFORM, { transform: s => s }) // unreachable
     .addEdge('a', 'b')
     .setEntryPoint('a');

    expect(() => g.compile()).toThrow(/unreachable/i);
  });

  test('compile() throws on missing entry point', () => {
    const g = new GraphBuilder('no-entry');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s });

    expect(() => g.compile()).toThrow(/entry point/i);
  });

  test('addNode() rejects duplicate IDs', () => {
    const g = new GraphBuilder('dup-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s });
    expect(() => g.addNode('a', NODE_TYPES.LLM, {})).toThrow(/already exists/i);
  });

  test('addNode() rejects unknown type', () => {
    const g = new GraphBuilder('type-test');
    expect(() => g.addNode('a', 'unknown_type', {})).toThrow(/unknown node type/i);
  });

  test('toJSON() / fromJSON() round-trips correctly', () => {
    const g = new GraphBuilder('serial-test');
    g.addNode('start', NODE_TYPES.TRANSFORM, { transform: (s) => ({ ...s, visited: true }) })
     .addNode('end', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addEdge('start', 'end')
     .setEntryPoint('start')
     .setExitPoint('end');

    const json = g.toJSON();
    expect(json.id).toBe('serial-test');
    expect(json.nodes).toHaveLength(2);
    expect(json.entryPoint).toBe('start');

    // fromJSON reconstructs
    const g2 = GraphBuilder.fromJSON(json);
    expect(g2.nodes.size).toBe(2);
    expect(g2.entryPoint).toBe('start');
  });

  test('toMermaid() generates valid diagram string', () => {
    const g = new GraphBuilder('mermaid-test');
    g.addNode('a', NODE_TYPES.LLM, {}, { label: 'Call LLM' })
     .addNode('b', NODE_TYPES.TOOL, {}, { label: 'Use Tool' })
     .addEdge('a', 'b')
     .setEntryPoint('a')
     .setExitPoint('b');

    const mermaid = g.toMermaid();
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('a');
    expect(mermaid).toContain('b');
  });

  test('addConditionalEdge() adds multiple branches', () => {
    const g = new GraphBuilder('cond-test');
    g.addNode('router', NODE_TYPES.CONDITIONAL, { condition: s => s.path })
     .addNode('path_a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('path_b', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addConditionalEdge('router', [
       { to: 'path_a', condition: s => s.path === 'a', label: 'path_a' },
       { to: 'path_b', condition: s => s.path === 'b', label: 'path_b' },
     ])
     .setEntryPoint('router');

    expect(g.edges.length).toBe(2);
  });

  test('parallel graph compiles correctly (diamond shape)', () => {
    const g = new GraphBuilder('parallel-test');
    g.addNode('start', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('branch1', NODE_TYPES.TRANSFORM, { transform: s => ({ ...s, b1: true }) })
     .addNode('branch2', NODE_TYPES.TRANSFORM, { transform: s => ({ ...s, b2: true }) })
     .addNode('merge', NODE_TYPES.REDUCE, {
       reducer: (acc, s) => mergeState(acc, s),
       initialValue: {},
       inputKey: 'parallelResults',
     })
     .addEdge('start', 'branch1')
     .addEdge('start', 'branch2')
     .addEdge('branch1', 'merge')
     .addEdge('branch2', 'merge')
     .setEntryPoint('start')
     .setExitPoint('merge');

    const compiled = g.compile();
    expect(compiled.topoOrder).toContain('start');
    expect(compiled.topoOrder).toContain('branch1');
    expect(compiled.topoOrder).toContain('branch2');
    expect(compiled.topoOrder).toContain('merge');
  });
});

// ─── Node Utilities Tests ─────────────────────────────────────────────────────

describe('Node Utilities', () => {
  describe('interpolate()', () => {
    test('replaces {key} placeholders', () => {
      expect(interpolate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
    });

    test('supports dot-path access', () => {
      expect(interpolate('Value: {user.age}', { user: { age: 42 } })).toBe('Value: 42');
    });

    test('leaves missing keys unchanged', () => {
      expect(interpolate('Hi {missing}', {})).toBe('Hi {missing}');
    });

    test('handles non-string template', () => {
      expect(interpolate(42, {})).toBe(42);
    });
  });

  describe('mergeState()', () => {
    test('merges shallow objects', () => {
      const result = mergeState({ a: 1 }, { b: 2 });
      expect(result).toEqual({ a: 1, b: 2 });
    });

    test('deep merges nested objects', () => {
      const result = mergeState({ a: { x: 1 } }, { a: { y: 2 } });
      expect(result).toEqual({ a: { x: 1, y: 2 } });
    });

    test('does not mutate target', () => {
      const target = { a: 1 };
      mergeState(target, { b: 2 });
      expect(target).toEqual({ a: 1 });
    });
  });

  describe('getPath() / setPath()', () => {
    test('getPath reads nested value', () => {
      expect(getPath({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    test('getPath returns undefined for missing path', () => {
      expect(getPath({}, 'a.b.c')).toBeUndefined();
    });

    test('setPath writes nested value', () => {
      const result = setPath({}, 'a.b.c', 42);
      expect(result.a.b.c).toBe(42);
    });

    test('setPath does not mutate original', () => {
      const orig = { a: 1 };
      setPath(orig, 'b', 2);
      expect(orig).toEqual({ a: 1 });
    });
  });
});

// ─── HeadyChain Execution Tests ───────────────────────────────────────────────

describe('HeadyChain Execution', () => {
  let chain;

  beforeEach(() => {
    chain = new HeadyChain();
  });

  afterEach(() => {
    chain.destroy();
  });

  test('executes a simple linear graph', async () => {
    const g = new GraphBuilder('linear');
    g.addNode('step1', NODE_TYPES.TRANSFORM, {
       transform: s => ({ ...s, step1: true }),
     })
     .addNode('step2', NODE_TYPES.TRANSFORM, {
       transform: s => ({ ...s, step2: true }),
     })
     .addEdge('step1', 'step2')
     .setEntryPoint('step1')
     .setExitPoint('step2');

    const result = await chain.execute(g, { initial: true });
    expect(result.status).toBe(WORKFLOW_STATUS.COMPLETED);
    expect(result.state.step1).toBe(true);
    expect(result.state.step2).toBe(true);
    expect(result.state.initial).toBe(true);
  });

  test('dry-run mode skips node execution', async () => {
    let executed = false;
    const g = new GraphBuilder('dryrun-test');
    g.addNode('step1', NODE_TYPES.TRANSFORM, {
       transform: s => { executed = true; return s; },
     })
     .setEntryPoint('step1')
     .setExitPoint('step1');

    const result = await chain.execute(g, {}, { dryRun: true });
    expect(result.status).toBe(WORKFLOW_STATUS.DRY_RUN);
    expect(executed).toBe(false);
  });

  test('emits node:start and node:complete events', async () => {
    const events = [];
    const g = new GraphBuilder('events-test');
    g.addNode('n1', NODE_TYPES.TRANSFORM, { transform: s => s })
     .setEntryPoint('n1')
     .setExitPoint('n1');

    chain.on('node:start', e => events.push({ type: 'start', nodeId: e.nodeId }));
    chain.on('node:complete', e => events.push({ type: 'complete', nodeId: e.nodeId }));
    chain.on('workflow:start', e => events.push({ type: 'wf_start' }));
    chain.on('workflow:complete', e => events.push({ type: 'wf_complete' }));

    await chain.execute(g, {});

    expect(events.find(e => e.type === 'wf_start')).toBeTruthy();
    expect(events.find(e => e.type === 'start' && e.nodeId === 'n1')).toBeTruthy();
    expect(events.find(e => e.type === 'complete' && e.nodeId === 'n1')).toBeTruthy();
    expect(events.find(e => e.type === 'wf_complete')).toBeTruthy();
  });

  test('fails cleanly on node error', async () => {
    const g = new GraphBuilder('error-test');
    g.addNode('bad', NODE_TYPES.TRANSFORM, {
       transform: () => { throw new Error('intentional test error'); },
     })
     .setEntryPoint('bad')
     .setExitPoint('bad');

    await expect(chain.execute(g, {})).rejects.toThrow('intentional test error');

    // Verify workflow record reflects failure
    const workflows = chain.listWorkflows();
    expect(workflows.some(w => w.status === WORKFLOW_STATUS.FAILED)).toBe(true);
  });

  test('validateGraph() returns valid for correct graph', () => {
    const g = new GraphBuilder('valid');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addNode('b', NODE_TYPES.TRANSFORM, { transform: s => s })
     .addEdge('a', 'b')
     .setEntryPoint('a')
     .setExitPoint('b');

    const result = chain.validateGraph(g);
    expect(result.valid).toBe(true);
    expect(result.nodeCount).toBe(2);
    expect(result.edgeCount).toBe(1);
  });

  test('validateGraph() returns invalid with error for cycle', () => {
    const json = {
      id: 'cycle',
      entryPoint: 'a',
      exitPoints: [],
      nodes: [
        { id: 'a', type: NODE_TYPES.TRANSFORM, config: { transform: 'function(s) { return s; }' }, metadata: {} },
        { id: 'b', type: NODE_TYPES.TRANSFORM, config: { transform: 'function(s) { return s; }' }, metadata: {} },
      ],
      edges: [
        { from: 'a', to: 'b', label: '', condition: null },
        { from: 'b', to: 'a', label: '', condition: null }, // cycle
      ],
    };

    const result = chain.validateGraph(json);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cycle/i);
  });

  test('executes conditional routing correctly', async () => {
    const g = new GraphBuilder('conditional');
    g.addNode('router', NODE_TYPES.CONDITIONAL, {
       condition: s => s.score > 50 ? 'high' : 'low',
       branches: { high: 'high_path', low: 'low_path' },
     })
     .addNode('high_path', NODE_TYPES.TRANSFORM, { transform: s => ({ ...s, result: 'high' }) })
     .addNode('low_path', NODE_TYPES.TRANSFORM, { transform: s => ({ ...s, result: 'low' }) })
     .addEdge('router', 'high_path', null, 'high')
     .addEdge('router', 'low_path', null, 'low')
     .setEntryPoint('router');

    const high = await chain.execute(g, { score: 75 });
    expect(high.state.result).toBe('high');

    const chain2 = new HeadyChain();
    const low = await chain2.execute(g, { score: 25 });
    expect(low.state.result).toBe('low');
    chain2.destroy();
  });

  test('LLM node works with mock', async () => {
    const g = new GraphBuilder('llm-test');
    g.addNode('llm', NODE_TYPES.LLM, {
       prompt: 'Say hello to {name}',
       outputKey: 'greeting',
     })
     .setEntryPoint('llm')
     .setExitPoint('llm');

    const result = await chain.execute(g, { name: 'Alice' });
    expect(result.state.greeting).toBeDefined();
    expect(typeof result.state.greeting).toBe('string');
  });

  test('getWorkflowStatus() returns status for tracked workflow', async () => {
    const g = new GraphBuilder('status-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .setEntryPoint('a')
     .setExitPoint('a');

    const result = await chain.execute(g, {}, { workflowId: 'test-wf-123' });
    const status = chain.getWorkflowStatus('test-wf-123');
    expect(status).toBeTruthy();
    expect(status.workflowId).toBe('test-wf-123');
    expect(status.status).toBe(WORKFLOW_STATUS.COMPLETED);
  });

  test('getMetrics() returns populated metrics object', async () => {
    const g = new GraphBuilder('metrics-test');
    g.addNode('a', NODE_TYPES.TRANSFORM, { transform: s => s })
     .setEntryPoint('a')
     .setExitPoint('a');

    await chain.execute(g, {});

    const metrics = chain.getMetrics();
    expect(metrics.totalWorkflows).toBeGreaterThan(0);
    expect(metrics.completedWorkflows).toBeGreaterThan(0);
    expect(metrics.totalNodeExecutions).toBeGreaterThan(0);
  });

  test('retry node retries on failure with PHI backoff', async () => {
    let attempts = 0;
    const g = new GraphBuilder('retry-test');
    g.addNode('retry', NODE_TYPES.RETRY, {
       inner: {
         type: NODE_TYPES.TRANSFORM,
         config: {
           transform: s => {
             attempts++;
             if (attempts < 3) throw new Error('transient error');
             return { ...s, succeeded: true };
           },
         },
       },
       maxAttempts: 5,
       backoffMs: 1, // minimal backoff for tests
     })
     .setEntryPoint('retry')
     .setExitPoint('retry');

    const result = await chain.execute(g, {});
    expect(result.state.succeeded).toBe(true);
    expect(attempts).toBe(3);
  }, 10000);

  test('tool node executes a registered tool', async () => {
    const registry = new ToolRegistry();
    registry.register('test_tool', {
      description: 'Test tool',
      inputSchema: { type: 'object', properties: { x: { type: 'number' } } },
      handler: async ({ x }) => ({ doubled: x * 2 }),
    });

    const chainWithTools = new HeadyChain({ toolRegistry: registry });
    const g = new GraphBuilder('tool-test');
    g.addNode('tool', NODE_TYPES.TOOL, {
       toolName: 'test_tool',
       inputs: { x: 5 },
       outputKey: 'toolResult',
     })
     .setEntryPoint('tool')
     .setExitPoint('tool');

    const result = await chainWithTools.execute(g, {});
    expect(result.state.toolResult).toBeDefined();
    chainWithTools.destroy();
  });

  test('transform node with merge=true merges output into state', async () => {
    const g = new GraphBuilder('transform-merge');
    g.addNode('transform', NODE_TYPES.TRANSFORM, {
       transform: s => ({ extra: 'added', modified: true }),
       merge: true,
     })
     .setEntryPoint('transform')
     .setExitPoint('transform');

    const result = await chain.execute(g, { original: 'yes' });
    expect(result.state.original).toBe('yes');
    expect(result.state.extra).toBe('added');
    expect(result.state.modified).toBe(true);
  });

  test('createGraph() returns a new GraphBuilder', () => {
    const g = chain.createGraph('new-graph');
    expect(g).toBeInstanceOf(GraphBuilder);
    expect(g.id).toBe('new-graph');
  });
});

// ─── Tool Registry Tests ──────────────────────────────────────────────────────

describe('ToolRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  test('registers and retrieves a tool', () => {
    registry.register('my_tool', {
      description: 'A test tool',
      handler: async (input) => ({ output: input.val * 2 }),
    });

    const tool = registry.getTool('my_tool');
    expect(tool).toBeTruthy();
    expect(tool.name).toBe('my_tool');
  });

  test('list() returns all tools without handler', () => {
    registry.register('t1', { description: 'Tool 1', handler: async () => {} });
    registry.register('t2', { description: 'Tool 2', handler: async () => {} });

    const tools = registry.list();
    // Built-ins + registered
    const names = tools.map(t => t.name);
    expect(names).toContain('t1');
    expect(names).toContain('t2');
    // No handler in list output
    expect(tools[0].handler).toBeUndefined();
  });

  test('execute() validates input schema and rejects invalid input', async () => {
    registry.register('typed_tool', {
      description: 'Tool with schema',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1 } },
      },
      handler: async ({ name }) => ({ greeting: `Hello ${name}` }),
    });

    await expect(registry.execute('typed_tool', {})).rejects.toThrow(/required property/i);
    await expect(registry.execute('typed_tool', { name: 'Alice' })).resolves.toBeDefined();
  });

  test('execute() throws for unknown tool', async () => {
    await expect(registry.execute('no_such_tool', {})).rejects.toThrow(/not registered/i);
  });

  test('execute() respects timeout', async () => {
    registry.register('slow_tool', {
      description: 'Slow',
      timeoutMs: 100,
      handler: async () => new Promise(resolve => setTimeout(resolve, 5000)),
    });

    await expect(registry.execute('slow_tool', {})).rejects.toThrow(/timed out/i);
  }, 2000);

  test('math_eval built-in tool evaluates expressions', async () => {
    const result = await registry.execute('math_eval', { expression: '2 + 2 * PHI' });
    expect(result.result).toBeCloseTo(2 + 2 * config.PHI);
  });

  test('file_write and file_read round-trip', async () => {
    const filePath = '/tmp/heady-chain-test-file.txt';
    await registry.execute('file_write', { filePath, content: 'hello world' });
    const readResult = await registry.execute('file_read', { filePath });
    expect(readResult.content).toBe('hello world');
  });

  test('code_execute evaluates javascript', async () => {
    const result = await registry.execute('code_execute', {
      code: 'return 2 + 2',
      language: 'javascript',
    });
    expect(result.result).toBe(4);
  });

  test('getStats() tracks call counts and errors', async () => {
    registry.register('stat_tool', {
      description: 'Stat tool',
      handler: async () => ({ ok: true }),
    });

    await registry.execute('stat_tool', {});
    await registry.execute('stat_tool', {});

    const stats = registry.getStats();
    expect(stats.stat_tool.calls).toBe(2);
    expect(stats.stat_tool.errors).toBe(0);
  });

  test('listForLLM() returns OpenAI function format', () => {
    const forLLM = registry.listForLLM();
    expect(Array.isArray(forLLM)).toBe(true);
    expect(forLLM[0]).toHaveProperty('type', 'function');
    expect(forLLM[0].function).toHaveProperty('name');
    expect(forLLM[0].function).toHaveProperty('description');
    expect(forLLM[0].function).toHaveProperty('parameters');
  });
});

// ─── JSON Schema Validator Tests ──────────────────────────────────────────────

describe('validateSchema()', () => {
  test('passes valid object', () => {
    const errors = validateSchema(
      { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      { name: 'test' }
    );
    expect(errors).toHaveLength(0);
  });

  test('catches missing required field', () => {
    const errors = validateSchema(
      { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
      {}
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/required property/i);
  });

  test('catches wrong type', () => {
    const errors = validateSchema({ type: 'string' }, 42);
    expect(errors.length).toBeGreaterThan(0);
  });

  test('validates string constraints', () => {
    const errors = validateSchema({ type: 'string', minLength: 5 }, 'hi');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/too short/i);
  });

  test('validates number constraints', () => {
    const errors = validateSchema({ type: 'number', minimum: 10 }, 5);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/minimum/i);
  });

  test('validates enum values', () => {
    const errors = validateSchema({ type: 'string', enum: ['a', 'b'] }, 'c');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ─── Memory Tests ─────────────────────────────────────────────────────────────

describe('BufferMemory', () => {
  test('adds and retrieves messages', () => {
    const mem = new BufferMemory({ maxSize: 5 });
    mem.add('user', 'hello');
    mem.add('assistant', 'hi there');

    const messages = mem.getMessages();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[1].content).toBe('hi there');
  });

  test('respects maxSize by dropping oldest messages', () => {
    const mem = new BufferMemory({ maxSize: 3 });
    for (let i = 0; i < 5; i++) mem.add('user', `msg ${i}`);
    expect(mem.size()).toBe(3);
    expect(mem.getMessages()[0].content).toBe('msg 2');
  });

  test('getWithinTokenBudget() returns subset within budget', () => {
    const mem = new BufferMemory({ maxSize: 20 });
    for (let i = 0; i < 10; i++) {
      mem.add('user', 'a'.repeat(100)); // 100 chars ≈ 25 tokens each
    }
    // Budget of 50 tokens ≈ 200 chars — fits ~2 messages
    const within = mem.getWithinTokenBudget(50);
    expect(within.length).toBeLessThan(10);
  });

  test('toJSON() / fromJSON() round-trips', () => {
    const mem = new BufferMemory({ maxSize: 5 });
    mem.add('user', 'hello');
    const json = mem.toJSON();
    const restored = BufferMemory.fromJSON(json);
    expect(restored.getMessages()).toHaveLength(1);
    expect(restored.getMessages()[0].content).toBe('hello');
  });

  test('clear() empties messages', () => {
    const mem = new BufferMemory();
    mem.add('user', 'hi');
    mem.clear();
    expect(mem.size()).toBe(0);
  });
});

describe('WorkingMemory', () => {
  test('stores and retrieves key-value pairs', () => {
    const mem = new WorkingMemory();
    mem.set('foo', 'bar');
    expect(mem.get('foo')).toBe('bar');
  });

  test('respects TTL — expired items return undefined', () => {
    const mem = new WorkingMemory({ ttlMs: 1 });
    mem.set('temp', 'value');
    return new Promise(resolve => setTimeout(() => {
      expect(mem.get('temp')).toBeUndefined();
      resolve();
    }, 5));
  });

  test('toObject() returns only non-expired entries', () => {
    const mem = new WorkingMemory();
    mem.set('a', 1);
    mem.set('b', 2);
    const obj = mem.toObject();
    expect(obj).toEqual({ a: 1, b: 2 });
  });

  test('delete() removes entry', () => {
    const mem = new WorkingMemory();
    mem.set('x', 10);
    mem.delete('x');
    expect(mem.get('x')).toBeUndefined();
  });

  test('toJSON() / fromJSON() round-trips', () => {
    const mem = new WorkingMemory({ ttlMs: 60000 });
    mem.set('key', 'value');
    const json = mem.toJSON();
    const restored = WorkingMemory.fromJSON(json);
    expect(restored.get('key')).toBe('value');
  });
});

describe('EntityMemory', () => {
  test('upserts entities', () => {
    const mem = new EntityMemory();
    mem.upsert('Alice', { type: 'person', facts: ['likes coffee'] });
    const entity = mem.get('alice');
    expect(entity).toBeTruthy();
    expect(entity.type).toBe('person');
    expect(entity.facts).toContain('likes coffee');
  });

  test('updates existing entity facts', () => {
    const mem = new EntityMemory();
    mem.upsert('Bob', { type: 'person', facts: ['tall'] });
    mem.upsert('Bob', { type: 'person', facts: ['engineer'] });
    const entity = mem.get('bob');
    expect(entity.facts).toContain('tall');
    expect(entity.facts).toContain('engineer');
  });

  test('extractFromText() finds capitalized entities', () => {
    const mem = new EntityMemory();
    const entities = mem.extractFromText('Alice and Bob work at Heady AI.');
    const names = entities.map(e => e.name);
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  test('prunes to maxEntities', () => {
    const mem = new EntityMemory({ maxEntities: 3 });
    for (let i = 0; i < 10; i++) {
      mem.upsert(`Entity${i}`, { type: 'test' });
    }
    expect(mem.getAll().length).toBeLessThanOrEqual(3);
  });

  test('toJSON() / fromJSON() round-trips', () => {
    const mem = new EntityMemory();
    mem.upsert('Charlie', { type: 'person', facts: ['developer'] });
    const json = mem.toJSON();
    const restored = EntityMemory.fromJSON(json);
    expect(restored.get('charlie')).toBeTruthy();
  });
});

describe('MemoryManager', () => {
  test('addMessage() updates buffer', async () => {
    const mgr = new MemoryManager();
    await mgr.addMessage('user', 'hello world');
    expect(mgr.buffer.size()).toBe(1);
  });

  test('getContextMessages() returns message array', async () => {
    const mgr = new MemoryManager();
    await mgr.addMessage('user', 'hi');
    await mgr.addMessage('assistant', 'hello');
    const ctx = mgr.getContextMessages();
    expect(ctx.length).toBe(2);
  });

  test('toJSON() / fromJSON() round-trips', async () => {
    const mgr = new MemoryManager();
    await mgr.addMessage('user', 'test message');
    const json = mgr.toJSON();
    const restored = MemoryManager.fromJSON(json);
    expect(restored.buffer.size()).toBe(1);
  });
});

// ─── Prompt Template Tests ────────────────────────────────────────────────────

describe('PromptTemplate', () => {
  test('formats template with variables', () => {
    const t = new PromptTemplate('Hello {name}, you are {age} years old.');
    expect(t.format({ name: 'Alice', age: 30 })).toBe('Hello Alice, you are 30 years old.');
  });

  test('extracts variable names', () => {
    const t = new PromptTemplate('{a} {b} {c}');
    expect(t.variables).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });

  test('uses defaults for missing variables', () => {
    const t = new PromptTemplate('Hello {name}!', { name: 'World' });
    expect(t.format()).toBe('Hello World!');
  });

  test('concat() chains templates', () => {
    const t1 = new PromptTemplate('Part 1: {a}');
    const t2 = new PromptTemplate('Part 2: {b}');
    const combined = t1.concat(t2);
    expect(combined.format({ a: 'foo', b: 'bar' })).toBe('Part 1: foo\n\nPart 2: bar');
  });
});

describe('ChatPromptTemplate', () => {
  test('formats into message array', () => {
    const t = new ChatPromptTemplate({
      system: 'You are a {role}.',
      messages: [{ role: 'user', content: 'Hello {name}' }],
    });

    const messages = t.format({ role: 'helper', name: 'World' });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are a helper.');
    expect(messages[1].content).toBe('Hello World');
  });

  test('includes few-shot examples', () => {
    const t = new ChatPromptTemplate({
      fewShots: [
        { role: 'user', content: 'Q: example' },
        { role: 'assistant', content: 'A: example answer' },
      ],
      messages: [{ role: 'user', content: 'actual question' }],
    });

    const messages = t.format({});
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toBe('Q: example');
  });

  test('static react() builds ReAct prompt', () => {
    const t = ChatPromptTemplate.react([
      { name: 'search', description: 'Search the web' },
    ]);
    const messages = t.format({ input: 'What is the capital of France?' });
    expect(messages.some(m => m.role === 'system')).toBe(true);
    expect(messages.some(m => m.role === 'user')).toBe(true);
  });
});

describe('ContextWindowManager', () => {
  test('estimateTokens() returns approximate count', () => {
    const mgr = new ContextWindowManager({ maxTokens: 1000 });
    // "hello world" is 11 chars ≈ 3 tokens
    const count = mgr.estimateTokens('hello world');
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(20);
  });

  test('fitMessages() truncates when over budget', () => {
    const mgr = new ContextWindowManager({ maxTokens: 20, reserveForOutput: 5 });
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: 'user',
      content: 'a'.repeat(50), // 50 chars each
    }));
    const fitted = mgr.fitMessages(messages);
    expect(fitted.length).toBeLessThan(20);
  });

  test('fitMessages() preserves system message', () => {
    const mgr = new ContextWindowManager({ maxTokens: 50 });
    const messages = [
      { role: 'system', content: 'System prompt' },
      ...Array.from({ length: 10 }, (_, i) => ({ role: 'user', content: 'a'.repeat(50) })),
    ];
    const fitted = mgr.fitMessages(messages);
    expect(fitted[0].role).toBe('system');
  });
});

// ─── Output Parser Tests ──────────────────────────────────────────────────────

describe('OutputParsers', () => {
  test('json parser strips markdown fences', () => {
    const text = '```json\n{"key": "value"}\n```';
    expect(OutputParsers.json(text)).toEqual({ key: 'value' });
  });

  test('list parser splits on newlines and strips numbering', () => {
    const text = '1. First item\n2. Second item\n3. Third item';
    const list = OutputParsers.list(text);
    expect(list).toHaveLength(3);
    expect(list[0]).toBe('First item');
  });

  test('keyValue parser extracts pairs', () => {
    const text = 'Name: Alice\nAge: 30\nRole: Engineer';
    const result = OutputParsers.keyValue(text);
    expect(result.name).toBe('Alice');
    expect(result.age).toBe('30');
    expect(result.role).toBe('Engineer');
  });

  test('react parser extracts action', () => {
    const text = 'Thought: I should search\nAction: web_search\nAction Input: {"query": "test"}';
    const result = OutputParsers.react(text);
    expect(result.type).toBe('action');
    expect(result.action).toBe('web_search');
    expect(result.actionInput.query).toBe('test');
  });

  test('react parser extracts final answer', () => {
    const text = 'Thought: I have the answer\nFinal Answer: Paris is the capital of France.';
    const result = OutputParsers.react(text);
    expect(result.type).toBe('final_answer');
    expect(result.answer).toBe('Paris is the capital of France.');
  });

  test('jsonOrText falls back to text on invalid JSON', () => {
    const text = 'This is not JSON';
    expect(OutputParsers.jsonOrText(text)).toBe('This is not JSON');
  });
});

// ─── Agent Tests ──────────────────────────────────────────────────────────────

describe('ReActAgent', () => {
  test('runs and returns answer (mock LLM)', async () => {
    const agent = AgentFactory.react({ maxIterations: 3 });
    const result = await agent.run('What is 2+2?');
    // Mock LLM returns text, so iterations may max out
    expect(result).toHaveProperty('steps');
    expect(result).toHaveProperty('iterations');
    expect(result.iterations).toBeGreaterThan(0);
  });

  test('accumulates steps across iterations', async () => {
    const agent = AgentFactory.react({ maxIterations: 2 });
    const result = await agent.run('test query');
    expect(Array.isArray(result.steps)).toBe(true);
  });
});

describe('PlanAndExecuteAgent', () => {
  test('creates a plan (mock LLM)', async () => {
    const agent = AgentFactory.planAndExecute();
    const result = await agent.run('Build a web scraper');
    expect(result).toHaveProperty('plan');
    expect(result).toHaveProperty('steps');
    expect(result).toHaveProperty('objective');
  });
});

describe('ToolCallingAgent', () => {
  test('runs and returns answer structure', async () => {
    const agent = AgentFactory.toolCalling();
    const result = await agent.run('Calculate 2+2');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('toolCalls');
    expect(result).toHaveProperty('rounds');
  });
});

describe('ConversationalAgent', () => {
  test('responds to chat input', async () => {
    const agent = AgentFactory.conversational({ useTools: false });
    const result = await agent.chat('Hello!');
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('memorySize');
    expect(result.memorySize).toBe(2); // user + assistant
  });

  test('maintains conversation history', async () => {
    const agent = AgentFactory.conversational({ useTools: false });
    await agent.chat('First message');
    await agent.chat('Second message');
    const ctx = agent.memory.getContextMessages();
    expect(ctx.length).toBe(4); // 2 user + 2 assistant
  });

  test('working memory remember/recall', () => {
    const agent = AgentFactory.conversational();
    agent.remember('userPreference', 'dark mode');
    expect(agent.recall('userPreference')).toBe('dark mode');
  });

  test('clearHistory() empties buffer', async () => {
    const agent = AgentFactory.conversational({ useTools: false });
    await agent.chat('hi');
    agent.clearHistory();
    expect(agent.memory.buffer.size()).toBe(0);
  });
});

describe('CriticAgent', () => {
  test('critiques content and returns score', async () => {
    const agent = AgentFactory.critic();
    const result = await agent.critique('Some content to review', 'Write a summary');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('feedback');
  });

  test('critiqueAndRevise() iterates until passed or max revisions', async () => {
    const agent = AgentFactory.critic({ maxRevisions: 2 });
    let callCount = 0;
    const generateFn = async (task) => {
      callCount++;
      return `Attempt ${callCount}: ${task.slice(0, 50)}`;
    };
    const result = await agent.critiqueAndRevise(generateFn, 'Write a haiku');
    expect(result).toHaveProperty('finalContent');
    expect(result).toHaveProperty('revisions');
    expect(result.revisions).toBeLessThanOrEqual(2);
  });
});

describe('SupervisorAgent', () => {
  test('registers agents and runs supervision', async () => {
    const supervisor = AgentFactory.supervisor();
    const mockAgent = { run: async (task) => ({ answer: `Handled: ${task}` }) };
    supervisor.registerAgent('researcher', mockAgent, 'Does research', ['search', 'analysis']);

    const result = await supervisor.run('Research AI trends');
    expect(result).toHaveProperty('task');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('rounds');
  });
});

// ─── Config Tests ─────────────────────────────────────────────────────────────

describe('Config', () => {
  test('PHI constant is correct', () => {
    expect(config.PHI).toBeCloseTo(1.6180339887, 5);
  });

  test('phiBackoff() increases with attempt number', () => {
    const b0 = config.phiBackoff(0);
    const b1 = config.phiBackoff(1);
    const b2 = config.phiBackoff(2);
    expect(b1).toBeGreaterThan(b0);
    expect(b2).toBeGreaterThan(b1);
  });

  test('phiBackoff() is capped at 30000ms', () => {
    expect(config.phiBackoff(100)).toBe(30000);
  });

  test('phiScale() multiplies by PHI^n', () => {
    expect(config.phiScale(100, 1)).toBeCloseTo(161.8, 0);
    expect(config.phiScale(100, 2)).toBeCloseTo(261.8, 0);
  });
});
