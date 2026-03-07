# VSA Theory & Mathematical Foundations

## Vector Symbolic Architectures

Vector Symbolic Architectures (VSAs), also known as Hyperdimensional Computing (HDC), represent symbols as high-dimensional vectors (typically 1000-10000 dimensions) and manipulate them using algebraic operations.

### Core Principles

1. **High-Dimensional Quasi-Orthogonality**
   - Random vectors in high dimensions are approximately orthogonal
   - Similarity ≈ 0 for independent concepts
   - Enables reliable symbolic manipulation

2. **Structured Similarity**
   - Related concepts have measurable similarity
   - Distance encodes semantic relationships
   - Enables continuous reasoning

### VSA Implementations

#### FHRR (Fourier Holographic Reduced Representation)

Used in Heady implementation:

- **Domain**: Angles in [-π, π] (stored as [-1, 1])
- **Similarity**: Mean cosine of angle differences
  ```
  sim(a, b) = (1/d) Σᵢ cos(π(aᵢ - bᵢ))
  ```
- **Binding**: Element-wise multiplication
- **Bundling**: Element-wise average

#### Other VSA Types

- **BSC (Binary Spatter Codes)**: Binary {0,1} vectors, XOR binding
- **MAP (Multiply-Add-Permute)**: Real-valued, circular convolution
- **HRR (Holographic Reduced Representations)**: Complex-valued, FFT-based

## VSA Operations

### 1. Binding (⊗)

Creates **compositional structures**:

```
ROLE ⊗ FILLER = ROLE_FILLER
```

**Properties:**
- **Dissimilar**: `sim(A ⊗ B, A) ≈ 0`
- **Invertible**: `(A ⊗ B) ⊗ B ≈ A`
- **Commutative**: `A ⊗ B = B ⊗ A` (in FHRR)

**Use Cases:**
- Encoding key-value pairs: `NAME ⊗ "Eric"`
- Creating structured representations: `SUBJECT ⊗ CAT + VERB ⊗ EAT + OBJECT ⊗ FISH`

### 2. Bundling (+)

Creates **set-like superpositions**:

```
ANIMALS = CAT + DOG + BIRD
```

**Properties:**
- **Similar**: `sim(A + B, A) > 0`
- **Capacity**: Can bundle ~d/10 items before degradation (d = dimensionality)
- **Commutative**: `A + B = B + A`

**Use Cases:**
- Creating prototypes/categories
- Representing multiple possible values
- Fuzzy set membership

### 3. Permutation (P)

Encodes **sequences and order**:

```
SEQUENCE = X₀ + P(X₁) + P²(X₂)
```

**Properties:**
- **Invertible**: `P⁻¹(P(X)) = X`
- **Orthogonalizing**: `sim(P(X), X) ≈ 0` for large shifts

**Use Cases:**
- Ordered lists
- Time series encoding
- Stack/queue operations

### 4. Resonator Networks

**Cleanup/retrieval** operation:

```
query → find argmax_{item ∈ codebook} sim(query, item)
```

**Properties:**
- **Associative memory**: Noisy input → clean output
- **Content-addressable**: Query by similarity
- **Graceful degradation**: Partial matches still work

## Integration with Continuous Semantic Logic

### Fuzzy Logic Mapping

Traditional fuzzy logic uses [0,1] truth values and T-norms/conorms:

- **AND (T-norm)**: `min(a,b)` or `a·b`
- **OR (T-conorm)**: `max(a,b)` or `a+b-a·b`
- **NOT**: `1-a`

VSA provides **semantic grounding** for these operations:

```
truth_value(concept) = (1/d) Σᵢ (cᵢ + 1)/2
```

Maps hypervector to [0,1] truth value.

### Continuous Gates

**Traditional** (discrete):
```javascript
if (condition) {
  action_a();
} else {
  action_b();
}
```

**VSA/CSL** (continuous):
```javascript
const gate_a = gates.soft_gate(condition, threshold, steepness);
const gate_b = gates.continuous_not(gate_a);
const result_a = action_a_value * gate_a;
const result_b = action_b_value * gate_b;
const final = result_a + result_b; // Weighted combination
```

All paths computed; weights determine influence.

## Phi-Scale Integration

Golden ratio (φ ≈ 1.618) appears in Heady's architecture. VSA integration:

1. **Magnitude mapping**: `|HV| → [0, φ]`
2. **Optimal thresholds**: Use φ-1 ≈ 0.618 for soft gates
3. **Equilibrium points**: Phi-bounded continuous ranges

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Time (4096d) |
|-----------|-----------|--------------|
| Similarity | O(d) | ~0.02ms |
| Binding | O(d) | ~0.01ms |
| Bundling | O(n·d) | ~0.05ms (n=3) |
| Query | O(m·d) | ~2ms (m=100) |

### Space Complexity

- **Per hypervector**: 4d bytes (Float32)
- **4096 dimensions**: 16KB per vector
- **Codebook (1000 concepts)**: ~16MB

### Scaling Laws

- **Dimensionality vs. Accuracy**: Exponential improvement
  - 1024d: 90% retrieval accuracy
  - 4096d: 99.9% retrieval accuracy
  - 10000d: 99.99%+ retrieval accuracy

- **Bundle capacity**: `~d/10` items at 95% accuracy
  - 4096d: ~400 bundled items
  - Degradation is graceful (not catastrophic)

## References

1. **Kanerva, P. (2009)**. "Hyperdimensional Computing"
2. **Plate, T. A. (2003)**. "Holographic Reduced Representation"
3. **Gayler, R. W. (2003)**. "Vector Symbolic Architectures"
4. **Rahimi et al. (2017)**. "Hyperdimensional Computing for Robotics"
5. **Schlegel et al. (2021)**. "Comparison of VSAs"
