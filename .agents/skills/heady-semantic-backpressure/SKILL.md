---
name: heady-semantic-backpressure
description: >
  Use when implementing backpressure management for multi-agent swarms. Covers Google SRE adaptive
  throttling algorithm, semantic deduplication via cosine similarity, phi-derived pressure levels,
  circuit breaker with half-open probe, phi-weighted priority scoring, criticality-based load shedding,
  and upstream backpressure signal propagation. All thresholds use CSL gates and phi-continuous scaling.
  Keywords: backpressure, throttling, SRE, load shedding, circuit breaker, semantic dedup, deduplication,
  priority scoring, queue management, overload, agent overload, Heady backpressure, swarm pressure.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady Semantic Backpressure

## When to Use This Skill

Use this skill when you need to:

- Manage agent/swarm overload and queue depth
- Implement adaptive throttling (Google SRE pattern)
- Deduplicate semantically similar tasks
- Build circuit breakers for agent pipelines
- Score task priority for admission control
- Implement load shedding by criticality tier

## Architecture

```
Incoming Task → Semantic Dedup Check (cosine ≥ 0.927)
             → Priority Scoring (phi-weighted)
             → SRE Throttle Check: P(reject) = max(0, (req - 2×accepts) / (req+1))
             → Circuit Breaker Gate
             → Queue Admission (if depth < fib(13)=233)
             → Agent Execution
```

## Instructions

### 1. Phi-Derived Pressure Levels

Replace arbitrary percentage thresholds with phi-harmonic levels:

| Level | Range | Old Values | Action |
|-------|-------|------------|--------|
| NOMINAL | 0 – ψ² (0.382) | 0 – 40% | Normal operation |
| ELEVATED | ψ² – ψ (0.382 – 0.618) | 40 – 60% | Start monitoring |
| HIGH | ψ – (1-ψ³) (0.618 – 0.854) | 60 – 80% | Shed SHEDDABLE tasks |
| CRITICAL | > (1-ψ⁴) (0.910) | > 95% | Shed all non-CRITICAL_PLUS |

### 2. Semantic Deduplication

Threshold: `CSL_THRESHOLDS.CRITICAL ≈ 0.927` (replaces arbitrary 0.92)

When two tasks have cosine similarity ≥ this threshold, the lower-priority one is deduplicated (returned cached result or dropped).

### 3. Priority Scoring (phi-weighted)

```
score = phiPriorityScore(criticality_weight, urgency, user_impact)
      = crit × 0.528 + urgency × 0.326 + impact × 0.146
```

Criticality weights (Fibonacci):
- CRITICAL_PLUS: fib(7) = 13
- CRITICAL: fib(6) = 8
- SHEDDABLE_PLUS: fib(5) = 5
- SHEDDABLE: fib(3) = 2

### 4. SRE Adaptive Throttling

Google SRE algorithm with K=2.0, 2-minute rolling window:
```
P(reject) = max(0, (requests - K × accepts) / (requests + 1))
```

### 5. Circuit Breaker (phi-scaled)

- Failure threshold: fib(5) = 5 consecutive failures
- Recovery time: phi-scaled backoff from base
- Half-open state: probe with fib(4) = 3 test requests
- States: CLOSED → OPEN → HALF_OPEN → CLOSED

### 6. Queue Configuration

- Max depth: fib(13) = 233
- Dedup cache size: fib(17) = 1597
- Dedup cache TTL: fib(11) × 1000 = 89,000ms
- Eviction fraction: ψ⁴ ≈ 14.6%

## Evidence Paths

- `section2-agent-orchestration/modules/semantic-backpressure.js`
- `section2-agent-orchestration/modules/swarm-coordinator.js`
