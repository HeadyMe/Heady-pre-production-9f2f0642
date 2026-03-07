'use strict';

/**
 * HeadyChain Pre-built Agent Patterns
 *
 * ReActAgent        — Reasoning + Acting loop (think → act → observe → repeat)
 * PlanAndExecuteAgent — Plan steps then execute sequentially
 * ToolCallingAgent  — Direct function/tool calling
 * ConversationalAgent — Stateful chat with memory and tools
 * SupervisorAgent   — Coordinate multiple sub-agents (like HeadyBees)
 * CriticAgent       — Review and critique another agent's output
 */

const { HeadyChain } = require('./index');
const { GraphBuilder } = require('./graph');
const { NODE_TYPES } = require('./nodes');
const { ToolRegistry, globalRegistry } = require('./tools');
const { MemoryManager, BufferMemory } = require('./memory');
const { ChatPromptTemplate, OutputParsers, PromptTemplate } = require('./prompts');
const { httpPost, interpolate } = require('./nodes');
const config = require('./config');

// ─── Shared LLM call helper ───────────────────────────────────────────────────

async function callLLM(messages, opts = {}) {
  const {
    model = config.HEADY_INFER_DEFAULT_MODEL,
    maxTokens = config.DEFAULT_MAX_TOKENS,
    temperature = 0.7,
    tools: toolSchemas,
  } = opts;

  const payload = { model, messages, max_tokens: maxTokens, temperature };
  if (toolSchemas && toolSchemas.length > 0) {
    payload.tools = toolSchemas;
    payload.tool_choice = 'auto';
  }

  // Mock for testing
  if (process.env.NODE_ENV === 'test' || process.env.HEADY_INFER_MOCK === 'true') {
    const lastMsg = messages[messages.length - 1]?.content || '';
    return {
      type: 'text',
      content: `[MOCK] Response to: ${lastMsg.slice(0, 100)}`,
    };
  }

  try {
    const result = await httpPost(
      `${config.HEADY_INFER_URL}/infer`,
      payload,
      config.HEADY_INFER_TIMEOUT_MS
    );
    if (result.status >= 400) {
      throw new Error(`LLM call failed with status ${result.status}: ${JSON.stringify(result.body)}`);
    }
    const body = result.body;

    // Parse response: tool_use vs text
    if (body.choices && body.choices[0]) {
      const choice = body.choices[0];
      const msg = choice.message || choice;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        return { type: 'tool_calls', tool_calls: msg.tool_calls, content: msg.content };
      }
      return { type: 'text', content: msg.content || msg.text || '' };
    }
    // Anthropic format
    if (body.content && Array.isArray(body.content)) {
      const toolBlocks = body.content.filter(b => b.type === 'tool_use');
      if (toolBlocks.length > 0) {
        return { type: 'tool_calls', tool_calls: toolBlocks.map(b => ({
          id: b.id,
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        })), content: body.content.filter(b => b.type === 'text').map(b => b.text).join('') };
      }
      return { type: 'text', content: body.content.map(b => b.text || '').join('') };
    }
    return { type: 'text', content: body.response || body.text || JSON.stringify(body) };
  } catch (err) {
    throw new Error(`LLM call error: ${err.message}`);
  }
}

// ─── ReAct Agent ─────────────────────────────────────────────────────────────

/**
 * ReActAgent: Reasoning + Acting loop.
 * Iterates: Thought → Action (tool call) → Observation → ... → Final Answer
 */
class ReActAgent {
  constructor(opts = {}) {
    this.toolRegistry = opts.toolRegistry || globalRegistry;
    this.maxIterations = opts.maxIterations || config.REACT_MAX_ITERATIONS;
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.memory = opts.memory || new BufferMemory({ maxSize: 20 });
    this.systemPrompt = opts.systemPrompt || this._defaultSystemPrompt();
    this.verbose = opts.verbose || false;
  }

  _defaultSystemPrompt() {
    const tools = this.toolRegistry.list();
    const toolDescs = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `You are a helpful AI assistant. Use tools to find accurate information.

Available tools:
${toolDescs}

Respond using this EXACT format:
Thought: [your reasoning]
Action: [tool name]
Action Input: {"key": "value"}

When you have the final answer:
Thought: [final reasoning]
Final Answer: [your complete answer]`;
  }

  /**
   * Run the ReAct loop for a given input.
   * @param {string} input - User's question or task
   * @param {object} context - Additional context
   * @returns {Promise<{answer: string, steps: Array, iterations: number}>}
   */
  async run(input, context = {}) {
    const messages = [];
    const steps = [];
    let iterations = 0;

    // Add system prompt
    messages.push({ role: 'system', content: interpolate(this.systemPrompt, context) });

    // Add conversation history
    const history = this.memory.getMessages(10);
    messages.push(...history.map(m => ({ role: m.role, content: m.content })));

    // Add current user input
    messages.push({ role: 'user', content: input });

    while (iterations < this.maxIterations) {
      iterations++;

      // Call LLM
      const llmResponse = await callLLM(messages, { model: this.model });
      const responseText = llmResponse.content;

      // Parse the response
      const parsed = OutputParsers.react(responseText);

      // Add assistant message to context
      messages.push({ role: 'assistant', content: responseText });
      steps.push({ iteration: iterations, type: parsed.type, thought: parsed.thought, raw: responseText });

      if (parsed.type === 'final_answer') {
        // Update memory
        await this.memory.add('user', input);
        await this.memory.add('assistant', parsed.answer);

        return {
          answer: parsed.answer,
          steps,
          iterations,
          thought: parsed.thought,
        };
      }

      if (parsed.type === 'action') {
        const { action: toolName, actionInput } = parsed;
        let observation;

        try {
          const toolResult = await this.toolRegistry.execute(toolName, actionInput);
          observation = `Tool result: ${JSON.stringify(toolResult)}`;
          steps[steps.length - 1].toolResult = toolResult;
        } catch (err) {
          observation = `Error calling tool '${toolName}': ${err.message}`;
          steps[steps.length - 1].error = err.message;
        }

        // Add observation to message history
        messages.push({ role: 'user', content: `Observation: ${observation}` });
        steps[steps.length - 1].observation = observation;

        if (this.verbose) {
          console.log(`[ReAct] Iteration ${iterations}: Action=${toolName}, Observation=${observation.slice(0, 100)}`);
        }
      } else {
        // Unexpected format — ask LLM to continue
        messages.push({ role: 'user', content: 'Please continue with Thought/Action or Final Answer format.' });
      }
    }

    // Max iterations exceeded
    return {
      answer: `Max iterations (${this.maxIterations}) reached without a final answer.`,
      steps,
      iterations,
      error: 'max_iterations_exceeded',
    };
  }
}

// ─── Plan & Execute Agent ─────────────────────────────────────────────────────

/**
 * PlanAndExecuteAgent: Creates a plan, then executes each step using available tools.
 */
class PlanAndExecuteAgent {
  constructor(opts = {}) {
    this.toolRegistry = opts.toolRegistry || globalRegistry;
    this.maxSteps = opts.maxSteps || config.PLAN_EXECUTE_MAX_STEPS;
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.memory = opts.memory || new BufferMemory({ maxSize: 20 });
    this.plannerPrompt = opts.plannerPrompt || ChatPromptTemplate.planAndExecute();
    this.executorPrompt = opts.executorPrompt || null;
  }

  /**
   * Generate a plan for the given objective.
   */
  async plan(objective, context = '') {
    const messages = this.plannerPrompt.format({ objective, context });
    const response = await callLLM(messages, { model: this.model, temperature: 0.3 });
    const steps = OutputParsers.list(response.content || '');
    return steps.slice(0, this.maxSteps);
  }

  /**
   * Execute a single plan step using available tools.
   */
  async executeStep(step, previousResults, objective) {
    const tools = this.toolRegistry.list();
    const toolDescs = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');

    const prevContext = previousResults.length > 0
      ? `Previous results:\n${previousResults.map((r, i) => `Step ${i + 1}: ${JSON.stringify(r).slice(0, 200)}`).join('\n')}`
      : '';

    const messages = [
      {
        role: 'system',
        content: `You execute tasks using available tools.\n\nAvailable tools:\n${toolDescs}\n\nOverall objective: ${objective}\n${prevContext}`,
      },
      {
        role: 'user',
        content: `Execute this step: ${step}\n\nRespond with: {"tool": "tool_name", "input": {...}} or {"result": "direct_answer"}`,
      },
    ];

    const response = await callLLM(messages, { model: this.model });
    let parsed;
    try {
      parsed = OutputParsers.json(response.content || '{}');
    } catch {
      parsed = { result: response.content };
    }

    if (parsed.tool) {
      try {
        const toolResult = await this.toolRegistry.execute(parsed.tool, parsed.input || {});
        return { step, tool: parsed.tool, result: toolResult, success: true };
      } catch (err) {
        return { step, tool: parsed.tool, error: err.message, success: false };
      }
    }

    return { step, result: parsed.result || response.content, success: true };
  }

  /**
   * Run the full Plan & Execute cycle.
   */
  async run(objective, context = {}) {
    const plan = await this.plan(objective, context.background || '');
    const results = [];
    const stepResults = [];

    for (let i = 0; i < plan.length; i++) {
      const stepResult = await this.executeStep(plan[i], results.map(r => r.result), objective);
      stepResults.push(stepResult);
      results.push(stepResult);
    }

    // Synthesize final answer
    const synthesis = await callLLM([
      {
        role: 'system',
        content: `Synthesize the results of executing a plan into a clear final answer.`,
      },
      {
        role: 'user',
        content: `Objective: ${objective}\n\nPlan executed:\n${plan.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\nResults:\n${results.map(r => JSON.stringify(r)).join('\n')}\n\nFinal Answer:`,
      },
    ], { model: this.model });

    return {
      objective,
      plan,
      steps: stepResults,
      answer: synthesis.content,
    };
  }
}

// ─── Tool Calling Agent ───────────────────────────────────────────────────────

/**
 * ToolCallingAgent: Uses native function/tool calling (schema-driven).
 * Best for models with native function calling support (GPT-4, Claude 3+).
 */
class ToolCallingAgent {
  constructor(opts = {}) {
    this.toolRegistry = opts.toolRegistry || globalRegistry;
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.maxRounds = opts.maxRounds || 10;
    this.systemPrompt = opts.systemPrompt || 'You are a helpful assistant. Use the provided tools to answer questions accurately.';
  }

  /**
   * Run the tool-calling loop.
   */
  async run(input, context = {}) {
    const tools = this.toolRegistry.listForLLM();
    const messages = [
      { role: 'system', content: interpolate(this.systemPrompt, context) },
      { role: 'user', content: input },
    ];

    const toolCalls = [];
    let rounds = 0;
    let finalContent = '';

    while (rounds < this.maxRounds) {
      rounds++;
      const response = await callLLM(messages, { model: this.model, tools });

      if (response.type === 'text') {
        finalContent = response.content;
        break;
      }

      if (response.type === 'tool_calls') {
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.tool_calls,
        });

        // Execute each tool call
        for (const toolCall of response.tool_calls) {
          const fnName = toolCall.function?.name || toolCall.name;
          let fnArgs = {};
          try {
            fnArgs = typeof toolCall.function?.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : (toolCall.function?.arguments || toolCall.input || {});
          } catch { fnArgs = {}; }

          let toolResult;
          try {
            toolResult = await this.toolRegistry.execute(fnName, fnArgs);
          } catch (err) {
            toolResult = { error: err.message };
          }

          toolCalls.push({ tool: fnName, input: fnArgs, output: toolResult, round: rounds });

          // Add tool result to messages
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id || `call_${Date.now()}`,
            content: JSON.stringify(toolResult),
          });
        }
      } else {
        finalContent = response.content || '';
        break;
      }
    }

    return {
      answer: finalContent,
      toolCalls,
      rounds,
    };
  }
}

// ─── Conversational Agent ─────────────────────────────────────────────────────

/**
 * ConversationalAgent: Multi-turn chat with persistent memory and optional tools.
 */
class ConversationalAgent {
  constructor(opts = {}) {
    this.toolRegistry = opts.toolRegistry || null;
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.systemPrompt = opts.systemPrompt || 'You are a helpful, friendly AI assistant.';
    this.memory = opts.memory || new MemoryManager();
    this.maxContextTokens = opts.maxContextTokens || config.DEFAULT_CONTEXT_WINDOW;
    this.useTools = opts.useTools !== false && this.toolRegistry !== null;
  }

  /**
   * Send a message and get a response.
   */
  async chat(input, userId = 'default') {
    // Add user message to memory
    await this.memory.addMessage('user', input, { userId });

    // Build messages for LLM
    const contextMessages = this.memory.getContextMessages(this.maxContextTokens);
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...contextMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    // Add working memory context if available
    const workingCtx = this.memory.working.toObject();
    if (Object.keys(workingCtx).length > 0) {
      messages[0].content += `\n\nCurrent context:\n${JSON.stringify(workingCtx, null, 2)}`;
    }

    const opts = { model: this.model };
    if (this.useTools && this.toolRegistry) {
      opts.tools = this.toolRegistry.listForLLM();
    }

    let response;
    let toolCalls = [];

    // Handle tool calls if needed
    if (this.useTools && opts.tools) {
      const result = await callLLM(messages, opts);

      if (result.type === 'tool_calls') {
        // Process tool calls and get final response
        const toolMessages = [...messages, {
          role: 'assistant',
          content: result.content || null,
          tool_calls: result.tool_calls,
        }];

        for (const tc of result.tool_calls) {
          const fnName = tc.function?.name || tc.name;
          let fnArgs = {};
          try {
            fnArgs = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.input || {};
          } catch {}

          let toolResult;
          try {
            toolResult = await this.toolRegistry.execute(fnName, fnArgs);
          } catch (err) {
            toolResult = { error: err.message };
          }
          toolCalls.push({ tool: fnName, result: toolResult });
          toolMessages.push({
            role: 'tool',
            tool_call_id: tc.id || `call_${Date.now()}`,
            content: JSON.stringify(toolResult),
          });
        }

        const finalResponse = await callLLM(toolMessages, { model: this.model });
        response = finalResponse.content || '';
      } else {
        response = result.content || '';
      }
    } else {
      const result = await callLLM(messages, opts);
      response = result.content || '';
    }

    // Add assistant response to memory
    await this.memory.addMessage('assistant', response, { userId, toolCalls });

    return {
      response,
      toolCalls,
      memorySize: this.memory.buffer.size(),
    };
  }

  /**
   * Clear conversation history.
   */
  clearHistory() {
    this.memory.buffer.clear();
  }

  /**
   * Store a fact in working memory.
   */
  remember(key, value, opts = {}) {
    this.memory.working.set(key, value, opts);
    return this;
  }

  /**
   * Retrieve from working memory.
   */
  recall(key) {
    return this.memory.working.get(key);
  }
}

// ─── Supervisor Agent ─────────────────────────────────────────────────────────

/**
 * SupervisorAgent: Orchestrates multiple sub-agents (like HeadyBees).
 * Routes tasks to specialist agents based on capability matching.
 */
class SupervisorAgent {
  constructor(opts = {}) {
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.agents = new Map();   // name -> { agent, description, capabilities }
    this.maxRounds = opts.maxRounds || 10;
    this.name = opts.name || 'supervisor';
    this.systemPrompt = opts.systemPrompt || this._defaultSystemPrompt();
  }

  /**
   * Register a sub-agent.
   */
  registerAgent(name, agent, description, capabilities = []) {
    this.agents.set(name, { agent, description, capabilities });
    return this;
  }

  _defaultSystemPrompt() {
    return `You are a supervisor coordinating specialized agents to complete complex tasks.
Your job is to:
1. Break down the task
2. Assign sub-tasks to the most appropriate agents
3. Collect and synthesize results
4. Return a comprehensive final answer

Available agents: {agentList}

Respond with JSON: {"delegate": [{"agent": "name", "task": "specific task"}], "synthesize": true/false}
Or: {"final_answer": "answer"}`;
  }

  _buildAgentList() {
    return [...this.agents.entries()]
      .map(([name, { description, capabilities }]) =>
        `- ${name}: ${description} (capabilities: ${capabilities.join(', ')})`
      )
      .join('\n');
  }

  /**
   * Run the supervisor loop.
   */
  async run(task, context = {}) {
    const agentList = this._buildAgentList();
    const messages = [
      { role: 'system', content: interpolate(this.systemPrompt, { agentList }) },
      { role: 'user', content: `Task: ${task}\n\nContext: ${JSON.stringify(context)}` },
    ];

    const allResults = [];
    let finalAnswer = '';
    let rounds = 0;

    while (rounds < this.maxRounds) {
      rounds++;

      const response = await callLLM(messages, { model: this.model, temperature: 0.2 });
      let directive;
      try {
        directive = OutputParsers.json(response.content || '{}');
      } catch {
        // If parse fails, treat as final answer
        finalAnswer = response.content;
        break;
      }

      if (directive.final_answer) {
        finalAnswer = directive.final_answer;
        break;
      }

      if (directive.delegate && Array.isArray(directive.delegate)) {
        // Execute delegated tasks in parallel
        const delegations = directive.delegate;
        const results = await Promise.all(
          delegations.map(async ({ agent: agentName, task: subTask }) => {
            const agentEntry = this.agents.get(agentName);
            if (!agentEntry) {
              return { agent: agentName, task: subTask, error: `Agent '${agentName}' not found` };
            }

            try {
              const agent = agentEntry.agent;
              let result;

              // Support various agent types
              if (typeof agent.run === 'function') {
                result = await agent.run(subTask, context);
              } else if (typeof agent.chat === 'function') {
                result = await agent.chat(subTask);
              } else if (typeof agent === 'function') {
                result = await agent(subTask, context);
              } else {
                result = { error: 'Agent has no run/chat method' };
              }

              return { agent: agentName, task: subTask, result };
            } catch (err) {
              return { agent: agentName, task: subTask, error: err.message };
            }
          })
        );

        allResults.push(...results);

        // Feed results back to supervisor
        messages.push({
          role: 'assistant',
          content: response.content,
        });
        messages.push({
          role: 'user',
          content: `Results from agents:\n${JSON.stringify(results, null, 2)}\n\nSynthesize or delegate further tasks.`,
        });
      } else {
        finalAnswer = response.content;
        break;
      }
    }

    return {
      task,
      answer: finalAnswer,
      agentResults: allResults,
      rounds,
    };
  }
}

// ─── Critic Agent ─────────────────────────────────────────────────────────────

/**
 * CriticAgent: Reviews and critiques another agent's output.
 * Can be used for quality control, fact-checking, or improvement loops.
 */
class CriticAgent {
  constructor(opts = {}) {
    this.model = opts.model || config.HEADY_INFER_DEFAULT_MODEL;
    this.criteria = opts.criteria || ['accuracy', 'completeness', 'clarity', 'reasoning'];
    this.maxRevisions = opts.maxRevisions || 3;
    this.passingScore = opts.passingScore || 7; // out of 10
    this.systemPrompt = opts.systemPrompt || this._defaultSystemPrompt();
  }

  _defaultSystemPrompt() {
    return `You are a critical reviewer. Evaluate responses on: ${this.criteria.join(', ')}.

Return JSON:
{
  "score": 1-10,
  "passed": true/false,
  "feedback": "specific feedback",
  "suggestions": ["improvement 1", "improvement 2"],
  "revised": "improved version (if not passed)"
}`;
  }

  /**
   * Critique a piece of content.
   */
  async critique(content, task = '', context = {}) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content: `Original task: ${task}\n\nContent to review:\n${content}\n\nEvaluate and provide feedback.`,
      },
    ];

    const response = await callLLM(messages, { model: this.model, temperature: 0.3 });

    let result;
    try {
      result = OutputParsers.json(response.content || '{}');
    } catch {
      result = {
        score: 5,
        passed: false,
        feedback: response.content,
        suggestions: [],
        revised: content,
      };
    }

    result.passed = result.passed !== undefined
      ? result.passed
      : (result.score || 0) >= this.passingScore;

    return result;
  }

  /**
   * Iterative critique-and-revise loop.
   * Critiques content, uses revised version if score is below threshold.
   *
   * @param {Function} generateFn - async function that returns content to critique
   * @param {string} task - Original task description
   * @param {object} context
   */
  async critiqueAndRevise(generateFn, task, context = {}) {
    let content = await generateFn(task, context);
    const history = [];

    for (let revision = 0; revision < this.maxRevisions; revision++) {
      const critique = await this.critique(content, task, context);
      history.push({ revision, content, critique });

      if (critique.passed) {
        return {
          finalContent: content,
          passed: true,
          revisions: revision,
          history,
        };
      }

      // Use revised content for next iteration
      if (critique.revised && critique.revised !== content) {
        content = critique.revised;
      } else {
        // Ask the generator to improve using feedback
        const improvedContent = await generateFn(
          `${task}\n\nPrevious attempt had these issues: ${critique.feedback}\nSuggestions: ${critique.suggestions.join(', ')}`,
          context
        );
        content = improvedContent;
      }
    }

    const finalCritique = await this.critique(content, task, context);
    history.push({ revision: this.maxRevisions, content, critique: finalCritique });

    return {
      finalContent: content,
      passed: finalCritique.passed,
      revisions: this.maxRevisions,
      history,
    };
  }
}

// ─── Agent Factory ────────────────────────────────────────────────────────────

/**
 * Factory for creating pre-configured agents.
 */
const AgentFactory = {
  react: (opts = {}) => new ReActAgent(opts),
  planAndExecute: (opts = {}) => new PlanAndExecuteAgent(opts),
  toolCalling: (opts = {}) => new ToolCallingAgent(opts),
  conversational: (opts = {}) => new ConversationalAgent(opts),
  supervisor: (opts = {}) => new SupervisorAgent(opts),
  critic: (opts = {}) => new CriticAgent(opts),
};

module.exports = {
  ReActAgent,
  PlanAndExecuteAgent,
  ToolCallingAgent,
  ConversationalAgent,
  SupervisorAgent,
  CriticAgent,
  AgentFactory,
  callLLM, // exported for direct use
};
