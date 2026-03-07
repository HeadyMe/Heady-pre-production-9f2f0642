'use strict';

/**
 * CustomScorer — Factory for creating LLM-as-judge scorers from user-defined rubrics.
 *
 * Usage:
 *   const MyScorer = CustomScorer.create({
 *     name: 'conciseness',
 *     description: 'Evaluates response conciseness',
 *     dimensions: ['brevity', 'information_density'],
 *     rubric: {
 *       5: 'Perfectly concise, no unnecessary words',
 *       4: 'Mostly concise with minor verbosity',
 *       3: 'Adequate but could be shorter',
 *       2: 'Noticeably verbose',
 *       1: 'Extremely verbose or padded',
 *     },
 *     dimensionPrompts: {
 *       brevity: 'How brief and to-the-point is the response?',
 *       information_density: 'How much useful information per word?',
 *     },
 *   });
 */

const BaseScorer = require('./base-scorer');

// Template for custom judge prompts
const CUSTOM_PROMPT_TEMPLATE = `You are an expert evaluator assessing an AI assistant's response on the dimension: {dimension_name}.

## User's Question
{question}

## AI Response
{answer}

{reference_block}

## Scoring Rubric
{rubric_text}

{dimension_prompts_block}

## Response Format (JSON only):
{
  {dimension_scores}
  "overall_score": <1-5>,
  "reasoning": "<concise explanation, 1–3 sentences>"
}`;

class CustomScorer extends BaseScorer {
  /**
   * @param {object} definition
   * @param {string}   definition.name              - Unique scorer name
   * @param {string}   [definition.description]     - Human-readable description
   * @param {string[]} [definition.dimensions]      - Sub-dimension names to score
   * @param {object}   [definition.rubric]          - { 1: text, 2: text, ..., 5: text }
   * @param {object}   [definition.dimensionPrompts]- { dimName: 'Evaluate X...' }
   * @param {string}   [definition.judgePrompt]     - Full custom prompt (overrides template)
   * @param {number}   [definition.passThreshold]   - Score threshold for pass/fail
   * @param {object}   [options]                    - BaseScorer options
   */
  constructor(definition, options = {}) {
    super(definition.name, { ...options, passThreshold: definition.passThreshold });
    this.definition = definition;

    // Build the prompt once at construction time for efficiency
    this._compiledPrompt = definition.judgePrompt || this._buildPrompt(definition);
  }

  async score(example, ctx) {
    const { input: question, output: answer } = example;
    const reference = example.expected_output || null;

    const prompt = this._compiledPrompt
      .replace('{question}', question)
      .replace('{answer}', answer)
      .replace('{reference_block}', reference
        ? `## Reference Answer\n${reference}`
        : '');

    const response = await ctx.judgeClient.complete({
      prompt,
      model: ctx.config.judgeModel,
      temperature: 0,
      maxTokens: 512,
      format: 'json',
    });

    const parsed = this._parseJSON(response.text);
    if (!parsed) throw new Error(`Custom scorer '${this.name}' judge returned invalid JSON`);

    const dimensions = this.definition.dimensions || [];
    const breakdown = {};
    for (const dim of dimensions) {
      breakdown[dim] = this._clampScore(Number(parsed[dim]) || 1);
    }

    const overall = this._clampScore(Number(parsed.overall_score) || 1);

    return {
      score: overall,
      breakdown,
      explanation: String(parsed.reasoning || ''),
      metadata: {
        custom: true,
        scorerDefinition: this.definition.name,
        judgeModel: ctx.config.judgeModel,
      },
    };
  }

  _buildPrompt(def) {
    const rubricText = Object.entries(def.rubric || {})
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([score, text]) => `**Score ${score}:** ${text}`)
      .join('\n\n');

    const dimensions = def.dimensions || [];
    const dimPromptsBlock = dimensions.length && def.dimensionPrompts
      ? `## Sub-dimension Instructions\n${dimensions.map((d) =>
          `- **${d}**: ${def.dimensionPrompts[d] || `Score the response's ${d}`}`
        ).join('\n')}`
      : '';

    const dimScores = dimensions
      .map((d) => `"${d}": <1-5>,`)
      .join('\n  ');

    return CUSTOM_PROMPT_TEMPLATE
      .replace('{dimension_name}', def.name)
      .replace('{rubric_text}', rubricText || 'Score 1–5 from worst to best.')
      .replace('{dimension_prompts_block}', dimPromptsBlock)
      .replace('{dimension_scores}', dimScores);
  }

  _parseJSON(text) {
    try {
      return JSON.parse(text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim());
    } catch {
      const match = text.match(/\{[\s\S]+\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }

  describe() {
    return {
      ...super.describe(),
      description: this.definition.description || `Custom scorer: ${this.name}`,
      dimensions: this.definition.dimensions || [],
      custom: true,
      rubric: this.definition.rubric || null,
    };
  }
}

/**
 * Factory method: create a custom scorer class definition.
 *
 * @param {object} definition - Same shape as CustomScorer constructor's first arg
 * @returns {object} - An instance ready for evaluation
 */
CustomScorer.create = function(definition, options = {}) {
  if (!definition || !definition.name) {
    throw new Error('CustomScorer.create() requires a definition with at least a name');
  }
  if (!definition.rubric && !definition.judgePrompt) {
    throw new Error('CustomScorer.create() requires either a rubric or a judgePrompt');
  }
  return new CustomScorer(definition, options);
};

CustomScorer.description = 'Factory for creating LLM-as-judge scorers from custom rubrics and criteria.';
CustomScorer.dimensions = [];

module.exports = CustomScorer;
