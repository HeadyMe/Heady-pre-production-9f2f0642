# Mathematical Foundations of Continuous Semantic Logic

## Fuzzy Logic Operators

### Zadeh T-Norms (Min/Max)
- **AND**: `min(a, b)` — conservative conjunction
- **OR**: `max(a, b)` — conservative disjunction  
- **NOT**: `1 - x` — standard negation

### Product T-Norms (Multiplicative)
- **AND**: `a × b` — multiplicative conjunction (dampens more than min)
- **OR**: `a + b - a×b` — probabilistic sum
- **NOT**: `1 - x`

### Łukasiewicz T-Norms (Bounded)
- **AND**: `max(0, a + b - 1)` — bounded difference
- **OR**: `min(1, a + b)` — bounded sum
- **NOT**: `1 - x`

## Membership Functions

### Triangular
```
μ(x) = {
  0                    if x ≤ a or x ≥ c
  (x - a)/(b - a)     if a < x ≤ b
  (c - x)/(c - b)     if b < x < c
}
```

### Gaussian
```
μ(x) = exp(-0.5 × ((x - μ)/σ)²)
```

### Sigmoid
```
μ(x) = 1 / (1 + exp(-k(x - c)))
```

## References
- Zadeh, L.A. (1965). "Fuzzy Sets". Information and Control.
- Wikipedia: Fuzzy Logic
- IBM BioFuzzNet: Deep Differentiable Fuzzy Logic Networks
- NIH: Transforming Boolean Models to Continuous Models
