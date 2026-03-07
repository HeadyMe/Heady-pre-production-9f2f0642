'use strict';

/**
 * HeadyChain Prompt Template Engine
 * Template strings, few-shot injection, context management, output parsers.
 */

const config = require('./config');
const { interpolate } = require('./nodes');

// ─── Output Parsers ───────────────────────────────────────────────────────────

const OutputParsers = {
  /**
   * Parse LLM output as JSON. Strips markdown fences.
   */
  json: (text) => {
    if (typeof text !== 'string') return text;
    // Strip markdown code fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/gm, '')
      .replace(/```\s*$/gm, '')
      .trim();
    return JSON.parse(cleaned);
  },

  /**
   * Parse LLM output as a newline-delimited list (strips numbering/bullets).
   */
  list: (text) => {
    if (typeof text !== 'string') return [];
    return text
      .split(/\n/)
      .map(line => line.replace(/^[\d.)\-*•]+\s*/, '').trim())
      .filter(line => line.length > 0);
  },

  /**
   * Parse LLM output as a numbered list, preserving order.
   */
  numberedList: (text) => {
    if (typeof text !== 'string') return [];
    const items = [];
    const re = /^\s*(\d+)[.)]\s+(.+)/;
    for (const line of text.split('\n')) {
      const m = re.exec(line);
      if (m) items.push({ index: parseInt(m[1], 10), text: m[2].trim() });
    }
    return items;
  },

  /**
   * Extract structured key: value pairs from text.
   */
  keyValue: (text) => {
    if (typeof text !== 'string') return {};
    const result = {};
    const re = /^([A-Za-z_][A-Za-z0-9_\s]*):\s*(.+)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = m[1].trim().toLowerCase().replace(/\s+/g, '_');
      result[key] = m[2].trim();
    }
    return result;
  },

  /**
   * Extract a specific section from markdown headings.
   */
  section: (heading) => (text) => {
    if (typeof text !== 'string') return '';
    const re = new RegExp(`#{1,3}\\s+${heading}\\s*\\n([\\s\\S]*?)(?=#{1,3}|$)`, 'i');
    const m = re.exec(text);
    return m ? m[1].trim() : '';
  },

  /**
   * Try JSON first, fall back to raw text.
   */
  jsonOrText: (text) => {
    try {
      return OutputParsers.json(text);
    } catch {
      return text;
    }
  },

  /**
   * Parse tool call format: TOOL: name\nINPUT: {...}
   */
  toolCall: (text) => {
    const toolMatch = /TOOL:\s*([^\n]+)/i.exec(text);
    const inputMatch = /INPUT:\s*(\{[\s\S]*?\})/i.exec(text);
    const thoughtMatch = /THOUGHT:\s*([^\n]+)/i.exec(text);
    const answerMatch = /FINAL ANSWER:\s*([\s\S]+)/i.exec(text);

    if (answerMatch) {
      return { type: 'final_answer', answer: answerMatch[1].trim() };
    }
    if (toolMatch) {
      let input = {};
      if (inputMatch) {
        try { input = JSON.parse(inputMatch[1]); } catch { input = { raw: inputMatch[1] }; }
      }
      return {
        type: 'tool_call',
        tool: toolMatch[1].trim(),
        input,
        thought: thoughtMatch ? thoughtMatch[1].trim() : '',
      };
    }
    return { type: 'text', text };
  },

  /**
   * Parse ReAct format: Thought/Action/Action Input/Observation
   */
  react: (text) => {
    const thought = /Thought:\s*([^\n]+(?:\n(?!Action:|Observation:)[^\n]+)*)/i.exec(text);
    const action = /Action:\s*([^\n]+)/i.exec(text);
    const actionInput = /Action Input:\s*(\{[\s\S]*?\}|[^\n]+)/i.exec(text);
    const finalAnswer = /Final Answer:\s*([\s\S]+)/i.exec(text);

    if (finalAnswer) {
      return { type: 'final_answer', answer: finalAnswer[1].trim(), thought: thought?.[1]?.trim() };
    }
    if (action) {
      let input = {};
      if (actionInput) {
        try { input = JSON.parse(actionInput[1].trim()); } catch { input = { query: actionInput[1].trim() }; }
      }
      return {
        type: 'action',
        thought: thought?.[1]?.trim() || '',
        action: action[1].trim(),
        actionInput: input,
      };
    }
    return { type: 'text', thought: thought?.[1]?.trim() || '', text };
  },
};

// ─── Prompt Template ──────────────────────────────────────────────────────────

class PromptTemplate {
  /**
   * @param {string} template - Template string with {variable} placeholders
   * @param {object} [defaults] - Default variable values
   */
  constructor(template, defaults = {}) {
    this.template = template;
    this.defaults = defaults;
    this._variables = this._extractVariables(template);
  }

  _extractVariables(template) {
    const vars = [];
    const re = /\{([^}]+)\}/g;
    let m;
    while ((m = re.exec(template)) !== null) {
      vars.push(m[1]);
    }
    return [...new Set(vars)];
  }

  get variables() {
    return this._variables;
  }

  /**
   * Render the template with provided variables.
   */
  format(vars = {}) {
    const merged = { ...this.defaults, ...vars };
    return interpolate(this.template, merged);
  }

  /**
   * Compose with another template: append its rendered output to this one.
   */
  concat(other, separator = '\n\n') {
    return new PromptTemplate(
      this.template + separator + (other instanceof PromptTemplate ? other.template : other),
      { ...this.defaults, ...(other instanceof PromptTemplate ? other.defaults : {}) }
    );
  }

  toString() {
    return this.template;
  }
}

// ─── Chat Prompt Template ─────────────────────────────────────────────────────

/**
 * Constructs multi-turn message arrays for chat LLMs.
 */
class ChatPromptTemplate {
  constructor({ system, messages = [], fewShots = [] } = {}) {
    this.systemTemplate = system ? new PromptTemplate(system) : null;
    this.messageTemplates = messages.map(m => ({
      role: m.role,
      template: new PromptTemplate(m.content || m.template || ''),
    }));
    this.fewShots = fewShots; // [{ role, content }] pairs
  }

  /**
   * Format into message array for LLM.
   * @param {object} vars - Template variables
   * @param {Array} [history] - Conversation history messages
   * @param {number} [maxTokens] - Context window budget
   */
  format(vars = {}, history = [], maxTokens = config.DEFAULT_CONTEXT_WINDOW) {
    const messages = [];

    // System message
    if (this.systemTemplate) {
      messages.push({ role: 'system', content: this.systemTemplate.format(vars) });
    }

    // Few-shot examples
    for (const example of this.fewShots) {
      messages.push({ role: example.role, content: interpolate(example.content, vars) });
    }

    // Historical context (token-budget-aware)
    const historyToInclude = this._fitHistory(history, maxTokens, messages);
    messages.push(...historyToInclude);

    // Templated messages
    for (const { role, template } of this.messageTemplates) {
      messages.push({ role, content: template.format(vars) });
    }

    return messages;
  }

  /**
   * Truncate history to fit within token budget.
   */
  _fitHistory(history, maxTokens, existingMessages) {
    const budgetChars = maxTokens * config.CHARS_PER_TOKEN;
    const existingChars = existingMessages.reduce((sum, m) => sum + String(m.content).length, 0);
    let remaining = budgetChars - existingChars;
    const result = [];

    for (let i = history.length - 1; i >= 0; i--) {
      const msgLen = String(history[i].content || '').length;
      if (remaining - msgLen < 0) break;
      result.unshift(history[i]);
      remaining -= msgLen;
    }

    return result;
  }

  /**
   * Add few-shot examples.
   */
  addFewShots(examples) {
    this.fewShots.push(...examples);
    return this;
  }

  /**
   * Create a standard ReAct agent prompt.
   */
  static react(toolDescriptions) {
    const tools = toolDescriptions.map(t => `- ${t.name}: ${t.description}`).join('\n');
    return new ChatPromptTemplate({
      system: `You are a helpful AI assistant with access to tools. Use tools to answer questions accurately.

Available tools:
${tools}

Use the following format for tool use:
Thought: [your reasoning about what to do]
Action: [tool name]
Action Input: [JSON object with tool inputs]

After receiving tool results (observations), continue reasoning.
When you have enough information, respond with:
Thought: [final reasoning]
Final Answer: [your complete answer to the user]`,
      messages: [{ role: 'user', content: '{input}' }],
    });
  }

  /**
   * Create a standard Plan & Execute prompt.
   */
  static planAndExecute() {
    return new ChatPromptTemplate({
      system: `You are a planning assistant. Create step-by-step plans to accomplish tasks.
When planning, think about: What needs to be done? What order? What dependencies exist?
Return a numbered list of concrete, actionable steps.`,
      messages: [
        { role: 'user', content: 'Create a plan to: {objective}\n\nContext: {context}' },
      ],
    });
  }

  /**
   * Create a standard summarization prompt.
   */
  static summarize() {
    return new ChatPromptTemplate({
      messages: [
        {
          role: 'user',
          content: 'Summarize the following text concisely:\n\n{text}\n\nSummary:',
        },
      ],
    });
  }

  /**
   * Create an entity extraction prompt.
   */
  static extractEntities() {
    return new ChatPromptTemplate({
      messages: [
        {
          role: 'user',
          content: `Extract named entities (people, places, organizations, concepts) from:

{text}

Return JSON: {"entities": [{"name": "...", "type": "...", "context": "..."}]}`,
        },
      ],
    });
  }
}

// ─── Context Window Manager ───────────────────────────────────────────────────

/**
 * Manages the overall context window budget across system, history, and user messages.
 */
class ContextWindowManager {
  constructor({ maxTokens = config.DEFAULT_CONTEXT_WINDOW, reserveForOutput = 1024 } = {}) {
    this.maxTokens = maxTokens;
    this.reserveForOutput = reserveForOutput;
    this.availableTokens = maxTokens - reserveForOutput;
  }

  /**
   * Estimate token count for text (rough: chars / 4).
   */
  estimateTokens(text) {
    return Math.ceil(String(text).length / config.CHARS_PER_TOKEN);
  }

  /**
   * Estimate total tokens for a messages array.
   */
  estimateMessagesTokens(messages) {
    return messages.reduce((sum, m) => sum + this.estimateTokens(m.content || ''), 0);
  }

  /**
   * Truncate messages array to fit within budget.
   * Preserves system message and most recent messages.
   */
  fitMessages(messages) {
    if (this.estimateMessagesTokens(messages) <= this.availableTokens) {
      return messages;
    }

    const system = messages.filter(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    const systemTokens = this.estimateMessagesTokens(system);
    let remaining = this.availableTokens - systemTokens;
    const kept = [];

    // Keep from the end
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const t = this.estimateTokens(nonSystem[i].content || '');
      if (remaining - t < 0) break;
      kept.unshift(nonSystem[i]);
      remaining -= t;
    }

    return [...system, ...kept];
  }

  /**
   * Truncate a single text to fit within remaining token budget.
   */
  truncateText(text, reserveTokens = 0) {
    const available = this.availableTokens - reserveTokens;
    const maxChars = available * config.CHARS_PER_TOKEN;
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars) + '\n...[truncated]';
  }
}

// ─── Prompt Composer ──────────────────────────────────────────────────────────

/**
 * Chain multiple prompt templates together.
 */
class PromptComposer {
  constructor() {
    this.steps = [];
  }

  /**
   * Add a template step.
   * @param {PromptTemplate|ChatPromptTemplate} template
   * @param {object} [vars] - Static vars for this step
   */
  add(template, vars = {}) {
    this.steps.push({ template, vars });
    return this;
  }

  /**
   * Format all templates and concatenate into a single message array.
   */
  formatAll(dynamicVars = {}, history = []) {
    const allMessages = [];
    for (const { template, vars } of this.steps) {
      const merged = { ...vars, ...dynamicVars };
      if (template instanceof ChatPromptTemplate) {
        allMessages.push(...template.format(merged, history));
      } else {
        allMessages.push({ role: 'user', content: template.format(merged) });
      }
    }
    return allMessages;
  }
}

module.exports = {
  PromptTemplate,
  ChatPromptTemplate,
  ContextWindowManager,
  PromptComposer,
  OutputParsers,
  interpolate,
};
