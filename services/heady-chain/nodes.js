'use strict';

/**
 * HeadyChain Built-in Node Types
 * Each node type defines how it executes within the DAG engine.
 * Node executors receive: (nodeConfig, state, context) => Promise<{ state, nextEdge? }>
 */

const http = require('http');
const https = require('https');
const config = require('./config');

// ─── Node Type Registry ──────────────────────────────────────────────────────

const NODE_TYPES = {
  LLM:         'llm',
  TOOL:        'tool',
  CONDITIONAL: 'conditional',
  PARALLEL:    'parallel',
  REDUCE:      'reduce',
  TRANSFORM:   'transform',
  HUMAN:       'human',
  SUBCHAIN:    'subchain',
  RETRY:       'retry',
};

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Interpolate {key} placeholders in a template string from a state object.
 */
function interpolate(template, state) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    const keys = key.split('.');
    let val = state;
    for (const k of keys) {
      if (val == null) return match;
      val = val[k];
    }
    return val != null ? String(val) : match;
  });
}

/**
 * Deep-merge source into target (non-mutating).
 */
function mergeState(target, source) {
  if (!source || typeof source !== 'object') return target;
  const result = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && result[k] && typeof result[k] === 'object') {
      result[k] = mergeState(result[k], v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Map a value out of state using a dot-path.
 */
function getPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

/**
 * Set a dot-path value in a state clone.
 */
function setPath(obj, path, value) {
  if (!path) return { ...obj, ...value };
  const keys = path.split('.');
  const result = { ...obj };
  let cur = result;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = { ...(cur[keys[i]] || {}) };
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return result;
}

/**
 * Minimal fetch for Node 20 (built-in fetch available, but also support http module).
 */
async function httpPost(url, body, timeoutMs = 30000) {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`HTTP request timeout after ${timeoutMs}ms`));
    });
    req.write(data);
    req.end();
  });
}

// ─── Node Executors ───────────────────────────────────────────────────────────

/**
 * LLMNode — Calls HeadyInfer with a prompt template.
 *
 * config:
 *   prompt {string}           - Prompt template with {state.key} placeholders
 *   systemPrompt {string}     - System message template
 *   model {string}            - Override model
 *   outputKey {string}        - State key to store LLM response (default: 'llmOutput')
 *   messages {Array}          - Static messages array (overrides prompt if set)
 *   maxTokens {number}
 *   temperature {number}
 *   parseJSON {boolean}       - Attempt to parse response as JSON
 */
async function executeLLMNode(nodeConfig, state, context) {
  const {
    prompt,
    systemPrompt,
    model = config.HEADY_INFER_DEFAULT_MODEL,
    outputKey = 'llmOutput',
    messages: staticMessages,
    maxTokens = config.DEFAULT_MAX_TOKENS,
    temperature = 0.7,
    parseJSON = false,
  } = nodeConfig;

  let messages;
  if (staticMessages) {
    messages = staticMessages.map(m => ({
      role: m.role,
      content: interpolate(m.content, state),
    }));
  } else {
    messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: interpolate(systemPrompt, state) });
    }
    if (prompt) {
      messages.push({ role: 'user', content: interpolate(prompt, state) });
    }
  }

  const inferUrl = `${config.HEADY_INFER_URL}/infer`;
  const payload = { model, messages, max_tokens: maxTokens, temperature };

  let response;
  try {
    const result = await httpPost(inferUrl, payload, config.HEADY_INFER_TIMEOUT_MS);
    if (result.status >= 400) {
      throw new Error(`HeadyInfer returned ${result.status}: ${JSON.stringify(result.body)}`);
    }
    response = result.body;
  } catch (err) {
    // In development/test without HeadyInfer, generate a mock response
    if (process.env.NODE_ENV === 'test' || process.env.HEADY_INFER_MOCK === 'true') {
      const mockText = `[MOCK LLM RESPONSE for: ${messages[messages.length - 1]?.content?.slice(0, 50)}...]`;
      const newState = setPath(state, outputKey, mockText);
      return { state: newState };
    }
    throw err;
  }

  // Extract text from response (support both OpenAI and Anthropic formats)
  let text = '';
  if (response.choices && response.choices[0]) {
    text = response.choices[0].message?.content || response.choices[0].text || '';
  } else if (response.content && Array.isArray(response.content)) {
    text = response.content.map(c => c.text || '').join('');
  } else if (typeof response.response === 'string') {
    text = response.response;
  } else if (typeof response.text === 'string') {
    text = response.text;
  }

  let output = text;
  if (parseJSON) {
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```$/m, '').trim();
      output = JSON.parse(cleaned);
    } catch {
      output = text; // fallback to raw text
    }
  }

  const newState = setPath(state, outputKey, output);
  // Also store usage info if available
  if (response.usage) {
    return { state: setPath(newState, '_llmUsage', response.usage) };
  }
  return { state: newState };
}

/**
 * ToolNode — Execute a registered tool by name.
 *
 * config:
 *   toolName {string}         - Name of registered tool
 *   inputMapping {object}     - Map tool input keys from state paths: { toolKey: 'state.path' }
 *   outputKey {string}        - State key to store tool result (default: 'toolOutput')
 *   toolRegistry {object}     - Injected by execution engine
 */
async function executeToolNode(nodeConfig, state, context) {
  const {
    toolName,
    inputMapping = {},
    outputKey = 'toolOutput',
  } = nodeConfig;

  const toolRegistry = context.toolRegistry;
  if (!toolRegistry) throw new Error('ToolNode requires toolRegistry in context');

  const tool = toolRegistry.getTool(toolName);
  if (!tool) throw new Error(`Tool '${toolName}' not found in registry`);

  // Build tool input from state via mapping
  const toolInput = {};
  for (const [toolKey, statePath] of Object.entries(inputMapping)) {
    toolInput[toolKey] = getPath(state, statePath);
  }
  // Also allow direct static inputs in nodeConfig.inputs
  if (nodeConfig.inputs) {
    for (const [k, v] of Object.entries(nodeConfig.inputs)) {
      if (!(k in toolInput)) {
        toolInput[k] = typeof v === 'string' ? interpolate(v, state) : v;
      }
    }
  }

  const result = await toolRegistry.execute(toolName, toolInput);
  const newState = setPath(state, outputKey, result);
  return { state: newState };
}

/**
 * ConditionalNode — Evaluate a condition to select the next edge.
 *
 * config:
 *   condition {Function|string} - (state) => string (edge label or target node id)
 *   branches {object}           - { conditionResult: targetNodeId }
 *
 * Returns nextEdge hint consumed by the execution engine.
 */
async function executeConditionalNode(nodeConfig, state, context) {
  const { condition, branches = {} } = nodeConfig;

  if (typeof condition !== 'function') {
    throw new Error('ConditionalNode requires a condition function in config');
  }

  const result = await condition(state, context);
  const nextNode = branches[result] || result; // allow returning node id directly

  return { state, nextEdge: String(nextNode) };
}

/**
 * ParallelNode — Fan-out execution to multiple sub-configs.
 * Each branch is executed concurrently; results collected into an array.
 *
 * config:
 *   branches {Array<{ nodeId, type, config }>} - Inline node descriptors OR
 *   branchNodeIds {Array<string>}              - IDs of graph nodes to fan-out to
 *   outputKey {string}                          - State key for collected results
 *   mergeStrategy {string}                      - 'array'|'merge' (default: 'array')
 */
async function executeParallelNode(nodeConfig, state, context) {
  const {
    branches = [],
    outputKey = 'parallelResults',
    mergeStrategy = 'array',
  } = nodeConfig;

  if (branches.length === 0) {
    return { state: setPath(state, outputKey, []) };
  }

  const results = await Promise.all(
    branches.map(async (branch) => {
      const executor = NODE_EXECUTORS[branch.type];
      if (!executor) throw new Error(`Unknown branch node type: ${branch.type}`);
      const { state: branchState } = await executor(branch.config, { ...state }, context);
      return branchState;
    })
  );

  let mergedOutput;
  if (mergeStrategy === 'merge') {
    mergedOutput = results.reduce((acc, s) => mergeState(acc, s), {});
  } else {
    mergedOutput = results;
  }

  const newState = setPath(state, outputKey, mergedOutput);
  return { state: newState };
}

/**
 * ReduceNode — Aggregate results from parallel branches.
 *
 * config:
 *   inputKey {string}          - State key containing array of branch results
 *   reducer {Function}         - (accumulator, current, index) => newAccumulator
 *   initialValue {*}           - Initial accumulator value
 *   outputKey {string}         - State key for reduced result
 */
async function executeReduceNode(nodeConfig, state, context) {
  const {
    inputKey = 'parallelResults',
    reducer,
    initialValue,
    outputKey = 'reducedResult',
  } = nodeConfig;

  if (typeof reducer !== 'function') {
    throw new Error('ReduceNode requires a reducer function in config');
  }

  const items = getPath(state, inputKey);
  if (!Array.isArray(items)) {
    throw new Error(`ReduceNode inputKey '${inputKey}' must be an array`);
  }

  const result = items.reduce(reducer, initialValue);
  const newState = setPath(state, outputKey, result);
  return { state: newState };
}

/**
 * TransformNode — Apply a pure function to state.
 *
 * config:
 *   transform {Function}  - (state, context) => newState (partial or full)
 *   merge {boolean}       - If true, merge return value into state; else replace
 */
async function executeTransformNode(nodeConfig, state, context) {
  const { transform, merge = true } = nodeConfig;

  if (typeof transform !== 'function') {
    throw new Error('TransformNode requires a transform function in config');
  }

  const result = await transform(state, context);

  if (merge) {
    return { state: mergeState(state, result) };
  }
  return { state: result };
}

/**
 * HumanNode — Pause execution and wait for human input.
 *
 * config:
 *   prompt {string}        - Message to display to human operator
 *   inputKey {string}      - State key where human input will be stored
 *   timeoutMs {number}     - How long to wait before timing out
 *
 * Execution pauses; the workflow enters WAITING_FOR_HUMAN status.
 * Resume via POST /chain/:id/resume with { input }
 */
async function executeHumanNode(nodeConfig, state, context) {
  const {
    prompt: promptTemplate = 'Please provide input to continue.',
    inputKey = 'humanInput',
    timeoutMs = config.HUMAN_TIMEOUT_MS,
  } = nodeConfig;

  const displayPrompt = interpolate(promptTemplate, state);

  // Signal the execution engine to pause
  return {
    state,
    pause: {
      type: 'human',
      prompt: displayPrompt,
      inputKey,
      timeoutMs,
      pausedAt: Date.now(),
    },
  };
}

/**
 * SubChainNode — Execute another HeadyChain workflow as a nested sub-workflow.
 *
 * config:
 *   chainId {string}            - ID of the sub-chain graph
 *   graph {object}              - Inline graph JSON (alternative to chainId)
 *   inputMapping {object}       - Map parent state keys → sub-chain state keys
 *   outputKey {string}          - State key to store sub-chain final state
 *   outputMapping {object}      - Map sub-chain output keys → parent state keys
 */
async function executeSubChainNode(nodeConfig, state, context) {
  const {
    chainId,
    graph: inlineGraph,
    inputMapping = {},
    outputKey = 'subChainResult',
    outputMapping = {},
  } = nodeConfig;

  const orchestrator = context.orchestrator;
  if (!orchestrator) throw new Error('SubChainNode requires orchestrator in context');

  // Build sub-chain initial state from input mapping
  const subState = {};
  for (const [subKey, parentPath] of Object.entries(inputMapping)) {
    subState[subKey] = getPath(state, parentPath);
  }

  let finalSubState;
  if (inlineGraph) {
    const { GraphBuilder } = require('./graph');
    const builder = GraphBuilder.fromJSON(inlineGraph);
    finalSubState = await orchestrator.executeGraph(builder, subState, context);
  } else if (chainId) {
    finalSubState = await orchestrator.executeStoredChain(chainId, subState, context);
  } else {
    throw new Error('SubChainNode requires either chainId or graph in config');
  }

  // Map outputs back to parent state
  let newState = setPath(state, outputKey, finalSubState);
  for (const [parentPath, subPath] of Object.entries(outputMapping)) {
    newState = setPath(newState, parentPath, getPath(finalSubState, subPath));
  }

  return { state: newState };
}

/**
 * RetryNode — Wrap an inner node with PHI-backoff retry logic.
 *
 * config:
 *   inner {object}        - { type, config } of the wrapped node
 *   maxAttempts {number}  - Max retry attempts (default from config)
 *   retryOn {Function}    - (error) => boolean — which errors to retry
 *   backoffMs {number}    - Base backoff override
 */
async function executeRetryNode(nodeConfig, state, context) {
  const {
    inner,
    maxAttempts = config.MAX_RETRY_ATTEMPTS,
    retryOn = () => true,
    backoffMs,
  } = nodeConfig;

  if (!inner || !inner.type) {
    throw new Error('RetryNode requires inner.type in config');
  }

  const executor = NODE_EXECUTORS[inner.type];
  if (!executor) throw new Error(`RetryNode: unknown inner type '${inner.type}'`);

  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await executor(inner.config || {}, state, context);
      return result;
    } catch (err) {
      lastError = err;
      if (!retryOn(err)) throw err;
      if (attempt < maxAttempts - 1) {
        const delay = backoffMs != null
          ? backoffMs * Math.pow(config.PHI, attempt)
          : config.phiBackoff(attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`RetryNode exhausted ${maxAttempts} attempts. Last error: ${lastError.message}`);
}

// ─── Node Executor Map ────────────────────────────────────────────────────────

const NODE_EXECUTORS = {
  [NODE_TYPES.LLM]:         executeLLMNode,
  [NODE_TYPES.TOOL]:        executeToolNode,
  [NODE_TYPES.CONDITIONAL]: executeConditionalNode,
  [NODE_TYPES.PARALLEL]:    executeParallelNode,
  [NODE_TYPES.REDUCE]:      executeReduceNode,
  [NODE_TYPES.TRANSFORM]:   executeTransformNode,
  [NODE_TYPES.HUMAN]:       executeHumanNode,
  [NODE_TYPES.SUBCHAIN]:    executeSubChainNode,
  [NODE_TYPES.RETRY]:       executeRetryNode,
};

module.exports = {
  NODE_TYPES,
  NODE_EXECUTORS,
  // Utilities exported for use in index.js and agents.js
  interpolate,
  mergeState,
  getPath,
  setPath,
  httpPost,
};
