# ADR 0003: Replace Boolean Logic with Continuous Semantic Logic (CSL)

**Status:** Accepted  
**Date:** 2026-03-07  
**Authors:** Eric Headington  
**Deciders:** HeadySystems Core Team  
**φ-revision:** 1.618  

---

## Context

Traditional software uses boolean logic extensively: a request is either authorized or not, a task is complete or incomplete, a service is healthy or unhealthy, a memory is relevant or irrelevant.

For HeadySystems — a platform for AI agent orchestration — boolean logic creates a fundamental impedance mismatch with the probabilistic, continuous nature of AI reasoning. Agents deal with:
- Partial information (not completely relevant, but not irrelevant)
- Graduated confidence (not fully certain, but not guessing)
- Incremental task completion (not done, not not-done)
- Fuzzy authorization (not clearly safe, not clearly dangerous)

The question was: should we adapt boolean logic with degrees (e.g., fuzzy logic), or redesign the fundamental value type?

---

## Decision

**Replace boolean logic with Continuous Semantic Logic (CSL) across all HeadySystems systems. CSL represents all semantic values as floating-point numbers in [0.0, 1.0], with φ-derived threshold bands replacing discrete true/false.**

CSL is implemented in `@headysystems/semantic-logic`.

---

## CSL Specification

### Value Space

CSL values ∈ [0.0, 1.0] where:
- 0.0 = complete absence / fully false
- 1.0 = complete presence / fully true
- Intermediate values represent degrees of truth/presence

### φ-Derived Threshold Bands

Rather than a binary split at 0.5, CSL uses φ-derived bands:

```
DORMANT:  [0.000, 0.236)  — nearly zero, inactive, negligible
LOW:      [0.236, 0.382)  — present but sub-threshold
MODERATE: [0.382, 0.618)  — meaningful, attention-worthy
HIGH:     [0.618, 0.854)  — strong, elevated, action-warranted
CRITICAL: [0.854, 1.000]  — maximum, urgent, forced response
```

Why these numbers?
- 0.236 ≈ 1/φ³  (third golden power)
- 0.382 = 1/φ²  (second golden power)
- 0.618 = 1/φ   (first golden power, the "golden ratio" complement)
- 0.854 ≈ 1 - 1/φ²

### CSL Gates (replacing if/else)

| Boolean | CSL Equivalent |
|---------|---------------|
| `if (x) {}` | `if (csl >= 0.618) {}` — act when CSL is HIGH+ |
| `if (!x) {}` | `if (csl < 0.382) {}` — suppress when MODERATE- |
| `x && y` | `Math.min(x, y)` — conjunctive AND |
| `x \|\| y` | `Math.max(x, y)` — disjunctive OR |
| `!x` | `1.0 - x` — complement |
| `x > threshold` | `csl > 0.618` — graduated threshold |

---

## Why CSL Beats Booleans for AI Systems

### 1. The Binary Lie

Consider agent memory retrieval. A boolean system asks: "Is this memory relevant? Yes/No."

Reality: a memory might be 73% relevant — enough to include as context, but not to treat as authoritative. A boolean "relevant" would inflate its importance; a boolean "irrelevant" would discard useful signal.

CSL returns 0.73, and the consumer decides whether that passes its 0.618 threshold.

### 2. Graceful Degradation

Boolean systems fail hard when thresholds are crossed:
```javascript
// Boolean: catastrophic threshold
if (errorRate > 0.05) { circuit.open(); }  // open at 5.1%, closed at 4.9%

// CSL: graduated response
const pressure = csl(errorRate);
if (pressure > 0.854) { circuit.open(); }      // force-open
else if (pressure > 0.618) { circuit.half(); } // half-open
else if (pressure > 0.382) { alertOps(); }     // warn
```

### 3. Composable Confidence

Multi-agent systems need to combine confidence scores from multiple agents:
```javascript
// Boolean: requires unanimous agreement or loses precision
const authorized = agentA.check() && agentB.check() && agentC.check();

// CSL: geometric mean preserves gradation
const authorized = Math.pow(agentA.csl() * agentB.csl() * agentC.csl(), 1/3);
// Result: 0.7 confidence from [0.8, 0.75, 0.55] — still acts, but with reduced certainty
```

### 4. Memory Relevance Scoring

Vector memory returns cosine similarity scores ∈ [-1, 1]. Normalizing to [0, 1] gives a direct CSL score. Boolean systems must choose an arbitrary cutoff; CSL systems use the full information.

### 5. Rate Limiting Refinement

Instead of "allowed / blocked," CSL rate limiting creates response quality gradations:
- CSL > 0.854: Full response
- CSL 0.618–0.854: Compressed response, lower priority
- CSL 0.382–0.618: Queued, delayed response
- CSL < 0.382: Rate-limited response with Retry-After header

This prevents "cliff edges" in API behavior.

### 6. Authorization Nuance

Zero-trust security benefits from CSL:
- CSL 1.0: Full capabilities, no audit
- CSL 0.618: Full capabilities, audit all actions
- CSL 0.382: Read-only capabilities
- CSL 0.236: Request human review
- CSL 0.0: Block

The `@heady-ai/core` capability bitmask is multiplied by the CSL score before checking permissions.

---

## Implementation Pattern

```javascript
// @headysystems/semantic-logic
class CSLGate {
  static DORMANT   = 0.236;
  static LOW       = 0.382;
  static MODERATE  = 0.618;
  static HIGH      = 0.854;
  static PHI       = 1.618033988749895;

  static and(a, b)    { return Math.min(a, b); }
  static or(a, b)     { return Math.max(a, b); }
  static not(a)       { return 1.0 - a; }
  static boost(a)     { return Math.min(1.0, a * CSLGate.PHI); }
  static suppress(a)  { return a / CSLGate.PHI; }

  static level(score) {
    if (score < 0.236) return 'DORMANT';
    if (score < 0.382) return 'LOW';
    if (score < 0.618) return 'MODERATE';
    if (score < 0.854) return 'HIGH';
    return 'CRITICAL';
  }

  static route(score, handlers) {
    const level = CSLGate.level(score);
    return handlers[level]?.(score) ?? handlers.default?.(score);
  }
}
```

---

## Migration from Booleans

All new code MUST use CSL. Legacy boolean code is migrated using:

1. `true` → `1.0`
2. `false` → `0.0`
3. `if (x)` → `if (x >= 0.618)` (HIGH threshold = confident yes)
4. `if (!x)` → `if (x < 0.382)` (MODERATE threshold = confident no)
5. `x && y` → `Math.min(x, y)`
6. `x || y` → `Math.max(x, y)`

---

## Consequences

### Positive
- Gradual degradation rather than cliff edges
- Composable confidence across agents
- Natural alignment with ML outputs (probabilities, similarities)
- Richer audit logs (CSL score vs. binary flag)
- Unified semantics across all system layers

### Negative
- Mental model shift: engineers must think in degrees, not true/false
- Test coverage: CSL ranges require parametric testing, not just `true`/`false` cases
- External APIs: boolean conversion at API boundaries requires clear documentation
- Debugging: "why did this score 0.614?" requires more explanation than "why was this false?"

### Mitigations
- All CSL thresholds are documented in a central constants file
- `CSLGate.level()` provides human-readable labels for logs
- API responses include both the CSL score and the derived boolean for compatibility
- Test utilities include CSL boundary helpers

---

## References

- Zadeh, L.A. (1965). Fuzzy sets. *Information and Control.*
- Goguen, J.A. (1967). L-fuzzy sets.
- HeadySystems `@headysystems/semantic-logic` — CSL implementation.
- ADR 0002: φ scaling provides the threshold values.
