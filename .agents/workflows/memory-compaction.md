---
description: Memory compaction — prune, deduplicate, and optimize vector memory
---

# 🧹 Memory Compaction Workflow

> Run weekly or when vector memory exceeds capacity thresholds.

## Steps

1. **Assess memory state**

   ```js
   const vectorMemory = require('./src/vector-memory');
   const stats = vectorMemory.getStats();
   console.log(`Total vectors: ${stats.total_vectors}`);
   console.log(`Memory usage: ${stats.memory_mb}MB`);
   ```

2. **Identify duplicates** — Cosine similarity > 0.98 between vectors → merge

3. **Prune stale entries** — Remove telemetry events older than 90 days

4. **Compact episodic memory** — Summarize clusters of similar events into single entries

5. **Reindex** — Rebuild vector indices for optimal query performance

6. **Verify** — Run `queryMemory()` with known test queries to confirm recall quality

7. **Report** — Log compaction results: vectors removed, space reclaimed, recall score
