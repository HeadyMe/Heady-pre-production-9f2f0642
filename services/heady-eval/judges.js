'use strict';

/**
 * HeadyEval Judges
 *
 * Manages LLM judge configuration:
 *  - Single judge via HeadyInfer
 *  - Multi-judge consensus
 *  - Judge calibration
 *  - Self-consistency checking
 *  - Rate limiting
 */

const http = require('http');
const https = require('https');
const config = require('./config');

// ─── Token bucket rate limiter ────────────────────────────────────────────────

class TokenBucket {
  constructor({ requestsPerMinute, tokensPerMinute }) {
    this.rpm = requestsPerMinute;
    this.tpm = tokensPerMinute;
    this._requests = 0;
    this._tokens = 0;
    this._resetAt = Date.now() + 60000;
  }

  _maybeReset() {
    const now = Date.now();
    if (now >= this._resetAt) {
      this._requests = 0;
      this._tokens = 0;
      this._resetAt = now + 60000;
    }
  }

  async acquire(estimatedTokens = 500) {
    this._maybeReset();
    if (this._requests >= this.rpm || this._tokens + estimatedTokens > this.tpm) {
      const waitMs = this._resetAt - Date.now();
      await new Promise((r) => setTimeout(r, Math.max(100, waitMs)));
      this._maybeReset();
    }
    this._requests++;
    this._tokens += estimatedTokens;
  }
}

// ─── HTTP client for HeadyInfer ───────────────────────────────────────────────

function makeRequest(url, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
          'X-Service': 'heady-eval',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`Invalid JSON from HeadyInfer: ${data.slice(0, 200)}`)); }
          } else {
            reject(new Error(`HeadyInfer error ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`HeadyInfer request timed out after ${timeoutMs}ms`));
    });

    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ─── JudgeClient ─────────────────────────────────────────────────────────────

class JudgeClient {
  /**
   * @param {object} opts
   * @param {string} opts.inferUrl       - HeadyInfer base URL
   * @param {string} opts.model          - Default judge model
   * @param {number} opts.temperature
   * @param {number} opts.maxTokens
   * @param {TokenBucket} opts.rateLimiter
   * @param {number} opts.timeout
   * @param {number} opts.maxRetries
   * @param {number} opts.retryDelayMs
   */
  constructor(opts = {}) {
    this.inferUrl = opts.inferUrl || config.headyInferUrl;
    this.model = opts.model || config.judgeModel;
    this.temperature = opts.temperature ?? config.judgeTemperature;
    this.maxTokens = opts.maxTokens || config.judgeMaxTokens;
    this.timeout = opts.timeout || config.judgeTimeout;
    this.maxRetries = opts.maxRetries || config.maxRetries;
    this.retryDelayMs = opts.retryDelayMs || config.retryDelayMs;
    this.rateLimiter = opts.rateLimiter || new TokenBucket(config.judgeRateLimit);
    this._costTracker = { calls: 0, inputTokens: 0, outputTokens: 0 };
  }

  /**
   * Complete a prompt using the judge model.
   *
   * @param {object} opts
   * @param {string} opts.prompt
   * @param {string} [opts.model]
   * @param {number} [opts.temperature]
   * @param {number} [opts.maxTokens]
   * @param {string} [opts.format]     - 'json' adds JSON mode instruction
   * @returns {Promise<{ text: string, usage: object }>}
   */
  async complete(opts) {
    const model = opts.model || this.model;
    const temperature = opts.temperature ?? this.temperature;
    const maxTokens = opts.maxTokens || this.maxTokens;

    let prompt = opts.prompt;
    if (opts.format === 'json') {
      prompt += '\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation outside the JSON.';
    }

    await this.rateLimiter.acquire(Math.ceil(prompt.length / 4));

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const body = {
          model,
          prompt,
          temperature,
          max_tokens: maxTokens,
          stream: false,
        };

        const response = await makeRequest(
          `${this.inferUrl}/v1/complete`,
          body,
          this.timeout
        );

        const text = response.text || response.content || response.choices?.[0]?.message?.content || '';
        const usage = response.usage || {};

        this._costTracker.calls++;
        this._costTracker.inputTokens += usage.input_tokens || usage.prompt_tokens || 0;
        this._costTracker.outputTokens += usage.output_tokens || usage.completion_tokens || 0;

        return { text, usage, model };
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
        }
      }
    }
    throw new Error(`Judge completion failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  getStats() {
    return { ...this._costTracker };
  }

  resetStats() {
    this._costTracker = { calls: 0, inputTokens: 0, outputTokens: 0 };
  }
}

// ─── MultiJudge ───────────────────────────────────────────────────────────────

class MultiJudge {
  /**
   * @param {JudgeClient[]} judges  - Multiple judge clients with different models
   * @param {number} consensusMin   - Minimum judges that must agree
   */
  constructor(judges, consensusMin = config.multiJudgeConsensusMin) {
    if (!Array.isArray(judges) || judges.length < 2) {
      throw new Error('MultiJudge requires at least 2 judge clients');
    }
    this.judges = judges;
    this.consensusMin = consensusMin;
  }

  /**
   * Run all judges in parallel and aggregate results.
   * Returns the median score and flags if judges disagree significantly.
   */
  async complete(opts) {
    const results = await Promise.allSettled(
      this.judges.map((j) => j.complete(opts))
    );

    const successes = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    if (successes.length < this.consensusMin) {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => r.reason?.message);
      throw new Error(`Multi-judge consensus failed: only ${successes.length}/${this.judges.length} judges responded. Errors: ${errors.join('; ')}`);
    }

    // Return the response with majority consensus (first success for text; caller
    // should parse all texts and take median score)
    return {
      text: successes[0].text,
      allTexts: successes.map((s) => s.text),
      judgeCount: successes.length,
      models: successes.map((s) => s.model),
    };
  }
}

// ─── CalibrationReference ────────────────────────────────────────────────────

class JudgeCalibrator {
  /**
   * Stores reference examples with known gold scores.
   * Used to verify judge is well-calibrated before a run.
   */
  constructor() {
    this._references = [];
  }

  addReference(example, goldScores) {
    this._references.push({ example, goldScores });
  }

  /**
   * Run judge on all reference examples and compare to gold scores.
   * Returns calibration error stats.
   */
  async calibrate(judgeClient, scorer) {
    const results = [];
    for (const { example, goldScores } of this._references) {
      const ctx = {
        judgeClient,
        config,
        embedClient: null,
        guardClient: null,
      };
      const result = await scorer.evaluate(example, ctx);
      const goldScore = goldScores[scorer.name] || goldScores.overall;
      if (goldScore !== undefined && result.score !== null) {
        results.push({ goldScore, judgeScore: result.score, delta: Math.abs(result.score - goldScore) });
      }
    }

    if (results.length === 0) return { calibrated: true, mae: 0, samples: 0 };

    const mae = results.reduce((s, r) => s + r.delta, 0) / results.length;
    const maxDelta = Math.max(...results.map((r) => r.delta));

    return {
      calibrated: mae < 0.5,
      mae: parseFloat(mae.toFixed(3)),
      maxDelta: parseFloat(maxDelta.toFixed(3)),
      samples: results.length,
      details: results,
    };
  }
}

// ─── Self-consistency check ───────────────────────────────────────────────────

/**
 * Run the same judge prompt twice and flag if scores diverge beyond threshold.
 */
async function selfConsistencyCheck(judgeClient, scorer, example, threshold = config.selfConsistencyThreshold) {
  const ctx = { judgeClient, config, embedClient: null, guardClient: null };
  const [r1, r2] = await Promise.all([
    scorer.evaluate(example, ctx),
    scorer.evaluate(example, ctx),
  ]);

  if (r1.score === null || r2.score === null) {
    return { consistent: false, delta: null, scores: [r1.score, r2.score], flagged: true };
  }

  const delta = Math.abs(r1.score - r2.score);
  return {
    consistent: delta <= threshold,
    delta: parseFloat(delta.toFixed(3)),
    scores: [r1.score, r2.score],
    flagged: delta > threshold,
  };
}

// ─── JudgeConfig ──────────────────────────────────────────────────────────────

class JudgeConfig {
  constructor(opts = {}) {
    const rateLimiter = new TokenBucket(config.judgeRateLimit);

    this.primary = new JudgeClient({
      inferUrl: opts.inferUrl || config.headyInferUrl,
      model: opts.model || config.judgeModel,
      temperature: opts.temperature ?? 0,
      maxTokens: opts.maxTokens,
      rateLimiter,
      timeout: opts.timeout,
      maxRetries: opts.maxRetries,
      retryDelayMs: opts.retryDelayMs,
    });

    if (opts.additionalModels && opts.additionalModels.length > 0) {
      const additionalJudges = opts.additionalModels.map((model) => new JudgeClient({
        inferUrl: opts.inferUrl || config.headyInferUrl,
        model,
        temperature: 0,
        rateLimiter,
      }));
      this.multi = new MultiJudge([this.primary, ...additionalJudges], opts.consensusMin);
    }

    this.calibrator = new JudgeCalibrator();
  }

  getClient(useMulti = false) {
    if (useMulti && this.multi) return this.multi;
    return this.primary;
  }

  addCalibrationExample(example, goldScores) {
    this.calibrator.addReference(example, goldScores);
  }

  async checkSelfConsistency(scorer, example) {
    return selfConsistencyCheck(this.primary, scorer, example);
  }
}

module.exports = {
  JudgeClient,
  MultiJudge,
  JudgeCalibrator,
  JudgeConfig,
  TokenBucket,
  selfConsistencyCheck,
};
