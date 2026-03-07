---
name: heady-phi-math-foundation
description: >
  Use when designing, implementing, or refactoring any Heady system component to use phi-continuous
  scaling instead of arbitrary fixed constants. Covers golden ratio (φ ≈ 1.618) derived thresholds,
  Fibonacci-sized caches/queues/batches, CSL gate constants, phi-harmonic backoff, adaptive intervals,
  pressure levels, alert thresholds, token budgets, eviction weights, and fusion scoring.
  Keywords: phi, golden ratio, Fibonacci, Sacred Geometry, CSL thresholds, phi-math, continuous scaling,
  no magic numbers, phi-backoff, phi-threshold, Heady constants, phi-continuous.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Phi-Math Foundation

## When to Use This Skill

Use this skill when you need to:

- Replace arbitrary fixed constants (0.5, 0.7, 0.85, 100, 500, 1000) with phi-derived values
- Design cache sizes, queue depths, batch sizes, or pool limits using Fibonacci numbers
- Configure thresholds, weights, or ratios using the golden ratio
- Implement backoff/retry timing using φ-scaled exponential delays
- Create CSL gate threshold hierarchies (CRITICAL → HIGH → MEDIUM → LOW → MINIMUM)
- Set up pressure/alert levels, token budgets, eviction scoring, or fusion weights
- Ensure any Heady module follows the "no magic numbers" principle

## Core Constants

```
φ  = (1 + √5) / 2  ≈ 1.6180339887   (golden ratio)
ψ  = 1 / φ          ≈ 0.6180339887   (conjugate)
φ² = φ + 1          ≈ 2.6180339887
φ³ = 2φ + 1         ≈ 4.2360679775
```

Key identities:
- `φ² = φ + 1`
- `1/φ = φ - 1`
- `φⁿ = F(n)·φ + F(n-1)` (Fibonacci-phi relationship)
- `lim F(n+1)/F(n) = φ` (Fibonacci ratio convergence)

## Instructions

### 1. Replacing Thresholds with Phi-Harmonic Levels

Use `phiThreshold(level, spread=0.5) = 1 - ψ^level × spread`:

| Level | Value  | Use For |
|-------|--------|---------|
| 0     | ≈0.500 | MINIMUM — noise floor |
| 1     | ≈0.691 | LOW — weak alignment |
| 2     | ≈0.809 | MEDIUM — moderate alignment |
| 3     | ≈0.882 | HIGH — strong alignment |
| 4     | ≈0.927 | CRITICAL — near-certain |

Standard CSL gate thresholds:
- `CSL_THRESHOLDS.CRITICAL = phiThreshold(4) ≈ 0.927`
- `CSL_THRESHOLDS.HIGH = phiThreshold(3) ≈ 0.882`
- `CSL_THRESHOLDS.MEDIUM = phiThreshold(2) ≈ 0.809`
- `CSL_THRESHOLDS.LOW = phiThreshold(1) ≈ 0.691`
- `CSL_THRESHOLDS.MINIMUM = phiThreshold(0) ≈ 0.500`
- `DEDUP_THRESHOLD ≈ 0.972` (above CRITICAL, for semantic identity)
- `COHERENCE_DRIFT_THRESHOLD = CSL_THRESHOLDS.MEDIUM ≈ 0.809`

### 2. Replacing Sizes with Fibonacci Numbers

Use `fib(n)` for cache sizes, queue depths, batch sizes:

| fib(n) | Value | Common Replacement |
|--------|-------|--------------------|
| fib(5) | 5     | failure thresholds |
| fib(6) | 8     | batch eviction size |
| fib(7) | 13    | small limits, trial days |
| fib(8) | 21    | HNSW m parameter, rerankTopK |
| fib(9) | 34    | sliding window buckets |
| fib(10)| 55    | max entities, ring buffer |
| fib(11)| 89    | efSearch, retention days |
| fib(12)| 144   | ef_construction (large) |
| fib(13)| 233   | queue depths |
| fib(14)| 377   | pattern stores |
| fib(16)| 987   | cache sizes |
| fib(17)| 1597  | history buffers |
| fib(20)| 6765  | large LRU caches |

### 3. Phi-Scaled Weights and Fusion

For N-factor score fusion:
- `phiFusionWeights(2)` → `[0.618, 0.382]` (replaces [0.6, 0.4])
- `phiFusionWeights(3)` → `[0.528, 0.326, 0.146]` (replaces [0.4, 0.35, 0.25])

For priority scoring: `phiPriorityScore(factor1, factor2, factor3)` applies phi-weighted factors.

For eviction: `EVICTION_WEIGHTS = { importance: 0.486, recency: 0.300, relevance: 0.214 }`

### 4. Phi-Backoff Timing

`phiBackoff(attempt, baseMs=1000, maxMs=60000)`:
- Attempt 0: 1000ms
- Attempt 1: 1618ms
- Attempt 2: 2618ms
- Attempt 3: 4236ms
- Attempt 4: 6854ms
- Attempt 5: 11090ms

With jitter: ±ψ² (≈ ±38.2%)

### 5. Pressure Levels (replacing arbitrary 0.60/0.80/0.95)

```
NOMINAL:   0 → ψ²    ≈ 0 – 0.382
ELEVATED:  ψ² → ψ    ≈ 0.382 – 0.618
HIGH:      ψ → 1-ψ³  ≈ 0.618 – 0.854
CRITICAL:  > 1-ψ⁴    ≈ 0.910+
```

### 6. Alert Thresholds (replacing arbitrary 0.80/0.95/1.00)

```
warning:  ψ       ≈ 0.618
caution:  1-ψ²    ≈ 0.764
critical: 1-ψ³    ≈ 0.854
exceeded: 1-ψ⁴    ≈ 0.910
hard_max: 1.0
```

### 7. Token Budgets (phi-geometric progression)

`phiTokenBudgets(base=8192)`:
- working:  8192 (base)
- session:  21450 (base × φ²)
- memory:   56131 (base × φ⁴)
- artifacts: 146920 (base × φ⁶)

### 8. CSL Gate Integration (replacing hard if/else)

Use `cslGate(value, cosScore, tau, temp)` for smooth sigmoid gating:
```
output = value × sigmoid((cosScore - τ) / temperature)
```

Use `cslBlend(weightHigh, weightLow, cosScore, tau)` for smooth weight interpolation.

Use `adaptiveTemperature(entropy, maxEntropy)` for entropy-responsive softmax.

### 9. Resource Allocation

`phiResourceWeights(5)` → [0.387, 0.239, 0.148, 0.092, 0.057]
Maps to: Hot:34%, Warm:21%, Cold:13%, Reserve:8%, Governance:5%

`phiMultiSplit(whole, n)` — recursive ψ-geometric series for N-way splits.

## Reference Implementation

The canonical implementation is `shared/phi-math.js` in the Heady repository, providing all functions listed above as ES module exports.

## Evidence Paths

- `shared/phi-math.js` — canonical phi-math foundation module
- `src/resilience/exponential-backoff.js` — phi-backoff in production
- All section modules that import from shared/phi-math.js
