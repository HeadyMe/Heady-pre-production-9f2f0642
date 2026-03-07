'use strict';

/**
 * RelevanceScorer
 *
 * Evaluates how relevant the answer is to the question using:
 *  1. Semantic similarity via HeadyEmbed cosine similarity
 *  2. LLM-as-judge with a structured 1–5 rubric
 *
 * Sub-dimensions: topic_relevance, specificity, completeness
 */

const BaseScorer = require('./base-scorer');

const JUDGE_PROMPT = `You are an expert evaluator assessing the RELEVANCE of an AI assistant's answer to a user's question.

## Task
Score the answer's relevance on a 1–5 scale using the rubric below.

## Question
{question}

## Answer
{answer}

## Scoring Rubric

**Score 5 — Highly Relevant:**
The answer directly addresses the question. Every sentence contributes to answering it. No off-topic content. Covers all key aspects the question asks about.

**Score 4 — Mostly Relevant:**
The answer addresses the main question but may include minor tangents or miss one secondary aspect. Core information is on-topic.

**Score 3 — Partially Relevant:**
The answer addresses part of the question but misses significant aspects, or includes substantial off-topic content. A reader would get some useful information.

**Score 2 — Minimally Relevant:**
The answer touches the topic superficially or mostly discusses related but different subjects. The user's core question is largely unanswered.

**Score 1 — Not Relevant:**
The answer does not address the question. It is off-topic, about a completely different subject, or is a non-answer (e.g., "I don't know" with no useful content).

## Sub-dimensions to evaluate:
- **topic_relevance** (1–5): Does the answer stay on the topic of the question?
- **specificity** (1–5): Is the answer specific to the details asked, or vague/generic?
- **completeness** (1–5): Does the answer cover all aspects of the question?

## Response Format (JSON only, no other text):
{
  "topic_relevance": <1-5>,
  "specificity": <1-5>,
  "completeness": <1-5>,
  "overall_score": <1-5>,
  "reasoning": "<concise explanation, 1–3 sentences>"
}`;

const COSINE_WEIGHT = 0.3;
const LLM_WEIGHT = 0.7;

class RelevanceScorer extends BaseScorer {
  constructor(options = {}) {
    super('relevance', options);
    this.cosineWeight = options.cosineWeight ?? COSINE_WEIGHT;
    this.llmWeight = options.llmWeight ?? LLM_WEIGHT;
    this.useSemantic = options.useSemantic !== false;
  }

  async score(example, ctx) {
    const { input: question, output: answer } = example;
    const results = await Promise.allSettled([
      this._llmJudge(question, answer, ctx),
      this.useSemantic ? this._semanticSimilarity(question, answer, ctx) : Promise.resolve(null),
    ]);

    const llmResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const semanticScore = results[1].status === 'fulfilled' ? results[1].value : null;

    // If LLM judge fails entirely, fall back to semantic only
    if (!llmResult) {
      const fallbackScore = semanticScore !== null ? this._probToScore(semanticScore) : 1;
      return {
        score: fallbackScore,
        breakdown: { semantic_similarity: semanticScore !== null ? this._probToScore(semanticScore) : null },
        explanation: `LLM judge unavailable. Semantic similarity score: ${semanticScore?.toFixed(3) ?? 'N/A'}`,
        metadata: { method: 'semantic_only', semanticScore },
      };
    }

    let finalScore = llmResult.overall_score;

    // Blend semantic similarity if available
    if (semanticScore !== null) {
      const semanticScaled = this._probToScore(semanticScore);
      finalScore = this.llmWeight * llmResult.overall_score + this.cosineWeight * semanticScaled;
    }

    return {
      score: this._clampScore(finalScore),
      breakdown: {
        topic_relevance: llmResult.topic_relevance,
        specificity: llmResult.specificity,
        completeness: llmResult.completeness,
        ...(semanticScore !== null && { semantic_similarity: this._probToScore(semanticScore) }),
      },
      explanation: llmResult.reasoning,
      metadata: {
        method: semanticScore !== null ? 'hybrid' : 'llm_judge',
        semanticScore,
        llmScore: llmResult.overall_score,
        judgeModel: ctx.config.judgeModel,
      },
    };
  }

  async _llmJudge(question, answer, ctx) {
    const prompt = JUDGE_PROMPT
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
    if (!parsed) throw new Error('Judge returned invalid JSON');

    return {
      topic_relevance: this._clampScore(Number(parsed.topic_relevance) || 1),
      specificity: this._clampScore(Number(parsed.specificity) || 1),
      completeness: this._clampScore(Number(parsed.completeness) || 1),
      overall_score: this._clampScore(Number(parsed.overall_score) || 1),
      reasoning: String(parsed.reasoning || ''),
    };
  }

  async _semanticSimilarity(question, answer, ctx) {
    try {
      const [qEmbed, aEmbed] = await Promise.all([
        ctx.embedClient.embed(question),
        ctx.embedClient.embed(answer),
      ]);
      return this._cosine(qEmbed, aEmbed);
    } catch {
      return null;
    }
  }

  _cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
  }

  _parseJSON(text) {
    try {
      // Strip markdown code blocks if present
      const cleaned = text.replace(/```(?:json)?\n?/g, '').replace(/```$/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      // Try to find JSON object in text
      const match = text.match(/\{[\s\S]+\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }
}

RelevanceScorer.description = 'Evaluates how relevant the answer is to the question using semantic similarity and LLM-as-judge.';
RelevanceScorer.dimensions = ['topic_relevance', 'specificity', 'completeness'];

module.exports = RelevanceScorer;
