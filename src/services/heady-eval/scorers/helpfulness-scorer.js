'use strict';

/**
 * HelpfulnessScorer
 *
 * Evaluates how helpful a response is to the user.
 *
 * Sub-dimensions:
 *  - task_completion:  Did the response complete what was asked?
 *  - actionability:   Does it provide actionable, usable information?
 *  - depth:           Appropriate level of detail for the question complexity
 *  - reference_match: How well does it match the reference answer (if provided)?
 */

const BaseScorer = require('./base-scorer');

const HELPFULNESS_PROMPT = `You are an expert evaluator assessing the HELPFULNESS of an AI assistant's response.

## User's Question / Task
{question}

## AI Response
{answer}

{reference_section}

## Evaluation Dimensions

### task_completion (1–5)
5 = Fully completes the task / answers every part of the question
4 = Addresses the main task with minor gaps
3 = Partially completes the task; some important parts missing
2 = Barely addresses the task; most of what was asked is missing
1 = Does not complete the task at all

### actionability (1–5)
5 = Highly actionable — user can immediately apply the information
4 = Mostly actionable with some vague points
3 = Mixed — some actionable content, some too vague
2 = Mostly vague or theoretical, hard to act on
1 = Not actionable at all (platitudes, irrelevant info)

### depth (1–5)
5 = Perfect depth for the complexity of the question — neither over- nor under-explained
4 = Good depth with minor issues (slightly too long/short)
3 = Adequate depth but noticeably too shallow or too verbose
2 = Significant mismatch in depth — much too shallow or bloated
1 = Extremely shallow (one word) or egregiously verbose/irrelevant

{reference_dimension}

## Response Format (JSON only):
{
  "task_completion": <1-5>,
  "actionability": <1-5>,
  "depth": <1-5>,
  {reference_json_field}
  "overall_helpfulness": <1-5>,
  "improvement_suggestions": ["<suggestion 1>", ...],
  "reasoning": "<concise explanation, 2–3 sentences>"
}`;

const REFERENCE_SECTION = `## Reference Answer (ground truth)
{reference}`;

const REFERENCE_DIMENSION = `### reference_match (1–5)
5 = The response conveys all the same key information as the reference answer
4 = Captures most key information with minor omissions
3 = Covers roughly half of the reference's key points
2 = Misses most of the reference's key content
1 = Completely different from the reference answer`;

class HelpfulnessScorer extends BaseScorer {
  constructor(options = {}) {
    super('helpfulness', options);
  }

  async score(example, ctx) {
    const { input: question, output: answer } = example;
    const hasReference = typeof example.expected_output === 'string' && example.expected_output.trim();

    const result = await this._llmJudge(question, answer, example.expected_output || null, ctx);

    const breakdown = {
      task_completion: result.task_completion,
      actionability: result.actionability,
      depth: result.depth,
    };
    if (hasReference) {
      breakdown.reference_match = result.reference_match;
    }

    // Weighted average
    const weights = hasReference
      ? { task_completion: 0.35, actionability: 0.25, depth: 0.20, reference_match: 0.20 }
      : { task_completion: 0.40, actionability: 0.35, depth: 0.25 };

    const weighted = Object.entries(weights).reduce((sum, [dim, w]) => {
      return sum + (breakdown[dim] || 1) * w;
    }, 0);

    return {
      score: this._clampScore(weighted),
      breakdown,
      explanation: result.reasoning,
      metadata: {
        improvement_suggestions: result.improvement_suggestions,
        llm_overall: result.overall_helpfulness,
        has_reference: hasReference,
        judgeModel: ctx.config.judgeModel,
      },
    };
  }

  async _llmJudge(question, answer, reference, ctx) {
    const hasRef = reference && reference.trim();

    let prompt = HELPFULNESS_PROMPT
      .replace('{question}', question)
      .replace('{answer}', answer);

    if (hasRef) {
      prompt = prompt
        .replace('{reference_section}', REFERENCE_SECTION.replace('{reference}', reference))
        .replace('{reference_dimension}', REFERENCE_DIMENSION)
        .replace('{reference_json_field}', '"reference_match": <1-5>,');
    } else {
      prompt = prompt
        .replace('{reference_section}', '')
        .replace('{reference_dimension}', '')
        .replace('{reference_json_field}', '');
    }

    const response = await ctx.judgeClient.complete({
      prompt,
      model: ctx.config.judgeModel,
      temperature: 0,
      maxTokens: 512,
      format: 'json',
    });

    const parsed = this._parseJSON(response.text);
    if (!parsed) throw new Error('Helpfulness judge returned invalid JSON');

    return {
      task_completion: this._clampScore(Number(parsed.task_completion) || 1),
      actionability: this._clampScore(Number(parsed.actionability) || 1),
      depth: this._clampScore(Number(parsed.depth) || 1),
      reference_match: hasRef ? this._clampScore(Number(parsed.reference_match) || 1) : null,
      overall_helpfulness: this._clampScore(Number(parsed.overall_helpfulness) || 1),
      improvement_suggestions: Array.isArray(parsed.improvement_suggestions) ? parsed.improvement_suggestions : [],
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

HelpfulnessScorer.description = 'Evaluates task completion, actionability, and depth of responses, with optional comparison to a reference answer.';
HelpfulnessScorer.dimensions = ['task_completion', 'actionability', 'depth', 'reference_match'];

module.exports = HelpfulnessScorer;
