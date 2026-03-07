'use strict';

/**
 * CoherenceScorer
 *
 * Evaluates the logical coherence and readability of a response.
 *
 * Sub-dimensions:
 *  - logical_consistency: No internal contradictions
 *  - grammar_readability:  Correct grammar, clear sentences
 *  - structure:            Well-organized, follows logical flow
 *  - contradiction_free:   No claims that contradict each other
 */

const BaseScorer = require('./base-scorer');

const COHERENCE_JUDGE_PROMPT = `You are an expert writing evaluator assessing the COHERENCE of an AI-generated response.

## Question asked
{question}

## Response to evaluate
{answer}

## Scoring Rubric (1–5 for each dimension)

### logical_consistency (1–5)
5 = All statements are logically consistent; ideas flow naturally from each other
4 = Mostly consistent with minor awkward transitions
3 = Some logical gaps or weak connections between ideas
2 = Multiple inconsistencies or poor logical flow
1 = Incoherent, contradictory, or nonsensical

### grammar_readability (1–5)
5 = Flawless grammar, clear and easy to read
4 = Minor grammatical issues that don't impede comprehension
3 = Noticeable errors or awkward phrasing but still understandable
2 = Frequent errors that make reading difficult
1 = Very poor grammar, nearly unreadable

### structure (1–5)
5 = Excellently organized with clear intro/body/conclusion or logical sections
4 = Good structure with minor organizational issues
3 = Adequate structure but could be better organized
2 = Poor structure, ideas are jumbled or hard to follow
1 = No discernible structure

### contradiction_free (1–5)
5 = No contradictions at all
4 = Extremely minor apparent contradictions (easily explained)
3 = One notable contradiction
2 = Multiple contradictions
1 = Severely contradictory statements

## Response Format (JSON only):
{
  "logical_consistency": <1-5>,
  "grammar_readability": <1-5>,
  "structure": <1-5>,
  "contradiction_free": <1-5>,
  "overall_coherence": <1-5>,
  "contradictions_found": ["<contradiction 1>", ...],
  "reasoning": "<concise explanation, 2–3 sentences>"
}

If you find no contradictions, set contradictions_found to an empty array [].`;

const DIMENSION_WEIGHTS = {
  logical_consistency: 0.30,
  grammar_readability: 0.25,
  structure: 0.25,
  contradiction_free: 0.20,
};

class CoherenceScorer extends BaseScorer {
  constructor(options = {}) {
    super('coherence', options);
    this.weights = options.weights || DIMENSION_WEIGHTS;
  }

  async score(example, ctx) {
    const { input: question, output: answer } = example;

    const result = await this._llmJudge(question, answer, ctx);

    // Compute weighted score from sub-dimensions
    const weighted = Object.entries(this.weights).reduce((sum, [dim, weight]) => {
      return sum + (result[dim] || 1) * weight;
    }, 0);

    return {
      score: this._clampScore(weighted),
      breakdown: {
        logical_consistency: result.logical_consistency,
        grammar_readability: result.grammar_readability,
        structure: result.structure,
        contradiction_free: result.contradiction_free,
      },
      explanation: result.reasoning,
      metadata: {
        contradictions_found: result.contradictions_found,
        llm_overall: result.overall_coherence,
        judgeModel: ctx.config.judgeModel,
      },
    };
  }

  async _llmJudge(question, answer, ctx) {
    const prompt = COHERENCE_JUDGE_PROMPT
      .replace('{question}', question)
      .replace('{answer}', answer);

    const response = await ctx.judgeClient.complete({
      prompt,
      model: ctx.config.judgeModel,
      temperature: 0,
      maxTokens: 512,
      format: 'json',
    });

    const parsed = this._parseJSON(response.text);
    if (!parsed) throw new Error('Coherence judge returned invalid JSON');

    return {
      logical_consistency: this._clampScore(Number(parsed.logical_consistency) || 1),
      grammar_readability: this._clampScore(Number(parsed.grammar_readability) || 1),
      structure: this._clampScore(Number(parsed.structure) || 1),
      contradiction_free: this._clampScore(Number(parsed.contradiction_free) || 1),
      overall_coherence: this._clampScore(Number(parsed.overall_coherence) || 1),
      contradictions_found: Array.isArray(parsed.contradictions_found) ? parsed.contradictions_found : [],
      reasoning: String(parsed.reasoning || ''),
    };
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
}

CoherenceScorer.description = 'Evaluates logical consistency, grammar, structure, and contradiction-freedom of responses.';
CoherenceScorer.dimensions = ['logical_consistency', 'grammar_readability', 'structure', 'contradiction_free'];

module.exports = CoherenceScorer;
