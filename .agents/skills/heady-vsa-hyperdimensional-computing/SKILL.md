---
name: heady-vsa-hyperdimensional-computing
description: Apply Heady-style vector-symbolic architecture for state machines, associative memory, hypervector binding, bundling, permutation, and similarity-based retrieval. Use when the user mentions VSA, hyperdimensional computing, tensor-native state logic, codebook retrieval, or replacing branch-heavy logic with vector operations.
metadata:
  author: Perplexity Computer
  version: '1.0'
---

# Heady VSA Hyperdimensional Computing

## When to Use This Skill

Use this skill when the user wants to:

- model state transitions with hypervectors
- design associative concept memory
- replace conditional state logic with similarity search
- reason about bind, bundle, permute, and lookup operations
- build VSA-based orchestration or retrieval systems

## Core Pattern

The source pattern uses a codebook of concept hypervectors and a VSA state machine where roles, actions, states, and agents are encoded as hypervectors, then combined with bind, bundle, and temporal permutation before nearest-neighbor retrieval ([engine.py](https://github.com/HeadyMe/Heady-pre-production-9f2f0642/blob/main/src/vsa/engine.py)).

## Instructions

1. Define the vocabulary before implementation.
   - roles
   - states
   - actions
   - agents
   - optional contexts or priorities

2. Use a codebook as associative memory.
   - Each atomic concept gets a stable hypervector.
   - Keep labels and the vector bank aligned for retrieval.

3. Encode structure with role-filler binding.
   - Bind role and value to represent semantic relationships.
   - Bundle multiple bindings into a unified state.
   - Permute when order or temporal position matters.

4. Retrieve by similarity, not if/else chains.
   - Compare the constructed state vector against the codebook.
   - Return nearest known concepts or states.
   - Keep top-k retrieval for inspection and debugging.

5. Log transitions as receipts.
   - step
   - agent
   - action
   - target
   - context
   - latency
   - nearest matches

6. Choose dimensions deliberately.
   - High dimensions improve quasi-orthogonality.
   - Track device choice and library dependencies explicitly.

7. Use unbinding for interpretability.
   - Reverse a role-filler pair to inspect likely fillers.
   - Treat results as approximate and similarity-ranked.

8. Good use cases.
   - orchestration state
   - semantic routing
   - noisy symbolic retrieval
   - pattern-rich workflows where brittle branching becomes unmanageable

9. Poor use cases.
   - exact arithmetic rules
   - low-dimensional deterministic lookup tables
   - systems that require exact symbolic reversal with no approximation

## Output Pattern

Provide:

- Vocabulary design
- Encoding scheme
- Retrieval scheme
- Transition example
- Logging and evaluation plan
- Tradeoffs and failure modes

## Example Prompts

- Replace this branch-heavy state engine with VSA logic
- Design a hypervector codebook for agent routing
- Explain how bind and bundle can model orchestration context
