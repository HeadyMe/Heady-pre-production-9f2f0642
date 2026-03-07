# CSL Architecture Guide

**Heady Latent OS — Section 5: CSL & Geometric AI**  
**Implementation Guide for Continuous Semantic Logic**  
**Date:** March 7, 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Module Map](#2-module-map)
3. [CSL Engine Usage](#3-csl-engine-usage)
4. [HDC Operations Usage](#4-hdc-operations-usage)
5. [MoE-CSL Router Usage](#5-moe-csl-router-usage)
6. [Ternary Logic Usage](#6-ternary-logic-usage)
7. [Integration Patterns](#7-integration-patterns)
8. [Performance Considerations](#8-performance-considerations)
9. [Numerical Stability Reference](#9-numerical-stability-reference)
10. [Extending CSL](#10-extending-csl)

---

## 1. Overview

**Continuous Semantic Logic (CSL)** is Heady's core innovation for AI reasoning. Instead of operating on scalar truth values (0 or 1), CSL treats logical propositions as directions in a high-dimensional vector space. Logical operations become geometric transformations:

| Classical Logic | CSL Operation | Geometry                  |
|-----------------|---------------|---------------------------|
| A AND B         | cos(A, B)     | Angular alignment         |
| A OR B          | normalize(A+B) | Superposition / centroid |
| NOT A           | A - proj_B(A) | Orthogonal complement     |
| A IMPLIES B     | proj_B(A)     | Projection onto B         |
| A XOR B         | exclusive components | Symmetric difference |
| CONSENSUS       | weighted mean  | Centroid on hypersphere   |
| GATE            | threshold(cos) | Semantic filter           |

**Key invariants:**
- All vectors live on (or near) the unit hypersphere S^{D-1}
- Truth is angular: +1 = aligned, 0 = orthogonal, -1 = antipodal
- Every operation is O(D) or O(D²) — GPU-friendly
- No external dependencies (pure JavaScript)

---

## 2. Module Map

```
section5-csl-geometric/
├── engine/
│   ├── csl-engine.js          ← Core CSL gates (AND, OR, NOT, IMPLY, XOR, CONSENSUS, GATE)
│   ├── hdc-operations.js      ← HDC algebra (BIND, BUNDLE, PERMUTE, ENCODE, DECODE)
│   └── moe-csl-router.js      ← Mixture-of-Experts CSL router
│
├── modules/
│   └── ternary-logic.js       ← Ternary logic (Kleene K3, Łukasiewicz, Gödel)
│
├── benchmarks/
│   └── csl-benchmark.js       ← Benchmark suite with statistical significance tests
│
└── docs/
    ├── csl-mathematical-proofs.md  ← Formal proofs
    └── csl-architecture-guide.md   ← This file
```

**Dependency graph:**
```
ternary-logic.js
    └── csl-engine.js (for CSLEngine)

moe-csl-router.js
    └── csl-engine.js

hdc-operations.js
    └── csl-engine.js (for utilities: norm, normalize, dot, etc.)

benchmarks/csl-benchmark.js
    ├── csl-engine.js
    └── moe-csl-router.js
```

---

## 3. CSL Engine Usage

### 3.1 Basic Setup

```javascript
const { CSLEngine } = require('./engine/csl-engine');

// Standard configuration (384-dim, all-MiniLM-L6-v2 compatible)
const engine = new CSLEngine({ dim: 384 });

// Large configuration (1536-dim, text-embedding-3-large compatible)
const largeEngine = new CSLEngine({ dim: 1536 });
```

### 3.2 Core Gate Operations

```javascript
// Assume vectorA, vectorB are Float32Array or Float64Array of length 384

// CSL AND: measures alignment (returns scalar ∈ [-1,+1])
const alignment = engine.AND(vectorA, vectorB);
// alignment > 0.8 → "strongly related"
// alignment ≈ 0   → "independent"
// alignment < -0.8 → "contradictory"

// CSL OR: semantic union (returns unit vector)
const union = engine.OR(vectorA, vectorB);
// union points "between" A and B on the hypersphere

// CSL NOT: remove B's meaning from A (returns unit vector)
const notB_from_A = engine.NOT(vectorA, vectorB);
// notB_from_A is orthogonal to vectorB
// Example: NOT(cats, persian) → cat concepts minus Persian-specific traits

// CSL IMPLY: how much of A is "contained in" B (returns vector)
const implication = engine.IMPLY(vectorA, vectorB);
// implication = proj_B(A) = (A·B / ‖B‖²) · B

// CSL XOR: exclusive semantic content (returns unit vector)
const exclusive = engine.XOR(vectorA, vectorB);
// exclusive captures what's unique to each concept

// CSL CONSENSUS: weighted agreement (returns unit vector + strength)
const { consensus, strength } = engine.CONSENSUS(
  [agentVec1, agentVec2, agentVec3],
  [0.4, 0.35, 0.25]  // confidence weights
);
// strength ∈ [0,1]: 0 = total disagreement, 1 = perfect agreement

// CSL GATE: semantic filter
const { activation, cosScore } = engine.GATE(
  inputVector,    // input to gate
  topicVector,    // gate's semantic direction
  0.3,            // threshold τ (only pass inputs with cos > 0.3)
  'soft',         // 'hard' or 'soft' (sigmoid)
  0.1             // temperature (lower = sharper)
);
```

### 3.3 Batch Operations

```javascript
// Batch AND: query one vector against many (GPU-friendly)
const scores = engine.batchAND(queryVector, corpusVectors);
// scores: Float64Array of n cosine similarities

// Batch NOT: negate one concept from all source vectors
const negated = engine.batchNOT(sourceVectors, conceptToRemove);

// Batch GATE: filter a corpus by semantic topic
const gateResults = engine.batchGATE(corpus, topicGate, 0.2, 'hard');
const passing = gateResults.filter(r => r.activation === 1);
```

### 3.4 Subspace Operations

```javascript
// NOT against multiple concepts simultaneously (Gram-Schmidt)
const filtered = engine.NOT_subspace(
  queryVector,
  [legal_concept, formal_concept, bureaucratic_concept],
  true  // normalize result
);
// filtered = query with all three excluded concepts removed

// Pairwise similarity matrix
const simMatrix = engine.pairwiseAND(vectors);
// simMatrix[i][j] = cos(vectors[i], vectors[j])

// Analogy completion: "A is to B as C is to ?"
const answer = engine.ANALOGY(
  man_vector,    // A
  king_vector,   // B
  woman_vector   // C
);
// answer ≈ queen_vector
```

---

## 4. HDC Operations Usage

### 4.1 Setup and Codebook Generation

```javascript
const { HDCOperations } = require('./engine/hdc-operations');

const hdc = new HDCOperations({ dim: 384, type: 'real' });

// Generate codebook for categorical values
const codebook = hdc.generateCodebook(
  ['cat', 'dog', 'bird', 'fish', 'rabbit'],
  384,    // dim
  'real'  // type
);

// Generate scalar codebook for continuous values
const ageCodebook = hdc.generateScalarCodebook(0, 100, 384);
// Encodes ages 0-100 as permutation-indexed vectors
```

### 4.2 Encoding

```javascript
// Categorical encoding
const catVector = hdc.ENCODE('cat', codebook);

// Scalar encoding (requires scalar codebook with __scalar_anchor__)
const age35 = hdc.ENCODE(35, ageCodebook, { min: 0, max: 100 });

// BIND: associate two concepts
const cat_age = hdc.BIND(catVector, age35);
// cat_age is dissimilar to both catVector and age35
// but encodes their association

// BUNDLE: superpose multiple vectors (set membership)
const { bundle, strength } = hdc.BUNDLE(
  [catVector, dogVector, birdVector]
);
// bundle is similar to all three; strength = consensus level

// PERMUTE: cyclic shift for sequence encoding
const v2 = hdc.PERMUTE(someVector, 1);  // shift by 1 position
const v3 = hdc.PERMUTE(someVector, 5);  // shift by 5 positions
```

### 4.3 Sequence Encoding

```javascript
// Encode a sequence preserving order
const sequence = [wordA, wordB, wordC, wordD];
const seqBundle = hdc.encodeSequence(sequence);

// Query position 2 (third element)
const candidates = hdc.decodeSequencePosition(seqBundle, 2, codebook, 3);
// candidates: [{ key: 'cat', similarity: 0.89 }, ...]
```

### 4.4 Record Encoding (Key-Value Store)

```javascript
// Encode a structured record as a single hypervector
const record = hdc.encodeRecord([
  { key: roleVector_subject, value: catVector },
  { key: roleVector_verb,    value: chasesVector },
  { key: roleVector_object,  value: mouseVector },
]);

// Query: who is the subject?
const subject_candidates = hdc.queryRecord(record, roleVector_subject, codebook, 3);
// Returns items similar to catVector
```

### 4.5 Decoding and Membership

```javascript
// DECODE: nearest-neighbor lookup (clean-up memory)
const matches = hdc.DECODE(noisyVector, codebook, 3);
// matches: [{ key: 'cat', similarity: 0.92 }, ...]

// Membership test: is this item in the bundle?
const { present, similarity, threshold } = hdc.isPresent(bundle, catVector, 3);

// Similarity (type-appropriate)
const sim = hdc.SIMILARITY(vecA, vecB);
// Binary → Hamming-based [0,1]; Real → Cosine [-1,+1]

// Capacity estimate for this dimension
const { capacity, snrAtCapacity } = hdc.estimateCapacity();
// capacity: ~17 items for D=384 before retrieval degrades
```

---

## 5. MoE-CSL Router Usage

### 5.1 Setup

```javascript
const { MoECSLRouter } = require('./engine/moe-csl-router');

const router = new MoECSLRouter({
  numExperts: 8,          // 8 specialist agents
  topK: 2,                // activate 2 experts per input
  dim: 384,               // vector dimension
  temperature: 0.1,       // softmax sharpness (lower = sparser)
  balanceWeight: 0.01,    // anti-collapse regularization strength
});
```

### 5.2 Expert Gate Configuration

```javascript
// Option A: Set gate vectors from semantic embeddings
router.setExpertGate(0, codeReviewVector,  { name: 'code-review', description: 'Code analysis expert' });
router.setExpertGate(1, mathVector,        { name: 'math', description: 'Mathematical reasoning' });
router.setExpertGate(2, legalVector,       { name: 'legal', description: 'Legal analysis' });
router.setExpertGate(3, medicalVector,     { name: 'medical', description: 'Medical knowledge' });
// ...

// Option B: Batch set from array
router.setAllExpertGates(gateVectors, metaArray);

// Option C: Random initialization for testing
router.initRandomGates();
```

### 5.3 Routing

```javascript
// Route a single input
const result = router.route(inputVector);
console.log(result.experts);        // [2, 5] — top-2 expert IDs
console.log(result.weights);        // [0.72, 0.28] — normalized weights
console.log(result.cosScores);      // Float64Array of 8 cosine scores
console.log(result.softmaxScores);  // Float64Array of 8 softmax probs
console.log(result.entropy);        // routing entropy (nats)
console.log(result.dominantExpert); // 2

// Route a batch
const batchResults = router.routeBatch(inputVectors);

// Soft routing: blend expert outputs by weights
const blended = router.softRoute(inputVector, [
  { id: 0, vector: expert0Output },
  { id: 1, vector: expert1Output },
  // ...
]);
```

### 5.4 Load Balancing and Monitoring

```javascript
// Get routing metrics
const metrics = router.getMetrics();
console.log(metrics.expertUtilization);  // Float64Array: fraction per expert
console.log(metrics.loadImbalance);      // max/mean ratio (1.0 = perfect balance)
console.log(metrics.collapsedExperts);   // [3, 6] — experts never used
console.log(metrics.routingEntropy);     // mean entropy of routing decisions

// Compute balance loss for training
const { loss, loadImbalance } = router.computeBalanceLoss();

// Reset collapsed experts
const reset = router.resetCollapsedExperts();
console.log(`Reset experts: ${reset.join(', ')}`);

// Expert similarity matrix (detect competing experts)
const simMatrix = router.expertSimilarityMatrix();
// High sim[i][j] → experts i and j compete for same inputs
```

---

## 6. Ternary Logic Usage

### 6.1 Setup and Basic Operations

```javascript
const { TernaryLogicEngine, TERNARY } = require('./modules/ternary-logic');

// Kleene K3 mode (default)
const kleene = new TernaryLogicEngine({ mode: 'kleene' });

// Łukasiewicz mode
const lukasiewicz = new TernaryLogicEngine({ mode: 'lukasiewicz' });

// Basic operations on cosine similarity values
const cosA = 0.8;   // "mostly true"
const cosB = -0.3;  // "slightly false / uncertain"

const andResult  = kleene.AND(cosA, cosB);    // min(0.8, -0.3) = -0.3
const orResult   = kleene.OR(cosA, cosB);     // max(0.8, -0.3) = 0.8
const notResult  = kleene.NOT(cosA);          // -0.8 (sign flip)
const implResult = kleene.IMPLY(cosA, cosB);  // max(-0.8, -0.3) = -0.3

// Discretize to ternary symbol
const symbol = kleene.discretize(andResult);   // 'UNKNOWN' (since -0.3 ∈ (-0.5, 0.5))
```

### 6.2 Integration with CSL Engine

```javascript
const engine = new CSLEngine({ dim: 384 });
const ternary = new TernaryLogicEngine({ mode: 'kleene' });

// Evaluate: "Does document A match query Q AND also NOT exclude topic E?"
const docQ_sim = engine.AND(document, query);       // ∈ [-1,+1]
const docE_sim = engine.AND(document, excluded);    // ∈ [-1,+1]
const notE = ternary.NOT(docE_sim);                 // flip sign

const filterScore = ternary.AND(docQ_sim, notE);
const symbol = ternary.discretize(filterScore);

// "query-relevant AND NOT about excluded topic"
console.log(symbol);  // 'TRUE', 'UNKNOWN', or 'FALSE'
```

### 6.3 Vector-Level Operations

```javascript
// Vector-level ternary AND: compute cos(A,B) AND cos(C,D)
const result = ternary.vectorAND(vecA, vecB, vecC, vecD);
console.log(result.score);      // combined score ∈ [-1,+1]
console.log(result.symbol);     // 'TRUE'|'UNKNOWN'|'FALSE'
console.log(result.confidence); // certainty ∈ [0,1]
```

### 6.4 Multi-Premise Formulas

```javascript
// Evaluate: "All three premises must be true"
const evaluation = ternary.evaluateFormula([
  { a: evidenceVec1, b: claimVec },
  { a: evidenceVec2, b: claimVec },
  { a: contextVec,   b: claimVec },
], 'AND');  // chain AND

console.log(evaluation.symbol);         // final ternary result
console.log(evaluation.premiseScores);  // individual cos scores
```

### 6.5 Confidence Intervals

```javascript
// When a result is UNKNOWN, get confidence bounds
const ci = ternary.confidenceInterval(0.2, 0.1);  // x=0.2, noise=0.1
// ci.lower = 0.004, ci.upper = 0.396, ci.symbol = 'UNKNOWN', ci.confidence = 0.2

// Ternary softmax over routing scores
const { pTrue, pUnknown, pFalse } = ternary.ternarySoftmax(
  [0.8, 0.1, -0.3, 0.6, -0.7],
  0.5
);
```

---

## 7. Integration Patterns

### 7.1 Semantic RAG with CSL Negation

```javascript
// Retrieval-Augmented Generation with semantic filtering
async function semanticRAG(query, corpus, excludedTopics) {
  const engine = new CSLEngine({ dim: 384 });

  // Get query embedding
  const queryVec = await embed(query);

  // Get excluded topic embeddings
  const excludeVecs = await Promise.all(excludedTopics.map(embed));

  // CSL NOT: remove all excluded topics from query
  const refinedQuery = engine.NOT_subspace(queryVec, excludeVecs, true);

  // Batch AND: score all corpus documents
  const scores = engine.batchAND(refinedQuery, corpus.vectors);

  // Return top results above threshold
  return corpus.items
    .map((item, i) => ({ item, score: scores[i] }))
    .filter(x => x.score > 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}
```

### 7.2 Multi-Agent Consensus Pipeline

```javascript
// Collect agent opinions and compute consensus
function agentConsensus(agentOutputs, confidences) {
  const engine = new CSLEngine({ dim: 384 });
  const ternary = new TernaryLogicEngine({ mode: 'lukasiewicz' });

  // Extract belief vectors and normalize confidence weights
  const beliefs = agentOutputs.map(o => o.beliefVector);
  const weights = confidences.map(c => Math.max(0, c));

  const { consensus, strength } = engine.CONSENSUS(beliefs, weights);

  // Evaluate consensus quality
  const quality = {
    strength,                                   // ‖Σwᵢaᵢ‖ ∈ [0,1]
    symbol: ternary.discretize(strength - 0.5), // map to ternary
    pairwiseAgreement: engine.pairwiseAND(beliefs)
      .map(row => row.reduce((s, x) => s + x, 0) / row.length), // mean per agent
  };

  return { consensus, quality };
}
```

### 7.3 Sacred Geometry Expert Routing

```javascript
// Route through the Sacred Geometry topology
// (Heady's 7-node flower-of-life expert arrangement)
function sacredGeometryRoute(input, experts) {
  const router = new MoECSLRouter({
    numExperts: 7,    // central + 6 petals
    topK: 2,
    temperature: 0.05, // very sharp selection
  });

  // Central expert covers all domains
  router.setExpertGate(0, experts.central.gate, { name: 'central-coordinator' });

  // 6 petal experts cover specialized domains
  for (let i = 0; i < 6; i++) {
    router.setExpertGate(i + 1, experts.petals[i].gate, {
      name: experts.petals[i].name,
    });
  }

  return router.route(input);
}
```

### 7.4 HDC Knowledge Graph

```javascript
// Build and query a knowledge graph as a single hypervector
function buildKnowledgeGraph(triples, codebook) {
  const hdc = new HDCOperations({ dim: 1536, type: 'real' });

  // Encode each triple (subject, predicate, object) as a bound pair
  const tripleVectors = triples.map(([s, p, o]) => {
    const sv = hdc.ENCODE(s, codebook);
    const pv = hdc.ENCODE(p, codebook);
    const ov = hdc.ENCODE(o, codebook);

    // Bind subject-object pair, then bind with predicate role
    const so = hdc.BIND(sv, ov);
    return hdc.BIND(so, pv);
  });

  // Bundle all triples into one holistic representation
  const { bundle } = hdc.BUNDLE(tripleVectors);
  return bundle;
}
```

---

## 8. Performance Considerations

### 8.1 Computational Complexity

| Operation     | Complexity  | Bottleneck          | GPU-friendly |
|---------------|-------------|---------------------|--------------|
| AND           | O(D)        | Dot product         | ✓ (GEMV)     |
| OR            | O(D)        | Element-wise add    | ✓            |
| NOT           | O(D)        | Dot + subtract      | ✓            |
| IMPLY         | O(D)        | Dot + scale         | ✓            |
| XOR           | O(D)        | Two projections     | ✓            |
| CONSENSUS     | O(n·D)      | Weighted sum        | ✓ (GEMV)     |
| GATE          | O(D) + O(1) | Dot + sigmoid       | ✓            |
| batchAND      | O(n·D)      | Matrix mult (GEMM)  | ✓✓ (best)    |
| pairwiseAND   | O(n²·D)     | Matrix mult         | ✓ (GEMM)     |
| BIND (conv)   | O(D²)       | Circular conv       | Partial      |
| BIND (XOR)    | O(D)        | Element-wise XOR    | ✓            |
| BUNDLE        | O(n·D)      | Weighted sum        | ✓            |
| PERMUTE       | O(D)        | Array reindex       | ✓            |

### 8.2 Memory Layout

For maximum GPU throughput, store vectors in row-major Float32Array batches:

```javascript
// Efficient batch storage: single contiguous buffer
const n = 1000, dim = 384;
const vectorBuffer = new Float32Array(n * dim);

// Access vector i: vectorBuffer.subarray(i * dim, (i+1) * dim)
// This layout enables BLAS GEMM operations
```

### 8.3 Dimension Selection

| Model                  | Dimension | Capacity | Use Case              |
|------------------------|-----------|----------|-----------------------|
| all-MiniLM-L6-v2       | 384       | ~96      | Fast, general purpose |
| all-mpnet-base-v2      | 768       | ~193     | Higher quality        |
| text-embedding-3-large | 1536      | ~385     | Maximum precision     |
| HDC (custom)           | 10000     | ~434/log | Near-exact orthogonality |

### 8.4 Precision Trade-offs

- **Float32:** Sufficient for cosine similarity (4-5 decimal places)
- **Float64:** Required for accumulation in CONSENSUS/BUNDLE (avoid catastrophic cancellation)
- **Best practice:** Float32 storage, Float64 intermediate computation

---

## 9. Numerical Stability Reference

### 9.1 Common Pitfalls

**Near-zero vectors:** Always check `norm(v) > EPSILON` before dividing. CSLEngine handles this internally by returning 0 for degenerate cases.

**Cosine saturation:** Clamp cosine values to [-1, +1] after computing — floating point arithmetic can yield values like 1.0000000002 due to rounding.

**BUNDLE of antipodal vectors:** `normalize(a + (-a)) = normalize(0)` is degenerate. The BUNDLE implementation returns `{ bundle: zeros, strength: 0.0 }` as a sentinel.

**Softmax overflow:** The MoE router uses the numerically stable softmax: subtract max before exponentiating. Always use this form.

**Circular convolution norm growth:** HRR BIND can grow in norm. The implementation normalizes after convolution to keep vectors on the unit sphere.

### 9.2 Epsilon Values

| Constant              | Value  | Used for                                       |
|-----------------------|--------|------------------------------------------------|
| `EPSILON`             | 1e-10  | General numerical comparisons                  |
| `ZERO_NORM_THRESHOLD` | 1e-8   | Detecting near-zero vectors before normalization|
| MoE `COLLAPSE_THRESHOLD` | 0.01 | Expert utilization below 1% = collapsed       |

### 9.3 Recovery Strategies

When CSLEngine operations return zero vectors (degenerate cases):
1. Check input vector norms before calling gates
2. Use `engine.validateVector(v)` to get specific error diagnostics
3. For CONSENSUS returning `strength = 0`: agents are in complete disagreement — escalate to human review or majority vote fallback

---

## 10. Extending CSL

### 10.1 Adding a New Gate

To add a new CSL gate (e.g., CSL BETWEEN — tests if a vector is between two others):

```javascript
// In csl-engine.js, inside the CSLEngine class:

/**
 * CSL BETWEEN — Tests if vector c is semantically between a and b.
 *
 * Formula: BETWEEN(a, b, c) = AND(c, OR(a,b)) - |AND(a,b)|
 *   High when c aligns with the a-b superposition
 *   while a and b are distinct (low pairwise similarity)
 *
 * @param {Float64Array} a
 * @param {Float64Array} b
 * @param {Float64Array} c - Candidate "between" vector
 * @returns {number} Betweenness score ∈ [-1, +1]
 */
BETWEEN(a, b, c) {
  const ab_union = this.OR(a, b);
  const c_to_union = this.AND(c, ab_union);
  const ab_sim = Math.abs(this.AND(a, b));
  return c_to_union - ab_sim;
}
```

### 10.2 Adding a New VSA Family

To support a new VSA family (e.g., FHRR with complex phase vectors):

```javascript
// In hdc-operations.js, add to the BIND method:
case 'complex_multiply': {
  // FHRR: element-wise complex multiplication
  // Input: pairs of (cos θ, sin θ) = phases
  const result = new Float64Array(d);
  for (let i = 0; i < d; i += 2) {
    const a_cos = a[i], a_sin = a[i+1];
    const b_cos = b[i], b_sin = b[i+1];
    // (cos θ_a + i sin θ_a)(cos θ_b + i sin θ_b)
    result[i]   = a_cos * b_cos - a_sin * b_sin;
    result[i+1] = a_cos * b_sin + a_sin * b_cos;
  }
  return result;
}
```

### 10.3 Adding a New Ternary Logic System

To add Priest's LP (Logic of Paradox, handles true contradictions):

```javascript
// In ternary-logic.js, add to _applyAND:
case 'priest_lp':
  // LP-AND: same as Kleene for AND
  return Math.min(a, b);

// And to _applyOR:
case 'priest_lp':
  // LP-OR: same as Kleene for OR
  return Math.max(a, b);

// But LP-IMPLY differs:
// LP-IMPLY: false implies true = true, but both-true → unknown
```

---

*Architecture guide compiled: March 7, 2026. Heady Connection AI Platform.*
