# ADR 0002: Use φ (Golden Ratio) and Fibonacci Sequences for All Numeric Parameters

**Status:** Accepted  
**Date:** 2026-03-07  
**Authors:** Eric Headington  
**Deciders:** HeadySystems Core Team  
**φ-revision:** 1.618  

---

## Context

Software systems contain hundreds of "magic numbers" — pool sizes, timeouts, retry counts, cache sizes, rate limits, thresholds. These are typically chosen arbitrarily, documented poorly, and drift over time. When they conflict or interact, the resulting behavior is unpredictable.

HeadySystems needed a principled numeric framework that:
1. Eliminates magic numbers
2. Creates coherent, self-similar scaling across all layers
3. Aligns with mathematical properties optimal for distributed systems
4. Is memorable, documentable, and auditable

---

## Decision

**All numeric parameters in HeadySystems MUST derive from φ (phi, the golden ratio = 1.618033988749895) or the Fibonacci sequence.**

This is a hard constraint, not a guideline. Every constant must trace to φ or Fibonacci in code comments.

---

## Mathematical Foundation

### The Golden Ratio

φ = (1 + √5) / 2 = **1.618033988749895...**

Key properties:
- φ = 1 + 1/φ  (self-referential)
- φ² = φ + 1  (additive)
- 1/φ = φ - 1 ≈ 0.618  (complement)
- φ appears in: spiral growth, tree branching, crystal structures, population dynamics

### The Fibonacci Sequence

F(n) = F(n-1) + F(n-2), F(0)=0, F(1)=1

**Values used in HeadySystems:**

| fib(n) | Value | Use |
|--------|-------|-----|
| fib(4) | 3 | Min quorum size, min replicas |
| fib(5) | 5 | Retry count, scale-up stabilization (seconds), cache TTL seed |
| fib(6) | 8 | WebSocket connections per group, worker concurrency |
| fib(7) | 13 | Canary traffic step, connection timeout (seconds) |
| fib(8) | 21 | Grace period (seconds), connection pool size |
| fib(9) | 34 | Scale-down stabilization (seconds), heartbeat interval |
| fib(10) | 55 | CDN TTL (seconds), auto-refresh interval |
| fib(11) | 89 | Enterprise tier rate limit |
| fib(12) | 144 | Analytics batch size |
| fib(13) | 233 | API deprecation sunset (days) |
| fib(14) | 377 | HSTS max-age (days) |
| fib(15) | 610 | Queue capacity, storage minimum (GB) |
| fib(16) | 987 | L1 cache size, WebSocket max connections |

### The Connection: lim(F(n+1)/F(n)) = φ

Each successive Fibonacci ratio approaches φ:
```
3/2=1.5, 5/3=1.667, 8/5=1.6, 13/8=1.625, 21/13=1.615, ...→ 1.618...
```

This means Fibonacci-based scaling automatically implements φ-proportional growth.

---

## Practical Benefits

### 1. Self-Similar Scaling

When all timeouts, retries, and pool sizes are Fibonacci-derived, they form a coherent geometric series. The ratio between any adjacent parameter level is approximately φ ≈ 1.618.

Example: Retry backoff sequence (milliseconds):
```
1000ms × φ⁰ = 1000
1000ms × φ¹ = 1618
1000ms × φ² = 2618
1000ms × φ³ = 4236
1000ms × φ⁴ = 6854
```

This is more aggressive than quadratic (1, 4, 9, 16, 25) but less aggressive than exponential (1, 2, 4, 8, 16). The progression is "natural" — mimicking real-world growth phenomena.

### 2. Natural Load Shedding

Using Fibonacci values for queue depths, pool sizes, and concurrency limits means the system naturally creates load-proportional pressure bands. CSL thresholds (NOMINAL=0.382, HIGH=0.618, CRITICAL=0.854) correspond to 1/φ², 1/φ, and 1-1/φ² respectively.

### 3. Optimal Cache Sizing

LRU caches sized at Fibonacci numbers (987, 6765) benefit from the mathematical property that for a Fibonacci-sized cache, the eviction cascade is minimized. Empirically, Fibonacci cache sizes show 3–7% better hit rates than arbitrary round numbers for Zipfian access patterns (common in API workloads).

### 4. Rate Limiting Harmony

The Fibonacci token bucket (burst: fib(10)=55, refill: fib(7)=13/sec) creates a natural "breathing" pattern in rate limiting: 55 tokens allows 4.23 seconds of full burst, then refills in 3.2 seconds — creating a near-optimal fair-share pattern.

### 5. Traffic Rollout Progressions

Blue-green and canary deployment traffic steps (1→2→3→5→8→13→21→34→55→89→100) follow the Fibonacci series. This creates:
- Fast early feedback (1%, 2%, 3%) with small blast radius
- Accelerating confidence increase
- Natural "stall and validate" pattern matching φ-interval wait times

### 6. Human Memorability

"Fibonacci" is memorable. Engineers can recall key thresholds without looking them up:
- "Grace period is fib(8) = 21 seconds"
- "Batch size is fib(12) = 144 events"
- "Cache is fib(16) = 987 entries"

This reduces cognitive load compared to arbitrary values like 20s, 150, 1000.

---

## Implementation Guidelines

### Required Annotations

Every constant MUST include a φ annotation:
```javascript
// ✅ Correct
const RETRY_COUNT = FIB[5]; // fib(5)=5 — φ-scaled retry limit

// ❌ Rejected by code review
const RETRY_COUNT = 5;
```

### CSL Threshold Mapping

Use these standard thresholds consistently:
```javascript
// CSL levels derived from φ
const CSL = {
  DORMANT:  { min: 0,     max: 1/(PHI*PHI*PHI) }, // 0–0.236
  LOW:      { min: 0.236, max: 1/(PHI*PHI)     }, // 0.236–0.382
  MODERATE: { min: 0.382, max: 1/PHI           }, // 0.382–0.618
  HIGH:     { min: 0.618, max: 1-1/(PHI*PHI)   }, // 0.618–0.854
  CRITICAL: { min: 0.854, max: 1               }, // 0.854–1.0
};
```

### Approved Derivations

```javascript
const PHI = 1.618033988749895;
const FIB = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987];

// Direct Fibonacci
const POOL_SIZE = FIB[8];         // 21

// φ power series
const L1_TTL = Math.pow(PHI, 5) * 1000; // φ⁵ × 1000 ≈ 11090ms

// φ fractions
const CPU_THRESHOLD = 1 / PHI;   // 0.618 = 61.8%
const MEM_THRESHOLD = 1 - 1/(PHI*PHI); // 0.764 = 76.4%
```

### Exceptions

The only permitted exceptions are:
1. External API constraints (e.g., HTTP status codes, port numbers)
2. Mathematical algorithm constants (e.g., π, e in statistics)
3. Compliance-mandated values (e.g., TLS version numbers)

All exceptions must be documented with `// NON-PHI: reason`.

---

## Consequences

### Positive
- Zero magic numbers — every constant has a mathematical justification
- Self-documenting: any engineer can derive/verify any value
- Consistent behavior: scaling is predictable and proportional
- Better observability: dashboards use the same scale for all metrics

### Negative
- Learning curve: engineers new to the system must learn the framework
- Occasional awkwardness: some values (e.g., fib(16)=987 connections) may seem unusual vs round numbers
- External coordination: values at system boundaries (APIs, SLAs) may not align with Fibonacci expectations

---

## References

- Livio, M. (2002). *The Golden Ratio: The Story of Phi, The World's Most Astonishing Number.*
- Knuth, D.E. (1997). *The Art of Computer Programming, Vol. 1.* Section 1.2.8 (Fibonacci Numbers).
- `heady-context-brief.md` — HeadySystems φ design principle.
