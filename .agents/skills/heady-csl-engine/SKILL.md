---
name: heady-csl-engine
description: >
  Use when implementing or extending Continuous Semantic Logic (CSL) — Heady's core geometric AI
  innovation using vector operations as logical gates. Covers CSL AND (cosine), OR (superposition),
  NOT (orthogonal projection), IMPLY (projection), XOR, CONSENSUS, GATE operations, plus HDC/VSA
  binding and bundling, MoE cosine routing, ternary logic, and mathematical proofs.
  60+ provisional patents. All parameters use phi-continuous scaling.
  Keywords: CSL, Continuous Semantic Logic, geometric logic, vector logic, cosine gate, orthogonal
  projection, semantic NOT, HDC, hyperdimensional computing, VSA, vector symbolic, MoE router,
  ternary logic, Heady CSL, geometric AI, Sacred Geometry logic.
metadata:
  author: eric-head
  version: '2.0'
---

# Heady CSL Engine (Continuous Semantic Logic)

## When to Use This Skill

Use this skill when you need to:

- Implement or extend CSL geometric logic gates
- Use vector operations for logical reasoning (AND, OR, NOT, IMPLY, XOR)
- Build consensus from multiple agent opinions via superposition
- Route tasks using cosine-based Mixture-of-Experts
- Implement hyperdimensional computing (HDC/VSA) for symbolic operations
- Handle uncertainty with ternary logic (TRUE/UNKNOWN/FALSE)
- Prove mathematical properties of CSL operations

## CSL Gate Definitions

### Domain

Unit vectors in ℝᴰ, D ∈ {384, 1536}. Truth value: τ(a,b) = cos(θ) ∈ [-1, +1]

+1 = aligned (TRUE), 0 = orthogonal (UNKNOWN), -1 = antipodal (FALSE)

### Operations

| Gate | Formula | Interpretation |
|------|---------|---------------|
| **AND** | cos(a, b) = (a·b)/(‖a‖·‖b‖) | Semantic alignment measure |
| **OR** | normalize(a + b) | Superposition (soft union) |
| **NOT** | a - proj_b(a) = a - (a·b/‖b‖²)·b | Orthogonal projection (semantic negation) |
| **IMPLY** | proj_b(a) = (a·b/‖b‖²)·b | Component of a in direction of b |
| **XOR** | normalize(a+b) - proj_mutual | Exclusive components |
| **CONSENSUS** | Σ(wᵢ·vᵢ) / ‖Σ(wᵢ·vᵢ)‖ | Weighted centroid (agent agreement) |
| **GATE** | value × σ((cos - τ) / temp) | Soft sigmoid gating |

### Key Properties (proven)

- AND: commutative, associative (in the limit)
- NOT: idempotent (NOT(NOT(a,b),b) = NOT(a,b)), orthogonality verified (NOT(a,b)·b = 0)
- OR over AND: approximately distributive
- GATE: bounded, non-constant, differentiable → valid activation function

## Instructions

### 1. Phi-Scaled Gate Parameters

- Default gate threshold: `CSL_THRESHOLDS.MINIMUM ≈ 0.500` (noise floor)
- Default temperature: `PHI_TEMPERATURE = ψ³ ≈ 0.236`
- Phi-level gates: `phiGATE(input, gateVec, level)` uses `phiThreshold(level)`
- Adaptive gates: `adaptiveGATE(input, gateVec, entropy, maxEntropy)` auto-adjusts temperature

### 2. HDC/VSA Operations

Three vector families supported:
- **Binary BSC**: XOR binding, majority bundling {0,1}ᴰ
- **Bipolar MAP**: multiply binding {-1,+1}ᴰ
- **Real HRR**: circular convolution binding ℝᴰ

Core operations:
- `BIND(a, b)`: Create compositional representations
- `BUNDLE(vectors)`: Aggregate (consensus/similarity)
- `PERMUTE(a, n)`: Sequence encoding via cyclic shift
- `ENCODE/DECODE`: Map values to/from hypervectors via codebooks

Capacity: ~96 items at D=384 (analytical estimate)

### 3. MoE Router (CSL-based)

Cosine similarity routing instead of learned linear weights:
```
scores[i] = cos(input, expertGate[i])
probs = softmax(scores / temperature)
selected = topK(probs, k=fib(3)=2)
```

- Temperature: `PHI_TEMPERATURE ≈ 0.236` (adaptive via entropy)
- Anti-collapse weight: `ψ⁸ ≈ 0.0131`
- Collapse detection threshold: `ψ⁹ ≈ 0.0081`
- Expert init: `(Math.random() - PSI) * PHI`

### 4. Ternary Logic

Continuous mapping to vector space:
- TRUE: cos ≈ +1 (aligned)
- UNKNOWN: cos ≈ 0 (orthogonal)
- FALSE: cos ≈ -1 (antipodal)

Threshold: `CSL_THRESHOLDS.MINIMUM ≈ 0.500`

Five modes: Kleene K3, Łukasiewicz (bounded sum), Gödel, Product, CSL-continuous

### 5. Benchmarking CSL vs Traditional

CSL NOT achieves 100% semantic negation success vs 32% for probabilistic NOT.
CSL routing is 5× faster than LLM classification (0.1s vs 0.59s), 43% cheaper.

## Theoretical References

- Birkhoff & von Neumann (1936): quantum logic → propositions as Hilbert subspaces
- Widdows (ACL 2003): orthogonal negation → `(a NOT b) = a - (a·b)b`
- Grand et al. (Nature 2022): semantic projection recovers human judgments
- Kanerva (1988): sparse distributed memory → hyperdimensional computing

## Evidence Paths

- `section5-csl-geometric/engine/csl-engine.js`
- `section5-csl-geometric/engine/hdc-operations.js`
- `section5-csl-geometric/engine/moe-csl-router.js`
- `section5-csl-geometric/modules/ternary-logic.js`
- `section5-csl-geometric/docs/csl-mathematical-proofs.md`
- `src/vector-space-ops.js`
