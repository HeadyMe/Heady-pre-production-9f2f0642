'use strict';

/**
 * FaithfulnessScorer
 *
 * Evaluates whether an answer is grounded in the provided context.
 *
 * Algorithm:
 *  1. Extract individual claims from the answer (LLM)
 *  2. For each claim, verify it against the source context (LLM)
 *  3. faithfulness = verified_claims / total_claims
 *  4. Flag unsupported claims as hallucinations
 */

const BaseScorer = require('./base-scorer');

// ─── Prompts ────────────────────────────────────────────────────────────────

const CLAIM_EXTRACTION_PROMPT = `You are an expert at analyzing text and extracting atomic factual claims.

## Task
Break the following answer into individual atomic claims — simple, standalone factual statements that can be verified independently. Each claim should be one specific assertion.

## Answer
{answer}

## Instructions
- Extract every distinct factual claim, including implicit ones
- Make each claim self-contained (include necessary context from the answer)
- Do NOT include opinions, hedges ("might be"), or questions as claims
- If the answer is entirely an opinion or question, return an empty list

## Response Format (JSON only):
{
  "claims": [
    "claim 1",
    "claim 2",
    ...
  ]
}`;

const CLAIM_VERIFICATION_PROMPT = `You are an expert fact-checker. Determine whether a given claim is supported by the provided context.

## Context (source of truth)
{context}

## Claim to verify
{claim}

## Instructions
A claim is SUPPORTED if:
- It is explicitly stated in the context, OR
- It can be directly inferred from information in the context without additional assumptions

A claim is NOT SUPPORTED if:
- It contradicts the context
- It goes beyond what the context says (adds extra information not present)
- It cannot be verified from the context alone

## Response Format (JSON only):
{
  "supported": true | false,
  "confidence": 0.0-1.0,
  "evidence": "<quote from context that supports/refutes, or 'No evidence found'>",
  "explanation": "<one sentence reasoning>"
}`;

const BATCH_VERIFICATION_PROMPT = `You are an expert fact-checker. For each claim below, determine whether it is supported by the provided context.

## Context (source of truth)
{context}

## Claims to verify
{claims}

## Instructions
For each claim, determine if it is SUPPORTED (explicitly stated or directly inferable from context) or NOT SUPPORTED (contradicts, goes beyond, or cannot be verified from context).

## Response Format (JSON only):
{
  "verifications": [
    {
      "claim": "<original claim text>",
      "supported": true | false,
      "confidence": 0.0-1.0,
      "explanation": "<one sentence>"
    },
    ...
  ]
}`;

class FaithfulnessScorer extends BaseScorer {
  constructor(options = {}) {
    super('faithfulness', options);
    this.batchVerify = options.batchVerify !== false; // batch is faster
    this.maxClaims = options.maxClaims || 20;
  }

  async score(example, ctx) {
    const { output: answer } = example;
    const context = example.context || example.contexts?.join('\n\n') || '';

    if (!context.trim()) {
      return {
        score: null,
        breakdown: {},
        explanation: 'No context provided — faithfulness cannot be evaluated without source context.',
        metadata: { skipped: true, reason: 'no_context' },
      };
    }

    // Step 1: Extract claims from the answer
    const claims = await this._extractClaims(answer, ctx);

    if (claims.length === 0) {
      return {
        score: 5,
        breakdown: { verified_claims: 0, total_claims: 0, hallucination_count: 0 },
        explanation: 'No verifiable factual claims found in the answer.',
        metadata: { claims: [], verifications: [] },
      };
    }

    // Limit to maxClaims to control cost
    const claimsToCheck = claims.slice(0, this.maxClaims);

    // Step 2: Verify claims against context
    const verifications = await this._verifyClaims(claimsToCheck, context, ctx);

    // Step 3: Compute faithfulness score
    const verified = verifications.filter((v) => v.supported);
    const unsupported = verifications.filter((v) => !v.supported);
    const faithfulness = verifications.length > 0 ? verified.length / verifications.length : 1;

    // Scale 0–1 faithfulness to 1–5
    const score = this._probToScore(faithfulness);

    const hallucinations = unsupported.map((v) => ({
      claim: v.claim,
      explanation: v.explanation,
      confidence: v.confidence,
    }));

    return {
      score: this._clampScore(score),
      breakdown: {
        verified_claims: verified.length,
        total_claims: verifications.length,
        hallucination_count: unsupported.length,
        faithfulness_ratio: parseFloat(faithfulness.toFixed(4)),
      },
      explanation: this._buildExplanation(faithfulness, verified.length, verifications.length, hallucinations),
      metadata: {
        claims: claimsToCheck,
        verifications,
        hallucinations,
        truncated: claims.length > this.maxClaims,
        originalClaimCount: claims.length,
        judgeModel: ctx.config.judgeModel,
      },
    };
  }

  async _extractClaims(answer, ctx) {
    const prompt = CLAIM_EXTRACTION_PROMPT.replace('{answer}', answer);

    const response = await ctx.judgeClient.complete({
      prompt,
      model: ctx.config.judgeModel,
      temperature: 0,
      maxTokens: 1024,
      format: 'json',
    });

    const parsed = this._parseJSON(response.text);
    if (!parsed || !Array.isArray(parsed.claims)) return [];
    return parsed.claims.filter((c) => typeof c === 'string' && c.trim());
  }

  async _verifyClaims(claims, context, ctx) {
    if (this.batchVerify && claims.length > 1) {
      return this._batchVerifyClaims(claims, context, ctx);
    }
    // Sequential verification
    const results = [];
    for (const claim of claims) {
      const v = await this._verifySingleClaim(claim, context, ctx);
      results.push(v);
    }
    return results;
  }

  async _batchVerifyClaims(claims, context, ctx) {
    const claimsText = claims.map((c, i) => `${i + 1}. ${c}`).join('\n');
    const prompt = BATCH_VERIFICATION_PROMPT
      .replace('{context}', context)
      .replace('{claims}', claimsText);

    const response = await ctx.judgeClient.complete({
      prompt,
      model: ctx.config.judgeModel,
      temperature: 0,
      maxTokens: 2048,
      format: 'json',
    });

    const parsed = this._parseJSON(response.text);
    if (!parsed || !Array.isArray(parsed.verifications)) {
      // Fall back to individual verification
      return this._verifyClaims_sequential(claims, context, ctx);
    }

    // Merge with original claims (handle partial responses)
    return claims.map((claim, i) => {
      const v = parsed.verifications[i] || {};
      return {
        claim,
        supported: Boolean(v.supported),
        confidence: parseFloat(v.confidence) || 0.5,
        explanation: v.explanation || '',
      };
    });
  }

  async _verifySingleClaim(claim, context, ctx) {
    const prompt = CLAIM_VERIFICATION_PROMPT
      .replace('{context}', context)
      .replace('{claim}', claim);

    try {
      const response = await ctx.judgeClient.complete({
        prompt,
        model: ctx.config.judgeModel,
        temperature: 0,
        maxTokens: 256,
        format: 'json',
      });
      const parsed = this._parseJSON(response.text);
      return {
        claim,
        supported: parsed?.supported === true,
        confidence: parseFloat(parsed?.confidence) || 0.5,
        evidence: parsed?.evidence || '',
        explanation: parsed?.explanation || '',
      };
    } catch {
      return { claim, supported: false, confidence: 0, explanation: 'Verification error' };
    }
  }

  async _verifyClaims_sequential(claims, context, ctx) {
    const results = [];
    for (const claim of claims) {
      results.push(await this._verifySingleClaim(claim, context, ctx));
    }
    return results;
  }

  _buildExplanation(faithfulness, verified, total, hallucinations) {
    const pct = Math.round(faithfulness * 100);
    let msg = `${pct}% faithful — ${verified}/${total} claims are supported by the context.`;
    if (hallucinations.length > 0) {
      const examples = hallucinations.slice(0, 2).map((h) => `"${h.claim}"`).join('; ');
      msg += ` Unsupported claims: ${examples}${hallucinations.length > 2 ? ` (+${hallucinations.length - 2} more)` : ''}.`;
    }
    return msg;
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

FaithfulnessScorer.description = 'Evaluates whether the answer is grounded in the provided context using claim extraction and verification.';
FaithfulnessScorer.dimensions = ['verified_claims', 'total_claims', 'hallucination_count', 'faithfulness_ratio'];

module.exports = FaithfulnessScorer;
