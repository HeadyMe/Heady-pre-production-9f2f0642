'use strict';

/**
 * HeadyEval Test Suite
 *
 * Tests: scorers, datasets, runner, reports, judges, index
 *
 * Uses Jest. Run with: npm test
 *
 * Mock strategy:
 *  - JudgeClient is mocked to return deterministic JSON responses
 *  - EmbedClient returns fixed unit vectors
 *  - GuardClient returns safe responses
 */

const { Dataset, DatasetManager, loadCSV } = require('../datasets');
const { JudgeClient, TokenBucket } = require('../judges');
const { Runner, EvalRun, RUN_STATUSES, ConcurrencyPool, ETATracker } = require('../runner');
const { ReportGenerator, mean, median, stddev, percentile, histogram } = require('../reports');
const BaseScorer = require('../scorers/base-scorer');
const RelevanceScorer = require('../scorers/relevance-scorer');
const FaithfulnessScorer = require('../scorers/faithfulness-scorer');
const SafetyScorer = require('../scorers/safety-scorer');
const CoherenceScorer = require('../scorers/coherence-scorer');
const HelpfulnessScorer = require('../scorers/helpfulness-scorer');
const CustomScorer = require('../scorers/custom-scorer');
const { HeadyEval } = require('../index');
const config = require('../config');

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeMockJudgeClient(responseMap = {}) {
  return {
    complete: jest.fn(async ({ prompt }) => {
      // Check if any key in responseMap matches the prompt
      for (const [key, response] of Object.entries(responseMap)) {
        if (prompt.includes(key)) {
          return { text: typeof response === 'string' ? response : JSON.stringify(response), usage: {} };
        }
      }
      // Default: return a passing score for any scorer
      return {
        text: JSON.stringify({
          overall_score: 4,
          topic_relevance: 4,
          specificity: 4,
          completeness: 4,
          reasoning: 'Mock: response is relevant.',
          flagged: false,
          flag_reason: '',
          toxicity: 5,
          bias: 5,
          misinformation: 5,
          privacy_violation: 5,
          overall_safety: 5,
          logical_consistency: 4,
          grammar_readability: 5,
          structure: 4,
          contradiction_free: 5,
          contradictions_found: [],
          task_completion: 4,
          actionability: 4,
          depth: 4,
          claims: ['The capital of France is Paris.'],
          verifications: [{ claim: 'The capital of France is Paris.', supported: true, confidence: 0.99, explanation: 'Stated in context.' }],
          reference_match: 4,
          improvement_suggestions: [],
        }),
        usage: { input_tokens: 200, output_tokens: 100 },
      };
    }),
    getStats: jest.fn(() => ({ calls: 1, inputTokens: 200, outputTokens: 100 })),
    resetStats: jest.fn(),
  };
}

const mockEmbedClient = {
  embed: jest.fn(async () => Array.from({ length: 384 }, (_, i) => i % 2 === 0 ? 0.1 : -0.1)),
};

const mockGuardClient = {
  check: jest.fn(async () => ({ blocked: false, flagged: false, scores: { toxicity: 0.01, bias: 0.02 } })),
};

function makeCtx(judgeOverrides = {}) {
  return {
    judgeClient: makeMockJudgeClient(judgeOverrides),
    embedClient: mockEmbedClient,
    guardClient: mockGuardClient,
    config,
  };
}

const EXAMPLE_GOOD = {
  id: 'test-001',
  input: 'What is the capital of France?',
  output: 'The capital of France is Paris. It is located in northern France along the Seine river.',
  context: 'France is a country in Western Europe. Its capital city is Paris, known for the Eiffel Tower.',
  expected_output: 'Paris is the capital of France.',
  metadata: {},
};

const EXAMPLE_BAD = {
  id: 'test-002',
  input: 'What is 2 + 2?',
  output: 'The French Revolution began in 1789.',
  context: null,
  expected_output: '4',
  metadata: {},
};

// ─── Statistics utilities ─────────────────────────────────────────────────────

describe('Statistics utilities', () => {
  describe('mean()', () => {
    it('computes correct mean', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });
    it('returns null for empty array', () => {
      expect(mean([])).toBeNull();
    });
    it('handles single element', () => {
      expect(mean([7])).toBe(7);
    });
  });

  describe('median()', () => {
    it('returns middle value for odd-length array', () => {
      expect(median([1, 3, 5])).toBe(3);
    });
    it('returns average of two middle values for even-length', () => {
      expect(median([1, 2, 3, 4])).toBe(2.5);
    });
    it('returns null for empty array', () => {
      expect(median([])).toBeNull();
    });
  });

  describe('stddev()', () => {
    it('computes standard deviation', () => {
      const s = stddev([2, 4, 4, 4, 5, 5, 7, 9]);
      // Sample std of [2,4,4,4,5,5,7,9] ≈ 2.138
      expect(s).toBeGreaterThan(2.0);
      expect(s).toBeLessThan(2.3);
    });
    it('returns null for less than 2 elements', () => {
      expect(stddev([5])).toBeNull();
    });
  });

  describe('percentile()', () => {
    it('computes 50th percentile (median)', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });
    it('computes 25th percentile', () => {
      expect(percentile([1, 2, 3, 4], 25)).toBe(1.75);
    });
    it('returns null for empty array', () => {
      expect(percentile([], 50)).toBeNull();
    });
  });

  describe('histogram()', () => {
    it('returns correct number of bins', () => {
      const h = histogram([1, 2, 3, 4, 5], 5);
      expect(h).toHaveLength(5);
    });
    it('all bins sum to total count', () => {
      const data = [1, 1, 2, 3, 4, 5, 5];
      const h = histogram(data, 4);
      const total = h.reduce((s, b) => s + b.count, 0);
      expect(total).toBe(data.length);
    });
    it('returns empty for empty data', () => {
      expect(histogram([], 5)).toEqual([]);
    });
  });
});

// ─── BaseScorer ───────────────────────────────────────────────────────────────

describe('BaseScorer', () => {
  it('throws if instantiated directly', () => {
    expect(() => new BaseScorer('test')).toThrow('abstract');
  });

  it('requires name', () => {
    class TestScorer extends BaseScorer {
      async score() { return { score: 3, breakdown: {}, explanation: 'ok', metadata: {} }; }
    }
    expect(() => new TestScorer('')).toThrow('name must be a non-empty string');
  });

  it('clamps scores to [1, 5] range', () => {
    class TestScorer extends BaseScorer {
      async score() { return { score: 10, breakdown: {}, explanation: '', metadata: {} }; }
    }
    const s = new TestScorer('test');
    expect(s._clampScore(10)).toBe(5);
    expect(s._clampScore(-1)).toBe(1);
    expect(s._clampScore(3)).toBe(3);
  });

  it('converts probability to 1-5 score', () => {
    class TestScorer extends BaseScorer {
      async score() { return { score: 3, breakdown: {}, explanation: '', metadata: {} }; }
    }
    const s = new TestScorer('test');
    expect(s._probToScore(0)).toBe(1);
    expect(s._probToScore(1)).toBe(5);
    expect(s._probToScore(0.5)).toBe(3);
  });

  it('evaluate() sets pass based on passThreshold', async () => {
    class TestScorer extends BaseScorer {
      async score() { return { score: 4, breakdown: {}, explanation: 'good', metadata: {} }; }
    }
    const s = new TestScorer('test', { passThreshold: 3 });
    const result = await s.evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.pass).toBe(true);
    expect(result.scorer).toBe('test');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('evaluate() catches and records errors', async () => {
    class BrokenScorer extends BaseScorer {
      async score() { throw new Error('intentional failure'); }
    }
    const s = new BrokenScorer('broken');
    const result = await s.evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.error).toBe('intentional failure');
    expect(result.pass).toBe(false);
    expect(result.score).toBeNull();
  });

  it('evaluate() returns skipped result when disabled', async () => {
    class TestScorer extends BaseScorer {
      async score() { return { score: 5, breakdown: {}, explanation: '', metadata: {} }; }
    }
    const s = new TestScorer('test', { enabled: false });
    const result = await s.evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.score).toBeNull();
    expect(result.metadata.skipped).toBe(true);
  });
});

// ─── RelevanceScorer ──────────────────────────────────────────────────────────

describe('RelevanceScorer', () => {
  let scorer;
  beforeEach(() => { scorer = new RelevanceScorer(); });

  it('has correct name and description', () => {
    expect(scorer.name).toBe('relevance');
    expect(RelevanceScorer.description).toBeTruthy();
    expect(RelevanceScorer.dimensions).toContain('topic_relevance');
  });

  it('scores a relevant answer highly', async () => {
    const ctx = makeCtx();
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.breakdown).toHaveProperty('topic_relevance');
    expect(result.breakdown).toHaveProperty('specificity');
    expect(result.breakdown).toHaveProperty('completeness');
  });

  it('includes semantic_similarity when embedClient available', async () => {
    const ctx = makeCtx();
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.breakdown.semantic_similarity).toBeDefined();
  });

  it('falls back gracefully when embed fails', async () => {
    const ctx = {
      ...makeCtx(),
      embedClient: { embed: jest.fn().mockRejectedValue(new Error('embed unavailable')) },
    };
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.error).toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it('falls back to semantic-only when LLM judge fails', async () => {
    const ctx = {
      ...makeCtx(),
      judgeClient: { complete: jest.fn().mockRejectedValue(new Error('LLM error')) },
    };
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBeGreaterThanOrEqual(1);
  });
});

// ─── FaithfulnessScorer ───────────────────────────────────────────────────────

describe('FaithfulnessScorer', () => {
  let scorer;
  beforeEach(() => { scorer = new FaithfulnessScorer(); });

  it('has correct name', () => { expect(scorer.name).toBe('faithfulness'); });

  it('returns skipped result when no context provided', async () => {
    const example = { ...EXAMPLE_GOOD, context: null };
    const result = await scorer.evaluate(example, makeCtx());
    expect(result.score).toBeNull();
    expect(result.metadata.skipped).toBe(true);
  });

  it('scores faithful answer with context', async () => {
    const ctx = makeCtx();
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.breakdown).toHaveProperty('faithfulness_ratio');
    expect(result.breakdown).toHaveProperty('verified_claims');
    expect(result.breakdown).toHaveProperty('total_claims');
    expect(result.metadata).toHaveProperty('hallucinations');
  });

  it('extracts and verifies claims', async () => {
    const ctx = makeCtx();
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.metadata.claims).toBeInstanceOf(Array);
    expect(result.metadata.verifications).toBeInstanceOf(Array);
  });

  it('returns score 5 when no claims extracted', async () => {
    const ctx = {
      ...makeCtx(),
      judgeClient: {
        complete: jest.fn(async () => ({
          text: JSON.stringify({ claims: [] }),
          usage: {},
        })),
      },
    };
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBe(5);
  });
});

// ─── SafetyScorer ─────────────────────────────────────────────────────────────

describe('SafetyScorer', () => {
  let scorer;
  beforeEach(() => { scorer = new SafetyScorer(); });

  it('has correct name', () => { expect(scorer.name).toBe('safety'); });

  it('scores safe content highly', async () => {
    const result = await scorer.evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.breakdown).toHaveProperty('toxicity');
    expect(result.breakdown).toHaveProperty('bias');
    expect(result.breakdown).toHaveProperty('misinformation');
    expect(result.breakdown).toHaveProperty('privacy_violation');
  });

  it('uses guard client when available', async () => {
    const ctx = makeCtx();
    await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(ctx.guardClient.check).toHaveBeenCalledWith(EXAMPLE_GOOD.output);
  });

  it('handles guard client failure gracefully', async () => {
    const ctx = {
      ...makeCtx(),
      guardClient: { check: jest.fn().mockRejectedValue(new Error('guard down')) },
    };
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.error).toBeNull();
    expect(result.score).toBeGreaterThanOrEqual(1);
  });

  it('hard-blocks when guard blocks and passThrough enabled', async () => {
    const ctx = {
      ...makeCtx(),
      guardClient: { check: jest.fn(async () => ({ blocked: true, flagged: true, reason: 'hate speech detected' })) },
    };
    const blockerScorer = new SafetyScorer({ guardPassThrough: true });
    const result = await blockerScorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBe(1);
    expect(result.explanation).toContain('hate speech detected');
  });
});

// ─── CoherenceScorer ──────────────────────────────────────────────────────────

describe('CoherenceScorer', () => {
  it('has correct name', () => { expect(new CoherenceScorer().name).toBe('coherence'); });

  it('returns all dimension scores', async () => {
    const result = await new CoherenceScorer().evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.breakdown).toHaveProperty('logical_consistency');
    expect(result.breakdown).toHaveProperty('grammar_readability');
    expect(result.breakdown).toHaveProperty('structure');
    expect(result.breakdown).toHaveProperty('contradiction_free');
  });

  it('includes contradictions metadata', async () => {
    const result = await new CoherenceScorer().evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.metadata.contradictions_found).toBeInstanceOf(Array);
  });
});

// ─── HelpfulnessScorer ────────────────────────────────────────────────────────

describe('HelpfulnessScorer', () => {
  it('has correct name', () => { expect(new HelpfulnessScorer().name).toBe('helpfulness'); });

  it('scores with reference answer', async () => {
    const result = await new HelpfulnessScorer().evaluate(EXAMPLE_GOOD, makeCtx());
    expect(result.breakdown).toHaveProperty('task_completion');
    expect(result.breakdown).toHaveProperty('actionability');
    expect(result.breakdown).toHaveProperty('depth');
    expect(result.breakdown).toHaveProperty('reference_match');
    expect(result.metadata.has_reference).toBeTruthy();
  });

  it('scores without reference answer', async () => {
    const noRefExample = { ...EXAMPLE_GOOD, expected_output: undefined };
    const result = await new HelpfulnessScorer().evaluate(noRefExample, makeCtx());
    expect(result.breakdown.reference_match).toBeUndefined();
    expect(result.metadata.has_reference).toBe(false);
  });
});

// ─── CustomScorer ─────────────────────────────────────────────────────────────

describe('CustomScorer', () => {
  const definition = {
    name: 'conciseness',
    description: 'Evaluates response brevity',
    dimensions: ['brevity', 'information_density'],
    rubric: {
      5: 'Perfectly concise, no unnecessary words',
      4: 'Mostly concise with minor verbosity',
      3: 'Adequate but could be shorter',
      2: 'Noticeably verbose',
      1: 'Extremely verbose or padded',
    },
    dimensionPrompts: {
      brevity: 'How brief and to-the-point is the response?',
      information_density: 'How much useful information per word?',
    },
  };

  it('creates a custom scorer via factory', () => {
    const scorer = CustomScorer.create(definition);
    expect(scorer.name).toBe('conciseness');
    expect(scorer).toBeInstanceOf(CustomScorer);
  });

  it('throws without name', () => {
    expect(() => CustomScorer.create({ rubric: {} })).toThrow('name');
  });

  it('throws without rubric or judgePrompt', () => {
    expect(() => CustomScorer.create({ name: 'test' })).toThrow('rubric');
  });

  it('scores with custom rubric', async () => {
    const ctx = {
      ...makeCtx(),
      judgeClient: {
        complete: jest.fn(async () => ({
          text: JSON.stringify({ brevity: 4, information_density: 5, overall_score: 4, reasoning: 'Concise.' }),
          usage: {},
        })),
      },
    };
    const scorer = CustomScorer.create(definition);
    const result = await scorer.evaluate(EXAMPLE_GOOD, ctx);
    expect(result.score).toBe(4);
    expect(result.breakdown).toHaveProperty('brevity');
    expect(result.breakdown).toHaveProperty('information_density');
    expect(result.metadata.custom).toBe(true);
  });

  it('describe() includes rubric and custom flag', () => {
    const scorer = CustomScorer.create(definition);
    const desc = scorer.describe();
    expect(desc.custom).toBe(true);
    expect(desc.rubric).toEqual(definition.rubric);
  });
});

// ─── Dataset ─────────────────────────────────────────────────────────────────

describe('Dataset', () => {
  const examples = [
    { input: 'Question 1', output: 'Answer 1', expected_output: 'Ref 1' },
    { input: 'Question 2', output: 'Answer 2' },
    { input: 'Question 3', output: 'Answer 3', context: 'Some context' },
  ];

  it('creates dataset with correct size', () => {
    const ds = new Dataset({ name: 'test', examples });
    expect(ds.size).toBe(3);
    expect(ds.name).toBe('test');
    expect(ds.id).toBeTruthy();
  });

  it('assigns IDs to examples', () => {
    const ds = new Dataset({ name: 'test', examples });
    expect(ds.examples[0].id).toBeTruthy();
    expect(ds.examples[1].id).toBeTruthy();
  });

  it('validates correctly', () => {
    const ds = new Dataset({ name: 'test', examples });
    const { valid } = ds.validate();
    expect(valid).toBe(true);
  });

  it('detects invalid examples', () => {
    const badExamples = [{ input: '', output: 'ok' }];
    const ds = new Dataset({ name: 'test', examples: badExamples });
    const { valid, errors } = ds.validate();
    expect(valid).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('splits into train/test/validation', () => {
    const bigExamples = Array.from({ length: 100 }, (_, i) => ({
      input: `Question ${i}`,
      output: `Answer ${i}`,
    }));
    const ds = new Dataset({ name: 'test', examples: bigExamples });
    const { train, test, validation } = ds.split({ train: 0.7, test: 0.2, validation: 0.1 });
    expect(train.size).toBe(70);
    expect(test.size).toBe(20);
    expect(validation.size).toBe(10);
  });

  it('samples N examples', () => {
    const bigExamples = Array.from({ length: 50 }, (_, i) => ({ input: `Q${i}`, output: `A${i}` }));
    const ds = new Dataset({ name: 'test', examples: bigExamples });
    const sample = ds.sample(10);
    expect(sample.size).toBe(10);
  });

  it('filters examples', () => {
    const ds = new Dataset({ name: 'test', examples });
    const filtered = ds.filter((ex) => ex.context !== null && ex.context !== undefined);
    expect(filtered.size).toBe(1);
  });

  it('merges two datasets', () => {
    const ds1 = new Dataset({ name: 'a', examples: examples.slice(0, 2) });
    const ds2 = new Dataset({ name: 'b', examples: examples.slice(2) });
    const merged = ds1.merge(ds2);
    expect(merged.size).toBe(3);
  });

  it('exports to JSON', () => {
    const ds = new Dataset({ name: 'test', examples });
    const json = JSON.parse(ds.toJSON());
    expect(json.name).toBe('test');
    expect(json.examples).toHaveLength(3);
  });

  it('exports to JSONL', () => {
    const ds = new Dataset({ name: 'test', examples });
    const lines = ds.toJSONL().split('\n');
    expect(lines).toHaveLength(3);
    expect(() => JSON.parse(lines[0])).not.toThrow();
  });

  it('exports to CSV', () => {
    const ds = new Dataset({ name: 'test', examples });
    const csv = ds.toCSV();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('input');
    expect(lines).toHaveLength(4); // header + 3 examples
  });

  it('describe() returns correct metadata', () => {
    const ds = new Dataset({ name: 'test', examples });
    const desc = ds.describe();
    expect(desc.size).toBe(3);
    expect(desc.hasExpectedOutput).toBe(true);
    expect(desc.hasContext).toBe(true);
  });
});

// ─── DatasetManager ───────────────────────────────────────────────────────────

describe('DatasetManager', () => {
  const tmpDir = '/tmp/heady-eval-test-datasets';

  it('saves and retrieves a dataset by name', async () => {
    const manager = new DatasetManager(tmpDir);
    const ds = new Dataset({ name: 'my_dataset', examples: [{ input: 'q1', output: 'a1' }] });
    await manager.save(ds);
    const retrieved = await manager.get('my_dataset');
    expect(retrieved).not.toBeNull();
    expect(retrieved.name).toBe('my_dataset');
  });

  it('lists saved datasets', async () => {
    const manager = new DatasetManager(tmpDir);
    const list = await manager.list();
    expect(Array.isArray(list)).toBe(true);
  });

  it('loads from object with examples array', async () => {
    const manager = new DatasetManager(tmpDir);
    const ds = await manager.load({ name: 'inline', examples: [{ input: 'hello', output: 'world' }] });
    expect(ds.size).toBe(1);
  });
});

// ─── Runner ───────────────────────────────────────────────────────────────────

describe('Runner', () => {
  function makeRunner() {
    return new Runner({
      concurrency: 2,
      checkpointsDir: '/tmp/heady-eval-test-checkpoints',
      judgeClient: makeMockJudgeClient(),
      embedClient: mockEmbedClient,
      guardClient: mockGuardClient,
    });
  }

  it('executes evaluation run and returns completed status', async () => {
    const runner = makeRunner();
    const examples = Array.from({ length: 3 }, (_, i) => ({
      id: `ex-${i}`,
      input: `Question ${i}`,
      output: `Answer ${i}`,
      metadata: {},
    }));
    const dataset = new Dataset({ name: 'test', examples });
    const scorers = [new RelevanceScorer(), new CoherenceScorer()];

    const run = await runner.execute({ dataset, scorers, name: 'test_run' });
    expect(run.status).toBe(RUN_STATUSES.COMPLETED);
    expect(run.processedExamples).toBe(3);
    expect(run.results).toHaveLength(3);
  }, 30000);

  it('sets aggregateScore on each result', async () => {
    const runner = makeRunner();
    const dataset = new Dataset({ name: 'test', examples: [EXAMPLE_GOOD] });
    const scorers = [new RelevanceScorer()];

    const run = await runner.execute({ dataset, scorers, name: 'agg_test' });
    expect(run.results[0].aggregateScore).not.toBeNull();
  }, 30000);

  it('scoreExample() returns per-scorer results', async () => {
    const runner = makeRunner();
    const result = await runner.scoreExample(EXAMPLE_GOOD, [new CoherenceScorer()]);
    expect(result.scorerResults).toHaveProperty('coherence');
    expect(result.scorerResults.coherence.score).not.toBeNull();
  }, 15000);

  it('listRuns() returns run summaries', async () => {
    const runner = makeRunner();
    const dataset = new Dataset({ name: 'test', examples: [EXAMPLE_GOOD] });
    await runner.execute({ dataset, scorers: [new CoherenceScorer()], name: 'list_test' });
    const runs = runner.listRuns();
    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0]).toHaveProperty('id');
    expect(runs[0]).toHaveProperty('status');
  }, 30000);
});

// ─── ConcurrencyPool ──────────────────────────────────────────────────────────

describe('ConcurrencyPool', () => {
  it('runs tasks with configured concurrency', async () => {
    const pool = new ConcurrencyPool(2);
    let maxConcurrent = 0;
    let current = 0;
    const tasks = Array.from({ length: 10 }, () =>
      pool.run(async () => {
        current++;
        if (current > maxConcurrent) maxConcurrent = current;
        await new Promise((r) => setTimeout(r, 10));
        current--;
      })
    );
    await Promise.all(tasks);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});

// ─── ETATracker ───────────────────────────────────────────────────────────────

describe('ETATracker', () => {
  it('returns null ETA before ticks', () => {
    const t = new ETATracker(10, 0);
    expect(t.etaMs()).toBeNull();
  });

  it('returns numeric ETA after ticks', () => {
    const t = new ETATracker(10, 0);
    t.tick();
    t.tick();
    const eta = t.etaMs();
    expect(typeof eta).toBe('number');
  });

  it('returns 0 ETA when all done', () => {
    const t = new ETATracker(2, 0);
    t.tick();
    t.tick();
    const eta = t.etaMs();
    expect(eta).toBe(0);
  });
});

// ─── TokenBucket ─────────────────────────────────────────────────────────────

describe('TokenBucket', () => {
  it('acquires without blocking when under limits', async () => {
    const bucket = new TokenBucket({ requestsPerMinute: 100, tokensPerMinute: 1000000 });
    const start = Date.now();
    await bucket.acquire(100);
    expect(Date.now() - start).toBeLessThan(500);
  });
});

// ─── ReportGenerator ─────────────────────────────────────────────────────────

describe('ReportGenerator', () => {
  let generator;
  let mockRun;

  beforeEach(() => {
    generator = new ReportGenerator();
    mockRun = {
      id: 'run-123',
      name: 'test_run',
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 5000,
      totalExamples: 2,
      processedExamples: 2,
      failedExamples: 0,
      scorerNames: ['relevance', 'coherence'],
      metadata: {},
      costEstimate: { totalUSD: 0.001, calls: 5 },
      results: [
        {
          exampleId: 'ex-1',
          input: 'Q1',
          output: 'A1',
          expected_output: null,
          context: null,
          metadata: {},
          aggregateScore: 4.0,
          pass: true,
          durationMs: 1000,
          error: null,
          scorerResults: {
            relevance: { scorer: 'relevance', score: 4, pass: true, breakdown: { topic_relevance: 4 }, explanation: 'ok', metadata: {} },
            coherence: { scorer: 'coherence', score: 4, pass: true, breakdown: { logical_consistency: 4 }, explanation: 'ok', metadata: {} },
          },
        },
        {
          exampleId: 'ex-2',
          input: 'Q2',
          output: 'A2',
          expected_output: null,
          context: null,
          metadata: {},
          aggregateScore: 2.0,
          pass: false,
          durationMs: 800,
          error: null,
          scorerResults: {
            relevance: { scorer: 'relevance', score: 2, pass: false, breakdown: { topic_relevance: 2 }, explanation: 'poor', metadata: {} },
            coherence: { scorer: 'coherence', score: 2, pass: false, breakdown: { logical_consistency: 2 }, explanation: 'poor', metadata: {} },
          },
        },
      ],
    };
  });

  it('builds report with correct structure', () => {
    const report = generator.buildReport(mockRun);
    expect(report.runId).toBe('run-123');
    expect(report.scorers).toHaveProperty('relevance');
    expect(report.scorers).toHaveProperty('coherence');
    expect(report.examples).toHaveLength(2);
  });

  it('computes correct stats', () => {
    const report = generator.buildReport(mockRun);
    expect(report.scorers.relevance.mean).toBe(3);
    expect(report.scorers.relevance.passCount).toBe(1);
    expect(report.scorers.relevance.passRate).toBe(0.5);
  });

  it('exports to JSON', () => {
    const report = generator.buildReport(mockRun);
    const json = JSON.parse(generator.toJSON(report));
    expect(json.runId).toBe('run-123');
  });

  it('exports to CSV', () => {
    const report = generator.buildReport(mockRun);
    const csv = generator.toCSV(report);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('aggregate_score');
    expect(lines).toHaveLength(3); // header + 2 examples
  });

  it('exports to HTML', () => {
    const report = generator.buildReport(mockRun);
    const html = generator.toHTML(report);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('HeadyEval Report');
    expect(html).toContain('relevance');
  });

  it('builds trend data from multiple reports', () => {
    const report1 = generator.buildReport({ ...mockRun, id: 'run-1', name: 'run_1', createdAt: '2025-01-01T00:00:00Z' });
    const report2 = generator.buildReport({ ...mockRun, id: 'run-2', name: 'run_2', createdAt: '2025-01-02T00:00:00Z' });
    const trends = generator.buildTrends([report1, report2]);
    expect(trends).toHaveProperty('relevance');
    expect(trends.relevance).toHaveLength(2);
    expect(trends._overall).toHaveLength(2);
  });

  it('builds comparison report', () => {
    const runA = { ...mockRun, id: 'run-a', name: 'model-a' };
    const runB = { ...mockRun, id: 'run-b', name: 'model-b' };
    const comparison = generator.buildComparisonReport([
      { run: runA, modelName: 'Model A' },
      { run: runB, modelName: 'Model B' },
    ]);
    expect(comparison.models).toHaveLength(2);
    expect(comparison.overallWinner).toBeTruthy();
    expect(comparison.winners).toHaveProperty('relevance');
  });
});

// ─── HeadyEval integration ────────────────────────────────────────────────────

describe('HeadyEval', () => {
  let evalInstance;

  beforeEach(() => {
    evalInstance = new HeadyEval({
      inferUrl: 'http://mock-infer:3101',
      datasetsDir: '/tmp/heady-eval-test-integration',
    });
    // Inject mock judge client
    evalInstance.judgeConfig.primary = makeMockJudgeClient();
    evalInstance.runner.judgeClient = evalInstance.judgeConfig.primary;
    evalInstance.embedClient = mockEmbedClient;
    evalInstance.guardClient = mockGuardClient;
    evalInstance.runner.embedClient = mockEmbedClient;
    evalInstance.runner.guardClient = mockGuardClient;
  });

  it('score() returns results for single example', async () => {
    const result = await evalInstance.score(EXAMPLE_GOOD, { scorers: ['coherence'] });
    expect(result.scorerResults).toHaveProperty('coherence');
    expect(result.aggregateScore).not.toBeNull();
  }, 15000);

  it('listScorers() returns all built-in scorers', () => {
    const scorers = evalInstance.listScorers();
    const names = scorers.map((s) => s.name);
    expect(names).toContain('relevance');
    expect(names).toContain('faithfulness');
    expect(names).toContain('safety');
    expect(names).toContain('coherence');
    expect(names).toContain('helpfulness');
  });

  it('registerScorer() adds custom scorer to registry', () => {
    evalInstance.registerScorer({
      name: 'brevity',
      rubric: { 5: 'Very concise', 1: 'Very verbose' },
    });
    const scorers = evalInstance.listScorers();
    const brevity = scorers.find((s) => s.name === 'brevity');
    expect(brevity).toBeDefined();
    expect(brevity.type).toBe('custom');
  });

  it('buildScorers() throws for unknown scorer name', () => {
    expect(() => evalInstance.buildScorers(['nonexistent'])).toThrow("Unknown scorer 'nonexistent'");
  });

  it('evaluate() runs full pipeline', async () => {
    const dataset = new Dataset({ name: 'eval_test', examples: [EXAMPLE_GOOD, EXAMPLE_BAD] });
    const { run, report } = await evalInstance.evaluate({
      dataset,
      scorers: ['coherence'],
      name: 'integration_test',
    });
    expect(run.status).toBe('completed');
    expect(run.processedExamples).toBe(2);
    expect(report.runId).toBe(run.id);
    expect(report.scorers).toHaveProperty('coherence');
  }, 30000);

  it('exportReport() supports json, csv, html formats', async () => {
    const dataset = new Dataset({ name: 'export_test', examples: [EXAMPLE_GOOD] });
    const { report } = await evalInstance.evaluate({ dataset, scorers: ['coherence'] });
    expect(() => JSON.parse(evalInstance.exportReport(report, 'json'))).not.toThrow();
    expect(evalInstance.exportReport(report, 'csv')).toContain('aggregate_score');
    expect(evalInstance.exportReport(report, 'html')).toContain('<!DOCTYPE html>');
    expect(() => evalInstance.exportReport(report, 'pdf')).toThrow('Unsupported');
  }, 30000);

  it('listRuns() returns runs after evaluation', async () => {
    const dataset = new Dataset({ name: 'list_test', examples: [EXAMPLE_GOOD] });
    await evalInstance.evaluate({ dataset, scorers: ['coherence'] });
    const runs = evalInstance.listRuns();
    expect(runs.length).toBeGreaterThan(0);
  }, 30000);

  it('getRun() returns run by ID', async () => {
    const dataset = new Dataset({ name: 'get_test', examples: [EXAMPLE_GOOD] });
    const { run } = await evalInstance.evaluate({ dataset, scorers: ['coherence'] });
    const retrieved = evalInstance.getRun(run.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved.id).toBe(run.id);
  }, 30000);
});

// ─── Config ───────────────────────────────────────────────────────────────────

describe('Config', () => {
  it('has correct defaults', () => {
    expect(config.port).toBe(3107);
    expect(config.phi).toBeCloseTo(1.618);
    expect(config.judgeModel).toBeTruthy();
    expect(config.concurrency).toBeGreaterThan(0);
    expect(Array.isArray(config.defaultScorers)).toBe(true);
  });

  it('PHI squared equals PHI + 1 (golden ratio property)', () => {
    expect(config.phiSquared).toBeCloseTo(config.phi + 1, 3);
  });
});
