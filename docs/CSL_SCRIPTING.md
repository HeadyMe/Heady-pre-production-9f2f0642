# CSL Scripting Language Reference

## Overview

The **Continuous Semantic Logic (CSL)** scripting language allows you to write Heady logic scripts **without traditional if/else branching**. Instead, all logic flows through continuous VSA-based semantic gates.

## Syntax Elements

### Comments

```csl
# This is a comment
# Comments start with # and continue to end of line
```

### Variable Assignment

```csl
@variable_name = expression
```

Variables are prefixed with `@` in definitions and `$` in references.

### Concept References

```csl
HEADY              # Atomic concept (uppercase)
SEMANTIC_LOGIC     # Underscore-separated concept name
```

Concepts must exist in the active codebook.

### Gate Invocations

```csl
resonance_gate(CONCEPT_A, CONCEPT_B)
superposition_gate(C1, C2, C3)
soft_gate(0.7, 0.618, 10)
```

### Numeric Literals

```csl
0.618              # Float
1                  # Integer (converted to float)
```

### Variable References

```csl
@result = continuous_and($var_a, $var_b)
```

Use `$` to reference previously assigned variables.

## Built-in Gates

### Semantic Gates

#### `resonance_gate(concept_a, concept_b) → number`

Measures semantic similarity between two concepts.

**Parameters:**
- `concept_a`: String (concept name) or Hypervector
- `concept_b`: String (concept name) or Hypervector

**Returns:** Similarity score [0, 1]

**Example:**
```csl
@match = resonance_gate(HEADY, SEMANTIC)
# Returns ~0.0-0.6 for orthogonal concepts
```

#### `superposition_gate(...concepts) → Hypervector`

Bundles multiple concepts into a unified representation.

**Parameters:**
- `...concepts`: Variable number of concept names

**Returns:** Bundled hypervector

**Example:**
```csl
@state = superposition_gate(INPUT, AGENT, HEADY)
# Creates composite state vector
```

#### `orthogonal_gate(concept_a, concept_b) → number`

Measures semantic independence (1 - resonance).

**Returns:** Orthogonality [0, 1]

**Example:**
```csl
@distinctness = orthogonal_gate(CAT, DATABASE)
# High value = very different concepts
```

#### `composition_gate(...concepts) → Hypervector`

Creates ordered compositional structure using binding.

**Example:**
```csl
@structured = composition_gate(SUBJECT, VERB, OBJECT)
# Preserves order: SUBJECT before VERB before OBJECT
```

#### `query_gate(query_vector, threshold, topK) → Array`

Queries codebook for similar concepts.

**Parameters:**
- `query_vector`: Hypervector to query
- `threshold`: Minimum similarity (default: 0.5)
- `topK`: Number of results (default: 3)

**Returns:** Array of {name, similarity, metadata}

### Continuous Logic Gates

#### `continuous_and(a, b) → number`

Fuzzy conjunction using product T-norm.

**Formula:** `a × b`

**Example:**
```csl
@both_true = continuous_and(0.8, 0.9)
# Returns 0.72
```

#### `continuous_or(a, b) → number`

Fuzzy disjunction using probabilistic T-conorm.

**Formula:** `a + b - a × b`

**Example:**
```csl
@either_true = continuous_or(0.6, 0.7)
# Returns 0.88
```

#### `continuous_not(a) → number`

Fuzzy negation.

**Formula:** `1 - a`

**Example:**
```csl
@inverted = continuous_not(0.3)
# Returns 0.7
```

#### `continuous_implies(a, b) → number`

Fuzzy implication (Gödel).

**Formula:** `a ≤ b ? 1 : b`

**Example:**
```csl
@if_then = continuous_implies(0.8, 0.9)
# Returns 1.0 (antecedent ≤ consequent)
```

#### `soft_gate(value, threshold, steepness) → number`

Smooth sigmoid threshold gate.

**Parameters:**
- `value`: Input [0, 1]
- `threshold`: Activation point (default: 0.618)
- `steepness`: Transition sharpness (default: 10)

**Formula:** `1 / (1 + exp(-steepness × (value - threshold)))`

**Example:**
```csl
@activated = soft_gate(0.7, 0.618, 10)
# Returns ~0.85 (smooth transition around φ-1)
```

### Phi-Scale Gate

#### `phi_decision_gate(state, rules) → *`

Makes continuous decision using phi-scale amplification.

**Parameters:**
- `state`: Current state hypervector
- `rules`: Array of {condition, action} pairs

**Returns:** Result of best-matching action

**Example:**
```javascript
// In JavaScript, not pure CSL
gates.phi_decision_gate(stateVector, [
  { condition: 'HIGH_PRIORITY', action: (score) => execute(score) },
  { condition: 'LOW_PRIORITY', action: (score) => queue(score) }
]);
```

## Complete Examples

### Example 1: Task Routing

```csl
# Task routing without if/else
@task_vec = superposition_gate(INPUT, TASK, SEMANTIC)

# Check resonance with each possible agent
@orchestrator_res = resonance_gate($task_vec, ORCHESTRATOR)
@conductor_res = resonance_gate($task_vec, CONDUCTOR)
@agent_res = resonance_gate($task_vec, AGENT)

# Apply soft thresholds (φ-1 = 0.618)
@orch_gate = soft_gate($orchestrator_res, 0.618, 10)
@cond_gate = soft_gate($conductor_res, 0.618, 10)
@agent_gate = soft_gate($agent_res, 0.618, 10)

# All scores computed; highest wins naturally
```

### Example 2: Multi-Criteria Decision

```csl
# Traditional: nested if/else for confidence, priority, load
# CSL: continuous evaluation of all branches

@conf_gate = soft_gate($confidence, 0.8, 10)
@prio_gate = soft_gate($priority, 0.7, 10)
@load_gate = soft_gate(continuous_not($load), 0.5, 10)

# Execute now: high conf AND high prio AND low load
@exec_now = continuous_and($conf_gate, continuous_and($prio_gate, $load_gate))

# Execute later: high conf AND high prio AND high load
@exec_later = continuous_and($conf_gate, continuous_and($prio_gate, continuous_not($load_gate)))

# Queue: high conf AND low prio
@queue_score = continuous_and($conf_gate, continuous_not($prio_gate))

# Reject: low conf
@reject_score = continuous_not($conf_gate)

# All computed; select max or blend
```

### Example 3: Semantic Pattern Matching

```csl
# Create query from input
@input_bundle = superposition_gate($input_a, $input_b, $input_c)

# Find similar patterns in codebook
@matches = query_gate($input_bundle, 0.5, 5)

# Process matches with continuous logic
# (Matches is an array; process in JavaScript)
```

### Example 4: State Machine (Continuous)

```csl
# Traditional state machine has discrete states
# CSL state machine has continuous activation levels

# Define state resonances
@idle_level = resonance_gate($current_state, IDLE_STATE)
@active_level = resonance_gate($current_state, ACTIVE_STATE)
@complete_level = resonance_gate($current_state, COMPLETE_STATE)

# Transition gates (no hard transitions!)
@can_activate = continuous_and($idle_level, $trigger_signal)
@can_complete = continuous_and($active_level, $completion_signal)

# New state is weighted blend
@new_state = superposition_gate(
  # Weighted by activation levels
  # Implementation in JavaScript
)
```

## Best Practices

### 1. Name Variables Descriptively

```csl
# Good
@task_routing_score = resonance_gate($task, ROUTER)

# Bad
@x = resonance_gate($y, Z)
```

### 2. Use Phi-Scale Thresholds

The golden ratio (φ ≈ 1.618) and φ-1 ≈ 0.618 are optimal:

```csl
@gate = soft_gate($value, 0.618, 10)  # Use φ-1
```

### 3. Comment Complex Logic

```csl
# Multi-step decision pipeline
# Step 1: Extract semantic features
@features = superposition_gate(A, B, C)

# Step 2: Match against known patterns
@pattern_match = resonance_gate($features, PATTERN_X)

# Step 3: Apply threshold
@decision = soft_gate($pattern_match, 0.618, 10)
```

### 4. Avoid Deep Nesting

```csl
# Bad: hard to read
@result = continuous_and(soft_gate(continuous_or($a, $b), 0.5, 10), continuous_not($c))

# Good: break into steps
@a_or_b = continuous_or($a, $b)
@gated = soft_gate($a_or_b, 0.5, 10)
@not_c = continuous_not($c)
@result = continuous_and($gated, $not_c)
```

### 5. Use Meaningful Concept Names

Add concepts to codebook with clear names:

```javascript
// In JavaScript setup
codebook.add('HIGH_PRIORITY_TASK', null, { domain: 'orchestration' });
codebook.add('LOW_LATENCY_REQUIRED', null, { domain: 'performance' });
```

Then use in CSL:

```csl
@priority_match = resonance_gate($task, HIGH_PRIORITY_TASK)
@latency_match = resonance_gate($task, LOW_LATENCY_REQUIRED)
```

## Debugging CSL Scripts

### Enable Logging

```javascript
const { logger } = require('./src/utils/logger');
logger.setLevel('debug');
```

### Inspect Intermediate Values

```csl
@step1 = resonance_gate(A, B)
# Check $step1 value in interpreter.getVariable('step1')

@step2 = soft_gate($step1, 0.618, 10)
# Check $step2 value
```

### Visualize Hypervectors

```javascript
const hv = interpreter.getVariable('my_vector');
console.log('Phi-scale:', hv.toPhiScale());
console.log('Truth-value:', hv.toTruthValue());
console.log('Vector:', hv.toString());
```

## Performance Tips

1. **Reuse Codebooks**: Load once, use everywhere
2. **Cache Gate Results**: Store frequently-used computations
3. **Batch Queries**: Query codebook in bulk when possible
4. **Reduce Dimensionality**: Use 2048d for prototyping

## Language Grammar (EBNF)

```ebnf
script          ::= (statement)*
statement       ::= comment | assignment | expression
comment         ::= "#" text newline
assignment      ::= "@" identifier "=" expression
expression      ::= gate_call | variable_ref | concept_ref | number
gate_call       ::= identifier "(" arguments ")"
arguments       ::= expression ("," expression)*
variable_ref    ::= "$" identifier
concept_ref     ::= uppercase_identifier
number          ::= [0-9]+ ("." [0-9]+)?
identifier      ::= [a-z_][a-z0-9_]*
uppercase_id    ::= [A-Z_][A-Z0-9_]*
```

## Future Extensions

Planned CSL language features:

- **Loops**: `@for i in range(10)`
- **Conditionals**: `@if soft_gate($x, 0.618, 10)`
- **Functions**: `@func my_gate(a, b) = ...`
- **Imports**: `@import other_script.csl`
- **Macros**: `@macro THRESHOLD 0.618`
