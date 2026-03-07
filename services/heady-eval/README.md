# HeadyEval

LLM-as-judge evaluation framework for the Heady AI platform. Replaces external eval tools (RAGAS, DeepEval, etc.) with first-party scorers for relevance, faithfulness, safety, coherence, and helpfulness — running entirely within the Heady service mesh.

---

## Architecture

```
heady-eval (port 3107)
   │
   ├── scorers/          # Pluggable scorer pipeline
   │   ├── base-scorer.js
   │   ├── relevance-scorer.js    (semantic + LLM judge)
   │   ├── faithfulness-scorer.js (claim extraction + verification)
   │   ├── safety-scorer.js       (HeadyGuard + LLM nuance)
   │   ├── coherence-scorer.js    (logic, grammar, structure)
   │   ├── helpfulness-scorer.js  (task completion, depth)
   │   └── custom-scorer.js       (user-defined rubrics)
   │
   ├── judges.js         # LLM judge clients, multi-judge consensus
   ├── datasets.js       # Dataset loading, splitting, versioning
   ├── runner.js         # Parallel evaluation with concurrency pool
   ├── reports.js        # Statistics, HTML/CSV/JSON exports
   ├── routes.js         # Express router
   ├── health.js         # /health + /metrics
   └── index.js          # HeadyEval class + service bootstrap
```

**Sacred Geometry scaling:** PHI = 1.618 used for resource limits and timeouts.

---

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start with mock downstream services
docker-compose up

# Or run directly (requires real HeadyInfer/Embed/Guard)
HEADY_INFER_URL=http://localhost:3101 \
HEADY_EMBED_URL=http://localhost:3102 \
HEADY_GUARD_URL=http://localhost:3103 \
node index.js
```

### Run tests

```bash
npm test
npm run test:coverage
```

### Docker

```bash
npm run docker:build
npm run docker:run
```

---

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|---|---|---|
| `HEADY_EVAL_PORT` | `3107` | HTTP port |
| `HEADY_EVAL_JUDGE_MODEL` | `claude-3.5-sonnet` | LLM used as judge |
| `HEADY_EVAL_CONCURRENCY` | `5` | Parallel evaluation workers |
| `HEADY_EVAL_DEFAULT_SCORERS` | `relevance,faithfulness,safety,coherence,helpfulness` | Comma-separated default scorer list |
| `HEADY_INFER_URL` | `http://heady-infer:3101` | HeadyInfer service URL |
| `HEADY_EMBED_URL` | `http://heady-embed:3102` | HeadyEmbed service URL |
| `HEADY_GUARD_URL` | `http://heady-guard:3103` | HeadyGuard service URL |
| `HEADY_EVAL_JUDGE_RPM` | `60` | Judge calls per minute (rate limit) |
| `HEADY_EVAL_JUDGE_TPM` | `100000` | Judge tokens per minute |
| `HEADY_EVAL_STORAGE_DIR` | `/tmp/heady-eval` | Base storage directory |

---

## Scorer Reference

### Relevance (`relevance`)

Evaluates how relevant the answer is to the question.

- **Method:** Hybrid (cosine similarity via HeadyEmbed + LLM judge, 30/70 blend)
- **Dimensions:** `topic_relevance`, `specificity`, `completeness`
- **Rubric:** 5 = directly addresses all aspects; 1 = completely off-topic
- **Requires:** `input`, `output`

### Faithfulness (`faithfulness`)

Evaluates whether the answer is grounded in the provided context.

- **Method:** Claim extraction → per-claim verification → `verified / total` ratio
- **Dimensions:** `verified_claims`, `total_claims`, `hallucination_count`, `faithfulness_ratio`
- **Score:** `faithfulness_ratio` mapped to 1–5 scale
- **Requires:** `input`, `output`, `context`
- **Skipped:** if no `context` provided

### Safety (`safety`)

Evaluates content safety across four risk categories.

- **Method:** HeadyGuard fast screening + LLM nuance analysis, conservative blend
- **Dimensions:** `toxicity`, `bias`, `misinformation`, `privacy_violation`
- **Weighted:** toxicity 35%, bias 25%, misinformation 25%, privacy 15%
- **Requires:** `input`, `output`

### Coherence (`coherence`)

Evaluates logical consistency and readability.

- **Method:** LLM judge with structured rubric
- **Dimensions:** `logical_consistency`, `grammar_readability`, `structure`, `contradiction_free`
- **Requires:** `input`, `output`

### Helpfulness (`helpfulness`)

Evaluates how useful the response is.

- **Method:** LLM judge; includes reference comparison if `expected_output` provided
- **Dimensions:** `task_completion`, `actionability`, `depth`, `reference_match` (optional)
- **Requires:** `input`, `output`

---

## API Reference

### Score a single example

```bash
curl -X POST http://localhost:3107/eval/score \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is the capital of France?",
    "output": "The capital of France is Paris.",
    "context": "France is a country in Western Europe. Its capital is Paris.",
    "expected_output": "Paris",
    "scorers": ["relevance", "faithfulness", "safety"]
  }'
```

**Response:**
```json
{
  "exampleId": "uuid",
  "aggregateScore": 4.67,
  "pass": true,
  "scorerResults": {
    "relevance": {
      "scorer": "relevance",
      "score": 5,
      "pass": true,
      "breakdown": { "topic_relevance": 5, "specificity": 5, "completeness": 4, "semantic_similarity": 4.8 },
      "explanation": "The answer directly and completely addresses the question.",
      "durationMs": 342,
      "error": null
    },
    "faithfulness": { "score": 5, "breakdown": { "faithfulness_ratio": 1.0, "verified_claims": 1, "total_claims": 1, "hallucination_count": 0 } },
    "safety": { "score": 5, "breakdown": { "toxicity": 5, "bias": 5, "misinformation": 5, "privacy_violation": 5 } }
  }
}
```

---

### Start a batch evaluation run

```bash
curl -X POST http://localhost:3107/eval/run \
  -H "Content-Type: application/json" \
  -d '{
    "name": "prod_eval_v2",
    "scorers": ["relevance", "faithfulness", "safety"],
    "examples": [
      { "input": "What is Python?", "output": "Python is a programming language.", "context": "Python is a high-level programming language." },
      { "input": "How do I reverse a string?", "output": "Use [::-1] slice syntax.", "expected_output": "s[::-1]" }
    ]
  }'
```

Returns `202 Accepted` with `runId`. Poll for completion:

```bash
curl http://localhost:3107/eval/run/{runId}
```

---

### Get evaluation report

```bash
# JSON report
curl http://localhost:3107/eval/reports/{runId}

# HTML report (open in browser)
curl http://localhost:3107/eval/reports/{runId}/html > report.html

# CSV export
curl http://localhost:3107/eval/reports/{runId}/csv > results.csv
```

---

### Compare multiple models

```bash
curl -X POST http://localhost:3107/eval/compare \
  -H "Content-Type: application/json" \
  -d '{
    "scorers": ["relevance", "helpfulness"],
    "examples": [
      { "input": "Explain photosynthesis", "metadata": { "gpt4_output": "...", "claude_output": "..." } }
    ],
    "models": [
      { "name": "gpt-4", "outputField": "gpt4_output" },
      { "name": "claude-3.5", "outputField": "claude_output" }
    ]
  }'
```

---

### A/B test model variants

```bash
curl -X POST http://localhost:3107/eval/ab-test \
  -H "Content-Type: application/json" \
  -d '{
    "scorers": ["relevance", "helpfulness"],
    "examples": [
      { "input": "Explain machine learning", "metadata": { "v1": "...", "v2": "..." } }
    ],
    "variantA": { "name": "v1", "outputField": "v1" },
    "variantB": { "name": "v2", "outputField": "v2" }
  }'
```

**Response:**
```json
{
  "variantA": "v1",
  "variantB": "v2",
  "overallWinner": "v2",
  "overallDelta": 0.3,
  "recommendation": "v2 outperforms v1 by 0.300 on the overall aggregate.",
  "scorerComparison": {
    "relevance": { "v1": 3.8, "v2": 4.1, "delta": 0.3, "winner": "v2" }
  }
}
```

---

### Dataset management

```bash
# Create a dataset
curl -X POST http://localhost:3107/eval/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_eval_set",
    "examples": [
      { "input": "Q1", "output": "A1", "expected_output": "A1", "context": "ctx" }
    ]
  }'

# Generate synthetic dataset
curl -X POST http://localhost:3107/eval/datasets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "synth_python",
    "generateSynthetic": { "topic": "Python programming", "count": 20, "style": "qa" }
  }'

# List datasets
curl http://localhost:3107/eval/datasets

# Get specific dataset
curl http://localhost:3107/eval/datasets/{id}?detail=true
```

---

### Custom scorers

```bash
# Register a custom scorer
curl -X POST http://localhost:3107/eval/scorers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "conciseness",
    "description": "Evaluates response brevity",
    "dimensions": ["brevity", "information_density"],
    "rubric": {
      "5": "Perfectly concise, no unnecessary words",
      "4": "Mostly concise with minor verbosity",
      "3": "Adequate but could be shorter",
      "2": "Noticeably verbose",
      "1": "Extremely verbose or padded"
    }
  }'

# Use it in evaluation
curl -X POST http://localhost:3107/eval/score \
  -d '{ "input": "...", "output": "...", "scorers": ["conciseness"] }'
```

---

## Programmatic Usage

```js
'use strict';
const { HeadyEval, Dataset, CustomScorer } = require('./index');

const eval = new HeadyEval({
  judgeModel: 'claude-3.5-sonnet',
  concurrency: 5,
  inferUrl: 'http://heady-infer:3101',
  embedUrl: 'http://heady-embed:3102',
  guardUrl:  'http://heady-guard:3103',
});

// Listen to progress events
eval.on('run:progress', ({ processed, total, percentComplete, etaMs }) => {
  console.log(`${percentComplete}% — ETA: ${Math.round(etaMs / 1000)}s`);
});

// Score a single example
const result = await eval.score({
  input:  'What is gradient descent?',
  output: 'Gradient descent is an optimization algorithm that minimizes a function by iteratively moving in the direction of steepest descent.',
  context: 'Gradient descent is an iterative optimization algorithm for finding the local minimum of a differentiable function.',
});

console.log('Aggregate score:', result.aggregateScore);
console.log('Faithfulness:', result.scorerResults.faithfulness.score);

// Run a full dataset evaluation
const dataset = await eval.loadDataset('./my_eval_set.json');
const { run, report } = await eval.evaluate({
  dataset,
  scorers: ['relevance', 'faithfulness', 'safety'],
  name: 'v2.1_eval',
});

console.log('Pass rate:', report.overall.passRate);
console.log('HTML report:', eval.exportReport(report, 'html'));

// Register a custom scorer
eval.registerScorer({
  name: 'technical_accuracy',
  description: 'Checks technical correctness of code or math answers',
  rubric: {
    5: 'Completely correct, no errors',
    4: 'Mostly correct with minor issues',
    3: 'Partially correct, some errors',
    2: 'Mostly incorrect',
    1: 'Completely wrong',
  },
  dimensions: ['correctness', 'precision'],
});

// A/B test two model versions
const abResult = await eval.abTest({
  dataset,
  variantA: { name: 'gpt-4', examples: datasetWithGPT4Outputs.examples },
  variantB: { name: 'claude-3.5', examples: datasetWithClaudeOutputs.examples },
  scorers: ['relevance', 'helpfulness'],
});

console.log(abResult.recommendation);

// Generate synthetic evaluation data
const syntheticDs = await eval.generateSyntheticDataset({
  topic: 'LLM evaluation best practices',
  count: 25,
  style: 'qa',
});
```

---

## Scoring Scale

All scorers use a **1–5 scale**:

| Score | Label | Meaning |
|---|---|---|
| 5 | Excellent | Meets or exceeds the highest standard |
| 4 | Good | Mostly correct with minor issues |
| 3 | Adequate | Acceptable but notable gaps |
| 2 | Poor | Significant problems |
| 1 | Failing | Severe issues or no value |

**Pass threshold:** 3.0 (configurable via `HEADY_EVAL_PASS_THRESHOLD`)

---

## Health & Metrics

```bash
curl http://localhost:3107/health
curl http://localhost:3107/metrics
```

Health check verifies:
- HeadyInfer reachability (required)
- HeadyEmbed reachability (non-fatal)
- HeadyGuard reachability (non-fatal)
- Process heap usage (< 90%)

---

## Service Mesh Integration

HeadyEval runs on port **3107** and expects these upstream services:

| Service | Default URL | Required |
|---|---|---|
| HeadyInfer | `http://heady-infer:3101` | Yes (LLM judge) |
| HeadyEmbed | `http://heady-embed:3102` | No (semantic scoring) |
| HeadyGuard | `http://heady-guard:3103` | No (fast safety pre-screening) |

If HeadyEmbed is unavailable, relevance scoring falls back to LLM-only (no semantic similarity dimension).
If HeadyGuard is unavailable, safety scoring falls back to LLM-only analysis.

---

## Multi-Judge Consensus

For high-stakes evaluations, configure multiple judge models:

```js
const eval = new HeadyEval({
  judgeOpts: {
    additionalModels: ['gpt-4o', 'gemini-1.5-pro'],
    consensusMin: 2,
  },
});
```

Multi-judge runs all models in parallel and flags examples where judges disagree.

---

## Calibration

Verify judge calibration before a production run:

```bash
curl -X POST http://localhost:3107/eval/calibrate \
  -H "Content-Type: application/json" \
  -d '{
    "scorerName": "relevance",
    "examples": [
      {
        "input": "What is 2+2?",
        "output": "4",
        "goldScores": { "relevance": 5 }
      },
      {
        "input": "What is 2+2?",
        "output": "The French Revolution",
        "goldScores": { "relevance": 1 }
      }
    ]
  }'
```

Returns `{ calibrated: true/false, mae: 0.25, samples: 2 }`.

---

## Cost Tracking

Every run reports cost estimates in `run.costEstimate`:

```json
{
  "totalUSD": 0.0134,
  "inputTokens": 45000,
  "outputTokens": 8900,
  "calls": 150
}
```

Based on Claude 3.5 Sonnet pricing ($3/1M input, $15/1M output). Update `runner.js _estimateCost()` for other models.

---

## Checkpoint & Resume

Runs automatically checkpoint every 10 examples to `/tmp/heady-eval/checkpoints/`. If a run fails mid-way, re-run with the same `runId` and it will resume from the last checkpoint:

```js
await eval.evaluate({ dataset, scorers, runId: 'my-run-id', name: 'my_run' });
// ...crashes at example 47...
// Re-run with same runId — picks up at example 48
await eval.evaluate({ dataset, scorers, runId: 'my-run-id', name: 'my_run' });
```

---

## Trend Tracking

Compare evaluation quality across multiple runs:

```bash
curl "http://localhost:3107/eval/trends?runIds=run-001,run-002,run-003"
```

Returns per-scorer mean and pass rate trend data suitable for charting.
