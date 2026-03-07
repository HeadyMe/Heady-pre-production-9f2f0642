/**
 * © 2024-2026 HeadySystems Inc. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 */

'use strict';

const logger = require('../../utils/logger');
const LLMRouter = require('../../providers/llm-router');

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLES = Object.freeze({
  CODE:           'code',
  PROSE:          'prose',
  POETRY:         'poetry',
  TECHNICAL:      'technical',
  CONVERSATIONAL: 'conversational',
  STRUCTURED:     'structured',
  MARKETING:      'marketing',
});

// System prompts per style
const STYLE_PROMPTS = {
  [STYLES.CODE]: `You are an expert software engineer. Generate clean, well-commented, production-ready code. Include type hints/JSDoc where appropriate. Follow best practices for the language or framework requested. Output ONLY the code and concise inline comments — no prose explanation unless asked.`,

  [STYLES.PROSE]: `You are a skilled author. Write clear, engaging prose. Vary sentence length for rhythm. Use vivid, precise language. Avoid clichés. Structure paragraphs logically with clear topic sentences.`,

  [STYLES.POETRY]: `You are a poet with mastery of form, meter, and imagery. Craft poetry that balances sound, image, and meaning. Adapt form to content — choose free verse, sonnet, haiku, or other forms as appropriate to the request.`,

  [STYLES.TECHNICAL]: `You are a technical writer. Produce accurate, clear documentation. Use precise terminology. Structure content with headings, lists, and tables as needed. Define acronyms and technical terms on first use. Aim for clarity over brevity.`,

  [STYLES.CONVERSATIONAL]: `You are a friendly, knowledgeable assistant. Communicate in a warm, approachable tone. Use plain language. Ask clarifying questions when appropriate. Be concise but thorough.`,

  [STYLES.STRUCTURED]: `You are a structured content specialist. Produce well-organized output with clear headings, lists, tables, and sections. Return JSON or Markdown as requested. Follow the exact schema or template provided.`,

  [STYLES.MARKETING]: `You are a world-class copywriter. Write compelling, benefit-driven marketing content. Lead with the hook. Address the reader's needs and pain points. Use active voice. Include a clear call to action.`,
};

// Model preferences per style
const STYLE_MODEL_PREFS = {
  [STYLES.CODE]:           { taskType: 'code-generation',   temperature: 0.1 },
  [STYLES.PROSE]:          { taskType: 'creative-writing',  temperature: 0.8 },
  [STYLES.POETRY]:         { taskType: 'creative-writing',  temperature: 0.9 },
  [STYLES.TECHNICAL]:      { taskType: 'documentation',     temperature: 0.2 },
  [STYLES.CONVERSATIONAL]: { taskType: 'chat',              temperature: 0.7 },
  [STYLES.STRUCTURED]:     { taskType: 'structured-output', temperature: 0.1 },
  [STYLES.MARKETING]:      { taskType: 'creative-writing',  temperature: 0.75 },
};

// ─── Template system ──────────────────────────────────────────────────────────

const BUILT_IN_TEMPLATES = {
  'readme': {
    style: STYLES.TECHNICAL,
    template: `Create a README.md for: {{subject}}
Include: Overview, Installation, Usage, API Reference, Contributing, License sections.
Project details: {{details}}`,
  },
  'commit-message': {
    style: STYLES.CODE,
    template: `Generate a conventional commit message for the following changes:
{{changes}}
Format: <type>(<scope>): <subject>
Types: feat, fix, docs, style, refactor, test, chore`,
  },
  'blog-post': {
    style: STYLES.PROSE,
    template: `Write a blog post about: {{topic}}
Target audience: {{audience}}
Tone: {{tone}}
Length: approximately {{wordCount}} words`,
  },
  'api-doc': {
    style: STYLES.TECHNICAL,
    template: `Document this API endpoint:
Method: {{method}}
Path: {{path}}
Description: {{description}}
Parameters: {{params}}
Returns: {{returns}}`,
  },
  'code-review': {
    style: STYLES.TECHNICAL,
    template: `Review this code for correctness, security, performance, and style:
Language: {{language}}
Code:
{{code}}
Provide: Summary, Issues (severity: high/medium/low), Suggestions`,
  },
  'pitch': {
    style: STYLES.MARKETING,
    template: `Write a compelling pitch for: {{product}}
Target customer: {{customer}}
Key benefit: {{benefit}}
Format: {{format}}`,
  },
};

// ─── CreativeEngine ───────────────────────────────────────────────────────────

class CreativeEngine {
  /**
   * @param {object} opts
   * @param {object}  [opts.llmRouter]    - LLMRouter instance
   * @param {object}  [opts.templates]    - Additional custom templates (merged with built-ins)
   * @param {number}  [opts.maxTokens]    - Default max tokens for generation
   * @param {boolean} [opts.streaming]    - Enable streaming responses
   */
  constructor(opts = {}) {
    this._router = opts.llmRouter || new LLMRouter();
    this._templates = { ...BUILT_IN_TEMPLATES, ...(opts.templates || {}) };
    this._maxTokens = opts.maxTokens ?? 2048;
    this._streaming = opts.streaming ?? false;

    logger.info('[CreativeEngine] initialized', {
      templates: Object.keys(this._templates).length,
      streaming: this._streaming,
    });
  }

  // ─── Core generation ─────────────────────────────────────────────────────────

  /**
   * Generate creative content.
   * @param {string|object} prompt  - Prompt string or { text, context, constraints }
   * @param {string}        style   - One of STYLES values (default: STYLES.PROSE)
   * @param {object}        opts
   * @param {string}   [opts.model]       - Force specific model
   * @param {number}   [opts.temperature] - Override temperature
   * @param {number}   [opts.maxTokens]   - Override max tokens
   * @param {string}   [opts.format]      - 'text'|'markdown'|'json' (default: text)
   * @param {string[]} [opts.stopWords]   - Stop sequences
   * @returns {Promise<GenerationResult>}
   */
  async generate(prompt, style = STYLES.PROSE, opts = {}) {
    const resolvedStyle = STYLES[style.toUpperCase()] || style;
    if (!STYLE_PROMPTS[resolvedStyle]) {
      throw new Error(`Unknown style: ${style}. Valid: ${Object.values(STYLES).join(', ')}`);
    }

    const promptText = typeof prompt === 'string' ? prompt : _buildPromptText(prompt);
    const prefs = STYLE_MODEL_PREFS[resolvedStyle];
    const systemPrompt = STYLE_PROMPTS[resolvedStyle];

    const routeOpts = {
      taskType: prefs.taskType,
      model: opts.model,
    };

    const llmPayload = {
      model: opts.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ],
      temperature: opts.temperature ?? prefs.temperature,
      max_tokens: opts.maxTokens ?? this._maxTokens,
      stop: opts.stopWords,
      stream: this._streaming && opts.streaming !== false,
    };

    const startMs = Date.now();

    try {
      const response = await this._router.route(llmPayload, routeOpts);
      const latencyMs = Date.now() - startMs;

      const content = _extractContent(response);

      const result = {
        content,
        style: resolvedStyle,
        model: response.model || routeOpts.model || 'unknown',
        usage: response.usage || {},
        latencyMs,
        format: opts.format || 'text',
        generatedAt: new Date().toISOString(),
      };

      logger.debug('[CreativeEngine] generation complete', {
        style: resolvedStyle, latencyMs, tokens: result.usage.total_tokens,
      });

      return result;
    } catch (err) {
      logger.error('[CreativeEngine] generation failed', { style, err: err.message });
      throw err;
    }
  }

  // ─── Template generation ─────────────────────────────────────────────────────

  /**
   * Generate content using a named template with variable substitution.
   * @param {string} templateName
   * @param {object} variables     - Values for {{variable}} placeholders
   * @param {object} opts          - Same as generate() opts
   * @returns {Promise<GenerationResult>}
   */
  async generateFromTemplate(templateName, variables = {}, opts = {}) {
    const tmpl = this._templates[templateName];
    if (!tmpl) {
      throw new Error(`Template not found: ${templateName}. Available: ${Object.keys(this._templates).join(', ')}`);
    }

    const prompt = _interpolateTemplate(tmpl.template, variables);
    const style = opts.style || tmpl.style || STYLES.PROSE;

    return this.generate(prompt, style, opts);
  }

  /**
   * Register a custom template.
   * @param {string} name
   * @param {object} template - { template: string, style?: string, description?: string }
   */
  registerTemplate(name, template) {
    if (!template.template) throw new Error('template.template (string) is required');
    this._templates[name] = template;
    logger.debug('[CreativeEngine] template registered', { name });
    return this;
  }

  /**
   * List available templates.
   * @returns {object[]}
   */
  listTemplates() {
    return Object.entries(this._templates).map(([name, tmpl]) => ({
      name,
      style: tmpl.style,
      description: tmpl.description || null,
      variables: _extractVariables(tmpl.template),
    }));
  }

  // ─── Multi-variation generation ───────────────────────────────────────────────

  /**
   * Generate multiple variations and optionally rank them.
   * @param {string} prompt
   * @param {string} style
   * @param {object} opts  - { count, rankBy, ...generateOpts }
   * @returns {Promise<GenerationResult[]>}
   */
  async generateVariations(prompt, style = STYLES.PROSE, opts = {}) {
    const count = opts.count ?? 3;
    const generateOpts = { ...opts };
    delete generateOpts.count;
    delete generateOpts.rankBy;

    const promises = Array.from({ length: count }, () =>
      this.generate(prompt, style, { ...generateOpts, temperature: (generateOpts.temperature ?? 0.7) + (Math.random() * 0.2 - 0.1) })
    );

    const results = await Promise.all(promises);

    if (opts.rankBy === 'length') {
      return results.sort((a, b) => b.content.length - a.content.length);
    }

    return results;
  }

  // ─── Refinement ──────────────────────────────────────────────────────────────

  /**
   * Refine existing content with instructions.
   * @param {string} content     - Original content
   * @param {string} instruction - Refinement instruction (e.g., "make it shorter", "add more examples")
   * @param {string} style
   * @param {object} opts
   */
  async refine(content, instruction, style = STYLES.PROSE, opts = {}) {
    const prompt = `Here is existing content:\n\n---\n${content}\n---\n\nPlease refine it with this instruction: ${instruction}`;
    return this.generate(prompt, style, opts);
  }

  // ─── Style config accessors ───────────────────────────────────────────────────

  listStyles() {
    return Object.values(STYLES);
  }

  getStyleConfig(style) {
    const resolved = STYLES[style.toUpperCase()] || style;
    return {
      style: resolved,
      systemPrompt: STYLE_PROMPTS[resolved] || null,
      modelPrefs: STYLE_MODEL_PREFS[resolved] || null,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _buildPromptText(promptObj) {
  const parts = [];
  if (promptObj.context) parts.push(`Context: ${promptObj.context}`);
  if (promptObj.text) parts.push(promptObj.text);
  if (promptObj.constraints) parts.push(`Constraints: ${promptObj.constraints}`);
  return parts.join('\n\n');
}

function _extractContent(response) {
  if (typeof response === 'string') return response;
  // OpenAI-style
  if (response.choices && response.choices[0]) {
    return response.choices[0].message?.content || response.choices[0].text || '';
  }
  // Anthropic-style
  if (response.content && Array.isArray(response.content)) {
    return response.content.map(c => c.text || '').join('');
  }
  if (response.content) return response.content;
  if (response.text) return response.text;
  if (response.output) return response.output;
  return JSON.stringify(response);
}

function _interpolateTemplate(template, variables) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (variables[key] !== undefined) return String(variables[key]);
    return `{{${key}}}`;  // leave unreplaced if not provided
  });
}

function _extractVariables(template) {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { CreativeEngine, STYLES, STYLE_PROMPTS, BUILT_IN_TEMPLATES };
