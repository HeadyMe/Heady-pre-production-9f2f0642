---
description: Concept alignment — validate concepts-index.yaml against actual codebase
---

# 🎯 Concept Alignment Workflow

> Ensures concepts-index.yaml reflects the actual state of the codebase.

## Steps

1. **Load concepts-index.yaml** — Parse all implemented and planned concepts

2. **Validate implemented concepts** — For each `status: active` concept:
   - Check that the `location` files exist
   - Verify the concept's functionality is actually wired in (not dead code)
   - Mark any concepts whose files are missing as `status: orphaned`

3. **Discover undocumented concepts** — Scan for patterns not in the index:
   - New bee domains added since last sync
   - New agent profiles
   - New resilience patterns
   - New security modules

4. **Reconcile planned vs implemented** — Check if any `planned` concepts have been built but not updated

5. **Update concepts-index.yaml** — Add missing entries, update statuses, remove orphans

6. **Validate against skills-registry.yaml** — Ensure skills reference valid concepts

7. **Report** — Alignment score: `implemented_and_documented / total_concepts`
